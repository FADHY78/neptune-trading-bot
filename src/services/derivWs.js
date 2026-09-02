/**
 * Deriv WebSocket Integration Service
 * Endpoint: wss://ws.binaryws.com/websockets/v3?app_id=YOUR_APP_ID
 */

export class DerivService {
  constructor() {
    this.ws = null;
    this.appId = '1089';
    this.token = '';
    this.connected = false;
    this.authorized = false;
    this.accountInfo = null;
    this.balance = 0;
    this.currency = 'USD';
    this.isDemo = true;
    
    this.callbacks = {
      onConnect: [],
      onDisconnect: [],
      onAuthorize: [],
      onBalance: [],
      onTick: [],
      onContractResult: [],
      onError: []
    };

    this.activeSubscriptions = new Map();
    this.reqIdCounter = 1;
    this.pendingRequests = new Map();
  }

  on(event, fn) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(fn);
    }
  }

  off(event, fn) {
    if (this.callbacks[event]) {
      this.callbacks[event] = this.callbacks[event].filter(cb => cb !== fn);
    }
  }

  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => {
        try { cb(data); } catch(e) { console.error(`Error in callback [${event}]:`, e); }
      });
    }
  }

  connect(token, appId = '34hP1yTdG6Hc7grRIWQWH') {
    return new Promise((resolve, reject) => {
      this.appId = appId || '34hP1yTdG6Hc7grRIWQWH';
      this.token = token;

      if (this.ws) {
        this.disconnect();
      }

      const isNumeric = /^\d+$/.test(String(this.appId).trim());
      const wsAppId = isNumeric ? String(this.appId).trim() : '1089';

      const url = `wss://ws.binaryws.com/websockets/v3?app_id=${wsAppId}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.connected = true;
        this.emit('onConnect', { appId: this.appId });

        if (this.token) {
          this.authorize(this.token).then(resolve).catch(reject);
        } else {
          resolve({ connected: true, authorized: false });
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.authorized = false;
        this.emit('onDisconnect', {});
      };

      this.ws.onerror = (err) => {
        this.emit('onError', { message: 'WebSocket Connection Error', details: err });
        reject(err);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.authorized = false;
  }

  send(request) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket is not connected'));
      }

      const reqId = this.reqIdCounter++;
      const payload = { ...request, req_id: reqId };

      this.pendingRequests.set(reqId, { resolve, reject, request: payload });
      this.ws.send(JSON.stringify(payload));
    });
  }

  async authorize(token) {
    this.token = token;
    const res = await this.send({ authorize: token });

    if (res.error) {
      this.authorized = false;
      throw new Error(res.error.message || 'Authorization failed');
    }

    this.authorized = true;
    this.accountInfo = res.authorize;
    this.balance = res.authorize.balance;
    this.currency = res.authorize.currency;
    this.isDemo = Boolean(res.authorize.is_virtual);

    this.emit('onAuthorize', {
      email: res.authorize.email,
      balance: res.authorize.balance,
      currency: res.authorize.currency,
      isVirtual: res.authorize.is_virtual,
      loginid: res.authorize.loginid
    });

    // Subscribe to balance updates
    this.subscribeBalance();

    return res.authorize;
  }

  async subscribeBalance() {
    try {
      await this.send({ balance: 1, subscribe: 1 });
    } catch (e) {
      console.warn('Failed to subscribe to balance', e);
    }
  }

  async subscribeTick(symbol) {
    try {
      const res = await this.send({ ticks: symbol, subscribe: 1 });
      if (res.subscription) {
        this.activeSubscriptions.set(res.subscription.id, { type: 'tick', symbol });
      }
      return res;
    } catch (e) {
      console.error(`Failed to subscribe to tick for ${symbol}`, e);
    }
  }

  async buyContract({ symbol, contractType, stake, barrier, duration = 1 }) {
    if (!this.authorized) {
      throw new Error('Deriv API is not authorized. Enter API Token.');
    }

    const parameters = {
      contract_type: contractType, // 'DIGITDIFF', 'DIGITMATCH', 'DIGITOVER', 'DIGITUNDER'
      symbol: symbol,
      duration: duration,
      duration_unit: 't', // ticks
      basis: 'stake',
      amount: stake,
      currency: this.currency || 'USD'
    };

    if (barrier !== undefined && barrier !== null) {
      parameters.barrier = barrier.toString();
    }

    const res = await this.send({
      buy: 1,
      price: stake,
      parameters
    });

    if (res.error) {
      throw new Error(res.error.message || 'Contract purchase failed');
    }

    const buyInfo = res.buy;
    
    // Subscribe to proposal_open_contract to track result
    this.send({
      proposal_open_contract: 1,
      contract_id: buyInfo.contract_id,
      subscribe: 1
    });

    return buyInfo;
  }

  handleMessage(data) {
    // Fulfill pending promise if matching req_id
    if (data.req_id && this.pendingRequests.has(data.req_id)) {
      const { resolve, reject } = this.pendingRequests.get(data.req_id);
      this.pendingRequests.delete(data.req_id);
      if (data.error) {
        reject(new Error(data.error.message));
      } else {
        resolve(data);
      }
    }

    const msgType = data.msg_type;

    switch (msgType) {
      case 'balance':
        if (data.balance) {
          this.balance = data.balance.balance;
          this.emit('onBalance', {
            balance: data.balance.balance,
            currency: data.balance.currency
          });
        }
        break;

      case 'tick':
        if (data.tick) {
          const rawQuote = data.tick.quote;
          const displayValue = data.tick.display_value || String(rawQuote);
          const lastDigit = parseInt(displayValue.slice(-1), 10);
          
          this.emit('onTick', {
            symbol: data.tick.symbol,
            quote: rawQuote,
            displayValue,
            lastDigit,
            epoch: data.tick.epoch
          });
        }
        break;

      case 'proposal_open_contract':
        if (data.proposal_open_contract) {
          const poc = data.proposal_open_contract;
          if (poc.is_expired || poc.is_sold) {
            const won = poc.status === 'won';
            const profit = poc.profit;
            const exitTick = poc.exit_tick_display_value;
            const exitDigit = exitTick ? parseInt(exitTick.slice(-1), 10) : null;

            this.emit('onContractResult', {
              contractId: poc.contract_id,
              won,
              profit,
              payout: poc.payout,
              buyPrice: poc.buy_price,
              exitTick,
              exitDigit,
              status: poc.status,
              raw: poc
            });
          }
        }
        break;

      default:
        break;
    }
  }
}

export const derivApi = new DerivService();

/**
 * Generate Deriv OAuth 2.0 Authorization URL
 * Official Spec: https://developers.deriv.com/docs/intro/oauth/
 */
export const getDerivOAuthUrl = async (appId = '34hP1yTdG6Hc7grRIWQWH', redirectUri = typeof window !== 'undefined' ? window.location.origin + '/' : 'https://neptune-trading-bot.vercel.app/') => {
  const clientId = appId || '34hP1yTdG6Hc7grRIWQWH';
  
  try {
    // 1. Generate random PKCE code_verifier
    const array = crypto.getRandomValues(new Uint8Array(64));
    const codeVerifier = Array.from(array)
      .map(v => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[v % 66])
      .join('');

    // 2. Derive code_challenge = BASE64URL(SHA256(verifier))
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // 3. Generate CSRF state
    const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // 4. Store in sessionStorage
    sessionStorage.setItem('pkce_code_verifier', codeVerifier);
    sessionStorage.setItem('oauth_state', state);

    // 5. Build official auth.deriv.com URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'trade account_manage',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    return `https://auth.deriv.com/oauth2/auth?${params.toString()}`;
  } catch (e) {
    return `https://auth.deriv.com/oauth2/auth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=trade+account_manage`;
  }
};

/**
 * Parse OAuth redirect tokens or code from URL query string
 */
export const parseDerivOAuthParams = (queryString = typeof window !== 'undefined' ? window.location.search : '') => {
  const searchParams = new URLSearchParams(queryString);

  // PKCE Code Flow Response
  if (searchParams.has('code')) {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const storedState = sessionStorage.getItem('oauth_state');

    return [{
      code,
      state,
      isCodeFlow: true,
      validState: !storedState || state === storedState
    }];
  }

  // Direct Token Query Params (?acct1=...&token1=...)
  const accounts = [];
  let index = 1;
  while (searchParams.has(`acct${index}`)) {
    accounts.push({
      account: searchParams.get(`acct${index}`),
      token: searchParams.get(`token${index}`),
      currency: searchParams.get(`cur${index}`)
    });
    index++;
  }

  return accounts;
};

/**
 * Step 4: Exchange Authorization Code for Access Token via Backend / Serverless Endpoint
 */
export const exchangeCodeForToken = async ({ code, codeVerifier, clientId, redirectUri }) => {
  try {
    const payload = {
      code,
      code_verifier: codeVerifier || sessionStorage.getItem('pkce_code_verifier'),
      client_id: clientId || '34hP1yTdG6Hc7grRIWQWH',
      redirect_uri: redirectUri || (typeof window !== 'undefined' ? window.location.origin + '/' : 'https://neptune-trading-bot.vercel.app/')
    };

    const res = await fetch('/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    
    // Clear PKCE storage after exchange
    sessionStorage.removeItem('pkce_code_verifier');
    sessionStorage.removeItem('oauth_state');

    if (!res.ok) {
      throw new Error(data.error_description || data.error || 'Token exchange failed');
    }

    return data; // { access_token, expires_in, token_type }
  } catch (err) {
    sessionStorage.removeItem('pkce_code_verifier');
    sessionStorage.removeItem('oauth_state');
    throw err;
  }
};




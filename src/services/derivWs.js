/**
 * Deriv WebSocket Integration Service
 * Endpoint: wss://ws.binaryws.com/websockets/v3?app_id=YOUR_APP_ID
 */

export class DerivService {
  constructor() {
    this.ws = null;
    this.appId = '34hP1yTdG6Hc7grRIWQWH';
    this.token = '';
    this.connected = false;
    this.authorized = false;
    this.accountInfo = null;
    this.accountList = [];
    this.loginid = '';
    this.balance = 0;
    this.currency = 'USD';
    this.isDemo = true;
    this.availableSymbols = [];
    
    this.callbacks = {
      onConnect: [],
      onDisconnect: [],
      onAuthorize: [],
      onBalance: [],
      onTick: [],
      onContractResult: [],
      onSymbols: [],
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
      const wsAppId = isNumeric ? String(this.appId).trim() : (this.appId || '34hP1yTdG6Hc7grRIWQWH');

      const url = `wss://ws.derivws.com/websockets/v3?app_id=${wsAppId}`;
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
    this.loginid = res.authorize.loginid || '';
    this.balance = res.authorize.balance || 0;
    this.currency = res.authorize.currency || 'USD';
    this.isDemo = Boolean(res.authorize.is_virtual);
    
    // Parse account list (Real and Demo accounts associated with this user)
    const rawAccountList = res.authorize.account_list || [];
    this.accountList = rawAccountList.map(acc => ({
      loginid: acc.loginid,
      currency: acc.currency,
      isVirtual: Boolean(acc.is_virtual),
      disabled: Boolean(acc.is_disabled),
      landingCompany: acc.landing_company_name,
      token: acc.token || '' // present in multi-token responses
    }));

    this.emit('onAuthorize', {
      email: res.authorize.email,
      balance: res.authorize.balance,
      currency: res.authorize.currency,
      isVirtual: res.authorize.is_virtual,
      loginid: res.authorize.loginid,
      fullname: res.authorize.fullname,
      accountList: this.accountList
    });

    // Subscribe to balance updates
    this.subscribeBalance();

    // Fetch active symbols dynamically from Deriv
    this.fetchActiveSymbols();

    return res.authorize;
  }

  async fetchActiveSymbols() {
    try {
      const res = await this.send({
        active_symbols: 'brief',
        product_type: 'basic'
      });

      if (res && res.active_symbols) {
        // Filter synthetic & available volatility / jump / crash symbols
        const symbols = res.active_symbols.map(s => ({
          symbol: s.symbol,
          name: s.display_name,
          market: s.market,
          marketDisplayName: s.market_display_name,
          submarket: s.submarket,
          submarketDisplayName: s.submarket_display_name,
          category: s.submarket_display_name || s.market_display_name || 'Synthetics',
          isOpen: Boolean(s.exchange_is_open)
        }));

        this.availableSymbols = symbols;
        this.emit('onSymbols', symbols);
        return symbols;
      }
    } catch (e) {
      console.warn('Could not fetch active symbols, using fallback catalog:', e);
    }
    return [];
  }

  async switchAccount(targetLoginId, targetToken = null) {
    // If a token is provided directly, authorize with it
    if (targetToken) {
      return this.authorize(targetToken);
    }

    // Check if account is in accountList with a token
    const matched = this.accountList.find(a => a.loginid === targetLoginId);
    if (matched && matched.token) {
      return this.authorize(matched.token);
    }

    // In Deriv WS, we can also try reconnecting or calling authorize
    this.loginid = targetLoginId;
    if (matched) {
      this.currency = matched.currency;
      this.isDemo = matched.isVirtual;
    }
    return matched;
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
 * Step 1: Generate PKCE Parameters (code_verifier, code_challenge, state)
 */
export const generatePKCE = async () => {
  // 1. Generate a random code_verifier (64 bytes -> random unguessable string)
  const array = crypto.getRandomValues(new Uint8Array(64));
  const codeVerifier = Array.from(array)
    .map(v => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[v % 66])
    .join('');

  // 2. Derive the code_challenge = BASE64URL(SHA256(code_verifier))
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // 3. Generate a random state for CSRF protection
  const state = crypto.getRandomValues(new Uint8Array(16))
    .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');

  // 4. Store code_verifier and state in sessionStorage before redirecting
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('pkce_code_verifier', codeVerifier);
    sessionStorage.setItem('oauth_state', state);
  }

  return { codeVerifier, codeChallenge, state };
};

/**
 * Step 2: Build Deriv OAuth 2.0 Authorization Endpoint URL (Login or Sign Up with PKCE)
 * Endpoint: https://auth.deriv.com/oauth2/auth
 */
export const getDerivOAuth2Url = async ({
  clientId = '34hP1yTdG6Hc7grRIWQWH',
  redirectUri = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '',
  scope = 'trade account_manage',
  isSignUp = false,
  tracking = {}
} = {}) => {
  const { codeChallenge, state } = await generatePKCE();

  const cleanClientId = String(clientId || '34hP1yTdG6Hc7grRIWQWH').trim();
  const cleanRedirectUri = redirectUri || (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cleanClientId,
    redirect_uri: cleanRedirectUri,
    scope: scope,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  if (isSignUp) {
    params.set('prompt', 'registration');
    const trackToken = tracking.t || tracking.affiliate_token || tracking.sidi || tracking.ca;
    if (trackToken) params.set('t', trackToken);
    if (tracking.utm_campaign) params.set('utm_campaign', tracking.utm_campaign);
    if (tracking.utm_medium) params.set('utm_medium', tracking.utm_medium);
    if (tracking.utm_source) params.set('utm_source', tracking.utm_source);
  }

  return `https://auth.deriv.com/oauth2/auth?${params.toString()}`;
};

// Backwards compatibility alias
export const getDerivOAuthUrl = getDerivOAuth2Url;

/**
 * Step 3: Handle OAuth Callback URL Parameters
 */
export const parseDerivOAuthParams = (queryString = typeof window !== 'undefined' ? window.location.search : '') => {
  if (!queryString) return { accounts: [], isCodeFlow: false };
  const searchParams = new URLSearchParams(queryString);

  // Check for error in callback
  if (searchParams.has('error')) {
    return {
      error: searchParams.get('error'),
      errorDescription: searchParams.get('error_description') || searchParams.get('error'),
      accounts: [],
      isCodeFlow: false
    };
  }

  // PKCE Authorization Code flow callback: ?code=...&state=...
  if (searchParams.has('code')) {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const storedState = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('oauth_state') : null;

    return {
      isCodeFlow: true,
      code,
      state,
      validState: !storedState || state === storedState,
      accounts: []
    };
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

  return { accounts, isCodeFlow: false };
};

/**
 * Step 4: Exchange Authorization Code for Access Token via /api/token backend endpoint
 */
export const exchangeCodeForToken = async ({ code, codeVerifier, clientId, redirectUri }) => {
  const verifier = codeVerifier || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('pkce_code_verifier') : '');
  const activeClientId = clientId || '34hP1yTdG6Hc7grRIWQWH';
  const callbackUri = redirectUri || (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');

  try {
    const payload = {
      code,
      code_verifier: verifier,
      client_id: activeClientId,
      redirect_uri: callbackUri
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
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('pkce_code_verifier');
      sessionStorage.removeItem('oauth_state');
    }

    if (!res.ok) {
      throw new Error(data.error_description || data.error || 'Token exchange failed');
    }

    return data; // { access_token, expires_in, token_type }
  } catch (err) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('pkce_code_verifier');
      sessionStorage.removeItem('oauth_state');
    }
    throw err;
  }
};




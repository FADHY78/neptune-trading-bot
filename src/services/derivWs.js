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

    this.isServerSession = false;
    this.eventSource = null;

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

  /**
   * Connect to Server-Sent Events (SSE) market stream
   */
  connectSSE(symbol = '1HZ100V') {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    const sseUrl = `/api/deriv/market/ticks?symbol=${encodeURIComponent(symbol)}`;
    this.eventSource = new EventSource(sseUrl);

    this.eventSource.addEventListener('authorized', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.authorized = true;
        this.connected = true;
        this.loginid = data.loginid;
        this.balance = data.balance;
        this.currency = data.currency;
        this.isDemo = Boolean(data.isVirtual);
        this.emit('onAuthorize', data);
      } catch (e) {}
    });

    this.eventSource.addEventListener('balance', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.balance = data.balance;
        this.currency = data.currency;
        this.emit('onBalance', data);
      } catch (e) {}
    });

    this.eventSource.addEventListener('tick', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit('onTick', data);
      } catch (e) {}
    });

    this.eventSource.onerror = (err) => {
      console.warn('SSE Market connection warning, retrying...');
    };

    this.connected = true;
    this.emit('onConnect', { sse: true });
    return this.eventSource;
  }

  /**
   * Connect browser to Deriv WebSocket for zero-latency public market feed.
   * Resolves once the socket is open. Concurrent callers share one attempt.
   */
  connectPublicWs() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this._connectionPromise) return this._connectionPromise;

    this._connectionPromise = new Promise((resolve, reject) => {
      const url = `wss://ws.derivws.com/websockets/v3?app_id=1089`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.connected = true;
        this._connectionPromise = null;
        this.emit('onConnect', { appId: '1089', publicFeed: true });

        // Replay queued subscriptions IMMEDIATELY — don't wait for active_symbols
        const queued = this._pendingSubscriptions || [];
        this._pendingSubscriptions = [];
        queued.forEach(sym => this._doSubscribe(sym));

        // Fetch active symbols in background (for UI display only)
        this.fetchActiveSymbols();

        resolve();
      };

      this.ws.onclose = () => {
        this.connected = false;
        this._connectionPromise = null;
        // Auto-reconnect after 3s, re-subscribe last symbol
        setTimeout(() => {
          this.connectPublicWs().then(() => {
            if (this._lastSubscribedSymbol) {
              this._doSubscribe(this._lastSubscribedSymbol);
            }
          });
        }, 3000);
      };

      this.ws.onerror = (err) => {
        console.warn('[DerivWS] WebSocket error:', err);
        this._connectionPromise = null;
        reject(err);
      };

      this.ws.onmessage = (event) => {
        try {
          this.handleMessage(JSON.parse(event.data));
        } catch (e) {
          console.error('[DerivWS] Message parse error:', e);
        }
      };
    });

    return this._connectionPromise;
  }

  /**
   * Check if user is authenticated via server HTTP-only session cookie
   */
  async checkServerSession() {
    try {
      const res = await fetch('/api/deriv/auth/status', { credentials: 'include' });
      const data = await res.json();
      if (data.authenticated && data.activeAccount) {
        this.isServerSession = true;
        this.authorized = true;
        this.connected = true;
        this.loginid = data.activeAccount.loginid;
        this.isDemo = Boolean(data.activeAccount.isVirtual);
        this.currency = data.activeAccount.currency || 'USD';
        this.balance = data.activeAccount.balance || 0;
        this.accountList = data.accounts || [];

        this.emit('onAuthorize', {
          loginid: this.loginid,
          isVirtual: this.isDemo,
          currency: this.currency,
          balance: this.balance,
          accountList: this.accountList
        });

        this.emit('onBalance', {
          balance: this.balance,
          currency: this.currency
        });

        // Connect public WebSocket for real-time market ticks & active symbols
        // The onSymbols event will trigger initial tick subscription once symbols are validated
        await this.connectPublicWs();

        return { authenticated: true, activeAccount: data.activeAccount, accounts: data.accounts };
      }
    } catch (e) {
      console.warn('Could not check server session:', e);
    }
    return { authenticated: false };
  }

  /**
   * Switch account on backend session
   */
  async switchServerAccount(loginid) {
    const res = await fetch('/api/deriv/account/switch', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginid })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to switch account');

    this.loginid = data.activeAccount.loginid;
    this.isDemo = data.activeAccount.isVirtual;
    this.currency = data.activeAccount.currency;
    this.balance = data.activeAccount.balance || 0;

    this.emit('onAuthorize', {
      loginid: this.loginid,
      isVirtual: this.isDemo,
      currency: this.currency,
      balance: this.balance,
      accountList: this.accountList
    });

    this.emit('onBalance', {
      balance: this.balance,
      currency: this.currency
    });

    return data;
  }

  /**
   * Log out and clear server HTTP-only cookies
   */
  async logoutServer() {
    try {
      await fetch('/api/deriv/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {}
    this.disconnect();
    this.isServerSession = false;
    this.authorized = false;
    this.connected = false;
    this.loginid = '';
    this.accountList = [];
    this.balance = 0;
  }

  connect(token, appId = '1089') {
    return new Promise((resolve, reject) => {
      this.appId = appId || '1089';
      this.token = token;

      if (this.ws) {
        this.disconnect();
      }

      const isNumeric = /^\d+$/.test(String(this.appId).trim());
      const wsAppId = isNumeric ? String(this.appId).trim() : '1089';

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
    this.stopSimulatedTickStream();
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
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
    let cleanToken = String(token || '').trim();
    if (cleanToken.startsWith('Bearer ')) {
      cleanToken = cleanToken.slice(7).trim();
    }
    this.token = cleanToken;
    const res = await this.send({ authorize: cleanToken });

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
      // Deriv API: active_symbols request (no product_type needed for brief)
      const res = await this.send({ active_symbols: 'brief' });

      if (res && Array.isArray(res.active_symbols) && res.active_symbols.length > 0) {
        // Map correct Deriv API field names (from the API docs):
        //   underlying_symbol      → the tradeable symbol code (e.g. "1HZ100V", "R_100")
        //   underlying_symbol_name → human display name
        //   pip_size               → minimum price fluctuation (used for digit extraction)
        //   exchange_is_open       → 1 = open, 0 = closed
        const symbols = res.active_symbols.map(s => ({
          symbol: s.underlying_symbol,
          name: s.underlying_symbol_name,
          market: s.market,
          submarket: s.submarket,
          category: s.submarket || s.market || 'Synthetics',
          isOpen: s.exchange_is_open === 1,
          isSuspended: s.is_trading_suspended === 1,
          // pip_size from Deriv is the raw fluctuation (e.g. 0.01)
          // Convert to decimal places count: 0.01→2, 0.001→3, 0.0001→4
          pipSize: s.pip_size < 1
            ? Math.round(-Math.log10(Number(s.pip_size) || 0.01))
            : 2
        }));

        this.availableSymbols = symbols;
        this.emit('onSymbols', symbols);
        return symbols;
      }
    } catch (e) {
      console.warn('[DerivWS] fetchActiveSymbols failed:', e.message || e);
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

  async forgetAllTicks() {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        await this.send({ forget_all: 'ticks' }).catch(() => {});
      }
      this.activeSubscriptions.clear();
    } catch (e) {
      console.warn('Error clearing tick subscriptions:', e);
    }
  }

  async fetchTicksHistory(symbol, count = 300) {
    try {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        await this.connectPublicWs();
      }
      return await this.send({
        ticks_history: symbol,
        adjust_start_time: 1,
        count: Number(count) || 300,
        end: 'latest',
        start: 1,
        style: 'ticks'
      });
    } catch (e) {
      console.warn(`Failed to fetch ticks_history for ${symbol}`, e);
    }
  }

  /**
   * Stop any active simulated tick stream
   */
  stopSimulatedTickStream() {
    if (this._simInterval) {
      clearInterval(this._simInterval);
      this._simInterval = null;
    }
  }

  /**
   * High-fidelity live market simulator fallback.
   * Runs whenever Deriv WebSocket rejects unauthenticated tick requests,
   * ensuring the UI metrics (Current Digit, Live Price, Total Ticks, Volatility)
   * are active and continuous until the user connects an authorized API Token.
   */
  startSimulatedTickStream(symbol = '1HZ100V', count = 300) {
    this.stopSimulatedTickStream();

    const sym = symbol || '1HZ100V';
    const basePrices = {
      '1HZ10V': 7450.25,
      '1HZ15V': 3120.40,
      '1HZ25V': 2450.80,
      '1HZ30V': 5600.15,
      '1HZ50V': 350.450,
      '1HZ75V': 104250.30,
      '1HZ90V': 89200.60,
      '1HZ100V': 2049.46,
      '1HZ150V': 850.12,
      '1HZ250V': 1420.75,
      'R_10': 7450.25,
      'R_25': 2450.80,
      'R_50': 350.450,
      'R_75': 104250.30,
      'R_100': 2049.46,
      'frxEURUSD': 1.08542
    };

    const pipSizes = {
      '1HZ10V': 3,
      '1HZ15V': 3,
      '1HZ25V': 3,
      '1HZ30V': 3,
      '1HZ50V': 4,
      '1HZ75V': 4,
      '1HZ90V': 4,
      '1HZ100V': 2,
      '1HZ150V': 2,
      '1HZ250V': 2,
      'R_10': 3,
      'R_25': 3,
      'R_50': 4,
      'R_75': 4,
      'R_100': 2,
      'frxEURUSD': 5
    };

    const pipSize = pipSizes[sym] || (sym.includes('50') || sym.includes('75') ? 4 : (sym.includes('100') ? 2 : 3));
    let currentPrice = basePrices[sym] || 2049.46;

    // Generate 300 historical prices
    const histPrices = [];
    const histDigits = [];
    let p = currentPrice;
    const volatilityStep = (p * 0.0003);

    for (let i = 0; i < count; i++) {
      const delta = (Math.random() - 0.495) * volatilityStep;
      p = Math.max(0.01, p + delta);
      histPrices.push(Number(p.toFixed(pipSize)));
      const disp = p.toFixed(pipSize);
      histDigits.push(parseInt(disp.slice(-1), 10));
    }

    currentPrice = p;

    // Emit initial historical batch
    this.emit('onTickHistory', {
      symbol: sym,
      digits: histDigits,
      prices: histPrices,
      pipSize
    });

    // Start live interval emitting 1 tick per second
    this._simInterval = setInterval(() => {
      const delta = (Math.random() - 0.495) * volatilityStep;
      currentPrice = Math.max(0.01, currentPrice + delta);
      const displayValue = currentPrice.toFixed(pipSize);
      const lastDigit = parseInt(displayValue.slice(-1), 10);

      this.emit('onTick', {
        symbol: sym,
        quote: currentPrice,
        displayValue,
        lastDigit: isNaN(lastDigit) ? 0 : lastDigit,
        pipSize,
        epoch: Math.floor(Date.now() / 1000),
        isSimulated: true
      });
    }, 1000);
  }

  /**
   * Public entry point: subscribe to tick stream with automatic fallback.
   */
  async subscribeTick(symbol, count = 300) {
    if (!symbol) return;
    this._lastSubscribedSymbol = symbol;

    // Queue if socket not open yet
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (!this._pendingSubscriptions) this._pendingSubscriptions = [];
      if (!this._pendingSubscriptions.includes(symbol)) this._pendingSubscriptions.push(symbol);
      this.connectPublicWs().catch(() => {
        this.startSimulatedTickStream(symbol, count);
      });
      return;
    }

    return this._doSubscribe(symbol, count);
  }

  /**
   * Internal: send ticks_history + ticks subscribe requests.
   */
  async _doSubscribe(symbol, count = 300) {
    this._lastSubscribedSymbol = symbol;
    try {
      // 1. Fetch historical ticks
      this.send({
        ticks_history: symbol,
        adjust_start_time: 1,
        count: Number(count) || 300,
        end: 'latest',
        start: 1,
        style: 'ticks'
      }).catch(() => {
        this.startSimulatedTickStream(symbol, count);
      });

      // 2. Subscribe to live tick stream
      const res = await this.send({ ticks: symbol, subscribe: 1 });
      if (res && res.subscription) {
        this.stopSimulatedTickStream();
        this.activeSubscriptions.set(res.subscription.id, { type: 'tick', symbol });
        console.info(`[DerivWS] ✅ Subscribed to ${symbol} (id: ${res.subscription.id})`);
      }
      return res;
    } catch (e) {
      // If Deriv server rejects (e.g. unauthenticated regional restriction or InvalidSymbol), activate high-fidelity fallback immediately
      this.startSimulatedTickStream(symbol, count);
    }
  }

  async buyContract({ symbol, contractType, stake, barrier, duration = 1 }) {
    // 1. Prioritize direct WebSocket trade execution when token is authorized
    if (this.authorized && this.token) {
      const parameters = {
        contract_type: String(contractType),
        underlying_symbol: String(symbol),
        duration: Number(duration) || 1,
        duration_unit: 't',
        basis: 'stake',
        amount: Number(stake),
        currency: String(this.currency || 'USD')
      };

      if (barrier !== undefined && barrier !== null && String(barrier).trim() !== '') {
        parameters.barrier = String(barrier).trim();
      }

      const res = await this.send({
        buy: "1",
        price: Number(stake),
        parameters
      });

      if (res.error) {
        throw new Error(res.error.message || 'Contract purchase failed');
      }

      const buyInfo = res.buy;
      this.activeContract = {
        id: buyInfo.contract_id,
        buyPrice: buyInfo.buy_price,
        payout: buyInfo.payout,
        symbol,
        contractType,
        startTime: Date.now()
      };

      // Subscribe to proposal open contract for this trade
      this.send({
        proposal_open_contract: 1,
        contract_id: buyInfo.contract_id,
        subscribe: 1
      });

      return buyInfo;
    }

    // 2. Otherwise if authenticated via secure backend session
    if (this.isServerSession) {
      const res = await fetch('/api/deriv/trade/buy', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, contractType, stake, barrier, duration })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server trade execution failed');
      }
      this.emit('onContractResult', data);
      return {
        contract_id: data.contractId,
        ...data
      };
    }

    if (!this.authorized) {
      throw new Error('Deriv API is not authorized. Enter API Token or Log in with Deriv.');
    }

    const parameters = {
      contract_type: contractType, // 'DIGITDIFF', 'DIGITMATCH', 'DIGITOVER', 'DIGITUNDER', 'DIGITEVEN', 'DIGITODD'
      symbol: symbol,
      duration: duration,
      duration_unit: 't', // ticks
      basis: 'stake',
      amount: stake,
      currency: this.currency || 'USD'
    };

    if (barrier !== undefined && barrier !== null && contractType !== 'DIGITEVEN' && contractType !== 'DIGITODD') {
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
          this.stopSimulatedTickStream();
          const rawQuote = data.tick.quote;
          const pipSize = data.tick.pip_size !== undefined ? Number(data.tick.pip_size) : 4;
          const displayValue = data.tick.display_value || (typeof rawQuote === 'number' ? rawQuote.toFixed(pipSize) : String(rawQuote));
          const lastDigit = parseInt(displayValue.slice(-1), 10);
          
          this.emit('onTick', {
            symbol: data.tick.symbol,
            quote: rawQuote,
            displayValue,
            lastDigit: isNaN(lastDigit) ? 0 : lastDigit,
            pipSize,
            epoch: data.tick.epoch,
            bid: data.tick.bid,
            ask: data.tick.ask
          });
        }
        break;

      case 'history':
        if (data.history && Array.isArray(data.history.prices)) {
          const pipSize = data.pip_size !== undefined ? Number(data.pip_size) : (data.history.pip_size !== undefined ? Number(data.history.pip_size) : 4);
          const digits = data.history.prices.map(p => {
            const str = typeof p === 'number' ? p.toFixed(pipSize) : String(p);
            return parseInt(str.slice(-1), 10);
          }).filter(d => !isNaN(d));

          this.emit('onTickHistory', {
            symbol: data.echo_req?.ticks_history,
            digits,
            prices: data.history.prices,
            pipSize
          });
        }
        break;

      case 'proposal_open_contract':
        if (data.proposal_open_contract) {
          const poc = data.proposal_open_contract;
          const isCompleted = poc.status === 'won' || poc.status === 'lost' || (poc.is_settleable === 1 && poc.status !== 'open') || (Boolean(poc.is_expired) && poc.status !== 'open');

          if (isCompleted) {
            const won = poc.status === 'won' || Number(poc.profit) > 0;
            const profit = Number(poc.profit) || 0;
            const exitTick = poc.exit_tick_display_value || (poc.exit_tick !== undefined ? String(poc.exit_tick) : (poc.current_spot_display_value || (poc.current_spot !== undefined ? String(poc.current_spot) : '')));
            const exitDigit = exitTick ? parseInt(String(exitTick).slice(-1), 10) : (poc.barrier !== undefined ? parseInt(String(poc.barrier), 10) : null);

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
  isSignUp = false,
  redirectUri = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : ''
} = {}) => {
  const params = new URLSearchParams();
  if (isSignUp) params.set('signup', 'true');
  if (clientId && clientId !== '34hP1yTdG6Hc7grRIWQWH') params.set('client_id', clientId);
  if (redirectUri) params.set('redirect_uri', redirectUri);
  return `/api/deriv/oauth/start${params.toString() ? `?${params.toString()}` : ''}`;
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




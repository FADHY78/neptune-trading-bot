import crypto from 'crypto';

// Secret key for signing HTTP-only cookies
const SESSION_SECRET = process.env.DERIV_SESSION_SECRET || 'neptune_deriv_secret_key_digit_atlas_2026';
const DERIV_APP_ID = process.env.DERIV_APP_ID || '34hP1yTdG6Hc7grRIWQWH';
const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`;

/**
 * Cookie signing & verification helpers
 */
export function signValue(val) {
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(val).digest('hex');
  return `${Buffer.from(val).toString('base64url')}.${hmac}`;
}

export function unsignValue(signedVal) {
  if (!signedVal || typeof signedVal !== 'string') return null;
  const parts = signedVal.split('.');
  if (parts.length !== 2) return null;
  const [b64, hmac] = parts;
  try {
    const raw = Buffer.from(b64, 'base64url').toString('utf8');
    const expectedHmac = crypto.createHmac('sha256', SESSION_SECRET).update(raw).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
      return raw;
    }
  } catch (e) {
    return null;
  }
  return null;
}

export function parseCookies(req) {
  const cookieHeader = req.headers?.cookie || '';
  const cookies = {};
  cookieHeader.split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=');
    if (k) cookies[k] = decodeURIComponent(v.join('='));
  });
  return cookies;
}

export function createSetCookieHeader(name, value, { maxAge = 86400, httpOnly = true, sameSite = 'Lax', path = '/' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  if (httpOnly) parts.push('HttpOnly');
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  if (path) parts.push(`Path=${path}`);
  return parts.join('; ');
}

/**
 * Helper to execute a quick one-shot Deriv WebSocket command
 */
export async function sendDerivWsCommand(requests, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(DERIV_WS_URL);
    const results = [];
    const timer = setTimeout(() => {
      try { ws.close(); } catch(e) {}
      reject(new Error('Deriv WS command timeout'));
    }, timeoutMs);

    ws.onopen = () => {
      const payload = Array.isArray(requests) ? requests : [requests];
      payload.forEach((req, idx) => {
        ws.send(JSON.stringify({ ...req, req_id: idx + 1 }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        results.push(data);
        const expectedCount = Array.isArray(requests) ? requests.length : 1;
        if (results.length >= expectedCount || data.error) {
          clearTimeout(timer);
          ws.close();
          if (data.error) {
            reject(new Error(data.error.message || 'Deriv WS error'));
          } else {
            resolve(Array.isArray(requests) ? results : results[0]);
          }
        }
      } catch (e) {
        clearTimeout(timer);
        ws.close();
        reject(e);
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timer);
      reject(new Error('WebSocket connection error: ' + (err.message || 'unknown')));
    };
  });
}

/**
 * Deriv Auth & Proxy Controllers
 */

// 1. GET /api/deriv/oauth/start
export function handleOAuthStart(req, res, urlObj) {
  const isSignUp = urlObj.searchParams.get('signup') === 'true';
  const customClientId = urlObj.searchParams.get('client_id') || DERIV_APP_ID;
  
  // Host detection for callback
  const protocol = req.headers['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = `${protocol}://${host}/callback`;

  // Cryptographic PKCE Generation
  const verifierBytes = crypto.randomBytes(48);
  const codeVerifier = verifierBytes.toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const state = crypto.randomBytes(16).toString('hex');

  // Sign State Cookie
  const statePayload = JSON.stringify({ state, codeVerifier, redirectUri, createdAt: Date.now() });
  const signedCookie = signValue(statePayload);

  // Set-Cookie: deriv_oauth_state (10 min expiry)
  res.setHeader('Set-Cookie', createSetCookieHeader('deriv_oauth_state', signedCookie, { maxAge: 600 }));

  // Build Deriv OAuth Redirect URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: customClientId,
    redirect_uri: redirectUri,
    scope: 'trade account_manage',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  if (isSignUp) {
    params.set('prompt', 'registration');
  }

  const derivAuthUrl = `https://auth.deriv.com/oauth2/auth?${params.toString()}`;
  res.statusCode = 302;
  res.setHeader('Location', derivAuthUrl);
  res.end();
}

// 2. GET /callback (or /api/deriv/oauth/callback)
export async function handleOAuthCallback(req, res, urlObj) {
  const code = urlObj.searchParams.get('code');
  const state = urlObj.searchParams.get('state');
  const error = urlObj.searchParams.get('error');
  const errorDesc = urlObj.searchParams.get('error_description');

  if (error) {
    res.statusCode = 302;
    res.setHeader('Location', `/?error=${encodeURIComponent(errorDesc || error)}`);
    res.end();
    return;
  }

  if (!code || !state) {
    res.statusCode = 302;
    res.setHeader('Location', '/?error=missing_oauth_code_or_state');
    res.end();
    return;
  }

  // Validate state from cookie
  const cookies = parseCookies(req);
  const stateCookieRaw = unsignValue(cookies.deriv_oauth_state);
  if (!stateCookieRaw) {
    res.statusCode = 302;
    res.setHeader('Location', '/?error=invalid_or_expired_oauth_state');
    res.end();
    return;
  }

  let stateData;
  try {
    stateData = JSON.parse(stateCookieRaw);
  } catch (e) {
    res.statusCode = 302;
    res.setHeader('Location', '/?error=corrupted_oauth_state');
    res.end();
    return;
  }

  if (stateData.state !== state) {
    res.statusCode = 302;
    res.setHeader('Location', '/?error=state_mismatch_csrf_detected');
    res.end();
    return;
  }

  try {
    // Exchange Code for Access Token
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: DERIV_APP_ID,
      code: code,
      code_verifier: stateData.codeVerifier,
      redirect_uri: stateData.redirectUri
    });

    const tokenRes = await fetch('https://auth.deriv.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString()
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      const errMsg = tokenData.error_description || tokenData.error || 'Token exchange failed';
      res.statusCode = 302;
      res.setHeader('Location', `/?error=${encodeURIComponent(errMsg)}`);
      res.end();
      return;
    }

    const accessToken = tokenData.access_token;

    // Account Discovery via Deriv WebSocket authorize
    let authInfo = null;
    try {
      const authRes = await sendDerivWsCommand({ authorize: accessToken });
      authInfo = authRes.authorize;
    } catch (authErr) {
      console.warn('Deriv WS authorize discovery note:', authErr.message);
    }

    // Process accounts (prioritize Demo accounts over Real as per Digit Atlas logic)
    const rawAccountList = authInfo?.account_list || [];
    const accounts = rawAccountList.map(a => ({
      loginid: a.loginid,
      currency: a.currency,
      isVirtual: Boolean(a.is_virtual),
      disabled: Boolean(a.is_disabled),
      token: a.token || (a.loginid === authInfo?.loginid ? accessToken : '')
    }));

    // Prioritize Virtual/Demo account
    accounts.sort((a, b) => (b.isVirtual ? 1 : 0) - (a.isVirtual ? 1 : 0));
    const activeAcc = accounts[0] || {
      loginid: authInfo?.loginid || 'VRTC_DEMO',
      currency: authInfo?.currency || 'USD',
      isVirtual: Boolean(authInfo?.is_virtual ?? true)
    };

    // Store Session in signed HTTP-only cookie
    const sessionPayload = JSON.stringify({
      accessToken: accessToken,
      activeLoginid: activeAcc.loginid,
      isVirtual: activeAcc.isVirtual,
      currency: activeAcc.currency,
      accounts: accounts,
      createdAt: Date.now(),
      expiresIn: tokenData.expires_in || 86400
    });

    const signedSession = signValue(sessionPayload);

    // Clear state cookie & set session cookie (7 days max age)
    res.setHeader('Set-Cookie', [
      createSetCookieHeader('deriv_access_session', signedSession, { maxAge: 7 * 86400 }),
      createSetCookieHeader('deriv_oauth_state', '', { maxAge: 0 })
    ]);

    // Redirect to home dashboard cleanly
    res.statusCode = 302;
    res.setHeader('Location', '/?login=success');
    res.end();
  } catch (err) {
    console.error('Deriv OAuth callback error:', err);
    res.statusCode = 302;
    res.setHeader('Location', `/?error=${encodeURIComponent(err.message)}`);
    res.end();
  }
}

// 3. GET /api/deriv/auth/status
export async function handleAuthStatus(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const cookies = parseCookies(req);
  const sessionRaw = unsignValue(cookies.deriv_access_session);

  if (!sessionRaw) {
    res.statusCode = 200;
    res.end(JSON.stringify({
      authenticated: false,
      activeAccount: null,
      accounts: []
    }));
    return;
  }

  try {
    const session = JSON.parse(sessionRaw);

    // Refresh balance and status via quick Deriv WS authorize
    let liveBalance = 0;
    try {
      const authRes = await sendDerivWsCommand({ authorize: session.accessToken }, 3500);
      liveBalance = authRes.authorize?.balance ?? 0;
    } catch (e) {
      // If token expired or network hiccup, keep previous state
    }

    res.statusCode = 200;
    res.end(JSON.stringify({
      authenticated: true,
      activeAccount: {
        loginid: session.activeLoginid,
        isVirtual: session.isVirtual,
        currency: session.currency,
        balance: liveBalance
      },
      accounts: session.accounts.map(a => ({
        loginid: a.loginid,
        currency: a.currency,
        isVirtual: a.isVirtual,
        disabled: a.disabled
      }))
    }));
  } catch (e) {
    res.statusCode = 200;
    res.end(JSON.stringify({ authenticated: false, error: 'Malformed session' }));
  }
}

// 4. POST /api/deriv/account/switch
export async function handleAccountSwitch(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const cookies = parseCookies(req);
  const sessionRaw = unsignValue(cookies.deriv_access_session);

  if (!sessionRaw) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: 'Unauthorized: No active session' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const { loginid } = JSON.parse(body || '{}');
      const session = JSON.parse(sessionRaw);
      const target = session.accounts.find(a => a.loginid === loginid);

      if (!target) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Account not found in session account list' }));
        return;
      }

      session.activeLoginid = target.loginid;
      session.isVirtual = target.isVirtual;
      session.currency = target.currency;
      if (target.token) {
        session.accessToken = target.token;
      }

      const updatedCookie = signValue(JSON.stringify(session));
      res.setHeader('Set-Cookie', createSetCookieHeader('deriv_access_session', updatedCookie, { maxAge: 7 * 86400 }));
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        activeAccount: {
          loginid: target.loginid,
          isVirtual: target.isVirtual,
          currency: target.currency
        }
      }));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
  });
}

// 5. POST /api/deriv/auth/logout
export function handleLogout(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Set-Cookie', [
    createSetCookieHeader('deriv_access_session', '', { maxAge: 0 }),
    createSetCookieHeader('deriv_oauth_state', '', { maxAge: 0 })
  ]);
  res.statusCode = 200;
  res.end(JSON.stringify({ success: true }));
}

// 6. GET /api/deriv/market/ticks (SSE - Server-Sent Events tick stream)
export function handleMarketTicksSSE(req, res, urlObj) {
  const symbol = urlObj.searchParams.get('symbol') || '1HZ100V';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Inspect session
  const cookies = parseCookies(req);
  const sessionRaw = unsignValue(cookies.deriv_access_session);
  let session = null;
  if (sessionRaw) {
    try { session = JSON.parse(sessionRaw); } catch(e) {}
  }

  const ws = new WebSocket(DERIV_WS_URL);

  // Keepalive heartbeat
  const pingInterval = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ ping: 1 }));
      }
    } catch(e) {}
  }, 15000);

  ws.onopen = () => {
    // If user has session, authorize the connection
    if (session?.accessToken) {
      ws.send(JSON.stringify({ authorize: session.accessToken, req_id: 1 }));
    } else {
      // Fallback: public market feed
      ws.send(JSON.stringify({ ticks: symbol, subscribe: 1, req_id: 2 }));
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.msg_type === 'authorize' && data.authorize) {
        sendEvent('authorized', {
          loginid: data.authorize.loginid,
          balance: data.authorize.balance,
          currency: data.authorize.currency,
          isVirtual: data.authorize.is_virtual
        });
        // Subscribe to balance & symbol ticks
        ws.send(JSON.stringify({ balance: 1, subscribe: 1, req_id: 10 }));
        ws.send(JSON.stringify({ ticks: symbol, subscribe: 1, req_id: 11 }));
      } else if (data.msg_type === 'balance' && data.balance) {
        sendEvent('balance', {
          balance: data.balance.balance,
          currency: data.balance.currency
        });
      } else if (data.msg_type === 'tick' && data.tick) {
        const rawQuote = data.tick.quote;
        const displayValue = data.tick.display_value || String(rawQuote);
        const lastDigit = parseInt(displayValue.slice(-1), 10);
        sendEvent('tick', {
          symbol: data.tick.symbol,
          quote: rawQuote,
          displayValue,
          lastDigit,
          epoch: data.tick.epoch
        });
      }
    } catch (e) {
      // Ignore parse error
    }
  };

  const cleanup = () => {
    clearInterval(pingInterval);
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    } catch(e) {}
  };

  req.on('close', cleanup);
  res.on('close', cleanup);
}

// 7. POST /api/deriv/trade/buy (Server-side authenticated contract purchase)
export function handleTradeBuy(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const cookies = parseCookies(req);
  const sessionRaw = unsignValue(cookies.deriv_access_session);

  if (!sessionRaw) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: 'Unauthorized: Login with Deriv required to execute live trades' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const session = JSON.parse(sessionRaw);
      const { symbol, contractType, stake, barrier, duration = 1 } = JSON.parse(body || '{}');

      if (!symbol || !contractType || !stake) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing required parameters (symbol, contractType, stake)' }));
        return;
      }

      // Open authenticated WS to Deriv to buy contract and await outcome
      const ws = new WebSocket(DERIV_WS_URL);
      let contractBuyId = null;

      const tradePromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          try { ws.close(); } catch(e) {}
          reject(new Error('Trade execution timeout waiting for contract result'));
        }, 15000);

        ws.onopen = () => {
          ws.send(JSON.stringify({ authorize: session.accessToken, req_id: 1 }));
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);

          if (data.error) {
            clearTimeout(timer);
            ws.close();
            return reject(new Error(data.error.message || 'Deriv error'));
          }

          if (data.msg_type === 'authorize') {
            // Authorized -> Send Buy Request
            const parameters = {
              contract_type: contractType,
              symbol: symbol,
              duration: duration,
              duration_unit: 't',
              basis: 'stake',
              amount: stake,
              currency: session.currency || 'USD'
            };

            if (barrier !== undefined && barrier !== null) {
              parameters.barrier = String(barrier);
            }

            ws.send(JSON.stringify({
              buy: 1,
              price: stake,
              parameters: parameters,
              req_id: 2
            }));
          } else if (data.msg_type === 'buy') {
            contractBuyId = data.buy.contract_id;
            // Subscribe to proposal open contract for this trade
            ws.send(JSON.stringify({
              proposal_open_contract: 1,
              contract_id: contractBuyId,
              subscribe: 1,
              req_id: 3
            }));
          } else if (data.msg_type === 'proposal_open_contract' && data.proposal_open_contract) {
            const poc = data.proposal_open_contract;
            if (poc.contract_id === contractBuyId && (poc.is_expired || poc.is_sold)) {
              clearTimeout(timer);
              ws.close();

              const won = poc.status === 'won';
              const profit = poc.profit;
              const exitTick = poc.exit_tick_display_value;
              const exitDigit = exitTick ? parseInt(exitTick.slice(-1), 10) : null;

              resolve({
                contractId: poc.contract_id,
                won,
                profit,
                payout: poc.payout,
                buyPrice: poc.buy_price,
                exitTick,
                exitDigit,
                status: poc.status
              });
            }
          }
        };

        ws.onerror = (err) => {
          clearTimeout(timer);
          reject(new Error('Deriv WS connection failed during trade'));
        };
      });

      const tradeResult = await tradePromise;
      res.statusCode = 200;
      res.end(JSON.stringify(tradeResult));
    } catch (err) {
      console.error('Trade execution error:', err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

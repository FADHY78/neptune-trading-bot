import crypto from 'crypto';

// Secret key for signing HTTP-only cookies
const SESSION_SECRET = process.env.DERIV_SESSION_SECRET || 'neptune_deriv_secret_key_digit_atlas_2026';
// Deriv OAuth 2.0 Client ID (for auth.deriv.com)
const DERIV_APP_ID = process.env.DERIV_APP_ID || '34hP1yTdG6Hc7grRIWQWH';
// Deriv WebSocket API App ID (MUST be a numeric integer, e.g. 1089)
const DERIV_WS_APP_ID = process.env.DERIV_WS_APP_ID || (/^\d+$/.test(String(DERIV_APP_ID).trim()) ? String(DERIV_APP_ID).trim() : '1089');
const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${DERIV_WS_APP_ID}`;

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

export function extractLoginIds(legData) {
  if (!legData) return [];
  let list = [];
  if (Array.isArray(legData.loginids)) {
    list = legData.loginids;
  } else if (Array.isArray(legData)) {
    list = legData;
  } else if (typeof legData === 'object') {
    if (Array.isArray(legData.accounts)) {
      list = legData.accounts;
    } else {
      const keys = Object.keys(legData);
      const filtered = keys.filter(k => k !== 'loginids' && k !== 'accounts');
      if (filtered.length > 0) {
        list = filtered;
      } else if (Array.isArray(legData[keys[0]])) {
        list = legData[keys[0]];
      }
    }
  }

  return list.map(item => {
    if (typeof item === 'string') return item.trim();
    if (item && typeof item === 'object') return (item.id || item.loginid || '').trim();
    return '';
  }).filter(id => id && id !== 'loginids' && id !== 'accounts');
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
 * Universal request body parser (supports Vercel pre-parsed bodies & Node streams)
 */
export async function getRequestBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') return req.body;
    try { return JSON.parse(req.body); } catch(e) { return {}; }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch(e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
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
  if (!urlObj) {
    const proto = req.headers?.['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'http');
    const host = req.headers?.['x-forwarded-host'] || req.headers?.host || 'localhost';
    urlObj = new URL(req.url || '/', `${proto}://${host}`);
  }

  const isSignUp = urlObj.searchParams.get('signup') === 'true';
  const customClientId = urlObj.searchParams.get('client_id') || DERIV_APP_ID;
  const customRedirectUri = urlObj.searchParams.get('redirect_uri') || process.env.DERIV_REDIRECT_URI;
  
  // Host detection for callback
  const protocol = req.headers['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = customRedirectUri || `${protocol}://${host}/`;

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
    scope: 'trade',
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
  if (!urlObj) {
    const proto = req.headers?.['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'http');
    const host = req.headers?.['x-forwarded-host'] || req.headers?.host || 'localhost';
    urlObj = new URL(req.url || '/', `${proto}://${host}`);
  }

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

    // Account Discovery via Deriv Options REST API & Userinfo
    let accounts = [];
    let initialBalance = 0;

    // 1. Query userinfo from auth.deriv.com
    try {
      const uRes = await fetch('https://auth.deriv.com/userinfo', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (uRes.ok) {
        const uData = await uRes.json();
        if (uData && Array.isArray(uData.accounts) && uData.accounts.length > 0) {
          accounts = uData.accounts.map(a => ({
            loginid: a.loginid || a.id,
            currency: a.currency || 'USD',
            isVirtual: Boolean(a.is_virtual) || String(a.loginid || a.id).startsWith('VRTC'),
            balance: Number(a.balance || 0),
            disabled: false
          }));
        }
      }
    } catch (uErr) {
      console.warn('Userinfo lookup note:', uErr.message);
    }

    // 2. Query Legacy accounts (VRTC... / CR...)
    if (accounts.length === 0) {
      try {
        const legRes = await fetch('https://api.derivws.com/trading/v1/options/legacy/accounts', {
          headers: {
            'Deriv-App-ID': DERIV_APP_ID,
            'Authorization': `Bearer ${accessToken}`
          }
        });
        if (legRes.ok) {
          const legData = await legRes.json();
          const loginids = extractLoginIds(legData);
          if (loginids.length > 0) {
            accounts = loginids.map(id => ({
              loginid: id,
              currency: 'USD',
              isVirtual: id.startsWith('VRTC') || id.startsWith('VRT'),
              balance: 0,
              disabled: false
            }));
          }
        }
      } catch (legErr) {
        console.warn('Legacy accounts discovery note:', legErr.message);
      }
    }

    // 3. Query Options REST accounts
    if (accounts.length === 0) {
      try {
        const restRes = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
          headers: {
            'Deriv-App-ID': DERIV_APP_ID,
            'Authorization': `Bearer ${accessToken}`
          }
        });
        if (restRes.ok) {
          const restList = await restRes.json();
          if (Array.isArray(restList) && restList.length > 0) {
            accounts = restList.map(a => ({
              loginid: a.id || a.loginid,
              currency: a.currency || 'USD',
              isVirtual: a.type === 'demo' || String(a.id || a.loginid).startsWith('VRTC'),
              balance: Number(a.balance || 0),
              disabled: false
            }));
          }
        }
      } catch (restErr) {
        console.warn('Options REST accounts discovery note:', restErr.message);
      }
    }

    // 4. If no accounts exist yet, initialize/create an Options trading account
    if (accounts.length === 0) {
      try {
        const createRes = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
          method: 'POST',
          headers: {
            'Deriv-App-ID': DERIV_APP_ID,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });
        if (createRes.ok) {
          const newAcc = await createRes.json();
          if (newAcc && (newAcc.id || newAcc.loginid)) {
            accounts = [{
              loginid: newAcc.id || newAcc.loginid,
              currency: newAcc.currency || 'USD',
              isVirtual: newAcc.type === 'demo' || String(newAcc.id || newAcc.loginid).startsWith('VRTC'),
              balance: Number(newAcc.balance || 0),
              disabled: false
            }];
          }
        }
      } catch (cErr) {
        console.warn('Options account creation note:', cErr.message);
      }
    }

    // Prioritize Virtual/Demo account
    accounts.sort((a, b) => (b.isVirtual ? 1 : 0) - (a.isVirtual ? 1 : 0));
    const activeAcc = accounts[0] || {
      loginid: 'VRTC_DEMO',
      currency: 'USD',
      isVirtual: true,
      balance: 0
    };
    initialBalance = activeAcc.balance || initialBalance;

    // Fetch live balance for active account
    if (activeAcc && activeAcc.loginid && activeAcc.loginid !== 'VRTC_DEMO') {
      try {
        const balRes = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${encodeURIComponent(activeAcc.loginid)}`, {
          headers: {
            'Deriv-App-ID': DERIV_APP_ID,
            'Authorization': `Bearer ${accessToken}`
          }
        });
        if (balRes.ok) {
          const bData = await balRes.json();
          if (bData && bData.balance !== undefined) {
            initialBalance = Number(bData.balance);
            activeAcc.balance = initialBalance;
          }
        }
      } catch(e) {}
    }

    // Store Session in signed HTTP-only cookie
    const sessionPayload = JSON.stringify({
      accessToken: accessToken,
      isOAuth: true,
      activeLoginid: activeAcc.loginid,
      isVirtual: activeAcc.isVirtual,
      currency: activeAcc.currency,
      balance: initialBalance,
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

    // Refresh live balance and accounts list
    let liveBalance = session.balance ?? 0;

    // 1. Deriv Options REST API (supports Bearer JWT tokens from OAuth 2.0 PKCE)
    try {
      const restRes = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
        headers: {
          'Deriv-App-ID': DERIV_APP_ID,
          'Authorization': `Bearer ${session.accessToken}`
        }
      });
      if (restRes.ok) {
        let restList = await restRes.json();

        // If list is empty, initialize/create options account
        if (!Array.isArray(restList) || restList.length === 0) {
          const cRes = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
            method: 'POST',
            headers: {
              'Deriv-App-ID': DERIV_APP_ID,
              'Authorization': `Bearer ${session.accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
          });
          if (cRes.ok) {
            const created = await cRes.json();
            if (created && (created.id || created.loginid)) restList = [created];
          }
        }

        if (Array.isArray(restList) && restList.length > 0) {
          session.accounts = restList.map(a => ({
            loginid: a.id || a.loginid,
            currency: a.currency || 'USD',
            isVirtual: a.type === 'demo' || String(a.id || a.loginid).startsWith('VRTC'),
            balance: Number(a.balance || 0),
            disabled: false
          }));

          session.accounts.sort((a, b) => (b.isVirtual ? 1 : 0) - (a.isVirtual ? 1 : 0));

          // Set active account
          const active = session.accounts.find(a => a.loginid === session.activeLoginid) || session.accounts[0];
          session.activeLoginid = active.loginid;
          session.isVirtual = active.isVirtual;
          session.currency = active.currency;
          liveBalance = active.balance;
          session.balance = liveBalance;

          const updatedCookie = signValue(JSON.stringify(session));
          res.setHeader('Set-Cookie', createSetCookieHeader('deriv_access_session', updatedCookie, { maxAge: 7 * 86400 }));
        }
      }
    } catch (restErr) {
      console.warn('REST status refresh note:', restErr.message);
    }

    // 2. Query Legacy accounts (VRTC... / CR...) if accounts empty or active is VRTC_DEMO
    if (!session.accounts || session.accounts.length === 0 || session.activeLoginid === 'VRTC_DEMO') {
      try {
        const legRes = await fetch('https://api.derivws.com/trading/v1/options/legacy/accounts', {
          headers: {
            'Deriv-App-ID': DERIV_APP_ID,
            'Authorization': `Bearer ${session.accessToken}`
          }
        });
        if (legRes.ok) {
          const legData = await legRes.json();
          const loginids = extractLoginIds(legData);
          if (loginids.length > 0) {
            session.accounts = loginids.map(id => ({
              loginid: id,
              currency: 'USD',
              isVirtual: id.startsWith('VRTC') || id.startsWith('VRT'),
              balance: 0,
              disabled: false
            }));
            session.accounts.sort((a, b) => (b.isVirtual ? 1 : 0) - (a.isVirtual ? 1 : 0));
            session.activeLoginid = session.accounts[0].loginid;
            session.isVirtual = session.accounts[0].isVirtual;
            session.currency = session.accounts[0].currency;

            // Fetch live balance for active account
            try {
              const bRes = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${encodeURIComponent(session.activeLoginid)}`, {
                headers: {
                  'Deriv-App-ID': DERIV_APP_ID,
                  'Authorization': `Bearer ${session.accessToken}`
                }
              });
              if (bRes.ok) {
                const bData = await bRes.json();
                if (bData && bData.balance !== undefined) {
                  liveBalance = Number(bData.balance);
                  session.balance = liveBalance;
                  session.accounts[0].balance = liveBalance;
                }
              }
            } catch(e) {}

            const updatedCookie = signValue(JSON.stringify(session));
            res.setHeader('Set-Cookie', createSetCookieHeader('deriv_access_session', updatedCookie, { maxAge: 7 * 86400 }));
          }
        }
      } catch (legErr) {}
    }

    // 3. Query userinfo from auth.deriv.com if accounts still empty or active is VRTC_DEMO
    if (!session.accounts || session.accounts.length === 0 || session.activeLoginid === 'VRTC_DEMO') {
      try {
        const uRes = await fetch('https://auth.deriv.com/userinfo', {
          headers: { 'Authorization': `Bearer ${session.accessToken}` }
        });
        if (uRes.ok) {
          const uData = await uRes.json();
          if (uData && Array.isArray(uData.accounts) && uData.accounts.length > 0) {
            session.accounts = uData.accounts.map(a => ({
              loginid: a.loginid || a.id,
              currency: a.currency || 'USD',
              isVirtual: Boolean(a.is_virtual) || String(a.loginid || a.id).startsWith('VRTC'),
              balance: Number(a.balance || 0),
              disabled: false
            }));
            session.accounts.sort((a, b) => (b.isVirtual ? 1 : 0) - (a.isVirtual ? 1 : 0));
            const active = session.accounts.find(a => a.loginid === session.activeLoginid) || session.accounts[0];
            session.activeLoginid = active.loginid;
            session.isVirtual = active.isVirtual;
            session.currency = active.currency;
            liveBalance = active.balance || liveBalance;
            session.balance = liveBalance;

            const updatedCookie = signValue(JSON.stringify(session));
            res.setHeader('Set-Cookie', createSetCookieHeader('deriv_access_session', updatedCookie, { maxAge: 7 * 86400 }));
          }
        }
      } catch (uErr) {}
    }

    // 2. If token is standard API token (<= 128 chars), refresh via Deriv WebSocket
    if (session.accessToken && session.accessToken.length <= 128) {
      try {
        const authRes = await sendDerivWsCommand({ authorize: session.accessToken }, 4000);
        if (authRes && authRes.authorize) {
          liveBalance = authRes.authorize.balance ?? liveBalance;
          session.balance = liveBalance;

          const rawList = authRes.authorize.account_list || [];
          if (rawList.length > 0) {
            session.accounts = rawList.map(a => ({
              loginid: a.loginid,
              currency: a.currency || 'USD',
              isVirtual: Boolean(a.is_virtual),
              disabled: Boolean(a.is_disabled),
              landingCompany: a.landing_company_name,
              token: a.token || (a.loginid === authRes.authorize.loginid ? session.accessToken : '')
            }));
            session.accounts.sort((a, b) => (b.isVirtual ? 1 : 0) - (a.isVirtual ? 1 : 0));
          }

          if (!session.activeLoginid || session.activeLoginid === 'VRTC_DEMO' || !session.accounts.find(a => a.loginid === session.activeLoginid)) {
            const matched = session.accounts.find(a => a.loginid === authRes.authorize.loginid) || session.accounts[0];
            if (matched) {
              session.activeLoginid = matched.loginid;
              session.isVirtual = matched.isVirtual;
              session.currency = matched.currency;
            }
          }

          const updatedCookie = signValue(JSON.stringify(session));
          res.setHeader('Set-Cookie', createSetCookieHeader('deriv_access_session', updatedCookie, { maxAge: 7 * 86400 }));
        }
      } catch (wsErr) {
        console.warn('WS status refresh note:', wsErr.message);
      }
    }

    // If no real trading accounts found, clear ghost session and return unauthenticated
    if (!session.accounts || session.accounts.length === 0 || session.activeLoginid === 'VRTC_DEMO') {
      res.setHeader('Set-Cookie', createSetCookieHeader('deriv_access_session', '', { maxAge: 0 }));
      res.statusCode = 200;
      res.end(JSON.stringify({
        authenticated: false,
        activeAccount: null,
        accounts: [],
        message: 'No active trading account linked to this OAuth session. Please log in or connect with your Deriv API Token.'
      }));
      return;
    }

    res.statusCode = 200;
    res.end(JSON.stringify({
      authenticated: true,
      activeAccount: {
        loginid: session.activeLoginid,
        isVirtual: Boolean(session.isVirtual),
        currency: session.currency || 'USD',
        balance: Number(liveBalance)
      },
      accounts: (session.accounts || []).map(a => ({
        loginid: a.loginid,
        currency: a.currency || 'USD',
        isVirtual: Boolean(a.isVirtual),
        disabled: Boolean(a.disabled)
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

  try {
    const { loginid } = await getRequestBody(req);
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
  if (!urlObj) {
    const proto = req.headers?.['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'http');
    const host = req.headers?.['x-forwarded-host'] || req.headers?.host || 'localhost';
    urlObj = new URL(req.url || '/', `${proto}://${host}`);
  }

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
    // If user has API token (<= 128 chars), authorize the connection
    if (session?.accessToken && session.accessToken.length <= 128) {
      ws.send(JSON.stringify({ authorize: session.accessToken, req_id: 1 }));
    } else {
      // Stream public market feed directly (zero latency)
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
export async function handleTradeBuy(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const cookies = parseCookies(req);
  const sessionRaw = unsignValue(cookies.deriv_access_session);

  if (!sessionRaw) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: 'Unauthorized: Login with Deriv required to execute live trades' }));
    return;
  }

  try {
    const session = JSON.parse(sessionRaw);
    const { symbol, contractType, stake, barrier, duration = 1 } = await getRequestBody(req);

    if (!symbol || !contractType || !stake) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Missing required parameters (symbol, contractType, stake)' }));
      return;
    }

    let targetWsUrl = DERIV_WS_URL;
    let authReqPayload = null;

    const isOAuth = session.isOAuth || (session.accessToken && (session.accessToken.startsWith('ory_at_') || session.accessToken.length > 32));

    if (isOAuth) {
      // OAuth 2.0 PKCE flow: Acquire short-lived OTP for the selected account
      const otpData = await getDerivAccountOtp(session.activeLoginid, session.accessToken);
      if (otpData && otpData.url) {
        targetWsUrl = otpData.url;
      }
      if (otpData && otpData.otp) {
        authReqPayload = { authorize: otpData.otp, req_id: 1 };
      }
    } else {
      // Direct API Token flow
      authReqPayload = { authorize: session.accessToken, req_id: 1 };
    }

    const ws = new WebSocket(targetWsUrl);
    let contractBuyId = null;

    const tradePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        try { ws.close(); } catch(e) {}
        reject(new Error('Trade execution timeout waiting for contract result'));
      }, 15000);

      const sendBuyOrder = (currency = 'USD') => {
        const parameters = {
          contract_type: contractType,
          symbol: symbol,
          duration: duration,
          duration_unit: 't',
          basis: 'stake',
          amount: stake,
          currency: currency || session.currency || 'USD'
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
      };

      ws.onopen = () => {
        if (authReqPayload) {
          ws.send(JSON.stringify(authReqPayload));
        } else {
          // Pre-authenticated via OTP query parameter
          sendBuyOrder(session.currency || 'USD');
        }
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
          sendBuyOrder(data.authorize?.currency || session.currency || 'USD');
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
        reject(new Error(`Deriv WS connection failed during trade: ${err?.message || 'handshake error'}`));
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
}

/**
 * Helper to request One-Time Password (OTP) for authenticated WebSocket trade execution
 * (Official Deriv Options REST Architecture for OAuth 2.0 PKCE JWT Bearer tokens)
 */
export async function getDerivAccountOtp(accountId, accessToken) {
  let cleanAccountId = (accountId === 'loginids' || accountId === 'VRTC_DEMO') ? null : accountId;

  // If active accountId is not yet resolved or is placeholder, query options accounts
  if (!cleanAccountId || cleanAccountId === 'VRTC_DEMO' || cleanAccountId === 'loginids') {
    // 1. Try userinfo from auth.deriv.com
    try {
      const uRes = await fetch('https://auth.deriv.com/userinfo', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (uRes.ok) {
        const uData = await uRes.json();
        if (uData && Array.isArray(uData.accounts) && uData.accounts.length > 0) {
          const demo = uData.accounts.find(a => String(a.loginid || a.id).startsWith('VRTC'));
          cleanAccountId = demo ? (demo.loginid || demo.id) : (uData.accounts[0].loginid || uData.accounts[0].id);
        }
      }
    } catch (e) {}

    // 2. Try Legacy accounts (VRTC... / CR...)
    if (!cleanAccountId || cleanAccountId === 'VRTC_DEMO' || cleanAccountId === 'loginids') {
      try {
        const legRes = await fetch('https://api.derivws.com/trading/v1/options/legacy/accounts', {
          headers: {
            'Deriv-App-ID': DERIV_APP_ID,
            'Authorization': `Bearer ${accessToken}`
          }
        });
        if (legRes.ok) {
          const legData = await legRes.json();
          const loginids = extractLoginIds(legData);
          if (loginids.length > 0) {
            const demo = loginids.find(id => id.startsWith('VRTC') || id.startsWith('VRT'));
            cleanAccountId = demo || loginids[0];
          }
        }
      } catch (e) {}
    }

    // 3. Try Options REST accounts
    if (!cleanAccountId || cleanAccountId === 'VRTC_DEMO') {
      try {
        const accRes = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
          headers: {
            'Deriv-App-ID': DERIV_APP_ID,
            'Authorization': `Bearer ${accessToken}`
          }
        });
        if (accRes.ok) {
          let accList = await accRes.json();

          // If empty, initialize/create options account
          if (!Array.isArray(accList) || accList.length === 0) {
            const cRes = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
              method: 'POST',
              headers: {
                'Deriv-App-ID': DERIV_APP_ID,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({})
            });
            if (cRes.ok) {
              const created = await cRes.json();
              if (created && (created.id || created.loginid)) accList = [created];
            }
          }

          if (Array.isArray(accList) && accList.length > 0) {
            const demo = accList.find(a => a.type === 'demo' || String(a.id || a.loginid).startsWith('VRTC'));
            cleanAccountId = demo ? (demo.id || demo.loginid) : (accList[0].id || accList[0].loginid);
          }
        }
      } catch (e) {
        console.warn('Account resolution for OTP warning:', e.message);
      }
    }
  }

  if (!cleanAccountId || cleanAccountId === 'VRTC_DEMO') {
    throw new Error('No active Deriv Options trading account found. You can also paste your personal Deriv API Token in settings to trade directly.');
  }

  const endpoint = `https://api.derivws.com/trading/v1/options/accounts/${encodeURIComponent(cleanAccountId)}/otp`;
  const otpRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Deriv-App-ID': DERIV_APP_ID,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!otpRes.ok) {
    const errText = await otpRes.text();
    throw new Error(`Deriv OTP acquisition error (${otpRes.status}): ${errText}`);
  }

  return otpRes.json();
}

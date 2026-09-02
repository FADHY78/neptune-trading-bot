import {
  handleOAuthStart,
  handleOAuthCallback,
  handleAuthStatus,
  handleAccountSwitch,
  handleLogout,
  handleMarketTicksSSE,
  handleTradeBuy
} from '../derivBackend.js';

export default async function handler(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers['x-forwarded-host'] || req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  if (pathname.includes('/oauth/start')) {
    return handleOAuthStart(req, res, urlObj);
  }
  if (pathname.includes('/oauth/callback') || pathname.endsWith('/callback')) {
    return handleOAuthCallback(req, res, urlObj);
  }
  if (pathname.includes('/auth/status')) {
    return handleAuthStatus(req, res);
  }
  if (pathname.includes('/account/switch')) {
    return handleAccountSwitch(req, res);
  }
  if (pathname.includes('/auth/logout')) {
    return handleLogout(req, res);
  }
  if (pathname.includes('/market/ticks')) {
    return handleMarketTicksSSE(req, res, urlObj);
  }
  if (pathname.includes('/trade/buy')) {
    return handleTradeBuy(req, res);
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: `Unknown Deriv endpoint: ${pathname}` }));
}

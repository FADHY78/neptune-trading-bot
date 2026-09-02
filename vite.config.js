import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {
  handleOAuthStart,
  handleOAuthCallback,
  handleAuthStatus,
  handleAccountSwitch,
  handleLogout,
  handleMarketTicksSSE,
  handleTradeBuy
} from './api/derivBackend.js'

// Full Backend Deriv Proxy Plugin (Digit Atlas architecture)
const derivBackendPlugin = () => ({
  name: 'deriv-backend-proxy',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
      const pathname = urlObj.pathname;

      // 1. OAuth Start
      if (pathname === '/api/deriv/oauth/start') {
        return handleOAuthStart(req, res, urlObj);
      }

      // 2. OAuth Callback
      if (pathname === '/callback' || pathname === '/api/deriv/oauth/callback') {
        return handleOAuthCallback(req, res, urlObj);
      }

      // 3. Auth Status
      if (pathname === '/api/deriv/auth/status') {
        return handleAuthStatus(req, res);
      }

      // 4. Switch Account
      if (pathname === '/api/deriv/account/switch' && req.method === 'POST') {
        return handleAccountSwitch(req, res);
      }

      // 5. Logout
      if (pathname === '/api/deriv/auth/logout' && req.method === 'POST') {
        return handleLogout(req, res);
      }

      // 6. SSE Market Tick Stream
      if (pathname === '/api/deriv/market/ticks') {
        return handleMarketTicksSSE(req, res, urlObj);
      }

      // 7. Authenticated Trade Execution
      if (pathname === '/api/deriv/trade/buy' && req.method === 'POST') {
        return handleTradeBuy(req, res);
      }

      // 8. Legacy /api/token fallback
      if (pathname === '/api/token') {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.statusCode = 200;
          res.end();
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { code, code_verifier, client_id, redirect_uri } = JSON.parse(body || '{}');
              const params = new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: client_id || '',
                code: code || '',
                code_verifier: code_verifier || '',
                redirect_uri: redirect_uri || ''
              });

              const derivRes = await fetch('https://auth.deriv.com/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
              });

              const data = await derivRes.json();
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = derivRes.status;
              res.end(JSON.stringify(data));
            } catch (err) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }
      }

      next();
    });
  }
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), derivBackendPlugin()],
  server: {
    port: 3000,
    open: true
  }
})

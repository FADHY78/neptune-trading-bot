import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Local dev middleware for /api/token Deriv PKCE token exchange
const derivTokenProxyPlugin = () => ({
  name: 'deriv-token-proxy',
  configureServer(server) {
    server.middlewares.use('/api/token', async (req, res) => {
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
      } else {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      }
    });
  }
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), derivTokenProxyPlugin()],
  server: {
    port: 3000,
    open: true
  }
})

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { code, code_verifier, client_id, redirect_uri } = req.body || {};

  if (!code || !code_verifier || !client_id || !redirect_uri) {
    return res.status(400).json({ error: 'Missing required parameters (code, code_verifier, client_id, redirect_uri)' });
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: client_id,
      code: code,
      code_verifier: code_verifier,
      redirect_uri: redirect_uri
    });

    const response = await fetch('https://auth.deriv.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Deriv token exchange error:', error);
    return res.status(500).json({ error: error.message });
  }
}

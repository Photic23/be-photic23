module.exports = async function handler(req, res) {
    const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
    const host = req.headers.host.startsWith('localhost') 
        ? `http://${req.headers.host}` 
        : `https://${req.headers.host}`;
    const REDIRECT_URI = `${host}/api/simple-callback`;
    
    // Generate simple code verifier
    const codeVerifier = Array(128).fill(0)
        .map(() => Math.random().toString(36)[2])
        .join('');
    
    // Set cookie to store verifier
    res.setHeader('Set-Cookie', `verifier=${codeVerifier}; HttpOnly; Path=/; Max-Age=600`);
    
    // Simple code challenge
    const crypto = require('crypto');
    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    
    const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: 'user-read-currently-playing',
        redirect_uri: REDIRECT_URI,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge
    })}`;
    
    res.redirect(authUrl);
};

// api/simple-callback.js
module.exports = async function handler(req, res) {
    const { code } = req.query;
    const cookies = req.headers.cookie?.split('; ').reduce((acc, c) => {
        const [key, value] = c.split('=');
        acc[key] = value;
        return acc;
    }, {}) || {};
    
    const codeVerifier = cookies.verifier;
    
    if (!code || !codeVerifier) {
        return res.status(400).send('Missing code or verifier');
    }
    
    const host = req.headers.host.startsWith('localhost') 
        ? `http://${req.headers.host}` 
        : `https://${req.headers.host}`;
    
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: `${host}/api/simple-callback`,
            client_id: process.env.SPOTIFY_CLIENT_ID,
            code_verifier: codeVerifier,
        }),
    });
    
    const data = await tokenResponse.json();
    
    if (data.refresh_token) {
        res.setHeader('Content-Type', 'text/html');
        res.send(`
            <html>
            <body style="font-family: Arial; padding: 20px;">
                <h1>✅ Success!</h1>
                <h2>Copy this refresh token:</h2>
                <pre style="background: #000; color: #0f0; padding: 20px; word-wrap: break-word;">
${data.refresh_token}
                </pre>
                <p>Update SPOTIFY_REFRESH_TOKEN in Vercel and redeploy.</p>
            </body>
            </html>
        `);
    } else {
        res.status(400).json(data);
    }
};
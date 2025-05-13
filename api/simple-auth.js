// api/auth-start.js
module.exports = async function handler(req, res) {
    const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
    const REDIRECT_URI = `https://${req.headers.host}/api/auth-callback`;
    
    // Generate random values
    const state = Math.random().toString(36).substring(7);
    const codeVerifier = Array(128).fill(0).map(() => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
            .charAt(Math.floor(Math.random() * 66))
    ).join('');
    
    // Store in temporary tokens (you might want to use a database in production)
    global.authState = { state, codeVerifier };
    
    // Generate code challenge
    const crypto = require('crypto');
    const challenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: 'user-read-currently-playing',
        redirect_uri: REDIRECT_URI,
        state: state,
        code_challenge_method: 'S256',
        code_challenge: challenge
    });
    
    res.redirect(`https://accounts.spotify.com/authorize?${params}`);
};

// api/auth-callback.js
module.exports = async function handler(req, res) {
    const { code, state } = req.query;
    
    if (!code || !global.authState || state !== global.authState.state) {
        return res.status(400).send('Invalid request');
    }
    
    const { codeVerifier } = global.authState;
    const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
    const REDIRECT_URI = `https://${req.headers.host}/api/auth-callback`;
    
    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
                client_id: CLIENT_ID,
                code_verifier: codeVerifier,
            }),
        });
        
        const data = await response.json();
        
        if (data.refresh_token) {
            res.setHeader('Content-Type', 'text/html');
            res.status(200).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Success!</title>
                    <style>
                        body { font-family: Arial; padding: 20px; max-width: 800px; margin: 0 auto; }
                        pre { background: #000; color: #0f0; padding: 20px; border-radius: 5px; overflow-x: auto; word-wrap: break-word; }
                        .warning { background: #ff0; color: #000; padding: 10px; margin: 10px 0; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <h1>✅ Success!</h1>
                    <h2>Your new refresh token:</h2>
                    <pre>${data.refresh_token}</pre>
                    
                    <h2>Add this to Vercel Environment Variables:</h2>
                    <pre>SPOTIFY_REFRESH_TOKEN=${data.refresh_token}</pre>
                    
                    <div class="warning">
                        <strong>⚠️ IMPORTANT:</strong>
                        <ul>
                            <li>Do NOT test the /api/refresh-token endpoint</li>
                            <li>Do NOT test the /api/token-status endpoint</li>
                            <li>Just use /api/current-track - it handles everything</li>
                            <li>Testing refresh endpoints will break your token!</li>
                        </ul>
                    </div>
                    
                    <h3>Next steps:</h3>
                    <ol>
                        <li>Copy the refresh token above</li>
                        <li>Go to Vercel Dashboard → Environment Variables</li>
                        <li>Update SPOTIFY_REFRESH_TOKEN with the new value</li>
                        <li>Redeploy your app</li>
                        <li>Use ONLY the /api/current-track endpoint</li>
                    </ol>
                </body>
                </html>
            `);
        } else {
            res.status(400).json({ error: 'No refresh token received', data });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
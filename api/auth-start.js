const crypto = require('crypto');

module.exports = async function handler(req, res) {
    try {
        const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
        if (!CLIENT_ID) {
            return res.status(500).send('Missing SPOTIFY_CLIENT_ID environment variable');
        }
        
        const host = req.headers.host;
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const REDIRECT_URI = `${protocol}://${host}/api/auth-callback`;
        
        // Generate random values
        const state = crypto.randomBytes(16).toString('hex');
        const codeVerifier = crypto.randomBytes(64).toString('base64url');
        
        // Store in cookie instead of global state (more reliable)
        const stateData = JSON.stringify({ state, codeVerifier });
        const cookieValue = Buffer.from(stateData).toString('base64');
        
        res.setHeader('Set-Cookie', `spotify_auth=${cookieValue}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
        
        // Generate code challenge
        const challenge = crypto
            .createHash('sha256')
            .update(codeVerifier)
            .digest('base64url');
        
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: CLIENT_ID,
            scope: 'user-read-currently-playing',
            redirect_uri: REDIRECT_URI,
            state: state,
            code_challenge_method: 'S256',
            code_challenge: challenge
        });
        
        const authUrl = `https://accounts.spotify.com/authorize?${params}`;
        res.redirect(authUrl);
    } catch (error) {
        console.error('Error in auth-start:', error);
        res.status(500).send(`Error: ${error.message}`);
    }
};

// api/auth-callback.js - Fixed to use cookies
module.exports = async function handler(req, res) {
    try {
        const { code, state, error } = req.query;
        
        if (error) {
            return res.status(400).send(`Spotify authorization error: ${error}`);
        }
        
        if (!code || !state) {
            return res.status(400).send('Missing authorization code or state parameter');
        }
        
        // Get auth data from cookie
        const cookies = req.headers.cookie?.split('; ').reduce((acc, cookie) => {
            const [key, value] = cookie.split('=');
            acc[key] = value;
            return acc;
        }, {}) || {};
        
        if (!cookies.spotify_auth) {
            return res.status(400).send('Missing or expired authentication session. Please start over.');
        }
        
        let authData;
        try {
            const decoded = Buffer.from(cookies.spotify_auth, 'base64').toString();
            authData = JSON.parse(decoded);
        } catch (e) {
            return res.status(400).send('Invalid authentication session. Please start over.');
        }
        
        if (state !== authData.state) {
            return res.status(400).send('Invalid state parameter. Possible CSRF attack.');
        }
        
        const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
        const host = req.headers.host;
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const REDIRECT_URI = `${protocol}://${host}/api/auth-callback`;
        
        // Exchange code for token
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
                code_verifier: authData.codeVerifier,
            }),
        });
        
        const data = await response.json();
        
        // Clear the auth cookie
        res.setHeader('Set-Cookie', 'spotify_auth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
        
        if (data.refresh_token) {
            res.setHeader('Content-Type', 'text/html');
            res.status(200).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Spotify Authentication Success</title>
                    <style>
                        body { 
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                            padding: 20px; 
                            max-width: 800px; 
                            margin: 0 auto;
                            background: #f8f9fa;
                        }
                        .container {
                            background: white;
                            padding: 30px;
                            border-radius: 10px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        }
                        h1 { color: #1db954; margin-bottom: 30px; }
                        .token-box { 
                            background: #000; 
                            color: #1db954; 
                            padding: 20px; 
                            border-radius: 8px; 
                            word-break: break-all;
                            font-family: Monaco, Consolas, monospace;
                            margin: 20px 0;
                        }
                        .warning { 
                            background: #fff3cd; 
                            color: #856404;
                            padding: 15px; 
                            margin: 20px 0; 
                            border-radius: 8px;
                            border: 1px solid #ffeaa7;
                        }
                        .success-icon {
                            width: 60px;
                            height: 60px;
                            margin: 0 auto 20px;
                            display: block;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <svg class="success-icon" viewBox="0 0 24 24" fill="#1db954">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                        
                        <h1>Authentication Successful!</h1>
                        
                        <p><strong>Your Refresh Token:</strong></p>
                        <div class="token-box">${data.refresh_token}</div>
                        
                        <div class="warning">
                            <strong>⚠️ Important:</strong> This token is sensitive. Only use it in your backend environment variables.
                        </div>
                        
                        <h2>Next Steps:</h2>
                        <ol>
                            <li>Copy the refresh token above</li>
                            <li>Go to Vercel Dashboard → Environment Variables</li>
                            <li>Set <code>SPOTIFY_REFRESH_TOKEN</code> to this value</li>
                            <li>Redeploy your application</li>
                            <li>Delete these auth endpoints from your code</li>
                        </ol>
                        
                        <p style="margin-top: 30px; color: #666; font-size: 14px;">
                            Token will expire in ${data.expires_in} seconds (${Math.round(data.expires_in / 60)} minutes)
                        </p>
                    </div>
                </body>
                </html>
            `);
        } else {
            res.status(400).send(`
                <html>
                <body style="font-family: Arial; padding: 20px;">
                    <h1>Error: No refresh token received</h1>
                    <pre style="background: #f0f0f0; padding: 15px; border-radius: 5px;">
${JSON.stringify(data, null, 2)}
                    </pre>
                    <p><a href="/api/auth-start">Try again</a></p>
                </body>
                </html>
            `);
        }
    } catch (error) {
        console.error('Error in auth-callback:', error);
        res.status(500).send(`
            <html>
            <body style="font-family: Arial; padding: 20px;">
                <h1>Server Error</h1>
                <pre style="color: red;">${error.message}</pre>
                <p><a href="/api/auth-start">Start over</a></p>
            </body>
            </html>
        `);
    }
};
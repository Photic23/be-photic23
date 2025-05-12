import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://photic23.vercel.app');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code, codeVerifier, redirectUri } = req.body;

    try {
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri,
                client_id: process.env.SPOTIFY_CLIENT_ID,
                code_verifier: codeVerifier,
            }),
        });

        const data = await tokenResponse.json();
        
        if (data.access_token) {
            // Store tokens in KV
            await kv.set('spotify_access_token', data.access_token);
            if (data.refresh_token) {
                await kv.set('spotify_refresh_token', data.refresh_token);
            }
            
            // Store expiration time
            const expirationTime = new Date().getTime() + (data.expires_in * 1000);
            await kv.set('spotify_token_expiration', expirationTime.toString());
            
            // Set a secure httpOnly cookie for session
            res.setHeader('Set-Cookie', `spotify_session=authorized; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=31536000`);
            
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Failed to exchange code for token' });
    } catch (error) {
        console.error('Error in auth callback:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
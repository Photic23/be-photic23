import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

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
            // Calculate expiration time
            const expiresAt = new Date(Date.now() + (data.expires_in * 1000));
            
            // Store or update tokens in Supabase
            const { error } = await supabase
                .from('spotify_tokens')
                .upsert({
                    id: 1, // We're only storing one user's tokens
                    access_token: data.access_token,
                    refresh_token: data.refresh_token,
                    expires_at: expiresAt.toISOString()
                });

            if (error) {
                console.error('Supabase error:', error);
                return res.status(500).json({ error: 'Failed to store tokens' });
            }
            
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
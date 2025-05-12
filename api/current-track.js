const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase with error handling
let supabase;
try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        console.log('Missing Supabase environment variables');
    } else {
        supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
    }
} catch (error) {
    console.error('Supabase initialization error:', error);
}

module.exports = async function handler(req, res) {
    // CORS handling
    const allowedOrigins = [
        'https://photic23.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001'
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // If Supabase isn't initialized, return null
    if (!supabase) {
        console.log('Supabase not initialized - returning null');
        return res.status(200).json(null);
    }

    try {
        // Get the stored tokens
        const { data: tokenData, error } = await supabase
            .from('spotify_tokens')
            .select('*')
            .eq('id', 1)
            .single();

        if (error || !tokenData) {
            return res.status(200).json(null);
        }

        // Check if token is expired
        if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
            // Token is expired, try to refresh it
            const newToken = await refreshSpotifyToken(tokenData.refresh_token);
            if (!newToken) {
                return res.status(200).json(null);
            }
            tokenData.access_token = newToken;
        }

        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`
            }
        });

        if (response.status === 204) {
            return res.status(200).json(null);
        }

        if (response.status === 401) {
            // Token expired, try to refresh
            const newToken = await refreshSpotifyToken(tokenData.refresh_token);
            if (newToken) {
                // Retry with new token
                const retryResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
                    headers: {
                        'Authorization': `Bearer ${newToken}`
                    }
                });
                
                if (retryResponse.ok) {
                    const data = await retryResponse.json();
                    return res.status(200).json(data.item);
                }
            }
            return res.status(200).json(null);
        }

        if (response.ok) {
            const data = await response.json();
            return res.status(200).json(data.item);
        }

        return res.status(200).json(null);
    } catch (error) {
        console.error('Error fetching current track:', error);
        return res.status(200).json(null);
    }
};

async function refreshSpotifyToken(refreshToken) {
    if (!refreshToken) return null;

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: process.env.SPOTIFY_CLIENT_ID,
            }),
        });

        const data = await response.json();
        if (data.access_token) {
            // Update tokens in database
            const expiresAt = new Date(Date.now() + (data.expires_in * 1000));
            
            await supabase
                .from('spotify_tokens')
                .update({
                    access_token: data.access_token,
                    refresh_token: data.refresh_token || refreshToken,
                    expires_at: expiresAt.toISOString()
                })
                .eq('id', 1);
            
            return data.access_token;
        }
    } catch (error) {
        console.error('Error refreshing token:', error);
    }
    return null;
}
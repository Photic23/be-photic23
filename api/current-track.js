const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

module.exports = async function handler(req, res) {
    // Enable CORS
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

    try {
        // Check if we have hardcoded tokens first
        let accessToken = process.env.SPOTIFY_ACCESS_TOKEN;
        let refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
        
        // If no hardcoded tokens, check database
        if (!accessToken) {
            const { data: tokenData, error } = await supabase
                .from('spotify_tokens')
                .select('*')
                .eq('id', 1)
                .single();

            if (error || !tokenData) {
                console.log('No tokens found in database');
                return res.status(200).json(null);
            }

            accessToken = tokenData.access_token;
            refreshToken = tokenData.refresh_token;
        }

        // Try to fetch current track
        console.log('Fetching current track...');
        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        console.log('Spotify API response status:', response.status);

        if (response.status === 204) {
            console.log('No content - nothing is playing');
            return res.status(200).json(null);
        }

        if (response.status === 401) {
            console.log('Token expired, attempting refresh...');
            // Token expired, try to refresh
            const newToken = await refreshSpotifyToken(refreshToken);
            if (newToken) {
                console.log('Token refreshed successfully');
                // Retry with new token
                const retryResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
                    headers: {
                        'Authorization': `Bearer ${newToken}`
                    }
                });
                
                console.log('Retry response status:', retryResponse.status);
                
                if (retryResponse.status === 204) {
                    return res.status(200).json(null);
                }
                
                if (retryResponse.ok) {
                    const data = await retryResponse.json();
                    console.log('Track data:', data?.item?.name);
                    console.log('Is playing:', data?.is_playing);
                    
                    // Only return if actually playing
                    if (data?.is_playing) {
                        return res.status(200).json(data.item);
                    } else {
                        return res.status(200).json(null);
                    }
                }
            }
            return res.status(200).json(null);
        }

        if (response.ok) {
            const data = await response.json();
            console.log('Track data:', data?.item?.name);
            console.log('Is playing:', data?.is_playing);
            console.log('Progress:', data?.progress_ms);
            
            // Only return if actually playing
            if (data?.is_playing) {
                return res.status(200).json(data.item);
            } else {
                console.log('Track is paused');
                return res.status(200).json(null);
            }
        }

        return res.status(200).json(null);
    } catch (error) {
        console.error('Error fetching current track:', error);
        return res.status(500).json({ error: 'Failed to fetch current track' });
    }
};

async function refreshSpotifyToken(refreshToken) {
    if (!refreshToken) return null;

    try {
        console.log('Refreshing Spotify token...');
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
            console.log('New access token received');
            
            // If using hardcoded refresh token, don't update database
            if (process.env.SPOTIFY_REFRESH_TOKEN) {
                return data.access_token;
            }
            
            // Otherwise, update database
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
        } else {
            console.error('Failed to refresh token:', data);
        }
    } catch (error) {
        console.error('Error refreshing token:', error);
    }
    return null;
}
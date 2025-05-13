const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Cache for the current access token
let cachedAccessToken = null;
let tokenExpiresAt = null;

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
        // Get valid access token
        const accessToken = await getValidAccessToken();
        
        if (!accessToken) {
            console.log('No valid access token available');
            return res.status(200).json(null);
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
            console.log('Token still invalid after refresh, clearing cache');
            cachedAccessToken = null;
            tokenExpiresAt = null;
            return res.status(200).json(null);
        }

        if (response.ok) {
            const data = await response.json();
            console.log('Track data:', data?.item?.name);
            console.log('Is playing:', data?.is_playing);
            
            // Only return if actually playing
            if (data?.is_playing) {
                return res.status(200).json(data.item);
            } else {
                return res.status(200).json(null);
            }
        }

        return res.status(200).json(null);
    } catch (error) {
        console.error('Error fetching current track:', error);
        return res.status(500).json({ error: 'Failed to fetch current track' });
    }
};

async function getValidAccessToken() {
    // Check if we have a valid cached token
    if (cachedAccessToken && tokenExpiresAt && new Date() < tokenExpiresAt) {
        console.log('Using cached access token');
        return cachedAccessToken;
    }

    // Get refresh token
    const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN || await getRefreshTokenFromDb();
    
    if (!refreshToken) {
        console.log('No refresh token available');
        return null;
    }

    // Refresh the access token
    const newAccessToken = await refreshSpotifyToken(refreshToken);
    
    if (newAccessToken) {
        // Cache the new token
        cachedAccessToken = newAccessToken;
        tokenExpiresAt = new Date(Date.now() + 50 * 60 * 1000); // 50 minutes (tokens last 60)
        console.log('Access token refreshed and cached');
        return newAccessToken;
    }

    return null;
}

async function getRefreshTokenFromDb() {
    try {
        const { data: tokenData } = await supabase
            .from('spotify_tokens')
            .select('refresh_token')
            .eq('id', 1)
            .single();
        
        return tokenData?.refresh_token;
    } catch (error) {
        console.error('Error getting refresh token from DB:', error);
        return null;
    }
}

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
        
        if (!response.ok) {
            console.error('Token refresh failed:', data);
            return null;
        }
        
        if (data.access_token) {
            console.log('New access token received');
            
            // Update database if not using hardcoded tokens
            if (!process.env.SPOTIFY_REFRESH_TOKEN) {
                const expiresAt = new Date(Date.now() + (data.expires_in * 1000));
                
                await supabase
                    .from('spotify_tokens')
                    .update({
                        access_token: data.access_token,
                        refresh_token: data.refresh_token || refreshToken,
                        expires_at: expiresAt.toISOString()
                    })
                    .eq('id', 1);
            }
            
            return data.access_token;
        }
    } catch (error) {
        console.error('Error refreshing token:', error);
    }
    return null;
}
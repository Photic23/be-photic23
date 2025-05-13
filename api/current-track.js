// Version with request deduplication to prevent concurrent token refreshes
const tokenCache = global.spotifyTokenCache || {
    accessToken: null,
    expiresAt: null,
    refreshPromise: null
};

if (!global.spotifyTokenCache) {
    global.spotifyTokenCache = tokenCache;
}

async function getAccessToken(refreshToken, clientId, clientSecret) {
    // If we already have a valid token, return it
    if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt) {
        console.log('Using cached access token');
        return tokenCache.accessToken;
    }
    
    // If a refresh is already in progress, wait for it
    if (tokenCache.refreshPromise) {
        console.log('Waiting for in-progress token refresh');
        return await tokenCache.refreshPromise;
    }
    
    // Start a new refresh
    console.log('Starting new token refresh');
    tokenCache.refreshPromise = (async () => {
        try {
            const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                    client_id: clientId,
                    client_secret: clientSecret
                }),
            });
            
            const tokenData = await tokenResponse.json();
            
            if (tokenData.error) {
                throw new Error(tokenData.error);
            }
            
            // Cache the new access token
            tokenCache.accessToken = tokenData.access_token;
            tokenCache.expiresAt = Date.now() + (tokenData.expires_in * 1000) - 60000;
            
            return tokenData.access_token;
        } finally {
            // Clear the promise regardless of success or failure
            tokenCache.refreshPromise = null;
        }
    })();
    
    return await tokenCache.refreshPromise;
}

module.exports = async function handler(req, res) {
    console.log(`[${new Date().toISOString()}] Current track request`);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
        const clientId = process.env.SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
        
        if (!refreshToken || !clientId || !clientSecret) {
            return res.status(200).json({ 
                error: 'Missing Spotify credentials',
                details: 'Server configuration error'
            });
        }
        
        let accessToken;
        try {
            accessToken = await getAccessToken(refreshToken, clientId, clientSecret);
        } catch (error) {
            console.error('Token refresh error:', error.message);
            if (error.message === 'invalid_grant') {
                return res.status(200).json({ 
                    error: 'Refresh token expired or revoked',
                    needsNewToken: true,
                    details: 'Please re-authenticate with Spotify'
                });
            }
            throw error;
        }
        
        // Get current track
        const trackResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        console.log('Track response:', trackResponse.status);
        
        if (trackResponse.status === 204) {
            return res.status(200).json(null);
        }
        
        if (trackResponse.status === 401) {
            // Access token expired, clear cache
            tokenCache.accessToken = null;
            tokenCache.expiresAt = null;
            return res.status(200).json({ 
                error: 'Token expired',
                retry: true
            });
        }
        
        if (trackResponse.ok) {
            const trackData = await trackResponse.json();
            
            if (trackData.is_playing && trackData.item) {
                return res.status(200).json({
                    name: trackData.item.name,
                    artists: trackData.item.artists.map(artist => artist.name),
                    album: trackData.item.album.name,
                    image: trackData.item.album.images[0]?.url,
                    duration_ms: trackData.item.duration_ms,
                    progress_ms: trackData.progress_ms,
                    external_urls: trackData.item.external_urls
                });
            }
        }
        
        return res.status(200).json(null);
        
    } catch (error) {
        console.error('Error:', error.message);
        return res.status(200).json({ 
            error: 'Server error',
            details: error.message
        });
    }
};
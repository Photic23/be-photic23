// Simple in-memory cache for access tokens
let tokenCache = {
    accessToken: null,
    expiresAt: null
};

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
            console.error('Missing credentials');
            return res.status(200).json({ 
                error: 'Missing Spotify credentials',
                details: 'Server configuration error'
            });
        }
        
        let accessToken = tokenCache.accessToken;
        
        // Check if we need a new access token
        if (!accessToken || Date.now() >= tokenCache.expiresAt) {
            console.log('Getting new access token...');
            
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
                console.error('Token error:', tokenData);
                
                if (tokenData.error === 'invalid_grant') {
                    return res.status(200).json({ 
                        error: 'Refresh token expired or revoked',
                        needsNewToken: true,
                        details: 'Please re-authenticate with Spotify'
                    });
                }
                
                return res.status(200).json({ 
                    error: 'Authentication failed',
                    details: tokenData.error_description || tokenData.error
                });
            }
            
            // Cache the new access token
            accessToken = tokenData.access_token;
            tokenCache.accessToken = accessToken;
            tokenCache.expiresAt = Date.now() + (tokenData.expires_in * 1000) - 60000; // Refresh 1 minute early
            
            console.log('Cached new access token, expires at:', new Date(tokenCache.expiresAt).toISOString());
        } else {
            console.log('Using cached access token');
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
            // Access token expired, clear cache and try again
            console.log('Access token expired, clearing cache');
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
            
            return res.status(200).json(null);
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
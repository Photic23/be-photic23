// api/current-track.js - Version with better error recovery and debugging
const tokenCache = global.spotifyTokenCache || {
    accessToken: null,
    expiresAt: null,
    refreshPromise: null,
    lastRefreshTime: 0
};

if (!global.spotifyTokenCache) {
    global.spotifyTokenCache = tokenCache;
}

// Helper to validate environment variables
function validateEnvironment() {
    const required = ['SPOTIFY_REFRESH_TOKEN', 'SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('Missing environment variables:', missing);
        return false;
    }
    
    // Log token info for debugging (safely)
    const token = process.env.SPOTIFY_REFRESH_TOKEN;
    console.log('Token check:', {
        length: token.length,
        firstChars: token.substring(0, 5),
        lastChars: token.slice(-5),
        hasSpecialChars: /[^a-zA-Z0-9-_]/.test(token)
    });
    
    return true;
}

async function getAccessToken(refreshToken, clientId, clientSecret) {
    const now = Date.now();
    
    // If we have a valid cached token, return it
    if (tokenCache.accessToken && now < tokenCache.expiresAt) {
        console.log('Using cached access token, expires in:', 
            Math.round((tokenCache.expiresAt - now) / 1000), 'seconds');
        return tokenCache.accessToken;
    }
    
    // Prevent rapid refresh attempts
    const timeSinceLastRefresh = now - tokenCache.lastRefreshTime;
    if (timeSinceLastRefresh < 2000) { // 2 second minimum between refreshes
        console.log('Rate limiting: too soon since last refresh');
        throw new Error('rate_limited');
    }
    
    // If a refresh is already in progress, wait for it
    if (tokenCache.refreshPromise) {
        console.log('Waiting for in-progress token refresh');
        try {
            return await tokenCache.refreshPromise;
        } catch (error) {
            console.error('Existing refresh failed:', error.message);
            tokenCache.refreshPromise = null;
        }
    }
    
    // Start a new refresh
    console.log('Starting new token refresh at:', new Date().toISOString());
    tokenCache.lastRefreshTime = now;
    
    tokenCache.refreshPromise = (async () => {
        try {
            const params = new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret
            });
            
            console.log('Making token request with params length:', params.toString().length);
            
            const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params,
                // Add timeout
                signal: AbortSignal.timeout(10000) // 10 second timeout
            });
            
            const responseText = await tokenResponse.text();
            console.log('Token response status:', tokenResponse.status);
            console.log('Response preview:', responseText.substring(0, 100));
            
            let tokenData;
            try {
                tokenData = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Failed to parse token response:', parseError);
                throw new Error('Invalid response from Spotify');
            }
            
            if (tokenData.error) {
                console.error('Spotify error:', tokenData.error, tokenData.error_description);
                
                // Clear cache on authentication errors
                if (tokenData.error === 'invalid_grant') {
                    tokenCache.accessToken = null;
                    tokenCache.expiresAt = null;
                }
                
                throw new Error(tokenData.error);
            }
            
            // Successfully got a new token
            tokenCache.accessToken = tokenData.access_token;
            tokenCache.expiresAt = now + ((tokenData.expires_in - 300) * 1000); // Refresh 5 minutes early
            
            console.log('New access token obtained, expires at:', 
                new Date(tokenCache.expiresAt).toISOString());
            
            // Check if Spotify sent a new refresh token (they sometimes do)
            if (tokenData.refresh_token && tokenData.refresh_token !== refreshToken) {
                console.warn('IMPORTANT: Spotify sent a new refresh token!');
                console.warn('You must update SPOTIFY_REFRESH_TOKEN environment variable to:', 
                    tokenData.refresh_token.substring(0, 10) + '...');
            }
            
            return tokenData.access_token;
            
        } catch (error) {
            console.error('Token refresh error:', error.message);
            // Clear the cache on error
            tokenCache.accessToken = null;
            tokenCache.expiresAt = null;
            throw error;
        } finally {
            tokenCache.refreshPromise = null;
        }
    })();
    
    return await tokenCache.refreshPromise;
}

module.exports = async function handler(req, res) {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[${requestId}] ${new Date().toISOString()} - Current track request`);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        // Validate environment
        if (!validateEnvironment()) {
            return res.status(200).json({ 
                error: 'Server configuration error',
                details: 'Missing required environment variables'
            });
        }
        
        const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
        const clientId = process.env.SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
        
        let accessToken;
        try {
            accessToken = await getAccessToken(refreshToken, clientId, clientSecret);
        } catch (error) {
            console.error(`[${requestId}] Token error:`, error.message);
            
            if (error.message === 'invalid_grant') {
                return res.status(200).json({ 
                    error: 'Refresh token expired or revoked',
                    needsNewToken: true,
                    details: 'Please re-authenticate with Spotify',
                    timestamp: new Date().toISOString()
                });
            }
            
            if (error.message === 'rate_limited') {
                return res.status(200).json({ 
                    error: 'Too many requests',
                    retry: true,
                    details: 'Please wait a moment before retrying'
                });
            }
            
            // Log the actual error for debugging
            console.error(`[${requestId}] Unexpected error:`, error);
            
            return res.status(200).json({ 
                error: 'Authentication failed',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        // Get current track
        try {
            console.log(`[${requestId}] Fetching current track`);
            
            const trackResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            
            console.log(`[${requestId}] Track response:`, trackResponse.status);
            
            if (trackResponse.status === 204) {
                return res.status(200).json(null);
            }
            
            if (trackResponse.status === 401) {
                // Access token is invalid, clear cache and retry once
                console.log(`[${requestId}] Access token invalid, clearing cache`);
                tokenCache.accessToken = null;
                tokenCache.expiresAt = null;
                
                // Try once more with a fresh token
                try {
                    accessToken = await getAccessToken(refreshToken, clientId, clientSecret);
                    const retryResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    });
                    
                    if (retryResponse.ok) {
                        const trackData = await retryResponse.json();
                        return handleTrackData(trackData, res);
                    }
                } catch (retryError) {
                    console.error(`[${requestId}] Retry failed:`, retryError.message);
                }
                
                return res.status(200).json({ 
                    error: 'Authentication failed',
                    needsNewToken: true,
                    details: 'Unable to authenticate with Spotify'
                });
            }
            
            if (trackResponse.ok) {
                const trackData = await trackResponse.json();
                return handleTrackData(trackData, res);
            }
            
            console.error(`[${requestId}] Unexpected status:`, trackResponse.status);
            return res.status(200).json(null);
            
        } catch (trackError) {
            console.error(`[${requestId}] Track fetch error:`, trackError.message);
            return res.status(200).json({ 
                error: 'Failed to fetch track',
                details: trackError.message
            });
        }
        
    } catch (error) {
        console.error(`[${requestId}] Handler error:`, error);
        return res.status(200).json({ 
            error: 'Server error',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

function handleTrackData(trackData, res) {
    if (trackData.is_playing && trackData.item) {
        return res.status(200).json({
            name: trackData.item.name,
            artists: trackData.item.artists.map(artist => artist.name),
            album: trackData.item.album.name,
            image: trackData.item.album.images[0]?.url,
            duration_ms: trackData.item.duration_ms,
            progress_ms: trackData.progress_ms,
            external_urls: trackData.item.external_urls,
            timestamp: new Date().toISOString()
        });
    }
    
    return res.status(200).json(null);
}
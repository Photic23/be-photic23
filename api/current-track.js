let accessToken = null;
let tokenExpiry = null;
let refreshPromise = null;

async function getValidAccessToken(retryCount = 0) {
    // Check if we have a valid cached token (with 5 minute buffer)
    if (accessToken && tokenExpiry && new Date() < new Date(tokenExpiry - 5 * 60 * 1000)) {
        console.log('Using cached access token');
        return accessToken;
    }
    
    // If we're already refreshing, wait for that to complete
    if (refreshPromise) {
        console.log('Waiting for ongoing refresh...');
        try {
            return await refreshPromise;
        } catch (error) {
            if (retryCount < 1) {
                console.log('Refresh failed, retrying...');
                refreshPromise = null;
                return getValidAccessToken(retryCount + 1);
            }
            throw error;
        }
    }
    
    // Start a new refresh
    refreshPromise = refreshAccessToken();
    
    try {
        const token = await refreshPromise;
        refreshPromise = null;
        return token;
    } catch (error) {
        refreshPromise = null;
        throw error;
    }
}

async function refreshAccessToken() {
    console.log('Refreshing access token...');
    
    const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    
    if (!refreshToken || !clientId) {
        throw new Error('Missing credentials');
    }
    
    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: clientId,
            }),
        });
        
        const data = await response.json();
        
        if (data.error) {
            console.error('Token refresh error:', data);
            
            // If refresh token is revoked, clear everything
            if (data.error === 'invalid_grant') {
                accessToken = null;
                tokenExpiry = null;
            }
            
            throw new Error(data.error_description || data.error);
        }
        
        if (!data.access_token) {
            throw new Error('No access token in response');
        }
        
        // Cache the new token with conservative expiry (30 minutes instead of 60)
        accessToken = data.access_token;
        tokenExpiry = new Date(Date.now() + 30 * 60 * 1000);
        
        console.log('Access token refreshed successfully, expires at:', tokenExpiry.toISOString());
        return accessToken;
        
    } catch (error) {
        // Clear cached token on error
        accessToken = null;
        tokenExpiry = null;
        throw error;
    }
}

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        let token;
        let attempts = 0;
        const maxAttempts = 2;
        
        while (attempts < maxAttempts) {
            try {
                token = await getValidAccessToken();
                break;
            } catch (error) {
                attempts++;
                console.error(`Attempt ${attempts} failed:`, error.message);
                
                if (error.message.includes('Refresh token revoked')) {
                    // Refresh token is dead, nothing we can do
                    return res.status(200).json({ 
                        error: 'Refresh token revoked. Please re-authenticate.',
                        needsNewToken: true 
                    });
                }
                
                if (attempts >= maxAttempts) {
                    throw error;
                }
                
                // Wait a bit before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Fetch current track
        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('Spotify API response:', response.status);
        
        if (response.status === 204) {
            return res.status(200).json(null);
        }
        
        if (response.status === 401) {
            // Token expired unexpectedly
            console.log('Token expired unexpectedly, clearing cache');
            accessToken = null;
            tokenExpiry = null;
            
            // Try once more with a fresh token
            try {
                const newToken = await getValidAccessToken();
                const retryResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
                    headers: {
                        'Authorization': `Bearer ${newToken}`
                    }
                });
                
                if (retryResponse.ok) {
                    const data = await retryResponse.json();
                    return res.status(200).json(data.is_playing ? data.item : null);
                }
            } catch (retryError) {
                console.error('Retry failed:', retryError.message);
            }
            
            return res.status(200).json(null);
        }
        
        if (response.ok) {
            const data = await response.json();
            return res.status(200).json(data.is_playing ? data.item : null);
        }
        
        return res.status(200).json(null);
        
    } catch (error) {
        console.error('Error in current-track:', error.message);
        return res.status(200).json(null);
    }
};
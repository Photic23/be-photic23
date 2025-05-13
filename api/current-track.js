let accessToken = null;
let tokenExpiry = null;
let refreshPromise = null;

async function getValidAccessToken() {
    // If we have a valid token, return it
    if (accessToken && tokenExpiry && new Date() < tokenExpiry) {
        console.log('Using cached access token');
        return accessToken;
    }
    
    // If we're already refreshing, wait for that to complete
    if (refreshPromise) {
        console.log('Waiting for ongoing refresh...');
        return await refreshPromise;
    }
    
    // Start a new refresh
    refreshPromise = refreshAccessToken();
    const token = await refreshPromise;
    refreshPromise = null;
    return token;
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
            throw new Error(data.error_description || data.error);
        }
        
        if (!data.access_token) {
            throw new Error('No access token in response');
        }
        
        // Cache the new token
        accessToken = data.access_token;
        // Set expiry to 55 minutes (tokens last 60 minutes)
        tokenExpiry = new Date(Date.now() + 55 * 60 * 1000);
        
        console.log('Access token refreshed successfully');
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
        // Get valid access token (cached or refreshed)
        const token = await getValidAccessToken();
        
        // Fetch current track
        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 204) {
            return res.status(200).json(null);
        }
        
        if (response.status === 401) {
            // Token expired unexpectedly, clear cache and try once more
            console.log('Token expired unexpectedly, retrying...');
            accessToken = null;
            tokenExpiry = null;
            
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
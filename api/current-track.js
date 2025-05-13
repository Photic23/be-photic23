const tokenStore = {
    accessToken: null,
    expiresAt: null,
    refreshToken: null,
    isRefreshing: false,
    lastError: null
};

async function getAccessToken() {
    const now = Date.now();
    
    // If we have a valid token, use it
    if (tokenStore.accessToken && tokenStore.expiresAt && now < tokenStore.expiresAt) {
        return tokenStore.accessToken;
    }
    
    // If already refreshing, wait a bit and check again
    if (tokenStore.isRefreshing) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return tokenStore.accessToken;
    }
    
    // Need to refresh
    tokenStore.isRefreshing = true;
    
    try {
        const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
        const clientId = process.env.SPOTIFY_CLIENT_ID;
        
        if (!refreshToken || !clientId) {
            throw new Error('Missing credentials');
        }
        
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
            tokenStore.lastError = data;
            if (data.error === 'invalid_grant') {
                throw new Error('Refresh token revoked. Please re-authenticate.');
            }
            throw new Error(data.error_description || data.error);
        }
        
        // Store the new token (expires in 30 minutes to be safe)
        tokenStore.accessToken = data.access_token;
        tokenStore.expiresAt = now + (30 * 60 * 1000);
        tokenStore.lastError = null;
        
        return data.access_token;
        
    } catch (error) {
        tokenStore.accessToken = null;
        tokenStore.expiresAt = null;
        throw error;
    } finally {
        tokenStore.isRefreshing = false;
    }
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        const accessToken = await getAccessToken();
        
        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.status === 204) {
            return res.status(200).json(null);
        }
        
        if (response.status === 401) {
            // Token expired, clear it
            tokenStore.accessToken = null;
            tokenStore.expiresAt = null;
            throw new Error('Token expired');
        }
        
        if (response.ok) {
            const data = await response.json();
            return res.status(200).json(data.is_playing ? data.item : null);
        }
        
        return res.status(200).json(null);
        
    } catch (error) {
        console.error('Error:', error.message);
        
        if (error.message.includes('revoked')) {
            return res.status(200).json({ 
                error: error.message,
                needsNewToken: true 
            });
        }
        
        return res.status(200).json(null);
    }
};
// api/token-status.js - Monitor token status
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Get the current cache status from the current-track module
    const status = {
        time: new Date().toISOString(),
        hasRefreshToken: !!process.env.SPOTIFY_REFRESH_TOKEN,
        hasClientId: !!process.env.SPOTIFY_CLIENT_ID,
        // These would need to be exported from current-track.js
        // For now, just test if we can refresh
    };
    
    try {
        // Test if refresh token works
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: process.env.SPOTIFY_REFRESH_TOKEN,
                client_id: process.env.SPOTIFY_CLIENT_ID,
            }),
        });
        
        const data = await response.json();
        
        status.refreshTokenStatus = data.error ? `Error: ${data.error}` : 'Valid';
        status.tokenResponse = data;
        
    } catch (error) {
        status.refreshTokenStatus = `Error: ${error.message}`;
    }
    
    return res.status(200).json(status);
};
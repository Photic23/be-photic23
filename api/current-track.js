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
        
        if (!refreshToken || !clientId) {
            console.log('Missing credentials');
            return res.status(200).json(null);
        }
        
        // Always get a fresh access token - simple approach
        console.log('Getting access token...');
        
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
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
        
        const tokenData = await tokenResponse.json();
        console.log('Token response:', tokenResponse.status, tokenData.error || 'success');
        
        if (tokenData.error) {
            console.error('Token error:', tokenData);
            
            if (tokenData.error === 'invalid_grant') {
                return res.status(200).json({ 
                    error: 'Refresh token revoked. Please re-authenticate.',
                    needsNewToken: true 
                });
            }
            
            return res.status(200).json(null);
        }
        
        const accessToken = tokenData.access_token;
        
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
        
        if (trackResponse.ok) {
            const trackData = await trackResponse.json();
            console.log('Track playing:', trackData.is_playing, trackData.item?.name);
            return res.status(200).json(trackData.is_playing ? trackData.item : null);
        }
        
        return res.status(200).json(null);
        
    } catch (error) {
        console.error('Error:', error.message);
        return res.status(200).json(null);
    }
};
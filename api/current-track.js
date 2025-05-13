module.exports = async function handler(req, res) {
    // Simple CORS for all origins
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
            console.log('Missing environment variables');
            return res.status(200).json(null);
        }

        // Get fresh access token
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
        
        if (!tokenData.access_token) {
            console.error('Failed to get access token:', tokenData);
            return res.status(200).json(null);
        }

        // Get current track
        const trackResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`
            }
        });

        if (trackResponse.status === 204) {
            // No content - nothing playing
            return res.status(200).json(null);
        }

        if (trackResponse.ok) {
            const trackData = await trackResponse.json();
            // Check if actually playing
            if (trackData.is_playing) {
                return res.status(200).json(trackData.item);
            }
        }

        return res.status(200).json(null);
    } catch (error) {
        console.error('Error:', error);
        return res.status(200).json(null);
    }
};
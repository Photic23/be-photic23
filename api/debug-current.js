module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
        
        if (!refreshToken) {
            return res.status(200).json({ error: 'No refresh token' });
        }

        // Get access token
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
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

        const tokenData = await tokenResponse.json();
        
        if (tokenData.error) {
            return res.status(200).json({ 
                error: 'Token error',
                details: tokenData 
            });
        }

        // Get current track with full debug info
        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`
            }
        });

        if (response.status === 204) {
            return res.status(200).json({ 
                status: 204,
                message: 'No content - nothing playing or no active device' 
            });
        }

        if (response.ok) {
            const data = await response.json();
            return res.status(200).json({
                status: response.status,
                is_playing: data.is_playing,
                track_name: data.item?.name,
                artist: data.item?.artists?.[0]?.name,
                device: data.device?.name,
                device_active: data.device?.is_active,
                timestamp: new Date().toISOString()
            });
        }

        return res.status(200).json({ 
            status: response.status,
            message: 'Unknown response' 
        });

    } catch (error) {
        return res.status(200).json({ 
            error: error.message,
            stack: error.stack 
        });
    }
};
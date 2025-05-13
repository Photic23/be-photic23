// api/current-track.js - Use env variable instead of database
module.exports = async function handler(req, res) {
    // CORS
    const allowedOrigins = [
        'https://photic23.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001'
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Get refresh token from environment variable instead of database
        const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
        
        if (!refreshToken) {
            console.log('No refresh token in environment');
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
                client_id: process.env.SPOTIFY_CLIENT_ID,
            }),
        });

        const tokenData = await tokenResponse.json();
        
        if (tokenData.error) {
            console.log('Token refresh failed:', tokenData);
            return res.status(200).json(null);
        }

        // Get current track
        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`
            }
        });

        if (response.status === 204) {
            return res.status(200).json(null);
        }

        if (response.ok) {
            const data = await response.json();
            // Only return if actually playing
            if (data?.is_playing) {
                return res.status(200).json(data.item);
            }
        }

        return res.status(200).json(null);
    } catch (error) {
        console.error('Error:', error);
        return res.status(200).json(null);
    }
};
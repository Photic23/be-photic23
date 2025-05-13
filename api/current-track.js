const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Get refresh token from env
        const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
        
        if (!refreshToken) {
            return res.status(200).json(null);
        }

        // Always get a fresh access token using refresh token
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
        
        if (!tokenData.access_token) {
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
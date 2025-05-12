import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://photic23.vercel.app');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Get the stored access token
        const accessToken = await kv.get('spotify_access_token');
        
        if (!accessToken) {
            return res.status(200).json(null);
        }

        // Check if token is expired
        const expirationTime = await kv.get('spotify_token_expiration');
        if (expirationTime && new Date().getTime() > parseInt(expirationTime)) {
            // Token is expired, try to refresh it
            const newToken = await refreshSpotifyToken();
            if (!newToken) {
                return res.status(200).json(null);
            }
        }

        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (response.status === 204) {
            return res.status(200).json(null);
        }

        if (response.status === 401) {
            // Token expired, try to refresh
            const newToken = await refreshSpotifyToken();
            if (newToken) {
                // Retry with new token
                const retryResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
                    headers: {
                        'Authorization': `Bearer ${newToken}`
                    }
                });
                
                if (retryResponse.ok) {
                    const data = await retryResponse.json();
                    return res.status(200).json(data.item);
                }
            }
            return res.status(200).json(null);
        }

        if (response.ok) {
            const data = await response.json();
            return res.status(200).json(data.item);
        }

        return res.status(200).json(null);
    } catch (error) {
        console.error('Error fetching current track:', error);
        return res.status(500).json({ error: 'Failed to fetch current track' });
    }
}

async function refreshSpotifyToken() {
    const refreshToken = await kv.get('spotify_refresh_token');
    if (!refreshToken) return null;

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
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

        const data = await response.json();
        if (data.access_token) {
            // Store the new tokens
            await kv.set('spotify_access_token', data.access_token);
            if (data.refresh_token) {
                await kv.set('spotify_refresh_token', data.refresh_token);
            }
            
            // Update expiration time
            const expirationTime = new Date().getTime() + (data.expires_in * 1000);
            await kv.set('spotify_token_expiration', expirationTime.toString());
            
            return data.access_token;
        }
    } catch (error) {
        console.error('Error refreshing token:', error);
    }
    return null;
}

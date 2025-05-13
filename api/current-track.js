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
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
        
        if (!refreshToken || !clientId || !clientSecret) {
            console.error('Missing credentials:', {
                hasRefreshToken: !!refreshToken,
                hasClientId: !!clientId,
                hasClientSecret: !!clientSecret
            });
            return res.status(200).json({ 
                error: 'Missing Spotify credentials',
                details: 'Server configuration error'
            });
        }
        
        // Get fresh access token
        console.log('Getting access token...');
        console.log('Using refresh token:', refreshToken.substring(0, 10) + '...'); // Log first 10 chars for debugging
        
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret
            }),
        });
        
        const tokenData = await tokenResponse.json();
        console.log('Token response:', {
            status: tokenResponse.status,
            error: tokenData.error,
            hasAccessToken: !!tokenData.access_token,
            hasNewRefreshToken: !!tokenData.refresh_token // Check if Spotify sent a new refresh token
        });
        
        if (tokenData.error) {
            console.error('Token error:', tokenData);
            
            if (tokenData.error === 'invalid_grant') {
                return res.status(200).json({ 
                    error: 'Refresh token expired or revoked',
                    needsNewToken: true,
                    details: 'Please re-authenticate with Spotify'
                });
            }
            
            return res.status(200).json({ 
                error: 'Authentication failed',
                details: tokenData.error_description || tokenData.error
            });
        }
        
        // Important: Check if Spotify sent a new refresh token
        if (tokenData.refresh_token && tokenData.refresh_token !== refreshToken) {
            console.warn('WARNING: Spotify sent a new refresh token! You need to update your environment variable.');
            console.log('New refresh token (first 10 chars):', tokenData.refresh_token.substring(0, 10) + '...');
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
            
            if (trackData.is_playing && trackData.item) {
                return res.status(200).json({
                    name: trackData.item.name,
                    artists: trackData.item.artists.map(artist => artist.name),
                    album: trackData.item.album.name,
                    image: trackData.item.album.images[0]?.url,
                    duration_ms: trackData.item.duration_ms,
                    progress_ms: trackData.progress_ms,
                    external_urls: trackData.item.external_urls
                });
            }
            
            return res.status(200).json(null);
        }
        
        return res.status(200).json(null);
        
    } catch (error) {
        console.error('Error:', error.message);
        return res.status(200).json({ 
            error: 'Server error',
            details: error.message
        });
    }
};
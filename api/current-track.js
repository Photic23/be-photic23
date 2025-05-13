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
        console.log('Token response:', tokenResponse.status, tokenData.error || 'success');
        
        if (tokenData.error) {
            console.error('Token error:', tokenData);
            
            if (tokenData.error === 'invalid_grant') {
                return res.status(200).json({ 
                    error: 'Refresh token expired or revoked',
                    needsNewToken: true,
                    details: 'Please re-authenticate with Spotify'
                });
            }
            
            if (tokenData.error === 'invalid_client') {
                return res.status(200).json({ 
                    error: 'Invalid client credentials',
                    details: 'Check SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET'
                });
            }
            
            return res.status(200).json({ 
                error: 'Authentication failed',
                details: tokenData.error_description || tokenData.error
            });
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
            // No content - nothing playing
            return res.status(200).json(null);
        }
        
        if (trackResponse.status === 401) {
            console.error('Unauthorized - token might be invalid');
            return res.status(200).json({ 
                error: 'Authorization failed',
                needsNewToken: true
            });
        }
        
        if (trackResponse.ok) {
            const trackData = await trackResponse.json();
            console.log('Track playing:', trackData.is_playing, trackData.item?.name);
            
            if (trackData.is_playing && trackData.item) {
                // Return only essential track information
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
        
        console.error('Unexpected response status:', trackResponse.status);
        return res.status(200).json(null);
        
    } catch (error) {
        console.error('Error:', error.message);
        return res.status(200).json({ 
            error: 'Server error',
            details: error.message
        });
    }
};
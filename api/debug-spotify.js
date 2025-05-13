module.exports = async function handler(req, res) {
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
        // Get tokens
        let accessToken = process.env.SPOTIFY_ACCESS_TOKEN;
        if (!accessToken) {
            const { data: tokenData } = await supabase
                .from('spotify_tokens')
                .select('*')
                .eq('id', 1)
                .single();
            accessToken = tokenData?.access_token;
        }

        if (!accessToken) {
            return res.status(200).json({ error: 'No access token found' });
        }

        // Fetch current playback state
        const response = await fetch('https://api.spotify.com/v1/me/player', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (response.status === 204) {
            return res.status(200).json({ 
                message: 'No active device',
                status: 204 
            });
        }

        if (response.ok) {
            const data = await response.json();
            return res.status(200).json({
                is_playing: data.is_playing,
                device: data.device,
                shuffle_state: data.shuffle_state,
                repeat_state: data.repeat_state,
                current_track: data.item?.name,
                artist: data.item?.artists?.[0]?.name,
                progress: data.progress_ms,
                duration: data.item?.duration_ms,
                status: response.status
            });
        }

        return res.status(200).json({ 
            error: 'Failed to fetch playback state',
            status: response.status 
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
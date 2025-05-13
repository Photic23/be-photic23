module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const status = {
        time: new Date().toISOString(),
        hasRefreshToken: !!process.env.SPOTIFY_REFRESH_TOKEN,
        hasClientId: !!process.env.SPOTIFY_CLIENT_ID,
        refreshTokenStatus: 'Not tested - would invalidate current session',
        advice: 'Do not test refresh token if current session is working'
    };
    
    // DO NOT test the refresh token - just report its presence
    if (process.env.SPOTIFY_REFRESH_TOKEN && process.env.SPOTIFY_CLIENT_ID) {
        status.message = 'Credentials are configured. Do not test refresh if current track is working.';
    } else {
        status.message = 'Missing credentials';
    }
    
    return res.status(200).json(status);
};
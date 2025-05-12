module.exports = function handler(req, res) {
    // Enable CORS
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
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');
        return res.status(200).end();
    }
    
    try {
        // Parse cookies safely
        const cookies = req.headers.cookie?.split('; ').reduce((acc, cookie) => {
            const [key, value] = cookie.split('=');
            if (key && value) {
                acc[key] = value;
            }
            return acc;
        }, {}) || {};
        
        const authorized = cookies.spotify_session === 'authorized';
        return res.status(200).json({ authorized });
    } catch (error) {
        console.error('Error in auth-status:', error);
        return res.status(200).json({ authorized: false });
    }
};
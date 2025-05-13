module.exports = function handler(req, res) {
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
    
    // Always return authorized if we have hardcoded tokens
    const hasHardcodedTokens = process.env.SPOTIFY_ACCESS_TOKEN && process.env.SPOTIFY_REFRESH_TOKEN;
    
    return res.status(200).json({ authorized: hasHardcodedTokens });
};
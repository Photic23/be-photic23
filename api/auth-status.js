export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://photic23.vercel.app');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Parse cookies
    const cookies = req.headers.cookie?.split('; ').reduce((acc, cookie) => {
        const [key, value] = cookie.split('=');
        acc[key] = value;
        return acc;
    }, {}) || {};
    
    const authorized = cookies.spotify_session === 'authorized';
    return res.status(200).json({ authorized });
}

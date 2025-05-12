import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://photic23.vercel.app');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Clear stored tokens
        await kv.del('spotify_access_token');
        await kv.del('spotify_refresh_token');
        await kv.del('spotify_token_expiration');
        
        // Clear session cookie
        res.setHeader('Set-Cookie', `spotify_session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`);
        
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error during logout:', error);
        return res.status(500).json({ error: 'Failed to logout' });
    }
}
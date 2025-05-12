const { createClient } = require('@supabase/supabase-js');

let supabase;
try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
    }
} catch (error) {
    console.error('Supabase initialization error:', error);
}

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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!supabase) {
        return res.status(200).json({ success: true });
    }

    try {
        // Clear stored tokens
        await supabase
            .from('spotify_tokens')
            .delete()
            .eq('id', 1);
        
        // Clear session cookie
        res.setHeader('Set-Cookie', `spotify_session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`);
        
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error during logout:', error);
        return res.status(500).json({ error: 'Failed to logout' });
    }
};
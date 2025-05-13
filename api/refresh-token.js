// module.exports = async function handler(req, res) {
//     const allowedOrigins = [
//         'https://photic23.vercel.app',
//         'http://localhost:3000',
//         'http://localhost:3001'
//     ];
    
//     const origin = req.headers.origin;
//     if (allowedOrigins.includes(origin)) {
//         res.setHeader('Access-Control-Allow-Origin', origin);
//     }
    
//     res.setHeader('Access-Control-Allow-Credentials', 'true');
    
//     if (req.method === 'OPTIONS') {
//         return res.status(200).end();
//     }

//     try {
//         const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
        
//         if (!refreshToken) {
//             return res.status(400).json({ error: 'No refresh token configured' });
//         }

//         const response = await fetch('https://accounts.spotify.com/api/token', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/x-www-form-urlencoded',
//             },
//             body: new URLSearchParams({
//                 grant_type: 'refresh_token',
//                 refresh_token: refreshToken,
//                 client_id: process.env.SPOTIFY_CLIENT_ID,
//             }),
//         });

//         const data = await response.json();
        
//         if (response.ok && data.access_token) {
//             // Clear the cache to force using new token
//             cachedAccessToken = null;
//             tokenExpiresAt = null;
            
//             return res.status(200).json({ 
//                 success: true,
//                 message: 'Token refreshed successfully',
//                 expires_in: data.expires_in
//             });
//         } else {
//             return res.status(400).json({ 
//                 error: 'Failed to refresh token',
//                 details: data 
//             });
//         }
//     } catch (error) {
//         return res.status(500).json({ error: error.message });
//     }
// };
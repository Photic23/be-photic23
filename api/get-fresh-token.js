// module.exports = async function handler(req, res) {
//     const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
//     const REDIRECT_URI = 'https://be-photic23.vercel.app/api/auth-callback-temp';
    
//     if (req.query.start) {
//         // Generate random values
//         const state = Math.random().toString(36).substring(7);
//         const codeVerifier = Array(128).fill(0).map(() => 
//             'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
//                 .charAt(Math.floor(Math.random() * 66))
//         ).join('');
        
//         // Store in cookies (temporary)
//         res.setHeader('Set-Cookie', [
//             `state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/`,
//             `code_verifier=${codeVerifier}; HttpOnly; Secure; SameSite=Lax; Path=/`
//         ]);
        
//         // Generate code challenge
//         const encoder = new TextEncoder();
//         const data = encoder.encode(codeVerifier);
//         const digest = await crypto.subtle.digest('SHA-256', data);
//         const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
//             .replace(/\+/g, '-')
//             .replace(/\//g, '_')
//             .replace(/=+$/, '');
        
//         const params = new URLSearchParams({
//             response_type: 'code',
//             client_id: CLIENT_ID,
//             scope: 'user-read-currently-playing',
//             redirect_uri: REDIRECT_URI,
//             state: state,
//             code_challenge_method: 'S256',
//             code_challenge: codeChallenge
//         });
        
//         return res.redirect(`https://accounts.spotify.com/authorize?${params}`);
//     }
    
//     return res.status(200).send(`
//         <html>
//             <body style="font-family: Arial; padding: 20px;">
//                 <h1>Get Fresh Spotify Token</h1>
//                 <p>This will get you a new refresh token.</p>
//                 <a href="/api/get-fresh-token?start=true" 
//                    style="background: #1db954; color: white; padding: 10px 20px; 
//                           text-decoration: none; border-radius: 20px; display: inline-block;">
//                     Start Authentication
//                 </a>
//             </body>
//         </html>
//     `);
// };
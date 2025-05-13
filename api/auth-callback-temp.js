// module.exports = async function handler(req, res) {
//     const { code, state } = req.query;
    
//     // Get code_verifier from cookie
//     const cookies = req.headers.cookie?.split('; ').reduce((acc, cookie) => {
//         const [key, value] = cookie.split('=');
//         acc[key] = value;
//         return acc;
//     }, {}) || {};
    
//     const codeVerifier = cookies.code_verifier;
    
//     if (!code || !codeVerifier) {
//         return res.status(400).send('Missing code or verifier');
//     }
    
//     try {
//         const response = await fetch('https://accounts.spotify.com/api/token', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/x-www-form-urlencoded',
//             },
//             body: new URLSearchParams({
//                 grant_type: 'authorization_code',
//                 code: code,
//                 redirect_uri: 'https://be-photic23.vercel.app/api/auth-callback-temp',
//                 client_id: process.env.SPOTIFY_CLIENT_ID,
//                 code_verifier: codeVerifier,
//             }),
//         });
        
//         const data = await response.json();
        
//         if (data.refresh_token) {
//             return res.status(200).send(`
//                 <html>
//                     <body style="font-family: Arial; padding: 20px;">
//                         <h1>Success!</h1>
//                         <h2>Your New Refresh Token:</h2>
//                         <pre style="background: #000; color: #0f0; padding: 20px; 
//                                    word-wrap: break-word; overflow-x: auto;">
// ${data.refresh_token}
//                         </pre>
//                         <h3>Add this to Vercel Environment Variables:</h3>
//                         <pre style="background: #f0f0f0; padding: 20px;">
// SPOTIFY_REFRESH_TOKEN=${data.refresh_token}
//                         </pre>
//                         <p>After adding to Vercel, redeploy your app.</p>
//                     </body>
//                 </html>
//             `);
//         } else {
//             return res.status(400).json(data);
//         }
//     } catch (error) {
//         return res.status(500).send(error.message);
//     }
// };
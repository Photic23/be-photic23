module.exports = async function handler(req, res) {
    // This endpoint is to help you get your initial tokens
    // You can remove it after getting your tokens
    
    res.status(200).json({
        message: "To set up permanent authentication:",
        steps: [
            "1. Use the frontend to authenticate once",
            "2. Check Supabase dashboard for your tokens",
            "3. Add these as environment variables in Vercel:",
            "   - SPOTIFY_ACCESS_TOKEN",
            "   - SPOTIFY_REFRESH_TOKEN",
            "4. The backend will now always use these tokens"
        ]
    });
};
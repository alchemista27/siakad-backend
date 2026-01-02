const jwt = require('jsonwebtoken');
// Use the same env var name as authController: JWT_SECRET. Keep a fallback for older name.
const SECRET_KEY = process.env.JWT_SECRET || process.env.SECRET_KEY || 'rahasia';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // Format token: "Bearer <token>"
    const token = authHeader && authHeader.split(' ')[1];
    // Debug/logging untuk membantu diagnosa 403
    console.log('[auth] Authorization header:', !!authHeader);
    if (authHeader) console.log('[auth] Authorization header value (first 50 chars):', authHeader.slice(0, 50));

    if (!token) {
        console.warn('[auth] No token provided');
        return res.status(401).json({ error: 'Token tidak ditemukan' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.warn('[auth] Token verification failed:', err && err.message);
            return res.status(401).json({ error: 'Token tidak valid atau kedaluwarsa' });
        }

        // Simpan data user dari token ke request object
        req.user = user;
        next();
    });
};

module.exports = authenticateToken;
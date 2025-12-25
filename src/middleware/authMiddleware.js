const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY || 'rahasia';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // Format token: "Bearer <token>"
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403); //Forbidden

        // Simpan data user dari token ke request object
        req.user = user;
        next();
    });
};

module.exports = authenticateToken;
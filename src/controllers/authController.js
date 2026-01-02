const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
// Gunakan nama variabel dan fallback yang konsisten dengan middleware untuk menghindari error token
const SECRET_KEY = process.env.JWT_SECRET || process.env.SECRET_KEY || 'rahasia';

const login = async (req, res) => {
    const { username, password } = req.body;

    try {
        // Cari user
        const user = await prisma.user.findUnique({
            where: { username },
            include: {
                teacherProfile: true,
                studentProfile: true,
            }
        });

        if (!user) {
            return res.status(401).json({ error: 'username tidak ditemukan'});
        }

        // Cek password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Password salah'});
        }

        // Buat payload token
        let profileId = null;
        let fullName = 'Admin';

        if (user.role === 'TEACHER') {
            profileId = user.teacherProfile.id;
            fullName = user.teacherProfile.fullName;
        } else if (user.role === 'STUDENT') {
            profileId = user.studentProfile.id;
            fullName = user.studentProfile.fullName;
        }

        const token = jwt.sign(
            {
                userId: user.id,
                role: user.role,
                profileId: profileId
            },
            SECRET_KEY,
            { expiresIn: '1d' }
        );

        res.json({
            message: 'Login berhasil',
            token,
            user: {
                username: user.username,
                role: user.role,
                fullName: fullName
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message});
    }
};

module.exports = { login };
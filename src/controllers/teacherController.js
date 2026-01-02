const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Ambil kelas yang di ajar oleh guru yang login
const getMyClasses = async (req, res) => {
    try {
        // Ambil data dari token: jika ada `profileId` (Teacher.id) gunakan itu,
        // kalau tidak gunakan `userId` (User.id) dan cari Teacher by userId.
        const { userId, profileId } = req.user || {};

        console.log("=== Debugging Teacher Classes ===");
        console.log("Token payload userId:", userId, "profileId:", profileId);

        let teacherProfile = null;
        if (profileId) {
            teacherProfile = await prisma.teacher.findUnique({ where: { id: parseInt(profileId) } });
        } else if (userId) {
            teacherProfile = await prisma.teacher.findUnique({ where: { userId: parseInt(userId) } });
        }

        // Cek user terdaftar sebagai guru atau tidak
        if (!teacherProfile) {
            console.log("Error: user ini tidak memiliki akses sebagai guru.");
            return res.status(404).json({ error: 'Profile guru tidak ditemukan untuk user ini.' });
        }

        console.log("Profile guru ditemukan:", teacherProfile);
        console.log("Menggunakan Teacher ID:", teacherProfile.id);

        // Ambil data kelas yang diajar oleh guru
        const classes = await prisma.teachingAssignment.findMany({
            where: {
                teacherId: teacherProfile.id,
            },
            include: {
                class: true,
                subject: true,
            },
        });

        console.log(`Hasil: Ditemukan ${classes.length} kelas.`);

        res.json(classes);
    } catch (error) {
        console.error("Error mengambil kelas guru:", error);
        res.status(500).json({error: error.message});
    }
};

module.exports = { getMyClasses };
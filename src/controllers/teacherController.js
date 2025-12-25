const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Ambil kelas yang di ajar oleh guru yang login
const getMyClasses = async (req, res) => {
    try {
        const teacherId = req.user.profileId; // Asumsikan profileId adalah ID gurru

        const classes = await prisma.teachingAssignment.findMany({
            where: {
                teacherId: teacherId,
            },
            include: {
                class: true,
                subject: true,
            },
        });

        res.json(classes);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
};

module.exports = { getMyClasses };
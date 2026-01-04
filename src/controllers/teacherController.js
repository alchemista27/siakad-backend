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

// Ambil detail satu kelas ajar, termasuk daftar siswa & penilaiannya
const getAssignmentDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const assignmentId = parseInt(id);

        const assignment = await prisma.teachingAssignment.findUnique({
            where: { id: assignmentId },
            include: {
                class: {
                    include: {
                        // Ambil daftar siswa di kelas ini
                        students: {
                            include: {
                                student: true // Ambil detail profil siswa
                            }
                        }
                    }
                },
                subject: true,
                // Ambil daftar penilaian yang sudah dibuat untuk kelas ajar ini
                assessments: {
                    include: {
                        // Ambil nilai yang sudah ada untuk setiap penilaian
                        grades: true
                    }
                }
            }
        });

        if (!assignment) {
            return res.status(404).json({ error: 'Kelas ajar tidak ditemukan.' });
        }

        res.json(assignment);
    } catch (error) {
        console.error("Error mengambil detail kelas ajar:", error);
        res.status(500).json({ error: error.message });
    }
};

// Buat penilaian baru untuk sebuah kelas ajar
const createAssessment = async (req, res) => {
    try {
        const { teachingAssignmentId, name, weightPercentage } = req.body;

        if (!teachingAssignmentId || !name) {
            return res.status(400).json({ error: 'ID Kelas Ajar dan Nama Penilaian harus diisi.' });
        }

        const newAssessment = await prisma.assessment.create({
            data: {
                teachingAssignmentId: parseInt(teachingAssignmentId),
                name: name,
                // Bobot bisa opsional, default ke 0 jika tidak disediakan
                weightPercentage: weightPercentage ? parseFloat(weightPercentage) : 0,
            },
        });

        res.status(201).json(newAssessment);
    } catch (error) {
        console.error("Error membuat penilaian:", error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = { getMyClasses, getAssignmentDetails, createAssessment };
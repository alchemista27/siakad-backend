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

// Ambil rekapitulasi nilai untuk sebuah kelas ajar
const getAssignmentSummary = async (req, res) => {
    const { id: assignmentId } = req.params;
    const teacherProfileId = req.user.profileId; // Diambil dari middleware otentikasi

    try {
        // 1. Validasi dan ambil data assignment
        const assignment = await prisma.teachingAssignment.findFirst({
            where: {
                id: parseInt(assignmentId, 10),
                teacherId: teacherProfileId,
            },
            include: {
                class: {
                    include: {
                        students: {
                            include: {
                                student: true,
                            },
                            orderBy: {
                                student: {
                                    fullName: 'asc',
                                },
                            },
                        },
                    },
                },
                subject: true,
                assessments: {
                    select: {
                        id: true,
                    },
                },
            },
        });

        if (!assignment) {
            return res.status(404).json({ message: 'Data kelas ajar tidak ditemukan.' });
        }

        const assessmentIds = assignment.assessments.map((a) => a.id);
        const students = assignment.class.students.map((sc) => sc.student).filter(Boolean);

        // 2. Hitung nilai rata-rata untuk setiap siswa
        const studentSummaries = await Promise.all(
            students.map(async (student) => {
                const averageResult =
                    assessmentIds.length > 0
                        ? await prisma.grade.aggregate({
                              _avg: { score: true },
                              where: { studentId: student.id, assessmentId: { in: assessmentIds } },
                          })
                        : { _avg: { score: null } };

                return {
                    studentId: student.id,
                    nis: student.nis,
                    fullName: student.fullName,
                    averageScore: averageResult._avg.score,
                };
            })
        );

        // 3. Format respons
        const responsePayload = {
            assignment: { class: { name: assignment.class.name }, subject: { name: assignment.subject.name }, kkm: assignment.kkm },
            studentSummaries: studentSummaries,
        };

        res.json(responsePayload);
    } catch (error) {
        console.error("Error fetching grade summary:", error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const deleteAssessment = async (req, res) => {
    const { id } = req.params;
    const teacherId = req.user.profileId;
    try {
        const assessmentId = parseInt(id);

        // Otorisasi: Cek apakah guru ini memiliki kelas ajar yang menaungi penilaian ini.
        const authorizedAssignment = await prisma.teachingAssignment.findFirst({
            where: {
                teacherId: teacherId,
                assessments: {
                    some: { id: assessmentId }
                }
            }
        });

        // Jika tidak ditemukan, berarti guru tidak berhak.
        // Kita perlu bedakan antara "tidak berhak" (403) dan "tidak ada" (404).
        if (!authorizedAssignment) {
            const assessmentExists = await prisma.assessment.findUnique({ where: { id: assessmentId } });
            if (!assessmentExists) {
                return res.status(404).json({ message: 'Penilaian tidak ditemukan.' });
            } else {
                return res.status(403).json({ message: 'Anda tidak memiliki izin untuk menghapus penilaian ini.' });
            }
        }

        // Jika berhak, lanjutkan penghapusan.
        await prisma.assessment.delete({ where: { id: assessmentId } });
        res.status(200).json({ message: 'Penilaian berhasil dihapus.' });
    } catch (error) {
        console.error("Error menghapus penilaian:", error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const bulkUpdateGrades = async (req, res) => {
    const { grades } = req.body;
    const teacherId = req.user.profileId;
    if (!Array.isArray(grades)) return res.status(400).json({ message: 'Data nilai tidak valid.' });
    try {
        const assessmentIds = [...new Set(grades.map(g => g.assessmentId))];
        const assignments = await prisma.teachingAssignment.findMany({ where: { teacherId: teacherId, assessments: { some: { id: { in: assessmentIds } } } }, select: { assessments: { select: { id: true } } } });
        const allowedAssessmentIds = new Set(assignments.flatMap(a => a.assessments.map(asm => asm.id)));
        if (!grades.every(g => allowedAssessmentIds.has(g.assessmentId))) return res.status(403).json({ message: 'Anda tidak memiliki izin untuk mengubah salah satu nilai ini.' });

        // Workaround for missing composite unique key in schema.
        // This uses an interactive transaction to find and then update/create.
        await prisma.$transaction(async (tx) => {
            for (const grade of grades) {
                const existingGrade = await tx.grade.findFirst({
                    where: {
                        studentId: grade.studentId,
                        assessmentId: grade.assessmentId,
                    },
                });

                if (existingGrade) {
                    // Only update if the score is different to avoid unnecessary database writes
                    if (existingGrade.score !== grade.score) {
                        await tx.grade.update({
                            where: { id: existingGrade.id }, // Assumes 'id' is the primary key on the Grade model
                            data: { score: grade.score },
                        });
                    }
                } else {
                    await tx.grade.create({ data: grade });
                }
            }
        });

        res.status(200).json({ message: 'Perubahan nilai berhasil disimpan.' });
    } catch (error) {
        console.error("Error menyimpan nilai:", error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server saat menyimpan nilai.' });
    }
};

const getStudentReportDetails = async (req, res) => {
    const { assignmentId, studentId } = req.params;
    const teacherId = req.user.profileId;

    try {
        // 1. Otorisasi: Pastikan guru yang login berhak mengakses kelas ajar ini
        const assignment = await prisma.teachingAssignment.findFirst({
            where: {
                id: parseInt(assignmentId),
                teacherId: teacherId,
            },
            include: {
                class: true,
                subject: true,
                assessments: {
                    orderBy: {
                        id: 'asc' // Urutkan penilaian berdasarkan ID, yang mencerminkan urutan pembuatan
                    }
                }
            }
        });

        if (!assignment) {
            return res.status(403).json({ message: 'Anda tidak memiliki izin untuk mengakses laporan ini.' });
        }

        // 2. Ambil data siswa
        const student = await prisma.student.findUnique({
            where: { id: parseInt(studentId) }
        });

        if (!student) {
            return res.status(404).json({ message: 'Data siswa tidak ditemukan.' });
        }

        // 3. Ambil semua nilai siswa untuk setiap penilaian di kelas ajar ini
        const assessmentIds = assignment.assessments.map(a => a.id);
        const gradesData = await prisma.grade.findMany({
            where: {
                studentId: parseInt(studentId),
                assessmentId: { in: assessmentIds }
            }
        });

        // Buat map untuk akses nilai yang mudah: { assessmentId: score }
        const gradesMap = new Map(gradesData.map(g => [g.assessmentId, g.score]));

        // Gabungkan data penilaian dengan nilainya
        const gradesReport = assignment.assessments.map(assessment => ({
            assessmentName: assessment.name,
            score: gradesMap.get(assessment.id) ?? null // Jika siswa belum dinilai, nilainya null
        }));

        // 4. Hitung rata-rata
        const validScores = gradesData.map(g => g.score).filter(s => s !== null);
        const averageScore = validScores.length > 0
            ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
            : 0;

        // 5. Susun payload respons
        const responsePayload = {
            student: { fullName: student.fullName, nis: student.nis },
            assignment: {
                subjectName: assignment.subject.name,
                className: assignment.class.name,
                kkm: assignment.kkm
            },
            grades: gradesReport,
            summary: {
                averageScore: averageScore,
                isPassing: averageScore >= assignment.kkm
            }
        };

        res.json(responsePayload);
    } catch (error) {
        console.error("Error fetching student report:", error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

module.exports = { getMyClasses, getAssignmentDetails, createAssessment, getAssignmentSummary, deleteAssessment, bulkUpdateGrades, getStudentReportDetails };
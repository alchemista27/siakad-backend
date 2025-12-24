const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('Memulai seeding database...');

    // Hashing Password
    const passwordHash = await bcrypt.hash('admin123', 10);

    // Membuat User Admin
    const adminUser = await prisma.user.upsert({
        where: { username: 'admin'},
        update: {},
        create: {
            username: 'admin',
            password: passwordHash,
            role: 'ADMIN'
        },
    });
    console.log('User admin telah dibuat:', adminUser.username);

    // Membuat Academic Years
    const academicYears = await prisma.academicYear.create({
        data: {
            name: '2025/2026',
            semester: 'GANJIL',
            isActive: true,
            startDate: new Date('2025-07-15'),
            endDate: new Date('2026-06-30'),
        },
    });

    // Membuat Guru
    const teacherUser = await prisma.user.create({
        data: {
            username: 'guru1',
            password: passwordHash,
            role: 'TEACHER',
            teacherProfile: {
                create: {
                    fullName: 'Budi Santoso, S.Pd.',
                    nip: '198504152010121001',
                },
            },
        },
    });

    // Membuat Kelas
    const kelasI = await prisma.class.create({
        data: {
            name: 'Kelas-I-C',
            level: 1,
            academicYearId: academicYears.id,
            homeroomTeacherId: teacherUser.teacherProfile ? teacherUser.id : 1,
        },
    });

    // Update class link ke homeroom
    const teacherProfile = await prisma.teacher.findUnique({where: { userId: teacherUser.id }});
    await prisma.class.update({
        where: { id: kelasI.id },
        data: { homeroomTeacherId: teacherProfile.id }
    });

    // Membuat siswa
    const studdentUser = await prisma.user.create({
        data: {
            username: 'siswa1',
            password: passwordHash,
            role: 'STUDENT',
            studentProfile: {
                create: {
                    fullName: 'Andi Pratama',
                    nis: '123456789',
                    studentClasses: {
                        create: {
                            classId: kelasI.id,
                        },
                    },
                },
            }
        },
    });

    // Membuat mata pelajaran
    const mathSubject = await prisma.subject.create({
        data: {
            code: 'MTK',
            name: 'Matematika',
        },
    });

    await prisma.teachingAssignment.create({
        data: {
            classId: kelasI.id,
            teacherId: teacherProfile.id,
            subjectId: mathSubject.id,
            kkm: 75,
        },
    });

    console.log("Seeding DataBase Selesai.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
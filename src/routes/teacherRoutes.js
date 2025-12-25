const express = require('express');
const { getMyClasses } = require('../controllers/teacherController');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

// Proteksi route ini dengan middelware autentikasi
router.get('/my-classes', authenticateToken, getMyClasses);

module.exports = router;
const express = require('express');
const { getMyClasses, getAssignmentDetails, createAssessment } = require('../controllers/teacherController');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

// Proteksi route ini dengan middelware autentikasi
router.get('/my-classes', authenticateToken, getMyClasses);
router.get('/assignments/:id', authenticateToken, getAssignmentDetails);
router.post('/assessments', authenticateToken, createAssessment);

module.exports = router;
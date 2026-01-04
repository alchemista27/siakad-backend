const express = require('express');
const { getMyClasses, getAssignmentDetails, createAssessment, getAssignmentSummary, deleteAssessment, bulkUpdateGrades, getStudentReportDetails } = require('../controllers/teacherController');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

// Proteksi route ini dengan middelware autentikasi
router.get('/my-classes', authenticateToken, getMyClasses);
router.get('/assignments/:id', authenticateToken, getAssignmentDetails);
router.get('/assignments/:id/summary', authenticateToken, getAssignmentSummary);
router.get('/assignments/:assignmentId/students/:studentId/report', authenticateToken, getStudentReportDetails);
router.post('/assessments', authenticateToken, createAssessment);
router.delete('/assessments/:id', authenticateToken, deleteAssessment);
router.put('/grades/bulk-update', authenticateToken, bulkUpdateGrades);

module.exports = router;
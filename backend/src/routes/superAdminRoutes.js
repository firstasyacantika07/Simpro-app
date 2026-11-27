const express = require('express');
const superAdminController = require('../controllers/superAdminController');
const { authenticateToken, requireSuperAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateToken, requireSuperAdmin);

router.get('/users', superAdminController.getAllUsers);
router.patch('/users/:id/role', superAdminController.updateUserRole);
router.get('/projects', superAdminController.getAllProjects);
router.get('/invitations', superAdminController.getInvitations);
router.post('/invitations/:id/review', superAdminController.reviewInvitationRequest);
router.get('/activity-logs', superAdminController.getActivityLogs);

module.exports = router;
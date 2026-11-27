const express = require('express');
const router = express.Router();
const fiturController = require('../controllers/fiturController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const MOS_WRITE_ROLES = [
  'Logistik',
  'Admin Proyek',
  'PM',
  'Project Manager',
  'Proyek Manager',
];

const PROGRESS_WRITE_ROLES = [
  'QS (Quantity Surveyor)',
  'QS',
  'PM',
  'Project Manager',
  'Proyek Manager',
];

router.get('/mos', authenticateToken, fiturController.listMos);
router.get('/progress', authenticateToken, fiturController.listProgress);
router.post('/mos', authenticateToken, authorizeRoles(...MOS_WRITE_ROLES), fiturController.createMos);
router.post(
  '/progress',
  authenticateToken,
  authorizeRoles(...PROGRESS_WRITE_ROLES),
  fiturController.createProgress
);

module.exports = router;
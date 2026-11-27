const express = require('express');
const router = express.Router();
const proyekController = require('../controllers/proyekController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireProjectAccess } = require('../middleware/projectAccessMiddleware');

router.get('/', authenticateToken, proyekController.getAllProjects);
router.get('/invitations/mine', authenticateToken, proyekController.getMyInvitationRequests);

router.get('/:id/bangunan', authenticateToken, requireProjectAccess(), proyekController.getBangunanByProject);
router.post('/:id/bangunan', authenticateToken, requireProjectAccess(), proyekController.createBangunan);
router.delete(
  '/:id/bangunan/:bangunanId',
  authenticateToken,
  requireProjectAccess(),
  proyekController.deleteBangunan
);

router.get(
  '/:id/progress-harian',
  authenticateToken,
  requireProjectAccess(),
  proyekController.getProgressHarianByProject
);
router.get('/:id/anggota', authenticateToken, requireProjectAccess(), proyekController.getProjectMembers);

// Permintaan undangan oleh PM (masuk antrean persetujuan SuperAdmin; tidak kirim email sebelum disetujui)
router.post('/:id/invite', authenticateToken, proyekController.requestProjectInvitation);
router.post(
  '/:id/invitation-requests',
  authenticateToken,
  proyekController.requestProjectInvitation
);

router.post('/', authenticateToken, proyekController.createProject);
router.put('/:id', authenticateToken, proyekController.updateProject);
router.delete('/:id', authenticateToken, proyekController.deleteProject);

module.exports = router;
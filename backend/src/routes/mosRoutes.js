const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const {
    getAllMos,
    createMos,
    updateMos,
    deleteMos,
} = require('../controllers/mosController');

const MOS_WRITE_ROLES = [
    'Logistik',
    'Admin Proyek',
    'PM',
    'Project Manager',
    'Proyek Manager',
];

// GET /mos
router.get('/mos', authenticateToken, getAllMos);

// POST /mos
router.post('/mos', authenticateToken, authorizeRoles(...MOS_WRITE_ROLES), createMos);

// PUT /mos/:id
router.put('/mos/:id', authenticateToken, authorizeRoles(...MOS_WRITE_ROLES), updateMos);

// DELETE /mos/:id
router.delete('/mos/:id', authenticateToken, authorizeRoles(...MOS_WRITE_ROLES), deleteMos);

module.exports = router;
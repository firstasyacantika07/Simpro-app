javascript
const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const {
    getAllProgress,
    createProgress,
    updateProgress,
    deleteProgress,
} = require('../controllers/progressController');

const PROGRESS_WRITE_ROLES = [
    'QS (Quantity Surveyor)',
    'QS',
    'PM',
    'Project Manager',
    'Proyek Manager',
];

// GET /progress (opsional ?proyek_id=... atau ?bangunan_id=...)
router.get('/progress', authenticateToken, getAllProgress);

// POST /progress
router.post(
    '/progress',
    authenticateToken,
    authorizeRoles(...PROGRESS_WRITE_ROLES),
    createProgress
);

// PUT /progress/:id
router.put(
    '/progress/:id',
    authenticateToken,
    authorizeRoles(...PROGRESS_WRITE_ROLES),
    updateProgress
);

// DELETE /progress/:id
router.delete(
    '/progress/:id',
    authenticateToken,
    authorizeRoles(...PROGRESS_WRITE_ROLES),
    deleteProgress
);

module.exports = router;
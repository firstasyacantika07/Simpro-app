const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { exportMosExcel, exportMosPdf } = require('../controllers/mosExportController');

// GET /api/fitur/mos/export/excel
router.get('/mos/export/excel', authenticateToken, exportMosExcel);

// GET /api/fitur/mos/export/pdf
router.get('/mos/export/pdf', authenticateToken, exportMosPdf);

module.exports = router;
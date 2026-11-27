const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/verify-invite', authController.verifyInvite);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/profile', authController.getProfile);

module.exports = router;
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateJwt } = require('../middleware/authMiddleware');

// Register a new user
router.post('/signup', authController.signup);

// Login user
router.post('/login', authController.login);

// Get current user (protected route)
router.get('/me', authenticateJwt, authController.getCurrentUser);

module.exports = router; 
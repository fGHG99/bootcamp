const express = require('express');
const { login, submitVerificationForm, refreshAccessToken, logout } = require('../Controllers/TraineeController');
const { protect } = require('../Middlewares/Protect');

const router = express.Router();

// Routes for trainee login and verification
router.post('/login', login);
router.post('/logout', logout);
router.post('/verify', protect, submitVerificationForm);
router.post('/refresh', refreshAccessToken);

module.exports = router;

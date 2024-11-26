const express = require('express');
const { login, submitVerificationForm } = require('../Controllers/TraineeController');
const { protect } = require('../Middlewares/Protect');

const router = express.Router();

// Routes for trainee login and verification
router.post('/login', login);
router.post('/verify', protect, submitVerificationForm);

module.exports = router;

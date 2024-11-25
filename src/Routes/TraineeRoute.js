const express = require('express');
const { login, submitVerificationForm } = require('../Controllers/TraineeController');

const router = express.Router();

// Routes for trainee login and verification
router.post('/login', login);
router.post('/verify', submitVerificationForm);

module.exports = router;

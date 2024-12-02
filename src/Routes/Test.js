const express = require('express');
const verifyRole = require('../Middlewares/VerifyRole');
const verifyStatus = require('../Middlewares/VerifyStatus');
const { protect } = require('../Middlewares/Auth');

const router = express.Router();

// Route for testing verifyStatus middleware
router.get('/status-test', verifyStatus, (req, res) => {
    res.status(200).json({ message: 'User is verified!', user: req.user });
});

// Route for testing verifyRole middleware for Admin
router.get('/role-test', verifyRole('ADMIN'), (req, res) => {
    res.status(200).json({ message: 'User has admin privileges!', user: req.user });
});

router.get('/protected', protect, (req, res) => {
    res.status(200).json({ message: 'User is protected!', user: req.user });
});

// Route for testing both middlewares together
router.get('/combined-test', verifyRole('TRAINEE'), verifyStatus, (req, res) => {
    res.status(200).json({
        message: 'User is a verified trainee!',
        user: req.user,
    });
});

module.exports = router;

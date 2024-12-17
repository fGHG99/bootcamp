const express = require('express');
const prisma = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { protect } = require('../Middlewares/Auth');

// Initialize Prisma Client
const { PrismaClient } = prisma;
const prismaClient = new PrismaClient();

const router = express.Router();

const SECRET_KEY = process.env.SECRET;
const REFRESH_KEY = process.env.REFRESH_SECRET;

// Login Route
router.post('/login', async (req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ message: 'Email, password, and role are required' });
    }

    try {
        const user = await prismaClient.user.findUnique({
            where: { email },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role !== role) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Username or password is incorrect' });
        }

        const accessToken = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '5m' });
        const refreshToken = jwt.sign({ id: user.id, role: user.role }, REFRESH_KEY, { expiresIn: '1y' });

        await prismaClient.user.update({
            where: { email },
            data: { refreshToken },
        });

        return res.status(200).json({
            message: 'Login successful',
            accessToken,
            refreshToken,
        });
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({ message: 'Error during login', error: error.message });
    }
});

// Refresh Access Token Route
router.post('/refresh-token', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token is required' });
    }

    try {
        const decoded = jwt.verify(refreshToken, REFRESH_KEY);

        const user = await prismaClient.user.findUnique({
            where: { id: decoded.id, refreshToken },
        });

        if (!user) {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        const accessToken = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '5m' });

        return res.status(200).json({
            message: 'Access token refreshed successfully',
            accessToken,
        });
    } catch (error) {
        console.error('Error refreshing access token:', error);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Refresh token has expired, please login again' });
        }

        return res.status(500).json({ message: 'Error refreshing access token', error: error.message });
    }
});
    
// Submit Verification Form Route
router.post('/submit-verification',protect, async (req, res) => {
    const { id } = req.user;
    const {
        fullName,
        nickname,
        pob,
        dob,
        address,
        mobile,
        lastEdu,
        lastEduInst,
        major,
        inCollege,
        college,
        currentMajor,
        github,
        skills: {
            skill1 = null,
            skill2 = null,
            skill3 = null,
            skill4 = null,
            skill5 = null,
            skill6 = null,
            skill7 = null,
            skill8 = null,
        } = {},
        confident,
    } = req.body;

    try {
        const updatedUser = await prismaClient.user.update({
            where: { id },
            data: {
                fullName,
                nickname,
                pob,
                dob: new Date(dob),
                address,
                mobile,
                lastEdu,
                lastEduInst,
                major,
                inCollege,
                college,
                currentMajor,
                github,
                skill1,
                skill2,
                skill3,
                skill4,
                skill5,
                skill6,
                skill7,
                skill8,
                confident,
                userstatus: 'VERIFIED',
            },
        });

        return res.status(200).json({ message: 'Verification form submitted', user: updatedUser });
    } catch (error) {
        console.error('Error updating trainee details:', error);
        return res.status(500).json({ message: 'Error submitting verification form', error: error.message });
    }
});

router.put('/edit', protect, async (req, res) => {
    const { id } = req.user; // Assume the `protect` middleware attaches the user ID to `req.user`
    const { fullName, nickname, address, mobile } = req.body;

    // Input validation
    if (!fullName && !nickname && !address && !mobile) {
        return res.status(400).json({
            message: 'At least one field (fullName, nickname, address, or mobile) must be provided.',
        });
    }

    try {
        // Update the user with only the provided fields
        const updatedUser = await prismaClient.user.update({
            where: { id },
            data: {
                ...(fullName && { fullName }),
                ...(nickname && { nickname }),
                ...(address && { address }),
                ...(mobile && { mobile }),
            },
        });

        return res.status(200).json({
            message: 'User information updated successfully',
            user: {
                fullName: updatedUser.fullName,
                nickname: updatedUser.nickname,
                address: updatedUser.address,
                mobile: updatedUser.mobile,
            },
        });
    } catch (error) {
        console.error('Error updating user information:', error);
        return res.status(500).json({
            message: 'An error occurred while updating user information',
            error: error.message,
        });
    }
});

// Logout Route
router.post('/logout', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token is required' });
    }
    
    try {
        const decoded = jwt.verify(refreshToken, REFRESH_KEY);

        await prismaClient.user.update({
            where: { id: decoded.id },
            data: { refreshToken: null },
        });

        return res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Error during logout:', error);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Refresh token already expired' });
        }

        return res.status(500).json({ message: 'Error during logout', error: error.message });
    }
});

router.get('/:id/pro', async (req, res) => {
    const { id } = req.params;

    try {
        const user = await prismaClient.user.findUnique({
            where: { id },
            include: {
                profiles: {
                    where: { type: 'PROFESSIONAL' },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.profiles.length === 0) {
            return res.status(404).json({ message: 'No professional profile found' });
        }

        // Only return the file path relative to the public directory
        const profileImageUrl = `${user.profiles[0].filepath.replace('public', '')}`;

        return res.status(200).json({
            profileImage: profileImageUrl, // Returning the relative path after public
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
});


router.get('/:id/casual', async (req, res) => {
    const { id } = req.params;

    try {
        const user = await prismaClient.user.findUnique({
            where: { id },
            include: {
                profiles: {
                    where: { type: 'CASUAL' },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.profiles.length === 0) {
            return res.status(404).json({ message: 'No casual profile found' });
        }

        // Only return the file path relative to the public directory
        const profileImageUrl = `${user.profiles[0].filepath.replace('public', '')}`;

        return res.status(200).json({
            profileImage: profileImageUrl, // Returning the relative path after public
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
});



module.exports = router;

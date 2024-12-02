const prisma = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Initialize Prisma Client
const { PrismaClient } = prisma;
const prismaClient = new PrismaClient();

const SECRET_KEY = process.env.SECRET;
const REFRESH_KEY = process.env.REFRESH_SECRET;

const login = async (req, res) => {
    const { email, password, role } = req.body;

    // Validate input
    if (!email || !password || !role) {
        return res.status(400).json({ message: 'Email & password are required' });
    }

    try {
        // Find user by email
        const user = await prismaClient.user.findUnique({
            where: { email },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the role matches
        if (user.role !== role) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Username or password is not correct' });
        }

        // Generate tokens
        const accessToken = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '5m' }); // Access token expires in 5 minutes
        const refreshToken = jwt.sign({ id: user.id, role: user.role }, REFRESH_KEY, { expiresIn: '1y' }); // Refresh token expires in 1 year

        // Store refresh token in the database
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
        return res.status(500).json({ message: 'Error during login', error });
    }
};

const refreshAccessToken = async (req, res) => {
    const { refreshToken } = req.body;

    // Validate input
    if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token is required' });
    }

    try {
        // Verify refresh token
        const decoded = jwt.verify(refreshToken, REFRESH_KEY);

        // Check if refresh token exists in the database
        const user = await prismaClient.user.findUnique({
            where: { id: decoded.id, refreshToken },
        });

        if (!user) {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        // Generate new access token
        const accessToken = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '5m' });

        return res.status(200).json({
            message: 'Access token refreshed successfully',
            accessToken,
        });
    } catch (error) {
        console.error('Error refreshing access token:', error);

        // Handle token verification errors
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Refresh token has expired, please login again' });
        }

        return res.status(500).json({ message: 'Error refreshing access token', error: error.message });
    }
};

// Submit verification form
const submitVerificationForm = async (req, res) => {
    const { id } = req.user; // Ensure req.user is populated by middleware
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
                status: 'Verified',
            },
        });

        return res.status(200).json({ message: 'Verification form submitted', user: updatedUser });
    } catch (error) {
        console.error('Error updating trainee details:', error);
        return res.status(500).json({ message: 'Error submitting verification form', error: error.message });
    }
};

const logout = async (req, res) => {
    const { refreshToken } = req.body;

    // Validate input
    if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token is required' });
    }

    try {
        // Verify the refresh token
        const decoded = jwt.verify(refreshToken, REFRESH_KEY);

        // Invalidate the refresh token by removing it from the database
        await prismaClient.user.update({
            where: { id: decoded.id },
            data: { refreshToken: null },
        });

        return res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Error during logout:', error);

        // Handle token verification errors
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Refresh token already expired' });
        }

        return res.status(500).json({ message: 'Error during logout', error: error.message });
    }
};

module.exports = { login, submitVerificationForm, refreshAccessToken, logout };

const prisma = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Initialize Prisma Client
const { PrismaClient } = prisma;
const prismaClient = new PrismaClient();

const SECRET_KEY = process.env.SECRET;

// Login trainee
const login = async (req, res) => {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
        return res.status(400).json({ message: 'Email, password, and role are required' });
    }

    try {
        // Find user by email
        const user = await prismaClient.user.findUnique({
            where: { email },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Username or password is not correct' });
        }

        // Generate tokens
        const accessToken = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
        const refreshToken = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

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
        return res.status(500).json({ message: 'Error during login', error });
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

module.exports = { login, submitVerificationForm };

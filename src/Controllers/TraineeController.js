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

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        // Find trainee by email
        const user = await prismaClient.user.findUnique({
            where: { email },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid password' });
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
    const { id } = req.user; // Extract user ID from access token
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
        skills,
        confident,
    } = req.body;

    try {
        // Update trainee details
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
                skill1: skills.skill1,
                skill2: skills.skill2,
                skill3: skills.skill3,
                skill4: skills.skill4,
                skill5: skills.skill5,
                skill6: skills.skill6,
                skill7: skills.skill7,
                skill8: skills.skill8,
                confident,
            },
        });

        return res.status(200).json({ message: 'Verification form submitted', user: updatedUser });
    } catch (error) {
        return res.status(500).json({ message: 'Error submitting verification form', error });
    }
};

module.exports = { login, submitVerificationForm };

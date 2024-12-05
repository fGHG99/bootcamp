const express = require('express');
const prisma = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verifyRoles } = require('../Middlewares/Auth'); 

const { PrismaClient } = prisma;
const prismaClient = new PrismaClient();
const router = express.Router();

router.post('/create', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Validate inputs
    if (!email || !password || !role) {
      return res.status(400).json({ message: 'Email, password, and role are required.' });
    }

    // Validate role against allowed roles
    const validRoles = ['TRAINEE', 'MENTOR', 'EXAMINER', 'ADMIN'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Valid roles are: ${validRoles.join(', ')}`,
      });
    }

    // Check if the user already exists
    const existingUser = await prismaClient.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists.' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate refresh token
    const refreshToken = jwt.sign(
      {
        email,
        role,
      },
      process.env.SECRET, // Add your refresh token secret in the `.env` file
      { expiresIn: '7d' } // Refresh token expires in 7 days
    );

    // Generate access token
    const accessToken = jwt.sign(
      {
        email,
        role,
      },
      process.env.SECRET, // Add your access token secret in the `.env` file
      { expiresIn: '15m' } // Access token expires in 15 minutes
    );

    // Create the user and save refreshToken
    const newUser = await prismaClient.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
        userstatus: 'UNVERIFIED',
        fullName: null,
        nickname: null,
        pob: null,
        dob: null,
        address: null,
        mobile: null,
        lastEdu: null,
        lastEduInst: null,
        major: null,
        inCollege: null,
        college: null,
        currentMajor: null,
        github: null,
        skill1: null,
        skill2: null,
        skill3: null,
        skill4: null,
        skill5: null,
        skill6: null,
        skill7: null,
        skill8: null,
        confident: null,
        refreshToken: refreshToken, // Store the refresh token in the database
      },
      select: {
        id: true,
        email: true,
        role: true,
        userstatus: true,
      },
    });

    res.status(201).json({
      message: 'User created successfully.',
      user: newUser,
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'An error occurred while creating the user.' });
  }
});

router.post('/class', verifyRoles(['ADMIN']), async (req, res) => {
  try {
    const { className, batchId, participant } = req.body;

    const classData = await prisma.class.create({
      data: {
        className,
        participant,
        batchId,
        createdAt: new Date(),
      },
    });
    res.status(201).json(classData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/batch', verifyRoles(['ADMIN']), async (req, res) => {
  try {
    const { batchNum, batchClass, mentorId, startDate, endDate, status } = req.body;

    const batch = await prisma.batch.create({
      data: {
        batchNum,
        batchClass,
        mentorId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status,
      },
    });
    res.status(201).json(batch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/challenge', verifyRoles(['ADMIN']), async (req, res) => {
  try {
    const { batchId, classId } = req.body;

    const challenge = await prisma.challenge.create({
      data: {
        batchId,
        classId,
        createdAt: new Date(),
      },
    });
    res.status(201).json(challenge);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



module.exports = router;

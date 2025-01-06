const { PrismaClient } = require('@prisma/client');
const express = require('express');

const prisma = new PrismaClient();
const router = express.Router();

// Mark a lesson as completed
router.post('/lesson', async (req, res) => {
  const { userId, lessonId } = req.body;

  if (!userId || !lessonId) {
    return res.status(400).json({ error: 'userId and lessonId are required' });
  }

  try {
    // Check if the lesson is already completed
    const existingCompletion = await prisma.lessonCompletion.findUnique({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
    });

    if (existingCompletion && existingCompletion.completed) {
      return res.status(200).json({ message: 'You already submitted this lesson.' });
    }

    // Mark lesson as completed
    await prisma.lessonCompletion.upsert({
      where: {
        userId_lessonId: { // Use the composite unique constraint
          userId,
          lessonId,
        },
      },
      update: {
        completed: true,
        completedAt: new Date(),
      },
      create: {
        userId,
        lessonId,
        completed: true,
        completedAt: new Date(),
      },
    });

    // Calculate progress
    const progressData = await calculateProgress(userId);

    // Check if a certificate should be issued
    const certificate = await checkAndIssueCertificate(userId, progressData);

    const { completedLessons, totalLessons, completedChallenges, totalChallenges } = progressData;

    if (certificate) {
      res.status(200).json({
        message: `Lesson completed successfully. You finished ${completedLessons} out of ${totalLessons} lessons and ${completedChallenges} out of ${totalChallenges} challenges, and a certificate was issued!`,
        certificate,
      });
    } else {
      res.status(200).json({
        message: `Lesson completed successfully. You finished ${completedLessons} out of ${totalLessons} lessons and ${completedChallenges} out of ${totalChallenges} challenges.`,
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark a challenge as completed
router.post('/challenge', async (req, res) => {
  const { userId, challengeId } = req.body;

  if (!userId || !challengeId) {
    return res.status(400).json({ error: 'userId and challengeId are required' });
  }

  try {
    // Check if the challenge is already completed
    const existingCompletion = await prisma.challengeCompletion.findUnique({
      where: {
        userId_challengeId: {
          userId,
          challengeId,
        },
      },
    });

    if (existingCompletion && existingCompletion.completed) {
      return res.status(200).json({ message: 'You already submitted this challenge.' });
    }

    // Mark challenge as completed
    await prisma.challengeCompletion.upsert({
      where: {
        userId_challengeId: { // Use the composite unique constraint
          userId,
          challengeId,
        },
      },
      update: {
        completed: true,
        completedAt: new Date(),
      },
      create: {
        userId,
        challengeId,
        completed: true,
        completedAt: new Date(),
      },
    });

    // Calculate progress
    const progressData = await calculateProgress(userId);

    // Check if a certificate should be issued
    const certificate = await checkAndIssueCertificate(userId, progressData);

    const { completedLessons, totalLessons, completedChallenges, totalChallenges } = progressData;

    if (certificate) {
      res.status(200).json({
        message: `Challenge completed successfully. You finished ${completedLessons} out of ${totalLessons} lessons and ${completedChallenges} out of ${totalChallenges} challenges, and a certificate was issued!`,
        certificate,
      });
    } else {
      res.status(200).json({
        message: `Challenge completed successfully. You finished ${completedChallenges} out of ${totalChallenges} challenges.`,
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get completion percentages for lessons and challenges
router.get('/percentage', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const totalLessons = await prisma.lesson.count();
    const completedLessons = await prisma.lessonCompletion.count({
      where: { userId, completed: true },
    });
    const lessonPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

    const totalChallenges = await prisma.challenge.count();
    const completedChallenges = await prisma.challengeCompletion.count({
      where: { userId, completed: true },
    });
    const challengePercentage = totalChallenges > 0 ? (completedChallenges / totalChallenges) * 100 : 0;

    res.status(200).json({
      lessonPercentage: lessonPercentage.toFixed(2),
      challengePercentage: challengePercentage.toFixed(2),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to calculate progress
async function calculateProgress(userId) {
  const totalLessons = await prisma.lesson.count();
  const completedLessons = await prisma.lessonCompletion.count({
    where: { userId, completed: true },
  });

  const totalChallenges = await prisma.challenge.count();
  const completedChallenges = await prisma.challengeCompletion.count({
    where: { userId, completed: true },
  });

  return { completedLessons, totalLessons, completedChallenges, totalChallenges };
}

// Helper function to check and issue certificate
async function checkAndIssueCertificate(userId, progressData) {
  const { completedLessons, totalLessons, completedChallenges, totalChallenges } = progressData;

  const lessonProgress = (completedLessons / totalLessons) * 100;
  const challengeProgress = (completedChallenges / totalChallenges) * 100;

  if (lessonProgress === 100 && challengeProgress === 100) {
    const classId = await prisma.class.findFirst({
      where: { lessons: { some: {} } }, // Fetch the related classId dynamically
    }).id;
    return await issueCertificate(userId, classId);
  }

  return null;
}

// Helper function to issue certificates
async function issueCertificate(userId, classId) {
  const existingCertificate = await prisma.certificate.findFirst({
    where: { traineeId: userId, classId },
  });

  const trainee = await prisma.user.findUnique({ where: { id: userId } });
  const classInfo = await prisma.class.findUnique({ where: { id: classId } });

  if (!existingCertificate) {
    const certificate = await prisma.certificate.create({
      data: {
        traineeId: userId,
        classId,
        status: 'Issued',
      },
    });

    return {
      message: 'Completion Certificate',
      content: `This certificate is presented to 
      ${trainee.fullName} 
      For successfully completing 
      the ${classInfo.className} class
      Completion date: ${new Date(certificate.createdAt).toLocaleDateString()}`,
    };
  } else {
    return {
      message: 'Certificate Already Issued',
      content: `Certificate for ${trainee.fullName} for the ${classInfo.className} class has already been issued.`,
    };
  }
}

module.exports = router;

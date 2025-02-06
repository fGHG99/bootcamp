const { PrismaClient } = require('@prisma/client');
const express = require('express');
const multer = require("multer");
const socket = require('./SocketHandler')
const getUserIdFromToken  = require('../Routes/GetUserId');
const fs = require("fs");

const prisma = new PrismaClient();
const router = express.Router();

// Utility to ensure directory exists
const ensureDirectoryExistence = (folderPath) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
};

// Sanitize filename
const sanitizeFilename = (filename) => {
  return filename.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_.-]/g, "");
};

const lessonSubmissionStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const targetFolder = "public/lesson/submissions";
    ensureDirectoryExistence(targetFolder);
    cb(null, targetFolder);
  },
  filename: (req, file, cb) => {
    const sanitizedFilename = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}-${sanitizedFilename}`);
  },
});

const lessonSubmissionUpload = multer({
  storage: lessonSubmissionStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // Maximum 100 MB per file
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png", "application/zip"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, PDF, and PPTX are allowed."));
    }
  },
});

const challengeSubmissionStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const targetFolder = "public/challenge/submissions";
    ensureDirectoryExistence(targetFolder);
    cb(null, targetFolder);
  },
  filename: (req, file, cb) => {
    const sanitizedFilename = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}-${sanitizedFilename}`);
  },
});

const challengeSubmissionUpload = multer({
  storage: challengeSubmissionStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // Maximum 100 MB per file
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png", "application/zip"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, PDF, and PPTX are allowed."));
    }
  },
});

router.post('/lesson/:lessonId', lessonSubmissionUpload.array('files', 10), async (req, res) => {
  const { userId } = req.body;
  const { lessonId } = req.params;
  const { files } = req;

  if (!userId || !lessonId) {
    return res.status(400).json({ error: 'userId and lessonId are required.' });
  }

  try {
    // Upsert lessonCompletion and explicitly select the ID
    const lessonCompletion = await prisma.lessonCompletion.upsert({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
      select: {
        id: true, // Explicitly select the ID
      },
      update: {
        completed: true,
        completedAt: new Date(),
        status: 'SUBMITTED',
      },
      create: {
        userId,
        lessonId,
        completed: true,
        completedAt: new Date(),
        status: 'SUBMITTED',
      },
    });

    // If files are uploaded, save them in the File model
    if (files && files.length > 0) {
      // Map the files and associate them with the LessonCompletion entry
      const uploadedFiles = files.map((file) => ({
        filename: sanitizeFilename(file.originalname),
        filepath: file.path,
        mimetype: file.mimetype,
        size: file.size,
        lesCompletionId: lessonCompletion.id, // Associate with LessonCompletion
      }));
    
      // Save the files in the File table
      await prisma.file.createMany({
        data: uploadedFiles,
      });
    }

    // Calculate progress
    const progressData = await calculateProgress(userId);

    // Check if a certificate should be issued
    const certificate = await checkAndIssueCertificate(userId, progressData);
    const { completedLessons, totalLessons, completedChallenges, totalChallenges } = progressData;

    // Construct response message
    const message = certificate
      ? `Lesson completed successfully. You finished ${completedLessons} out of ${totalLessons} lessons and ${completedChallenges} out of ${totalChallenges} challenges, and a certificate was issued!`
      : `Lesson completed successfully. You finished ${completedLessons} out of ${totalLessons} lessons and ${completedChallenges} out of ${totalChallenges} challenges.`;

      console.log(lessonCompletion.id)
    // Return response
    res.status(200).json({
      message,
      files,
      certificate,
    });
  } catch (error) {
    console.error('Error completing lesson:', error);
    res.status(500).json({ error: error.message });
  }
}); 

//mark a challenge as completed
router.post('/challenge/:challengeId', challengeSubmissionUpload.array('files', 10), async (req, res) => {
  const { userId } = req.body;
  const { challengeId } = req.params;
  const { files } = req;

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
      await prisma.challengeCompletion.update({
        where: {
          userId_challengeId: {
            userId,
            challengeId,
          },
        },
        data: {
          status: 'SUBMITTED', // Updating challengeCompletion.status instead of challenge.status
        },
      });
      return res.status(200).json({ message: 'Challenge has been submitted successfully.' });
    }

    // Mark challenge as completed in challengeCompletion table
    const challengeCompletion = await prisma.challengeCompletion.upsert({
      where: {
        userId_challengeId: {
          userId,
          challengeId,
        },
      },
      update: {
        completed: true,
        completedAt: new Date(),
        status: 'SUBMITTED', // Updating status in challengeCompletion
      },
      create: {
        userId,
        challengeId,
        completed: true,
        completedAt: new Date(),
        status: 'SUBMITTED', // Setting status in new entry
      },
    });

    // If files are uploaded, save them in the File model
    if (files && files.length > 0) {
      const uploadedFiles = files.map((file) => ({
        filename: sanitizeFilename(file.originalname),
        filepath: file.path,
        mimetype: file.mimetype,
        size: file.size,
        chCompletionId: challengeCompletion.id,
      }));

      await prisma.file.createMany({
        data: uploadedFiles,
      });
    }

    // Calculate progress
    const progressData = await calculateProgress(userId);
    const certificate = await checkAndIssueCertificate(userId, progressData);
    const { completedLessons, totalLessons, completedChallenges, totalChallenges } = progressData;

    const message = certificate
      ? `Challenge completed successfully. You finished ${completedLessons} out of ${totalLessons} lessons and ${completedChallenges} out of ${totalChallenges} challenges, and a certificate was issued!`
      : `Challenge completed successfully. You finished ${completedChallenges} out of ${totalChallenges} challenges.`;

    res.status(200).json({
      message,
      files,
      certificate,
    });
  } catch (error) {
    console.error('Error completing challenge:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/lesson/:lessonId/:userId/status', async (req, res) => {
  const { lessonId, userId } = req.params;

  if (!lessonId || !userId) {
    return res.status(400).json({ error: 'lessonId and userId are required' });
  }

  try {
    // Use `findUnique` to get a specific LessonCompletion based on lessonId and userId
    const lessonCompletion = await prisma.lessonCompletion.findUnique({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
      select: {
        status: true,
        submissionFiles: true,
      },
    });

    if (!lessonCompletion) {
      return res.status(404).json({ error: 'Lesson completion not found' });
    }

    res.status(200).json(lessonCompletion);
  } catch (error) {
    console.error('Error fetching lesson status:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/challenge/:challengeId/:userId/status', async (req, res) => {
  const { challengeId, userId } = req.params;

  if (!challengeId) {
    return res.status(400).json({ error: 'challengeId is required' });
  }

  try {
    const challenge = await prisma.challengeCompletion.findUnique({
      where: { 
        userId_challengeId: {
          userId,
          challengeId,
        }
      },
      select: { 
        status: true,
        completions: {
          include: {
            submissionFiles: true,
          }
        }
      },
    });

    if (!challenge) {
      return res.status(404).json({ error: 'challenge not found' });
    }

    res.status(200).json({ status: challenge.status, files: challenge.completions.map((c) => c.submissionFiles) });
  } catch (error) {
    console.error('Error fetching challenge status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get completion percentages for lessons and challenges
router.get('/percentage/:userId/:classId', async (req, res) => {
  const { userId, classId } = req.params;

  if (!userId || !classId) {
    return res.status(400).json({ error: 'userId and classId are required' });
  }

  try {
    // Check if the user is part of the class
    const userInClass = await prisma.class.findFirst({
      where: {
        users: {
          some: { id: userId },
        },
      },
    });

    if (!userInClass) {
      return res.status(403).json({ message: 'You are not from this class' });
    }

    // Fetch total and completed lessons
    const totalLessons = await prisma.lesson.count({ where: { classId } });
    const completedLessons = await prisma.lessonCompletion.count({
      where: {
        userId,
        completed: true,
        lesson: {
          classId, // Filter by classId through the related lesson
        },
      },
    });
    const lessonPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

    // Fetch total and completed challenges
    const totalChallenges = await prisma.challenge.count({ where: { classId } });
    const completedChallenges = await prisma.challengeCompletion.count({
      where: { userId, classId, completed: true },
    });
    const challengePercentage = totalChallenges > 0 ? (completedChallenges / totalChallenges) * 100 : 0;

    // If lessons or challenges are incomplete, return a message
    if (lessonPercentage < 100 || challengePercentage < 100) {
      return res.status(200).json({ message: "You haven't finished this class yet" });
    }

    // Check if the certificate exists
    const certificate = await prisma.certificate.findFirst({
      where: { userId, classId },
    });

    if (!certificate) {
      return res.status(200).json({ message: "You haven't received a certificate yet" });
    }

    // Return the certificate's filepath if all conditions are met
    res.status(200).json({ filepath: certificate.filepath });
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
    const classId = await prisma.class.findMany({
      where: { lessons: { some: {} } }, // Fetch the related classId dynamically
    }).id;
    const userId = await prisma.user.findMany({
      where: { lessons: { some: {} } }, // Fetch the related userId dynamically
    }).id
    console.log('Class ID:', classId, userId);
    // return await issueCertificate(userId, classId);
  }

  return null;
}

module.exports = router;

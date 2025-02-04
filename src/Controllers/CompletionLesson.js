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

router.post('/lesson', lessonSubmissionUpload.array('files', 10), async (req, res) => {
  const { userId, lessonId} = req.body;
  const { files } = req;

  if (!userId || !lessonId) {
    return res.status(400).json({ error: 'userId and lessonId are required.' });
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
      return res.status(200).json({
        message: 'You already submitted this lesson.',
      });
    }

    // Mark lesson as completed or create a new entry
    const lessonCompletion = await prisma.lessonCompletion.upsert({
      where: {
        userId_lessonId: {
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

    // If files are uploaded, save them in the File model
    if (files && files.length > 0) {
      const uploadedFiles = files.map((file) => ({
        filename: sanitizeFilename(file.originalname),
        filepath: file.path,
        mimetype: file.mimetype,
        size: file.size,
        completionId: lessonCompletion.id, // Link the file to the lessonCompletion entry
      }));

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
router.post('/challenge', challengeSubmissionUpload.array('files', 10), async (req, res) => {
  const { userId, challengeId } = req.body;
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
      return res.status(200).json({ message: `You already submitted this challenge.  ${completedLessons} out of ${totalLessons}`});
    }

    // Mark challenge as completed
    const challengeCompletion = await prisma.challengeCompletion.upsert({
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

    if (files && files.length > 0) {
      const uploadedFiles = files.map((file) => ({
        filename: sanitizeFilename(file.originalname),
        filepath: file.path,
        mimetype: file.mimetype,
        size: file.size,
        chCompletionId: challengeCompletion.id, // Link the file to the lessonCompletion entry
      }));

      await prisma.file.createMany({
        data: uploadedFiles,
      });
    }


    const progressData = await calculateProgress(userId);
    const certificate = await checkAndIssueCertificate(userId, progressData);
    const { completedLessons, totalLessons, completedChallenges, totalChallenges } = progressData;

     // Replace with how you retrieve the token
    const mentorId = getUserIdFromToken(refreshToken);

    console.log('Mentor ID:', mentorId);
    // Create a new notification for the user
    const userNotification = await prisma.notification.create({
      data: {
        userId,
        title: 'Challenge Completed!',
        description: `You have successfully completed challenge ID: ${challengeId}.`,
        type: 'success',
      },
    });
    console.log('User notification created:', userNotification);

    const io = socket.getIO();
    io.to(userId).emit('receiveNotification', {
      id: userNotification.id,
      title: userNotification.title,
      description: userNotification.description,
      type: userNotification.type,
      createdAt: userNotification.createdAt,
    });

    const notifyMentor = async (mentorId, challengeId) => {
      // Create a notification for the mentor
      const mentorNotification = await prisma.notification.create({
        data: {
          userId: mentorId,
          title: 'Student Challenge Completion',
          description: `Your student has completed challenge ID: ${challengeId}.`,
          type: 'info',
        },
      });
      console.log('Mentor notification created:', mentorNotification);

      // Emit notification to the mentor
      io.to(mentorId).emit('receiveNotification', {
        id: mentorNotification.id,
        title: mentorNotification.title,
        description: mentorNotification.description,
        type: mentorNotification.type,
        createdAt: mentorNotification.createdAt,
      });
    };

    await notifyMentor(mentorId, challengeId);

    // Calculate progress

    if (certificate) {
          const notifyMentor = async (userId) => {
            // Create a notification for the mentor
            const MentorNotification = await prisma.notification.create({
              data: {
                userId: userId,
                title: 'One of your student has completed all challenges',
                description: 'Certificate need to be issued!',
                type: 'Cert',
              },
            });
            console.log('Admin Notification Created', MentorNotification);
      
            // Emit notification to the mentor
            const io = socket.getIO();
            io.to(userId).emit('receiveNotification', {
              id: MentorNotification.id,
              title: MentorNotification.title,
              description: MentorNotification.description,
              type: MentorNotification.type,
              createdAt: MentorNotification.createdAt,
            });
          };
      
          await notifyMentor(userId);

          const notifyAdmin = async (userId) => {
            // Create a notification for the mentor
            const AdminNotification = await prisma.notification.create({
              data: {
                userId: userId,
                title: 'A Trainee has completed all challenges',
                description: 'Certificate need to be issued!',
                type: 'Cert',
              },
            });
            console.log('Admin Notification Created', AdminNotification);
      
            // Emit notification to the mentor
            const io = socket.getIO();
            io.to(userId).emit('receiveNotification', {
              id: AdminNotification.id,
              title: AdminNotification.title,
              description: AdminNotification.description,
              type: AdminNotification.type,
              createdAt: AdminNotification.createdAt,
            });
          };
      
          await notifyAdmin(userId);

      res.status(200).json({
        message: `Challenge completed successfully. You finished ${completedLessons} out of ${totalLessons} lessons and ${completedChallenges} out of ${totalChallenges} challenges, and a certificate will be issued!`,
        certificate,
        files,
      });
    } else {
      res.status(200).json({
        message: `Challenge completed successfully. You finished ${completedChallenges} out of ${totalChallenges} challenges.`,
        files,
      });
    }
  } catch (error) {
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

const { PrismaClient } = require("@prisma/client");
const express = require("express");
const multer = require("multer");
const socket = require("./SocketHandler");
const getUserIdFromToken = require("../Routes/GetUserId");
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
    const targetFolder = "public/lesson_submissions";
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
    const allowedMimeTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/zip",
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, PDF, and PPTX are allowed."
        )
      );
    }
  },
});

const challengeSubmissionStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const targetFolder = "public/challenge_submissions";
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
    const allowedMimeTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/zip",
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, PDF, and PPTX are allowed."
        )
      );
    }
  },
});

router.post(
  "/lesson/:lessonId",
  lessonSubmissionUpload.array("files", 10),
  async (req, res) => {
    const { userId } = req.body;
    const { lessonId } = req.params;
    const { files } = req;

    if (!userId || !lessonId) {
      return res.status(400).json({ error: "userId and lessonId are required." });
    }

    try {
      // Fetch the lesson details including mentor and deadline
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { mentorId: true, deadline: true },
      });

      if (!lesson || !lesson.mentorId) {
        return res.status(404).json({ error: "Lesson or Mentor not found" });
      }

      const mentorId = lesson.mentorId;

      // Get the current time and lesson deadline
      const currentDate = new Date();
      const deadlineDate = lesson.deadline ? new Date(lesson.deadline) : null;

      console.log("📅 Current DateTime:", currentDate.toISOString());
      console.log("📌 Lesson Deadline DateTime:", deadlineDate ? deadlineDate.toISOString() : "No deadline set");

      // Determine the submission status
      const status = deadlineDate && currentDate > deadlineDate ? "LATE" : "SUBMITTED";

      // Upsert lessonCompletion
      const lessonCompletion = await prisma.lessonCompletion.upsert({
        where: {
          userId_lessonId: {
            userId,
            lessonId,
          },
        },
        select: { id: true },
        update: {
          completed: true,
          completedAt: currentDate,
          status,
        },
        create: {
          userId,
          lessonId,
          completed: true,
          completedAt: currentDate,
          status,
        },
      });

      // If files are uploaded, save them in the File model
      if (files && files.length > 0) {
        const uploadedFiles = files.map((file) => ({
          filename: sanitizeFilename(file.originalname),
          filepath: file.path,
          mimetype: file.mimetype,
          size: file.size,
          lesCompletionId: lessonCompletion.id,
        }));

        await prisma.file.createMany({ data: uploadedFiles });
      }

      // Calculate progress
      const progressData = await calculateProgress(userId);

      // Check if a certificate should be issued
      const certificate = await checkAndIssueCertificate(userId, progressData);
      const {
        completedLessons,
        totalLessons,
        completedChallenges,
        totalChallenges,
      } = progressData;

      // Construct response message
      const message = certificate
        ? `Lesson completed successfully. You finished ${completedLessons} out of ${totalLessons} lessons and ${completedChallenges} out of ${totalChallenges} challenges, and a certificate was issued!`
        : `Lesson completed successfully. You finished ${completedLessons} out of ${totalLessons} lessons and ${completedChallenges} out of ${totalChallenges} challenges.`;

      // Notify Mentor
      const notifyMentor = async (mentorId) => {
        const mentorNotification = await prisma.notification.create({
          data: {
            userId: mentorId,
            title: "Student Submission",
            description: `A student just submitted their Lesson. Status: ${status}`,
            type: "Lesson",
          },
        });

        // Emit notification to mentor
        const io = socket.getIO();
        io.to(mentorId).emit("receiveNotification", {
          id: mentorNotification.id,
          title: mentorNotification.title,
          description: mentorNotification.description,
          type: mentorNotification.type,
          createdAt: mentorNotification.createdAt,
        });

        console.log(`📢 Notification sent to mentor ${mentorId}`);
      };

      await notifyMentor(mentorId);

      // Return response
      res.status(200).json({
        message,
        files,
        certificate,
        status,
      });
    } catch (error) {
      console.error("❌ Error completing lesson:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.post(
  "/challenge/:challengeId",
  challengeSubmissionUpload.array("files", 10),
  async (req, res) => {
    const { userId } = req.body;
    const { challengeId } = req.params;
    const { files } = req;

    if (!userId || !challengeId) {
      return res.status(400).json({ error: "userId and challengeId are required" });
    }

    try {
      // 🟢 1. Get mentorId and deadline from the Challenge model
      const challenge = await prisma.challenge.findUnique({
        where: { id: challengeId },
        select: { mentorId: true, deadline: true }, // Fetch mentorId and deadline
      });

      if (!challenge || !challenge.mentorId) {
        return res.status(404).json({ error: "Mentor not found." });
      }

      const { mentorId, deadline } = challenge;

      // 🟢 2. Determine submission status based on the deadline
      const currentDate = new Date();
      const deadlineDate = deadline ? new Date(deadline) : null;

      console.log("📅 Current DateTime:", currentDate.toISOString());
      console.log("📌 Challenge Deadline DateTime:", deadlineDate ? deadlineDate.toISOString() : "No deadline set");

      const status = deadlineDate && currentDate > deadlineDate ? "LATE" : "SUBMITTED";

      // 🟢 3. Upsert challenge completion
      const challengeCompletion = await prisma.challengeCompletion.upsert({
        where: {
          userId_challengeId: {
            userId,
            challengeId,
          },
        },
        update: {
          completed: true,
          completedAt: currentDate,
          status,
        },
        create: {
          userId,
          challengeId,
          completed: true,
          completedAt: currentDate,
          status,
        },
      });

      // 🟢 4. Upload files if provided
      if (files && files.length > 0) {
        const uploadedFiles = files.map((file) => ({
          filename: sanitizeFilename(file.originalname),
          filepath: file.path,
          mimetype: file.mimetype,
          size: file.size,
          chCompletionId: challengeCompletion.id,
        }));

        await prisma.file.createMany({ data: uploadedFiles });
      }

      // 🟢 5. Calculate progress and issue certificate
      const progressData = await calculateProgress(userId);
      const certificate = await checkAndIssueCertificate(userId, progressData);
      const {
        completedLessons,
        totalLessons,
        completedChallenges,
        totalChallenges,
      } = progressData;

      const message = certificate
        ? `Challenge completed successfully. You finished ${completedLessons} out of ${totalLessons} lessons and ${completedChallenges} out of ${totalChallenges} challenges, and a certificate was issued!`
        : `Challenge completed successfully. You finished ${completedChallenges} out of ${totalChallenges} challenges.`;

      // 🟢 6. Notify mentor about submission status
      const notifyMentor = async (mentorId) => {
        const mentorNotification = await prisma.notification.create({
          data: {
            userId: mentorId,
            title: "Student Submission",
            description: `A student just submitted their challenge. Status: ${status}`,
            type: "Challenge",
          },
        });

        // Emit notification to mentor if they're online
        const io = socket.getIO();
        io.to(mentorId).emit("receiveNotification", {
          id: mentorNotification.id,
          title: mentorNotification.title,
          description: mentorNotification.description,
          type: mentorNotification.type,
          createdAt: mentorNotification.createdAt,
        });

        console.log(`📢 Notification sent to mentor ${mentorId}`);
      };

      await notifyMentor(mentorId);

      res.status(200).json({
        message,
        files,
        certificate,
        status,
      });
    } catch (error) {
      console.error("❌ Error completing challenge:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/lesson/:lessonId/:userId/status", async (req, res) => {
  const { lessonId, userId } = req.params;

  if (!lessonId || !userId) {
    return res.status(400).json({ error: "lessonId and userId are required" });
  }

  try {
    // Check for lessonCompletion
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
        notes: true,
      },
    });

    if (lessonCompletion) {
      return res.status(200).json(lessonCompletion);
    }

    // If no lessonCompletion, fetch lesson status
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { status: true },
    });

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    res.status(200).json({
      status: lesson.status,
      submissionFiles: [],
      notes: [],
    });
  } catch (error) {
    console.error("Error fetching lesson status:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/challenge/:challengeId/:userId/status", async (req, res) => {
  const { challengeId, userId } = req.params;

  if (!challengeId || !userId) {
    return res.status(400).json({ error: "challengeId and userId are required" });
  }

  try {
    // Check for challengeCompletion
    const challengeCompletion = await prisma.challengeCompletion.findUnique({
      where: {
        userId_challengeId: {
          userId,
          challengeId,
        },
      },
      select: {
        status: true,
        submissionFiles: true,
        notes: true,
      },
    });

    if (challengeCompletion) {
      return res.status(200).json(challengeCompletion);
    }

    // If no challengeCompletion, fetch challenge status
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      select: { status: true },
    });

    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    res.status(200).json({
      status: challenge.status,
      submissionFiles: [],
      notes: [],
    });
  } catch (error) {
    console.error("Error fetching challenge status:", error);
    res.status(500).json({ error: error.message });
  }
});


router.get("/presentation/:presentationId/:userId/status", async (req, res) => {
  const { presentationId, userId } = req.params;

  if (!presentationId || !userId) {
    return res.status(400).json({ error: "presentationId and userId are required" });
  }

  try {
    // Check for finalCompletion
    const finalCompletion = await prisma.finalCompletion.findUnique({
      where: {
        userId_presentationId: {
          userId,
          presentationId,
        },
      },
      select: {
        status: true,
        submissionFiles: true,
        notes: true,
      },
    });

    if (finalCompletion) {
      return res.status(200).json(finalCompletion);
    }

    // If no finalCompletion, fetch presentation status
    const presentation = await prisma.finalPresentation.findUnique({
      where: { id: presentationId },
      select: { status: true },
    });

    if (!presentation) {
      return res.status(404).json({ error: "Presentation not found" });
    }

    res.status(200).json({
      status: presentation.status,
      submissionFiles: [],
      notes: [],
    });
  } catch (error) {
    console.error("Error fetching presentation status:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get completion percentages for lessons and challenges
router.get("/percentage/:userId/:classId", async (req, res) => {
  const { userId, classId } = req.params;

  if (!userId || !classId) {
    return res.status(400).json({ error: "userId and classId are required" });
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
      return res.status(403).json({ message: "You are not from this class" });
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
    const lessonPercentage =
      totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

    // Fetch total and completed challenges
    const totalChallenges = await prisma.challenge.count({
      where: { classId },
    });
    const completedChallenges = await prisma.challengeCompletion.count({
      where: { userId, classId, completed: true },
    });
    const challengePercentage =
      totalChallenges > 0 ? (completedChallenges / totalChallenges) * 100 : 0;

    // If lessons or challenges are incomplete, return a message
    if (lessonPercentage < 100 || challengePercentage < 100) {
      return res
        .status(200)
        .json({ message: "You haven't finished this class yet" });
    }

    // Check if the certificate exists
    const certificate = await prisma.certificate.findFirst({
      where: { userId, classId },
    });

    if (!certificate) {
      return res
        .status(200)
        .json({ message: "You haven't received a certificate yet" });
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

  return {
    completedLessons,
    totalLessons,
    completedChallenges,
    totalChallenges,
  };
}

// Helper function to check and issue certificate
async function checkAndIssueCertificate(userId, progressData) {
  const {
    completedLessons,
    totalLessons,
    completedChallenges,
    totalChallenges,
  } = progressData;

  const lessonProgress = (completedLessons / totalLessons) * 100;
  const challengeProgress = (completedChallenges / totalChallenges) * 100;

  if (lessonProgress === 100 && challengeProgress === 100) {
    const classId = await prisma.class.findMany({
      where: { lessons: { some: {} } }, // Fetch the related classId dynamically
    }).id;
    const userId = await prisma.user.findMany({
      where: { lessons: { some: {} } }, // Fetch the related userId dynamically
    }).id;
    console.log("Class ID:", classId, userId);
    // return await issueCertificate(userId, classId);
  }

  return null;
}

const presentationSubmissionStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const targetFolder = "public/presentation_submissions";
    ensureDirectoryExistence(targetFolder);
    cb(null, targetFolder);
  },
  filename: (req, file, cb) => {
    const sanitizedFilename = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}-${sanitizedFilename}`);
  },
});

const presentationSubmissionUpload = multer({
  storage: presentationSubmissionStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // Maximum 100 MB per file
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/zip",
      "video/mp4",
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, PDF, PPTX, and MP4 are allowed."
        )
      );
    }
  },
});

router.post(
  "/presentation/:presentationId",
  presentationSubmissionUpload.array("files", 10),
  async (req, res) => {
    const { userId } = req.body;
    const { presentationId } = req.params;
    const { files } = req;

    if (!userId || !presentationId) {
      return res.status(400).json({ error: "userId and presentationId are required." });
    }

    try {
      // Fetch the presentation deadline (including time)
      const presentation = await prisma.presentation.findUnique({
        where: { id: presentationId },
        select: { deadline: true },
      });

      if (!presentation || !presentation.deadline) {
        return res.status(404).json({ error: "Presentation not found or has no deadline." });
      }

      const currentDate = new Date();
      const deadlineDate = new Date(presentation.deadline);

      console.log("📅 Current DateTime:", currentDate.toISOString());
      console.log("📌 Deadline DateTime:", deadlineDate.toISOString());

      // Determine status based on exact date & time
      const status = currentDate > deadlineDate ? "LATE" : "SUBMITTED";

      // Find all examiners
      const examiners = await prisma.user.findMany({
        where: { role: "EXAMINER" },
        select: { id: true },
      });

      if (!examiners.length) {
        return res.status(404).json({ error: "No examiners found." });
      }

      // Upsert finalCompletion
      const finalCompletion = await prisma.finalCompletion.upsert({
        where: {
          userId_presentationId: {
            userId,
            presentationId,
          },
        },
        select: { id: true },
        update: {
          completed: true,
          completedAt: currentDate,
          status,
        },
        create: {
          userId,
          presentationId,
          completed: true,
          completedAt: currentDate,
          status,
        },
      });

      // Handle file uploads
      if (files && files.length > 0) {
        const uploadedFiles = files.map((file) => ({
          filename: sanitizeFilename(file.originalname),
          filepath: file.path,
          mimetype: file.mimetype,
          size: file.size,
          fpCompletionId: finalCompletion.id,
        }));

        await prisma.file.createMany({ data: uploadedFiles });
      }

      // Notify each examiner
      for (const examiner of examiners) {
        const mentorNotification = await prisma.notification.create({
          data: {
            userId: examiner.id,
            title: "Student Submission",
            description: `A student just submitted their final presentation. Status: ${status}`,
            type: "Presentation",
          },
        });

        // Emit socket notification
        const io = socket.getIO();
        io.to(examiner.id).emit("receiveNotification", {
          id: mentorNotification.id,
          title: mentorNotification.title,
          description: mentorNotification.description,
          type: mentorNotification.type,
          createdAt: mentorNotification.createdAt,
        });

        console.log(`📢 Notification sent to examiner ${examiner.id}`);
      }

      res.status(200).json({ files, status });
    } catch (error) {
      console.error("❌ Error completing presentation:", error);
      res.status(500).json({ error: error.message });
    }
  }
);
  
module.exports = router;

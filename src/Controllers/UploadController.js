const express = require("express");
const multer = require("multer");
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const router = express.Router();
const prisma = new PrismaClient();

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

// Centralized allowed MIME types
const allowedMimeTypes = {
  profile: ["image/jpeg", "image/png", "application/pdf"],
  lesson: ["image/jpeg", "image/png", "image/jpg", "application/pdf", "application/pptx"],
  certificate: ["application/pdf", "image/jpeg", "image/png"],
};

// Configure multer storage for profile uploads
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { type } = req.body;
    console.log("Received profile type:", type); // Debugging
    if (!type || !["CASUAL", "PROFESSIONAL"].includes(type)) {
      return cb(new Error("Invalid profile type. Must be CASUAL or PROFESSIONAL."));
    }

    const targetFolder = `public/profile/${type.toLowerCase()}`;
    ensureDirectoryExistence(targetFolder);
    cb(null, targetFolder);
  },
  filename: (req, file, cb) => {
    const sanitizedFilename = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}-${sanitizedFilename}`);
  },
});

const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Maximum file size 10 MB
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.profile.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and PDF are allowed."));
    }
  },
});

// Profile upload endpoint
router.post("/profile", profileUpload.single("file"), async (req, res) => {
  const { type, userId } = req.body;
  const file = req.file;

  if (!type || !["CASUAL", "PROFESSIONAL"].includes(type)) {
    return res.status(400).json({ error: "Invalid profile type. Must be CASUAL or PROFESSIONAL." });
  }

  if (!userId) {
    return res.status(400).json({ error: "User ID is required." });
  }

  if (!file) {
    return res.status(400).json({ error: "File is required." });
  }

  try {
    // Check if user already has a profile with the same type
    const existingProfile = await prisma.profile.findUnique({
      where: {
        userId_type: {
          userId,
          type, // Ensuring no more than 1 profile per type
        },
      },
    });

    if (existingProfile) {
      // If profile exists, update it instead of creating a new one
      const updatedProfile = await prisma.profile.update({
        where: {
          id: existingProfile.id, // Use the existing profile ID
        },
        data: {
          filepath: file.path,
          mimetype: file.mimetype,
          size: file.size,
        },
      });

      return res.status(200).json({
        message: `Profile of type ${type} updated successfully`,
        profile: updatedProfile,
      });
    }

    // If no existing profile, create a new one
    const profile = await prisma.profile.create({
      data: {
        type,
        filepath: file.path,
        mimetype: file.mimetype,
        size: file.size,
        userId,
      },
    });

    res.status(201).json({
      message: "Profile uploaded successfully",
      profile,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to upload or update profile", details: error.message });
  }
});

// Configure multer storage for lesson uploads
const lessonStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const targetFolder = "public/lesson";
    ensureDirectoryExistence(targetFolder);
    cb(null, targetFolder);
  },
  filename: (req, file, cb) => {
    const sanitizedFilename = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}-${sanitizedFilename}`);
  },
});

const lessonUpload = multer({
  storage: lessonStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // Maximum 100 MB per file
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.lesson.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, PDF, and PPTX are allowed."));
    }
  },
});

// Lesson creation endpoint
router.post("/lesson", lessonUpload.array("files", 3), async (req, res) => {
  const { title, description, deadline, classId, batchId } = req.body;
  const { files } = req;

  if (!title || !description || !deadline || !classId || !batchId) {
    return res.status(400).json({ error: "All lesson fields are required." });
  }

  if (!files || files.length === 0) {
    return res.status(400).json({ error: "At least one file is required." });
  }

  try {
    const lesson = await prisma.lesson.create({
      data: {
        title,
        description,
        deadline: new Date(deadline),
        classId,
        batchId,
      },
    });

    const uploads = files.map((file) =>
      prisma.file.create({
        data: {
          filename: sanitizeFilename(file.originalname),
          filepath: file.path,
          mimetype: file.mimetype,
          size: file.size,
          lesson: {
            connect: { id: lesson.id },
          },
        },
      })
    );

    const results = await Promise.all(uploads);

    res.status(201).json({
      message: "Lesson and files uploaded successfully.",
      lesson,
      files: results,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create lesson and upload files.", details: error.message });
  }
});

// Lesson update endpoint
router.put("/lesson/:lessonId", lessonUpload.array("files", 3), async (req, res) => {
  const { lessonId } = req.params;
  const { title, description, deadline, classId, batchId, deleteOldFiles } = req.body;
  const { files } = req;

  try {
    const existingLesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { files: true },
    });

    if (!existingLesson) {
      return res.status(404).json({ error: "Lesson not found." });
    }

    const updatedLesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        title: title || existingLesson.title,
        description: description || existingLesson.description,
        deadline: deadline ? new Date(deadline) : existingLesson.deadline,
        classId: classId || existingLesson.classId,
        batchId: batchId || existingLesson.batchId,
      },
    });

    if (deleteOldFiles === "true" && existingLesson.files.length > 0) {
      await Promise.all(
        existingLesson.files.map(async (file) => {
          try {
            fs.unlinkSync(file.filepath);
          } catch (err) {
            console.error(`Failed to delete file: ${file.filepath}`, err.message);
          }
        })
      );

      await prisma.file.deleteMany({
        where: { lessonId },
      });
    }

    let uploadedFiles = [];
    if (files && files.length > 0) {
      const uploads = files.map((file) =>
        prisma.file.create({
          data: {
            filename: sanitizeFilename(file.originalname),
            filepath: file.path,
            mimetype: file.mimetype,
            size: file.size,
            lesson: { connect: { id: lessonId } },
          },
        })
      );

      uploadedFiles = await Promise.all(uploads);
    }

    res.status(200).json({
      message: "Lesson updated successfully.",
      lesson: updatedLesson,
      files: uploadedFiles,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update lesson.", details: error.message });
  }
});

// Certificate upload endpoint
const certificateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const targetFolder = "public/certificate";
    ensureDirectoryExistence(targetFolder);
    cb(null, targetFolder);
  },
  filename: (req, file, cb) => {
    const sanitizedFilename = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}-${sanitizedFilename}`);
  },
});

const certificateUpload = multer({
  storage: certificateStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Maximum 5 MB
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.certificate.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, JPEG, and PNG are allowed."));
    }
  },
});

router.post("/certificate", certificateUpload.single("certificate"), async (req, res) => {
  const { traineeId, classId, batchId } = req.body;
  const certificates = req.file;

  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  try {
    const filepath = `public/certificate/${req.file.filename}`;

    const certificate = await prisma.certificate.create({
      data: {
        traineeId,
        classId,
        batchId,
        status: "Issued",
        issuedAt: new Date(),
        filepath,
        mimetype: certificates.mimetype,
        size: certificates.size,
      },
    });

    res.status(200).json({
      message: "Certificate uploaded successfully!",
      certificate,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error.', error: error.message });
  }
});

const challengeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const targetFolder = "public/challenge";
    ensureDirectoryExistence(targetFolder);
    cb(null, targetFolder);
  },
  filename: (req, file, cb) => {
    const sanitizedFilename = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}-${sanitizedFilename}`);
  },
});

const challengeUpload = multer({
  storage: challengeStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Maximum file size 50 MB
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png", "application/zip"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, JPEG, PNG, and ZIP are allowed."));
    }
  },
});

// Challenge upload endpoint
router.post("/challenge", challengeUpload.single("file"), async (req, res) => {
  const { title, description, batchId, classId, deadline, mentorId } = req.body; // Added mentorId
  const file = req.file;

  // Validate required fields
  if (!title || !description || !batchId || !classId || !deadline || !mentorId) {
    return res.status(400).json({ error: "All fields (title, description, batchId, classId, deadline, mentorId) are required." });
  }

  // Validate deadline
  if (isNaN(Date.parse(deadline))) {
    return res.status(400).json({ error: "Invalid deadline format. Please provide a valid date." });
  }

  // Check if a file was uploaded
  if (!file) {
    return res.status(400).json({ error: "File is required for uploading a challenge." });
  }

  try {
    // Create the challenge record in the database
    const challenge = await prisma.challenge.create({
      data: {
        title,
        description,
        batchId,
        classId,
        mentorId, // Save the mentor ID
        createdAt: new Date(),
        deadline: new Date(deadline),
        filepath: file.path,
        mimetype: file.mimetype,
        size: file.size,
      },
    });

    res.status(201).json({
      message: "Challenge uploaded successfully.",
      challenge,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to upload challenge.",
      details: error.message,
    });
  }
});

module.exports = router;

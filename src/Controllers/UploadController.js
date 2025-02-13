const express = require("express");
const multer = require("multer");
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const { verifyToken, verifyRoles } = require("../Middlewares/Auth");
const router = express.Router();
const prisma = new PrismaClient();
const path = require("path");

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
// const allowedMimeTypes = {
//   profile: ["image/jpeg", "image/png", "application/pdf"],
//   lesson: ["image/jpeg", "image/png", "image/jpg", "application/pdf", "application/pptx"],
//   challenge: ["image/jpeg", "image/png", "image/jpg", "application/pdf", "application/pptx"],
//   certificate: ["application/pdf", "image/jpeg", "image/png"],
// };

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
    const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png", "application/zip"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, PDF, and PPTX are allowed."));
    }
  },
});

// Lesson creation endpoint
router.post("/lesson", lessonUpload.array("files", 3), verifyToken , verifyRoles(['MENTOR']), async (req, res) => {
  const { title, description, deadline, classId, batchId, mentorId } = req.body;
  const { files } = req;

  if (!title || !description || !deadline || !classId || !batchId) {
    return res.status(400).json({ error: "All lesson fields are required." });
  }

  if (isNaN(Date.parse(deadline))) {
    return res.status(400).json({ error: "Invalid deadline format. Please provide a valid date." });
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
        class : {
          connect : { id : classId}
        },
        batch : {
          connect : { id : batchId}
        },
        mentor : {
          connect: { id : mentorId}
        }
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
            connect: { id: lesson.id }
          }
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
    console.log(error);
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

  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  try {
    // Validate traineeId
    const traineeExists = await prisma.user.findUnique({
      where: { id: traineeId },
    });
    if (!traineeExists) {
      return res.status(400).json({ message: "Invalid traineeId." });
    }

    // Validate classId
    const classExists = await prisma.class.findUnique({
      where: { id: classId },
    });
    if (!classExists) {
      return res.status(400).json({ message: "Invalid classId." });
    }

    // Validate batchId
    const batchExists = await prisma.batch.findUnique({
      where: { id: batchId },
    });
    if (!batchExists) {
      return res.status(400).json({ message: "Invalid batchId." });
    }

    // Proceed with certificate creation
    const filepath = `public/certificate/${req.file.filename}`;
    const certificates = req.file;

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
    console.error("Error while creating certificate:", error);
    res.status(500).json({
      message: "Internal server error.",
      error: error.message,
    });
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
  limits: { fileSize: 100 * 1024 * 1024 }, // Maximum file size 50 MB
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
router.post("/challenge", challengeUpload.array("files", 3), verifyToken, verifyRoles(['MENTOR']), async (req, res) => {
  const { title, description, batchId, classId, deadline, mentorId } = req.body; // Added mentorId
  const files = req.files;

  // Validate required fields
  if (!title || !description || !batchId || !classId || !deadline || !mentorId) {
    return res.status(400).json({ error: "All fields (title, description, batchId, classId, deadline, mentorId) are required." });
  }

  // Validate deadline
  if (isNaN(Date.parse(deadline))) {
    return res.status(400).json({ error: "Invalid deadline format. Please provide a valid date." });
  }

  // Check if a file was uploaded
  if (!files || files.length === 0) {
    return res.status(400).json({ error: "File is required for uploading a challenge." });
  }

  try {
    // Create the challenge reco  rd in the database
    const challenge = await prisma.challenge.create({
      data: {
        title,
        description,
        deadline: new Date(deadline),
        batch : {
          connect: { id : batchId}
        },
        class : {
          connect : { id : classId}
        },
        mentor : {
          connect : { id : mentorId }
        }, 
      },
    });

    const uploads = files.map((file) =>
      prisma.file.create({
        data: {
          filename: sanitizeFilename(file.originalname),
          filepath: file.path,
          mimetype: file.mimetype,
          size: file.size,
          challenge: {
            connect: { id: challenge.id },
          },
        },
      })
    );

    const results = await Promise.all(uploads);

    res.status(201).json({
      message: "Challenge uploaded successfully.",
      challenge,
      files: results,
    });
  } catch (error) {
    console.log("challenge", error)
    res.status(500).json({
      error: "Failed to upload challenge.",
      details: error.message,
    });
  }
});

const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const targetFolder = "public/cover-class";
    ensureDirectoryExistence(targetFolder);
    cb(null, targetFolder);
  },
  filename: (req, file, cb) => {
    const sanitizedFilename = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}-${sanitizedFilename}`);
  },
});

const coverUpload = multer({
  storage: coverStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // Maximum 100 MB per file
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, JPG are allowed."));
    }
  },
});

const batchStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const targetFolder = "public/cover-batch";
    ensureDirectoryExistence(targetFolder);
    cb(null, targetFolder);
  },
  filename: (req, file, cb) => {
    const sanitizedFilename = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}-${sanitizedFilename}`);
  },
});

const batchUpload = multer({
  storage: batchStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, JPG are allowed."));
    }
  },
});

router.post(
  "/class-cover",
  coverUpload.single("coverImage"),
  async (req, res) => {
    try {
      const { classId, fileName } = req.body;

      if (!classId) {
        return res.status(400).json({ error: "classId is required" });
      }

      const existingClass = await prisma.class.findUnique({ where: { id: classId } });
      if (!existingClass) {
        return res.status(404).json({ error: "Class not found" });
      }

      let coverData = {};

      if (fileName) {
        // Handle color selection case
        coverData = {
          filePath: `/public/cover/${fileName}`,
          fileName,
        };
      } else if (req.file) {
        // Handle uploaded file case
        coverData = {
          filePath: `/public/cover-class/${req.file.filename}`,
          fileName: req.file.filename,
          mimeType: req.file.mimetype,
          size: req.file.size,
        };
      } else {
        return res.status(400).json({ error: "Either fileName or coverImage must be provided." });
      }

      const existingCover = await prisma.classCover.findUnique({ where: { classId } });

      let updatedCover;
      if (existingCover) {
        updatedCover = await prisma.classCover.update({
          where: { classId },
          data: coverData,
        });
      } else {
        updatedCover = await prisma.classCover.create({
          data: {
            classId,
            ...coverData,
          },
        });
      }

      res.json(updatedCover);
    } catch (error) {
      console.error("Error saving class cover:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/batch-cover",
  batchUpload.single("coverImage"),
  async (req, res) => {
    try {
      const { batchId, fileName } = req.body;

      if (!batchId) {
        return res.status(400).json({ error: "batchId is missing" });
      }

      const existingBatch = await prisma.batch.findUnique({ where: { id: batchId } });
      if (!existingBatch) {
        return res.status(404).json({ error: "Batch not found" });
      }

      let coverData = {};

      if (fileName) {
        // Handle color selection case
        coverData = {
          filePath: `/public/cover/${fileName}`,
          fileName,
        };
      } else if (req.file) {
        // Handle uploaded file case
        coverData = {
          filePath: `/public/cover-batch/${req.file.filename}`,
          fileName: req.file.filename,
          mimeType: req.file.mimetype,
          size: req.file.size,
        };
      } else {
        return res.status(400).json({ error: "Either fileName or coverImage must be provided." });
      }

      const existingCover = await prisma.batchCover.findUnique({ where: { batchId } });

      let updatedCover;
      if (existingCover) {
        updatedCover = await prisma.batchCover.update({
          where: { batchId },
          data: coverData,
        });
      } else {
        updatedCover = await prisma.batchCover.create({
          data: {
            batchId,
            ...coverData,
          },
        });
      }

      res.json(updatedCover);
    } catch (error) {
      console.error("Error saving batch cover:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.get("/class-cover/:classId", async (req, res) => {
  try {
    const { classId } = req.params;
    const classCover = await prisma.classCover.findUnique({ where: { classId } });

    if (!classCover) {
      return res.status(404).json({ error: "Class cover not found" });
    }

    res.json(classCover);
  } catch (error) {
    console.error("Error fetching class cover:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

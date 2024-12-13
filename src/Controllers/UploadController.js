const express = require("express");
const multer = require("multer");
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");

const router = express.Router();
const prisma = new PrismaClient();

// Utility untuk memastikan folder target ada
const ensureDirectoryExistence = (folderPath) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
};

// Sanitasi nama file
const sanitizeFilename = (filename) => {
  return filename.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_.-]/g, "");
};

// Konfigurasi Multer untuk Profile
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { type } = req.body; // Mendapatkan tipe profil dari request body
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
  limits: { fileSize: 10 * 1024 * 1024 }, // Maksimal 10 MB per file
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and PDF are allowed."));
    }
  },
});

// Endpoint untuk upload Profile
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
    res.status(500).json({ error: "Failed to upload profile", details: error.message });
  }
});

// Konfigurasi Multer untuk Lesson
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
  limits: { fileSize: 100 * 1024 * 1024 }, // Maksimal 100 MB per file
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "application/pptx"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, PDF, and Word documents are allowed."));
    }
  },
});

// Endpoint untuk upload Lesson
router.post("/lesson", lessonUpload.array("files", 3), async (req, res) => {
  const { title, description, deadline, classId, batchId } = req.body;
  const { files } = req;

  if (!title || !description || !deadline || !classId || !batchId) {
    return res.status(400).json({ error: "All lesson fields are required" });
  }

  if (!files || files.length === 0) {
    return res.status(400).json({ error: "At least one file is required" });
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
      message: "Lesson and files uploaded successfully",
      lesson,
      files: results,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create lesson and upload files", details: error.message });
  }
});

router.put("/lesson/:lessonId", lessonUpload.array("files", 3), async (req, res) => {
    const { lessonId } = req.params;
    const { title, description, deadline, classId, batchId, deleteOldFiles } = req.body;
    const { files } = req; // File baru yang diunggah
  
    try {
      // Cari lesson berdasarkan ID
      const existingLesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { files: true }, // Sertakan file yang terkait
      });
  
      if (!existingLesson) {
        return res.status(404).json({ error: "Lesson not found" });
      }
  
      // Update data lesson
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
  
      // Hapus file lama jika diminta
      if (deleteOldFiles === "true" && existingLesson.files.length > 0) {
        await prisma.file.deleteMany({
          where: { lessonId },
        });
      }
  
      // Tambahkan file baru jika ada
      let uploadedFiles = [];
      if (files && files.length > 0) {
        const uploads = files.map((file) =>
          prisma.file.create({
            data: {
              filename: file.originalname,
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
        message: "Lesson updated successfully",
        lesson: updatedLesson,
        files: uploadedFiles,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update lesson", details: error.message });
    }
});

const certificateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/certificate/')); // Destination folder
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`); // Create unique filename
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPEG, and PNG are allowed.'), false);
  }
};

const certificateUpload = multer({
  certificateStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB file size limit
  fileFilter,
});

// Controller function to handle certificate upload
router.post('/upload-certificate', certificateUpload.single('certificate'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const filePath = `/public/certificate/${req.file.filename}`;

    // Save the file path to the database
    const certificate = await prisma.certificate.create({
      data: {
        traineeId: req.body.traineeId,
        classId: req.body.classId,
        batchId: req.body.batchId,
        status: 'Issued',
        issuedAt: new Date(),
        filePath,
      },
    });

    res.status(200).json({
      message: 'Certificate uploaded successfully!',
      certificate,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error.', error: error.message });
  }
});

module.exports = router;

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

// Konfigurasi Multer untuk lesson
const lessonStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const targetFolder = "public/lesson";
    ensureDirectoryExistence(targetFolder);
    cb(null, targetFolder);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const lessonUpload = multer({
  storage: lessonStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // Maksimal 100 MB per file
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "application/pdf", "application/msword"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, PDF, and Word documents are allowed."));
    }
  },
});

// Middleware untuk menangani error multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({ error: "Too many files. Maximum upload limit is 3 files." });
  }
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File too large. Maximum size is 100MB per file." });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// Endpoint untuk upload lesson
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
      // Buat lesson baru
      const lesson = await prisma.lesson.create({
        data: {
          title,
          description,
          deadline: new Date(deadline), // Pastikan format deadline benar
          classId,
          batchId,
        },
      });
  
      // Simpan metadata file ke database
      const uploads = files.map((file) =>
        prisma.file.create({
          data: {
            filename: file.originalname,
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

module.exports = router;

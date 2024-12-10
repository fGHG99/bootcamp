const { PrismaClient } = require('@prisma/client');
const express = require('express');

const prisma = new PrismaClient();
const router = express.Router();

// Mark a lesson as completed
router.post('/lesson/complete', async (req, res) => {
  const { userId, lessonId } = req.body;

  if (!userId || !lessonId) {
    return res.status(400).json({ error: 'userId and lessonId are required' });
  }

  try {
    // Mark lesson as completed
    await prisma.lessonCompletion.upsert({
      where: {
        userId_lessonId: { userId, lessonId },
      },
      update: { completed: true, completedAt: new Date() },
      create: { userId, lessonId, completed: true, completedAt: new Date() },
    });

    // Update class progress and handle certificate
    const certificate = await updateClassProgress(userId, lessonId);

    if (certificate) {
      res.status(200).json({
        message: 'Lesson completed successfully, and certificate issued!',
        certificate,
      });
    } else {
      res.status(200).json({ message: 'Lesson completed successfully.' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to update class progress and issue certificates
async function updateClassProgress(userId, lessonId) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { class: true },
  });

  if (!lesson) throw new Error('Lesson not found');

  const classId = lesson.classId;

  // Calculate progress
  const totalLessons = await prisma.lesson.count({ where: { classId } });
  const completedLessons = await prisma.lessonCompletion.count({
    where: { userId, lesson: { classId }, completed: true },
  });

  const progress = (completedLessons / totalLessons) * 100;

  // Update class status if progress is 100%
  if (progress === 100) {
    await prisma.class.update({ where: { id: classId }, data: { status: 'Completed' } });
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

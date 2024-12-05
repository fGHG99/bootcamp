const express = require('express');
const prisma = require('@prisma/client').PrismaClient;
const { protect } = require('../Middlewares/Auth'); // JWT middleware

const router = express.Router();
const prismaClient = new prisma();

router.post('/note/add', protect, async (req, res) => {
  const { content, visibility, graderId, traineeId } = req.body;

  // Validate content length
  if (!content || content.length > 300) {
    return res.status(400).json({ message: 'Content is required and must be under 300 characters.' });
  }

  try {
    const note = await prismaClient.note.create({
      data: {
        content,
        visibility,
        graderId,
        traineeId,
      },
    });

    res.status(201).json(note);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/note/list/:traineeId', protect, async (req, res) => {
    const { traineeId } = req.params;
    const { role, userId } = req.user; // User information from JWT middleware
  
    try {
      let notes;
  
      if (role === 'TRAINEE' && userId === traineeId) {
        // Trainees can only see notes marked "FOR_TRAINEE"
        notes = await prismaClient.note.findMany({
          where: {
            traineeId,
            visibility: 'FOR_TRAINEE',
          },
          include: { grader: true }, // Include grader information
        });
      } else if (['MENTOR', 'EXAMINER', 'ADMIN'].includes(role)) {
        // Mentors, Examiners, and Admins can see all notes
        notes = await prismaClient.note.findMany({
          where: {
            traineeId,
          },
          include: { grader: true },
        });
      } else {
        return res.status(403).json({ message: 'Unauthorized' });
      }
  
      // Modify the grader field
      const modifiedNotes = notes.map(note => ({
        ...note,
        grader: {
          fullName: `${note.grader.fullName} (${note.grader.nickname || 'No Nickname'})`,
          batch: note.grader.batchId || 'No Batch',
          role: note.grader.role,
        },
      }));
  
      res.json(modifiedNotes);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  });
  

  module.exports = router;
  

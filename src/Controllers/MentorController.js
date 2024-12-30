const express = require('express');
const prisma = require('@prisma/client').PrismaClient;
const { protect } = require('../Middlewares/Auth'); // JWT middleware

const router = express.Router();
const prismaClient = new prisma();

//router to add note 
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

//router to get notes based on visibility 
router.get('/notes/:graderId/:visibility?', protect, async (req, res) => {
  const { graderId, visibility } = req.params;
  const { role } = req.user; // User information from JWT middleware

  // Only authorized roles can access this route
  if (!['MENTOR', 'EXAMINER', 'ADMIN'].includes(role)) {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  try {
    // Build the query filter dynamically
    const whereClause = { graderId };
    if (visibility) {
      whereClause.visibility = visibility; // Add visibility filter if provided
    }

    // Fetch notes based on the query
    const notes = await prismaClient.note.findMany({
      where: whereClause,
      include: {
        grader: true, // Include grader details
        trainee: true, // Include trainee details
      },
    });

    // Transform the response to include relevant details
    const transformedNotes = notes.map(note => ({
      id: note.id,
      content: note.content,
      visibility: note.visibility,
      createdAt: note.createdAt,
      grader: {
        id: note.grader.id,
        fullName: note.grader.fullName || 'Unknown',
        nickname: note.grader.nickname || 'No Nickname',
      },
      trainee: {
        id: note.trainee.id,
        fullName: note.trainee.fullName || 'Unknown',
        nickname: note.trainee.nickname || 'No Nickname',
      },
    }));

    res.json(transformedNotes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

//router to get note for specific trainee only
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

//router to delete note
router.delete('/notes/:noteId', protect, async (req, res) => {
  const { noteId } = req.params;
  const { id: userId, role } = req.user; // Access userId and role from req.user

  if (!['MENTOR', 'EXAMINER', 'ADMIN'].includes(role)) {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  try {
    // Check if the note exists
    const note = await prismaClient.note.findUnique({
      where: { id: noteId },
      include: { grader: true },
    });

    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Only allow deletion if the user is the grader or has the ADMIN role
    if (role !== 'ADMIN' && note.graderId !== userId) {
      return res.status(403).json({ message: 'You are not authorized to delete this note' });
    }

    // Delete the note
    await prismaClient.note.delete({
      where: { id: noteId },
    });

    res.status(200).json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
  

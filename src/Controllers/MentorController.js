const express = require('express');
const prisma = require('@prisma/client').PrismaClient;
const { protect } = require('../Middlewares/Auth'); // JWT middleware
const jwt = require('jsonwebtoken');
const getUserIdFromToken  = require('../Routes/GetUserId');

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
        email: note.trainee.email || 'No Email',
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

async function verifyMentor(req, res, next) {
  const refreshToken = req.headers.refreshToken || req.headers.authorization?.split(" ")[1];

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token is required.' });
  }

  try {
    const decoded = jwt.decode(refreshToken);

    if (!decoded || decoded.role !== 'MENTOR') {
      return res.status(403).json({ error: 'Access denied. Mentor role required.' });
    }

    req.mentorId = decoded.id;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Failed to authenticate.', details: error.message });
  }
}

// Get lesson and challenge percentage by mentor
router.get('/completion-percentage', verifyMentor, async (req, res) => {
  const { mentorId } = req;

  try {
    // Get all classes assigned to the mentor
    const classes = await prismaClient.class.findMany({
      where: {
        mentors: {
          some: {
            id: mentorId,
          },
        },
      },
      include: {
        lessons: true,
        challenges: true,
      },
    });

    let totalLessons = 0;
    let totalCompletedLessons = 0;
    let totalChallenges = 0;
    let totalCompletedChallenges = 0;

    const percentages = await Promise.all(
      classes.map(async (classItem) => {
        const classTotalLessons = classItem.lessons.length;
        const classCompletedLessons = await prismaClient.lessonCompletion.count({
          where: {
            lesson: { classId: classItem.id },
            completed: true,
          },
        });

        const classTotalChallenges = classItem.challenges.length;
        const classCompletedChallenges = await prismaClient.challengeCompletion.count({
          where: {
            challenge: { classId: classItem.id },
            completed: true,
          },
        });

        // Aggregate totals for whole class percentages
        totalLessons += classTotalLessons;
        totalCompletedLessons += classCompletedLessons;
        totalChallenges += classTotalChallenges;
        totalCompletedChallenges += classCompletedChallenges;

        return {
          classId: classItem.id,
          className: classItem.name,
          lessonPercentage: classTotalLessons > 0 ? (classCompletedLessons / classTotalLessons) * 100 : 0,
          challengePercentage: classTotalChallenges > 0 ? (classCompletedChallenges / classTotalChallenges) * 100 : 0,
        };
      })
    );

    const wholeClassLessonPercentage = totalLessons > 0 ? (totalCompletedLessons / totalLessons) * 100 : 0;
    const wholeClassChallengePercentage = totalChallenges > 0 ? (totalCompletedChallenges / totalChallenges) * 100 : 0;

    res.status(200).json({
      percentages,
      wholeClassLessonPercentage: wholeClassLessonPercentage.toFixed(2),
      wholeClassChallengePercentage: wholeClassChallengePercentage.toFixed(2),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch completion percentages.', details: error.message });
  }
});

router.get('/notifications', async (req, res) => {
  const { mentorId } = req;

  try {
    const notifications = await prismaClient.notification.findMany({
      where: { userId: mentorId },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ notifications });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// Update a single notification as read
router.put('/notification/:id/read', async (req, res) => {
  const { id } = req.params;
  try {
    const updatedNotification = await prismaClient.notification.update({
      where: { id }, // UUID as string
      data: { isRead: true },
    });
    res.status(200).json({ message: 'Notification marked as read.', notification: updatedNotification });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification as read.', details: error.message });
  }
});

// Update all notifications as read
router.put('/notifications/read-all', async (req, res) => {
  const { mentorId } = req;
  
  try {

    const updatedNotifications = await prismaClient.notification.updateMany({
      where: { userId: mentorId },
      data: { isRead: true },
    });

    res.status(200).json({ message: 'All notifications marked as read.', count: updatedNotifications.count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all notifications as read.', details: error.message });
  }
});

module.exports = router;
  

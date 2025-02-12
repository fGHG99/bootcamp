const express = require('express');
const prisma = require('@prisma/client').PrismaClient;
const { protect, verifyToken } = require('../Middlewares/Auth'); // JWT middleware
const jwt = require('jsonwebtoken');

const router = express.Router();
const prismaClient = new prisma();

//router to add note 
router.post('/note/add', protect, async (req, res) => {
  const { content, visibility, graderId, traineeId, classId } = req.body;

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
        classId,
      },
    });

    res.status(201).json(note);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

//router to add note based from lessoncompletion id
router.post('/note/:lessonCompletionId/lesson', protect, async (req, res) => {
  const { lessonCompletionId } = req.params;
  const { content, visibility } = req.body;

  try {
    if (!content || !visibility) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const graderId = req.user.id;
    const lessonCompletion = await prismaClient.lessonCompletion.findUnique({
      where: { id: lessonCompletionId },
      select: { userId: true }, // Only fetch the userId
    });

    if (!lessonCompletion) {
      return res.status(404).json({ message: 'LessonCompletion not found' });
    }

    const traineeId = lessonCompletion.userId;
    const note = await prismaClient.note.create({
      data: {
        content,
        visibility,
        graderId,
        traineeId,
        lessonCompletionId, 
      },
    });

    await prismaClient.lessonCompletion.update({
      where: { id: lessonCompletionId },
      data: { status: 'GRADED' },
    });

    res.status(201).json({ message: 'Note created and LessonCompletion updated to GRADED', note });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error', error });
  }
});

//router to add note based from challengecompletion id
router.post('/note/:challengeCompletionId/challenge', protect, async (req, res) => {
  const { challengeCompletionId } = req.params;
  const { content, visibility } = req.body;

  try {
    if (!content || !visibility) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const graderId = req.user.id; // Get graderId from middleware
    const challengeCompletion = await prismaClient.challengeCompletion.findUnique({
      where: { id: challengeCompletionId },
      select: { userId: true }, 
    });

    if (!challengeCompletion) {
      return res.status(404).json({ message: 'ChallengeCompletion not found' });
    }

    const traineeId = challengeCompletion.userId;
    const note = await prismaClient.note.create({
      data: {
        content,
        visibility,
        graderId,
        traineeId,
        challengeCompletionId, // Link to ChallengeCompletion
      },
    });

    await prismaClient.challengeCompletion.update({
      where: { id: challengeCompletionId },
      data: { status: 'GRADED' },
    });

    res.status(201).json({ message: 'Note created and ChallengeCompletion updated to GRADED', note });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error', error });
  }
});

//router to get notes based on visibility OR BASED ON GRADER
router.get('/notes/:graderId/:visibility?', protect,  async (req, res) => {
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
        class: true, // Include class details
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
      class: {
        id: note.class.id,
        className: note.class.className || 'Unknown class',
      }
    }));

    res.json(transformedNotes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

//router to get note for specific trainee only
router.get('/note/trainee/:traineeId', protect, async (req, res) => {
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
          include: { 
            grader: true,
            class: true, 
          }, // Include grader information
        });
      } else if (['MENTOR', 'EXAMINER', 'ADMIN'].includes(role)) {
        // Mentors, Examiners, and Admins can see all notes
        notes = await prismaClient.note.findMany({
          where: {
            traineeId,
          },
          include: { 
            grader: true,
            class: true, 
          },
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
        class: {
          id: note.class.id,
          className: note.class.className || 'No Class',
        }
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

router.get('/notifications', verifyToken, async (req, res) => {
  const { userId } = req; // Assuming `userId` is set in the request after verifying the token

  try {
    const notifications = await prismaClient.notification.findMany({
      where: { userId },
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

router.post("/schedule", verifyToken, async (req, res) => {
  try {
    const { title, schedule } = req.body;

    // Validate input to avoid invalid characters in JSON data
    if (!title || !schedule || !Array.isArray(schedule) || schedule.length === 0) {
      return res.status(400).json({ error: "Invalid input data." });
    }

    // Check for invalid characters in title and schedule
    if (/[^\x20-\x7E]/.test(title)) {
      return res.status(400).json({ error: "Title contains invalid characters." });
    }

    // Dynamically create schedule with related schedule days
    const newSchedule = await prismaClient.schedule.create({
      data: {
        title,
        scheduleDays: {
          create: schedule.map(({ day, date, start, end }) => {
            if (!start || !end) {
              throw new Error("Start and end times are required.");
            }
            return {
              day,
              date: new Date(date),
              start,
              end
            };
          })
        },
        user: {
          connect: {
            id: req.userId
          }
        }
      },
      include: {
        scheduleDays: true
      }
    });

    res.status(201).json(newSchedule);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to create schedule." });
  }
});

router.get("/schedule", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    const schedules = await prismaClient.schedule.findMany({
      where: { userId },
      include: { scheduleDays: true },
    });

    res.status(200).json(schedules);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch schedules." });
  }
});

router.put("/schedule/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const scheduleId = req.params.id;
    const { title, schedule } = req.body;

    if (!title || !schedule || !Array.isArray(schedule)) {
      return res.status(400).json({ error: "Invalid input data." });
    }

    // Verify the schedule belongs to the user
    const existingSchedule = await prismaClient.schedule.findFirst({
      where: { id: scheduleId, userId },
    });

    if (!existingSchedule) {
      return res.status(404).json({ error: "Schedule not found." });
    }

    // Update the schedule and related schedule days
    const updatedSchedule = await prismaClient.schedule.update({
      where: { id: scheduleId },
      data: {
        title,
        scheduleDays: {
          deleteMany: {}, // Clear existing schedule days
          create: schedule.map((day) => ({
            day: day.day,
            date: new Date(day.date),
            start: day.hours.start,
            end: day.hours.end,
          })),
        },
      },
      include: { scheduleDays: true },
    });

    res.status(200).json(updatedSchedule);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update schedule." });
  }
});

router.get('/lesson/:lessonId/completions', async (req, res) => {
  const { lessonId } = req.params;

  if (!lessonId) {
    return res.status(400).json({ error: 'Lesson ID is required' });
  }

  try {
    // Find all lesson completions related to the lessonId
    const lessonCompletions = await prismaClient.lessonCompletion.findMany({
      where: { lessonId },
      select: { userId: true } // Only fetch user IDs
    });

    if (!lessonCompletions.length) {
      return res.status(404).json({ message: 'No lesson completions found for this lesson' });
    }

    // Fetch lesson completions grouped by status
    const submittedCompletions = await prismaClient.lessonCompletion.findMany({
      where: {
        lessonId,
        status: 'SUBMITTED'
      },
      include: { 
        user: {
          select: {
            id: true,
            fullName: true,
            nickname: true,
          }
        }, 
        lesson: {
          select: {
            id: true,
            title: true,
            description: true,
            deadline: true,
          }
        },
        submissionFiles: {
          select: {
            id: true,
            filename: true,
            filepath: true,
          }
        }
      }
    });

    const notSubmittedCompletions = await prismaClient.lessonCompletion.findMany({
      where: {
        lessonId,
        status: 'NOTSUBMITTED'
      },
      include: { 
        user: {
          select: {
            id: true,
            fullName: true,
            nickname: true,
          }
        }, 
        lesson: {
          select: {
            id: true,
            title: true,
            description: true,
            deadline: true,
          }
        }, 
        submissionFiles: {
          select: {
            id: true,
            filename: true,
            filepath: true,
          }
        }
      }
    });

    const lateCompletions = await prismaClient.lessonCompletion.findMany({
      where: {
        lessonId,
        status: 'LATE'
      },
      include: { 
        user: {
          select: {
            id: true,
            fullName: true,
            nickname: true,
          }
        }, 
        lesson: {
          select: {
            id: true,
            title: true,
            description: true,
            deadline: true,
          }
        }, 
        submissionFiles: {
          select: {
            id: true,
            filename: true,
            filepath: true,
          }
        } 
      }
    });

    const gradedCompletions = await prismaClient.lessonCompletion.findMany({
      where: {
        lessonId,
        status: 'GRADED'
      },
      include: { 
        user: {
          select: {
            id: true,
            fullName: true,
            nickname: true,
          }
        }, 
        lesson: {
          select: {
            id: true,
            title: true,
            description: true,
            deadline: true,
            
          }
        }, 
        submissionFiles: {
          select: {
            id: true,
            filename: true,
            filepath: true,
          }
        } 
      }
    });

    // Combine all completions into an array
    const allCompletions = [
      ...submittedCompletions.map(completion => ({ ...completion, status: 'SUBMITTED' })),
      ...notSubmittedCompletions.map(completion => ({ ...completion, status: 'NOTSUBMITTED' })),
      ...lateCompletions.map(completion => ({ ...completion, status: 'LATE' })),
      ...gradedCompletions.map(completion => ({ ...completion, status: 'GRADED'}))
    ];

    res.status(200).json({
      message: 'Lesson completions fetched successfully',
      completions: allCompletions
    });
  } catch (error) {
    console.error('Error fetching lesson completions:', error);
    res.status(500).json({ error: 'Failed to fetch lesson completions', details: error.message });
  }
});

router.get('/challenge/:challengeId/completions', async (req, res) => {
  const { challengeId } = req.params;

  if (!challengeId) {
    return res.status(400).json({ error: 'Challenge ID is required' });
  }

  try {
    // Find all challenge completions related to the challengeId
    const challengeCompletions = await prismaClient.challengeCompletion.findMany({
      where: { challengeId },
      select: { userId: true } // Only fetch user IDs
    });

    if (!challengeCompletions.length) {
      return res.status(404).json({ message: 'No challenge completions found for this challenge' });
    }
    // Fetch challenge completions grouped by status
    const submittedCompletions = await prismaClient.challengeCompletion.findMany({
      where: {
        challengeId,
        status: 'SUBMITTED'
      },
      include: { 
        user: {
          select: {
            id: true,
            fullName: true,
            nickname: true,
          }
        }, 
        challenge: {
          select: {
            id: true,
            title: true,
            description: true,
            deadline: true,
            
          }
        }, 
        submissionFiles: {
          select: {
            id: true,
            filename: true,
            filepath: true,
          }
        }
      }
    });

    const notSubmittedCompletions = await prismaClient.challengeCompletion.findMany({
      where: {
        challengeId,
        status: 'NOTSUBMITTED'
      },
      include: { 
        user: {
          select: {
            id: true,
            fullName: true,
            nickname: true,
          }
        }, 
        challenge: {
          select: {
            id: true,
            title: true,
            description: true,
            deadline: true,
            
          }, 
        }, 
        submissionFiles: {
          select: {
            id: true,
            filename: true,
            filepath: true,
          }
        } 
      }
    });

    const lateCompletions = await prismaClient.challengeCompletion.findMany({
      where: {
        challengeId,
        status: 'LATE'
      },
      include: { 
        user: {
          select: {
            id: true,
            fullName: true,
            nickname: true,
          }
        }, 
        challenge: {
          select: {
            id: true,
            title: true,
            description: true,
            deadline: true,
            
          }, 
        }, 
        submissionFiles: {
          select: {
            id: true,
            filename: true,
            filepath: true,
          }
        } 
      }
    });

    const gradedCompletions = await prismaClient.challengeCompletion.findMany({
      where: {
        challengeId,
        status: 'GRADED'
      },
      include: { 
        user: {
          select: {
            id: true,
            fullName: true,
            nickname: true,
          }
        },
        challenge: {
          select: {
            id: true,
            title: true,
            description: true,
            deadline: true,
            
          }, 
        }, 
        submissionFiles: {
          select: {
            id: true,
            filename: true,
            filepath: true,
          }
        } 
      }
    });

    // Combine all completions into an array
    const allCompletions = [
      ...submittedCompletions.map(completion => ({ ...completion, status: 'SUBMITTED' })),
      ...notSubmittedCompletions.map(completion => ({ ...completion, status: 'NOTSUBMITTED' })),
      ...lateCompletions.map(completion => ({ ...completion, status: 'LATE' })),
      ...gradedCompletions.map(completion => ({ ...completion, status: 'GRADED'}))
    ];

    res.status(200).json({
      message: 'Challenge completions fetched successfully',
      completions: allCompletions
    });
  } catch (error) {
    console.error('Error fetching challenge completions:', error);
    res.status(500).json({ error: 'Failed to fetch challenge completions', details: error.message });
  }
});

router.get('/class-lesson/:userId', async (req, res) => {
  const { userId } = req.params;
  const { classId, lessonStatus } = req.query; // Accept filters from query parameters

  try {
    // Step 1: Get all classes for the user
    const userClasses = await prismaClient.class.findMany({
      where: {
        users: {
          some: {
            id: userId,
          },
        },
        ...(classId && { id: classId }), // Filter by classId if provided
      },
      include: {
        lessons: { 
          include: {
            mentor: { select : { fullName: true, nickname: true } },
          } 
        },
      },
    });

    if (!userClasses.length) {
      return res.status(404).json({ message: 'No classes found for this user.' });
    }

    // Step 2: Extract all lessons from the classes
    const allLessons = userClasses.flatMap((userClass) => userClass.lessons);

    // Step 3: For each lesson, check its completion status for the given user
    const lessonsWithCompletion = await Promise.all(
      allLessons.map(async (lesson) => {
        const lessonCompletion = await prismaClient.lessonCompletion.findUnique({
          where: {
            userId_lessonId: {
              userId: userId,
              lessonId: lesson.id,
            },
          },
        });

        return {
          ...lesson,
          completionStatus: lessonCompletion ? lessonCompletion.status : lesson.status,
        };
      })
    );

    // Step 4: Apply lessonStatus filter if provided
    const filteredLessons = lessonStatus
      ? lessonsWithCompletion.filter((lesson) => lesson.completionStatus === lessonStatus)
      : lessonsWithCompletion;

    // Step 5: Group lessons back by class
    const result = userClasses.map((userClass) => ({
      classId: userClass.id,
      className: userClass.className,
      lessons: filteredLessons.filter((lesson) => lesson.classId === userClass.id),
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching classes and lessons:', error);
    res.status(500).json({ message: 'An error occurred while fetching data.' });
  }
});

router.get('/class-challenge/:userId', async (req, res) => {
  const { userId } = req.params;
  const { classId, challengeStatus } = req.query; // Accept filters from query parameters

  try {
    // Step 1: Get all classes for the user
    const userClasses = await prismaClient.class.findMany({
      where: {
        users: {
          some: {
            id: userId,
          },
        },
        ...(classId && { id: classId }), // Filter by classId if provided
      },
      include: {
        challenges: { 
          include: {
            mentor: { select : { fullName: true, nickname: true } },
          } 
        },
      },
    });

    if (!userClasses.length) {
      return res.status(404).json({ message: 'No classes found for this user.' });
    }

    // Step 2: Extract all lessons from the classes
    const allChallenges = userClasses.flatMap((userClass) => userClass.challenges);

    // Step 3: For each lesson, check its completion status for the given user
    const challengeWithCompletion = await Promise.all(
      allChallenges.map(async (challenge) => {
        const challengeCompletion = await prismaClient.challengeCompletion.findUnique({
          where: {
            userId_challengeId: {
              userId: userId,
              challengeId: challenge.id,
            },
          },
        });

        return {
          ...challenge,
          completionStatus: challengeCompletion ? challengeCompletion.status : challenge.status,
        };
      })
    );

    // Step 4: Apply lessonStatus filter if provided
    const filteredChallenges = challengeStatus
      ? challengeWithCompletion.filter((challenge) => challenge.completionStatus === challengeStatus)
      : challengeWithCompletion;

    // Step 5: Group lessons back by class
    const result = userClasses.map((userClass) => ({
      classId: userClass.id,
      className: userClass.className,
      challenges: filteredChallenges.filter((challenge) => challenge.classId === userClass.id),
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching classes and challenge', error);
    res.status(500).json({ message: 'An error occurred while fetching data.' });
  }
});
module.exports = router;
  

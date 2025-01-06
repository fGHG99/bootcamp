const express = require('express');
const prisma = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verifyRoles } = require('../Middlewares/Auth'); 


const { PrismaClient } = prisma;
const prismaClient = new PrismaClient();
const router = express.Router();

router.post('/create-user', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Validate inputs
    if (!email || !password || !role) {
      return res.status(400).json({ message: 'Email, password, and role are required.' });
    }

    // Validate role against allowed roles
    const validRoles = ['TRAINEE', 'MENTOR', 'EXAMINER', 'ADMIN'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Valid roles are: ${validRoles.join(', ')}`,
      });
    }

    // Check if the user already exists
    const existingUser = await prismaClient.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists.' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate refresh token
    const refreshToken = jwt.sign(
      {
        email,
        role,
      },
      process.env.SECRET, // Add your refresh token secret in the `.env` file
      { expiresIn: '7d' } // Refresh token expires in 7 days
    );

    // Generate access token
    const accessToken = jwt.sign(
      {
        email,
        role,
      },
      process.env.SECRET, // Add your access token secret in the `.env` file
      { expiresIn: '15m' } // Access token expires in 15 minutes
    );

    // Create the user and save refreshToken
    const newUser = await prismaClient.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
        userstatus: 'UNVERIFIED',
        fullName: null,
        nickname: null,
        pob: null,
        dob: null,
        address: null,
        mobile: null,
        lastEdu: null,
        lastEduInst: null,
        major: null,
        inCollege: null,
        college: null,
        currentMajor: null,
        github: null,
        skill1: null,
        skill2: null,
        skill3: null,
        skill4: null,
        skill5: null,
        skill6: null,
        skill7: null,
        skill8: null,
        confident: null,
        refreshToken: refreshToken, // Store the refresh token in the database
      },
      select: {
        id: true,
        email: true,
        role: true,
        userstatus: true,
      },
    });

    res.status(201).json({
      message: 'User created successfully.',
      user: newUser,
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'An error occurred while creating the user.' });
  }
});

router.post('/class', verifyRoles(['ADMIN']), async (req, res) => {
  try {
    const { className, batchId, participant } = req.body;

    const classData = await prismaClient.class.create({
      data: {
        className,
        participant,
        batchId,
        createdAt: new Date(),
      },
    });
    res.status(201).json(classData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/class', async (req, res) => {
  try {
    const classes = await prismaClient.class.findMany({
      select: {
        id: true,
        className: true,
        participant: true, // The count of participants
        batchId: true,
        batch: {
          select: {
            id: true,
            batchNum: true,
            batchClass: true,
            batchTitle: true,
          },
        }, // Fetch related batch details
        mentors: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        }, 
        users: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        challenges: true,
        lessons: true,
        certificates: true,
        status: true,
      },
    });
    

    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//router to assign mentor to classes
router.put('/class/:id', async (req, res) => {
  const { id } = req.params;
  const { className, mentors } = req.body;

  try {
    // Pastikan kelas dengan ID yang diberikan ada
    const existingClass = await prismaClient.class.findUnique({
      where: { id },
      include: { mentors: true }, // Sertakan relasi mentors untuk validasi
    });

    if (!existingClass) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Bangun data pembaruan secara dinamis
    const updateData = {};

    if (className !== undefined) {
      updateData.className = className;
    }

    if (mentors !== undefined) {
      updateData.mentors = {
        set: mentors.map((mentorId) => ({ id: mentorId })), // Perbarui mentors jika diberikan
      };
    }

    // Lakukan pembaruan
    const updatedClass = await prismaClient.class.update({
      where: { id },
      data: updateData,
      include: {
        mentors: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    res.status(200).json(updatedClass);
  } catch (error) {
    console.error('Error updating class:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { batchNum, batchClass, batchTitle, batchDesc, mentorIds, startDate, endDate, status } = req.body;

    const batch = await prismaClient.batch.create({
      data: {
        batchNum,
        batchClass,
        batchTitle,
        batchDesc,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status,
        mentors: {
          connect: mentorIds.map((id) => ({ id })), // Connect existing mentors
        },
      },
    });

    res.status(201).json(batch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.get('/batch', async (req, res) => {
  try {
    const { id } = req.query;

    if (id) {
      // Fetch a specific batch by ID, including associated mentors, participants, classes, etc.
      const batch = await prismaClient.batch.findUnique({
        where: { id },
        include: {
          mentors: {
            select: {
              id: true,
              fullName: true,
              nickname: true,
            },
          },
          participants : {
            select: {
              id: true,
              fullName: true,
              nickname: true,
            },
          },   // Include participant details
          classes: true,        // Include class details
          challenges: true,     // Include challenge details
          lessons: true,        // Include lesson details
          certificates: true,   // Include certificate details
        },
      });

      if (!batch) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      return res.status(200).json(batch);
    } else {
      // Fetch all batches, including associated mentors, participants, classes, etc.
      const batches = await prismaClient.batch.findMany({
        include: {
          mentors: {
            select: {
              id: true,
              fullName: true,
              nickname: true,
            },
          },
          participants: {
            select: {
              id: true,
              fullName: true,
              nickname: true,
            },
          },  
          classes: true,
          challenges: true,
          lessons: true,
          certificates: true,
        },
      });

      return res.status(200).json(batches);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.get('/batchs/:id', async (req, res) => {
  try {
    const { id } = req.params; // Get batch ID from the route parameter

    // Fetch the batch by ID, including associated classes and their lessons
    const batch = await prismaClient.batch.findUnique({
      where: { id },
      include: {
        classes: {
          include: {
            lessons: true,
            challenges: true // Include related Lesson records for each Class
          },
        },
      },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    res.status(200).json(batch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/challenge', verifyRoles(['ADMIN']), async (req, res) => {
  try {
    const { batchId, classId } = req.body;

    const challenge = await prismaClient.challenge.create({
      data: {
        batchId,
        classId,
        createdAt: new Date(),
      },
    });
    res.status(201).json(challenge);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a lesson's details
router.get('/:lessonId', async (req, res) => {
  try {
    const { lessonId } = req.params;

    const lesson = await prismaClient.lesson.findUnique({
      where: { id: lessonId },
      include: { files: true },
    });

    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

    res.status(200).json({ lesson });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching lesson', error });
  }
});

// Delete a lesson
router.delete('/:lessonId/delete', async (req, res) => {
  try {
    const { lessonId } = req.params;

    await prismaClient.lesson.delete({ where: { id: lessonId } });
    res.status(200).json({ message: 'Lesson deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting lesson', error });
  }
});

//router to get mentor details
router.get('/mentor/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // Find the mentor by userId
    const mentor = await prismaClient.user.findUnique({
      where: { id: userId },
      select: {
        fullName: true,   // Fetch the name of the mentor
        role: true,   // Fetch the role of the mentor
      },
    });

    if (!mentor) {
      return res.status(404).json({ message: 'Mentor not found' });
    }

    // Send the mentor details as a response
    res.json(mentor);
  } catch (error) {
    console.error('Error fetching mentor details:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// get user from dynamic role
router.get("/users/:role", async (req, res) => {
  try {
    const { role } = req.params; // Extract role from path parameters

    // Fetch users based on the role
    const users = await prismaClient.user.findMany({
      where: { role },
      select: {
        id: true,
        fullName: true,
        nickname: true,
        github: true, 
        address: true,
        mobile: true,
        email: true,
        confident: true,
        certificates: {
          select: {
            id: true,
            traineeId: true,
            issuedAt: true,
          },
        },
        classes: {
          select: {
            id: true,
            className: true,
            createdAt: true,
          },
        },
        batches: {
          select: {
            id: true,
            batchNum: true,
            batchClass: true,
            batchTitle: true,
          }
        },
        isLoggedIn: true,
      },
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

//router to get user based on class
router.get('/class/:classId', async (req, res) => {
  const { classId } = req.params;

  try {
    // Fetch users based on classId
    const users = await prismaClient.user.findMany({
      where: {
        classes: {
          some: {
            id: classId, // Ensure this is the correct relation and column name
          },
        },
      },
      include: {
        classes: true, // Include the related classes if needed
      },
    });

    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'No users found for this class.' });
    }

    // Count the number of users enrolled in the class
    const participantCount = users.length;

    // Update the class to reflect the number of participants
    await prismaClient.class.update({
      where: { id: classId },
      data: {
        participant: participantCount,
      },
    });

    // Return the users along with the updated participant count
    return res.status(200).json({
      classId,
      participantCount,
      users,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'An error occurred while fetching users.' });
  }
});

//router to get batch based on mentor
router.get('/batch/:mentorId', async (req, res) => {
  const { mentorId } = req.params;

  try {
    // Cari batch yang memiliki mentor tertentu
    const batches = await prismaClient.batch.findMany({
      where: {
        mentors: {
          some: {
            id: mentorId, // Cari mentor berdasarkan ID
          },
        },
      },
      include: {
        mentors: {
          select: { id: true, fullName: true, email: true }, // Sertakan detail mentor
        },
        participants: true,   // Sertakan peserta
        challenges: true,     // Sertakan tantangan
        classes: true,        // Sertakan kelas
        lessons: true,        // Sertakan pelajaran
      },
    });

    if (batches.length === 0) {
      return res.status(404).json({ message: 'No batches found for this mentor.' });
    }

    res.status(200).json(batches);
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

//router to assign mentors to a batch
router.put('/batch/:id', async (req, res) => {
  const { id } = req.params;
  const { batchNum, batchClass, batchTitle, mentors } = req.body;

  try {
    // Pastikan batch dengan ID yang diberikan ada
    const existingBatch = await prismaClient.batch.findUnique({ where: { id } });
    if (!existingBatch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Bangun data pembaruan secara dinamis
    const updateData = {};
    if (batchNum !== undefined) updateData.batchNum = batchNum;
    if (batchClass !== undefined) updateData.batchClass = batchClass;
    if (batchTitle !== undefined) updateData.batchTitle = batchTitle;
    if (mentors !== undefined) {
      updateData.mentors = {
        set: mentors.map((mentorId) => ({ id: mentorId })), // Perbarui mentor jika diberikan
      };
    }

    // Lakukan pembaruan
    const updatedBatch = await prismaClient.batch.update({
      where: { id },
      data: updateData,
      include: {
        mentors: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    res.status(200).json(updatedBatch);
  } catch (error) {
    console.error('Error updating batch:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

//router to assign participants to a batch
router.put('/batch/:id/participants', async (req, res) => {
  const { id } = req.params;
  const { participants } = req.body; // Expect an array of participant IDs

  try {
    // Ensure the batch with the given ID exists
    const existingBatch = await prismaClient.batch.findUnique({ where: { id } });
    if (!existingBatch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Build update data dynamically for participants
    const updateData = {};
    if (participants !== undefined) {
      updateData.participants = {
        set: participants.map((participantId) => ({ id: participantId })), // Update participants
      };
    }

    // Perform the update without requiring other fields
    const updatedBatch = await prismaClient.batch.update({
      where: { id },
      data: updateData,
      include: {
        participants: {
          select: { id: true, fullName: true, email: true }, // Customize fields as needed
        },
        // Include other relationships as necessary
        mentors: { select: { id: true, fullName: true, email: true } },
        // classes: true,
        // challenges: true,
        // lessons: true,
        // certificates: true,
      },
    });

    res.status(200).json(updatedBatch);
  } catch (error) {
    console.error('Error updating participants:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;

const express = require('express');
const prisma = require('@prisma/client');
const { Role: RoleEnum } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verifyRoles, verifyToken } = require('../Middlewares/Auth'); 
const socket = require('./SocketHandler');

const { PrismaClient } = prisma;
const prismaClient = new PrismaClient();
const router = express.Router();

router.post('/create-user', verifyToken, verifyRoles(['ADMIN']), async (req, res) => {
  const { userId } = req;
  try {
    const { email, password, dob, pob, mobile, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ message: 'Email, password, and role are required.' });
    }

    const validRoles = ['TRAINEE', 'MENTOR', 'EXAMINER', 'ADMIN'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Valid roles are: ${validRoles.join(', ')}`,
      });
    }

    const existingUser = await prismaClient.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const refreshToken = jwt.sign(
      {
        email,
        role,
      },
      process.env.SECRET, // Add your refresh token secret in the `.env` file
      { expiresIn: '7d' } // Refresh token expires in 7 days
    );

    const accessToken = jwt.sign(
      {
        email,
        role,
      },
      process.env.SECRET, // Add your access token secret in the `.env` file
      { expiresIn: '30m' } // Access token expires in 15 minutes
    );

    const newUser = await prismaClient.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
        userstatus: 'UNVERIFIED',
        fullName: null,
        nickname: null,
        pob,
        dob: new Date(dob),
        address: null,
        mobile,
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
        fullName: true,
        role: true,
        dob: true,
        pob: true,
        mobile: true,
        userstatus: true
      },
    });

    const notifyAdmin = async (userId) => {
      // Create a notification for the mentor
      const AdminNotification = await prismaClient.notification.create({
        data: {
          userId: userId,
          title: 'User Created!',
          description: 'You have successfully created new user.',
          type: 'User',
        },
      });
      console.log('Admin Notification Created', AdminNotification);

      // Emit notification to the mentor
      const io = socket.getIO();
      io.to(userId).emit('receiveNotification', {
        id: AdminNotification.id,
        title: AdminNotification.title,
        description: AdminNotification.description,
        type: AdminNotification.type,
        createdAt: AdminNotification.createdAt,
      });
    };

    await notifyAdmin(userId);

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

router.post('/class', verifyToken, async (req, res) => {
  const { userId } = req; // Extracting userId from the token
  try {
    const { className, batchId, mentors, users } = req.body;
    const participant = users.length;

    // Create the new class and link it to the provided batches, mentors, and users
    const classData = await prismaClient.class.create({
      data: {
        className,
        participant,
        createdAt: new Date(),
        batches: {
          create: batchId.map((batchId) => ({ batchId })),
        },
        mentors: {
          connect: mentors.map((mentorId) => ({ id: mentorId })), // Assign mentors by connecting existing users
        },
        users: {
          connect: users.map((userId) => ({ id: userId })), // Assign participants by connecting existing users
        },
      },
      include: {
        batches: {
          include: {
            batch: {
              select: {
                batchNum: true,
                batchTitle: true,
                batchDesc: true,
                status: true,
              },
            },
          },
        },
        mentors: {
          select: { id: true, fullName: true, email: true }, // Include mentor details
        },
        users: {
          select: { id: true, fullName: true, email: true }, // Include participant details
        },
      },
    });

    // Notify admin about the created class
    const notifyAdmin = async (userId) => {
      const AdminNotification = await prismaClient.notification.create({
        data: {
          userId: userId,
          title: 'Created class!',
          description: 'You have successfully created a new class.',
          type: 'class',
        },
      });

      // Emit the notification to the admin
      const io = socket.getIO();
      io.to(userId).emit('receiveNotification', {
        id: AdminNotification.id,
        title: AdminNotification.title,
        description: AdminNotification.description,
        type: AdminNotification.type,
        createdAt: AdminNotification.createdAt,
      });
    };

    await notifyAdmin(userId);

    res.status(201).json(classData);
  } catch (error) {
    console.error('Error creating class:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/class', async (req, res) => {
  try {
    const classes = await prismaClient.class.findMany({
      select: {
        id: true,
        className: true,
        participant: 0,
        createdAt: true,
        status: true,
        batches: {
          include: {
            batch: {
              select: {
                batchNum: true,
                batchTitle: true,
              },
            },
          },
        },
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
      },
    });

    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//router to assign mentor and participants
router.put('/class/:id', async (req, res) => {
  const { id } = req.params;
  const { className, mentors, users } = req.body;

  try {
    // Pastikan kelas dengan ID yang diberikan ada
    const existingClass = await prismaClient.class.findUnique({
      where: { id },
      include: { 
        mentors: true,
        users: true, 
      }, // Sertakan relasi mentors untuk validasi
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

    if (users !== undefined) {
      updateData.users = {
        set: users.map((userId) => ({ id: userId })), // Perbarui mentors jika diberikan
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
        users: {
          select : { id: true, fullName: true, email: true },
        }
      },
    });

    res.status(200).json(updatedClass);
  } catch (error) {
    console.error('Error updating class:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/batch', verifyRoles(['ADMIN']), verifyToken, async (req, res) => {
  const { userId } = req; // Authenticated user's ID
  try {
    const {
      batchNum,
      batchClass,
      batchTitle,
      batchDesc,
      mentorIds,
      participantIds, // New field for participants
      startDate,
      endDate,
    } = req.body;

    // Check if the batch number already exists
    const existingBatch = await prismaClient.batch.findUnique({
      where: { batchNum },
    });

    if (existingBatch) {
      return res.status(400).json({ error: 'Batch number already taken' });
    }

    // Fetch mentors based on mentorIds
    const mentors = await prismaClient.user.findMany({
      where: {
        id: {
          in: mentorIds,
        },
      },
      select: {
        id: true, // Mentor's ID to connect to the batch
        email: true,
        fullName: true,
        role: true,
      },
    });

    if (!mentors.length) {
      return res.status(404).json({ error: 'Mentors not found' });
    }

    // Fetch participants based on participantIds
    const participants = await prismaClient.user.findMany({
      where: {
        id: {
          in: participantIds,
        },
      },
      select: {
        id: true, // Participant's ID to connect to the batch
        email: true,
        fullName: true,
        role: true,
      },
    });

    if (!participants.length) {
      return res.status(404).json({ error: 'Participants not found' });
    }

    // Create the batch with mentors and participants
    const batch = await prismaClient.batch.create({
      data: {
        batchNum,
        classes: {
          create: batchClass.map((classId) => ({ classId })), // Connect existing classes by their IDs
        },
        batchTitle,
        batchDesc,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        status: 'Tba',
        mentors: {
          connect: mentorIds.map((id) => ({ id })), // Connect mentors by their IDs
        },
        participants: {
          connect: participantIds.map((id) => ({ id })), // Connect participants by their IDs
        },
      },
    });

    const notifyAdmin = async (userId) => {
      const AdminNotification = await prismaClient.notification.create({
        data: {
          userId: userId,
          title: 'Batch Created!',
          description: 'You have successfully created a new Batch.',
          type: 'Batch',
        },
      });

      console.log('Admin Notification Created', AdminNotification);

      // Emit notification to the admin
      const io = socket.getIO();
      io.to(userId).emit('receiveNotification', {
        id: AdminNotification.id,
        title: AdminNotification.title,
        description: AdminNotification.description,
        type: AdminNotification.type,
        createdAt: AdminNotification.createdAt,
      });
    };

    await notifyAdmin(userId);

    // Return the batch along with mentor and participant data
    res.status(201).json({
      ...batch,
      mentors,
      participants, // Add participant data to the response (email, fullName, role)
    });
  } catch (error) {
    console.error({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/batch', async (req, res) => {
  try {{
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
          classes: {
            include: {
              class: {
                select: {
                  id: true,
                  className: true,
                  mentors: {
                    select: {
                      id: true,
                      fullName: true,
                    },
                  },
                  users: {
                    select: {
                      id: true,
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
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
        classes: true,
      },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    res.status(200).json(batch);
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log(error)
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
router.get('/lesson/:lessonId', async (req, res) => {
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
        role: true,
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

router.get("/users", async (req, res) => {
  try {

    // Fetch users based on the role
    const users = await prismaClient.user.findMany({
      select: {
        id: true,
        fullName: true,
        nickname: true,
        github: true, 
        address: true,
        mobile: true,
        email: true,
        role: true,
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
            batchTitle: true,
          }
        },
        isLoggedIn: true,
        userstatus: true,
      },
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
    console.log(error)
  }
});

router.delete('/user/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prismaClient.user.delete({
      where: { id },
    });

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Router to get all class data based on classId
router.get('/class/:batchId', async (req, res) => {
  const { batchId } = req.params;

  try {
    // Fetch classes based on batchId
    const classes = await prismaClient.class.findMany({
      where: {
        batches: {
          some: {
            batchId: batchId, // Ensure this matches your Prisma schema for the relation
          },
        },
      },
      include: {
        users: {
          select: {
            fullName: true,
            email: true,
            role: true,
          },
        }, // Include related users
        mentors: {
          select: {
            fullName: true,
            email: true,
            role: true,
          },
        }, // Include related mentors
        batches: true, // Include related batches
        challenges: true, // Include related challenges
        lessons: true, // Include related lessons
        certificates: true, // Include related certificates
        Lcompletions: true, // Include related lesson completions
        Ccompletions: true, // Include related challenge completions
      },
    });

    if (!classes || classes.length === 0) {
      return res.status(404).json({ message: 'No classes found for this batch.' });
    }

    // Add participant count for each class
    const classesWithParticipantCount = await Promise.all(
      classes.map(async (classData) => {
        const participantCount = classData.users.length;

        // Optionally, update the participant count in the database
        await prismaClient.class.update({
          where: { id: classData.id },
          data: {
            participant: participantCount,
          },
        });

        return {
          ...classData,
          participantCount,
        };
      })
    );

    // Return the classes with their participant count
    return res.status(200).json(classesWithParticipantCount);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'An error occurred while fetching the classes.' });
  }
});

router.get('/classes/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch the class data based on classId
    const classData = await prismaClient.class.findUnique({
      where: { id: id },
      include: {
        users: {
          select: {
            profiles: {select: {filepath: true}},
            fullName: true,
            email: true,
            role: true,
          }
        }, // Include related users
        mentors: {
          select: {
            fullName: true,
            email: true,
            role: true,
          }
        }, // Include related mentors
        batches: true, 
         challenges: {
          include: {
            files: true,
         }},
         lessons: {
          include: {
            files: true,
          }
         },
        certificates: true, // Include related certificates
        Lcompletions: true, // Include related lesson completions
        Ccompletions: true, // Include related challenge completions
      },
    });

    if (!classData) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    // Count the number of users (participants) in the class
    const participantCount = classData.users.length;

    // Update the class with the participant count
    await prismaClient.class.update({
      where: { id: id },
      data: {
        participant: participantCount,
      },
    });

    // Return the class data along with the updated participant count
    return res.status(200).json({
      id,
      participantCount,
      classData,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'An error occurred while fetching the class data.' });
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
  const { batchNum, classes, batchTitle, mentors, participants } = req.body;

  try {
    // Ensure the batch with the given ID exists
    const existingBatch = await prismaClient.batch.findUnique({ where: { id } });
    if (!existingBatch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Build update data dynamically
    const updateData = {};
    if (batchNum !== undefined) updateData.batchNum = batchNum;
    if (classes !== undefined) updateData.classes = classes; // Modify classes if provided
    if (batchTitle !== undefined) updateData.batchTitle = batchTitle; // Modify title if provided
    if (mentors !== undefined) {
      updateData.mentors = {
        set: mentors.map((mentorId) => ({ id: mentorId })), // Replace mentors if provided
      };
    }
    if (participants !== undefined) {
      updateData.participants = {
        set: participants.map((userId) => ({ id: userId })), // Replace participants if provided
      };
    }

    // Perform the update with the dynamic data
    const updatedBatch = await prismaClient.batch.update({
      where: { id },
      data: updateData,
      include: {
        mentors: {
          select: { id: true, fullName: true, email: true },
        },
        participants: {
          select: { id: true, fullName: true, email: true },
        },
        classes: {
          include: {
            class: {
              select: {
                id: true,
                className: true,
                participant: true,
              },
            },
          },
        },
      },
    });

    res.status(200).json(updatedBatch);
  } catch (error) {
    console.error('Error updating batch:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
//   const { id } = req.params;
//   const { batchNum, batchClass, batchTitle, mentors, participants } = req.body; // Include participants in the request body

//   try {
//     // Ensure the batch with the given ID exists
//     const existingBatch = await prismaClient.batch.findUnique({ where: { id } });
//     if (!existingBatch) {
//       return res.status(404).json({ error: 'Batch not found' });
//     }

//     // Build dynamic update data
//     const updateData = {};
//     if (batchNum !== undefined) updateData.batchNum = batchNum;
//     if (batchClass !== undefined) updateData.batchClass = batchClass;
//     if (batchTitle !== undefined) updateData.batchTitle = batchTitle;
//     if (mentors !== undefined) {
//       updateData.mentors = {
//         set: mentors.map((mentorId) => ({ id: mentorId })), // Update mentors if provided
//       };
//     }
//     if (participants !== undefined) {
//       updateData.participants = {
//         set: participants.map((participantId) => ({ id: participantId })), // Update participants if provided
//       };
//     }

//     // Perform the update
//     const updatedBatch = await prismaClient.batch.update({
//       where: { id },
//       data: updateData,
//       include: {
//         mentors: {
//           select: { id: true, fullName: true, email: true },
//         },
//         participants: {
//           select: { id: true, fullName: true, email: true }, // Include participant details
//         },
//         // Include other relationships as necessary
//         // classes: true,
//         // challenges: true,
//         // lessons: true,
//         // certificates: true,
//       },
//     });

//     res.status(200).json(updatedBatch);
//   } catch (error) {
//     console.error('Error updating batch:', error);
//     res.status(500).json({ error: 'Internal Server Error' });
//   }
// });

router.get('/role/roles', async (req, res) => {
  try {
      // Fetch enum roles
      const enumRoles = Object.values(RoleEnum);

      // Fetch roles from the database table
      const tableRoles = await prismaClient.roles.findMany({
          select: { name: true }
      });

      // If the table has roles, map them, otherwise return an empty array
      const tableRoleNames = tableRoles.length > 0 
          ? tableRoles.map(role => role.name) 
          : [];

      // Merge enum roles and table roles, removing duplicates using Set
      const mergedRoles = [...new Set([...enumRoles, ...tableRoleNames])];

      res.status(200).json({ roles: mergedRoles });
  } catch (error) {
      console.error('Error fetching roles:', error);
      res.status(500).json({ error: "Failed to fetch roles" });
  }
});

module.exports = router;

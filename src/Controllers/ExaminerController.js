const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { protect } = require("../Middlewares/Auth");

const prisma = new PrismaClient();
const router = express.Router();

router.get("/presentations/completions", async (req, res) => {
  try {
    const { batchId, classId } = req.query;

    const whereClause = {};
    if (batchId) {
      whereClause.final = {
        batch: {
          id: batchId
        }
      };
    }

    if (classId) {
      whereClause.final = {
        ...whereClause.final,
        class: {
          id: classId
        }
      };
    }

    const finalPresentations = await prisma.finalCompletion.findMany({
      where: whereClause,
      include: {
        notes: {
          select: {
            content: true,
          }
        },
        user: {
          select: {
            id: true,
            fullName: true,
          }
        },
        final: {
          include: {
            class: {
              select: {
                id: true,
                className: true,
              }
            },
            batch: {
              select: {
                id: true,
                batchTitle: true,
              }
            }
          }
        },
        submissionFiles: true,
      },
    });

    res.status(200).json(finalPresentations);
  } catch (error) {
    console.error("Error fetching final presentations:", error);
    res.status(500).json({ error: "Failed to fetch final presentations" });
  }
});

router.get('/presentation/:presentationId/completions', async (req, res) => {
  const { presentationId } = req.params;

  if (!presentationId) {
    return res.status(400).json({ error: 'Lesson ID is required' });
  }

  try {
    // Find all lesson completions related to the presentationId
    const finalCompletions = await prisma.finalCompletion.findMany({
      where: { presentationId: presentationId },
      select: { userId: true } // Only fetch user IDs
    });

    if (!finalCompletions.length) {
      return res.status(404).json({ message: 'No presentation competion find' });
    }

    // Fetch lesson completions grouped by status
    const submittedCompletions = await prisma.finalCompletion.findMany({
      where: {
        presentationId,
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
        final: {
          select: {
            id: true,
            title: true,
            description: true,
            deadline: true,
          }
        },
        submissionFiles: true,
      }
    });

    const notSubmittedCompletions = await prisma.finalCompletion.findMany({
      where: {
        presentationId,
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
        final: {
          select: {
            id: true,
            title: true,
            description: true,
            deadline: true,
          }
        }, 
        submissionFiles: true,
      }
    });

    const lateCompletions = await prisma.finalCompletion.findMany({
      where: {
        presentationId,
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
        final: {
          select: {
            id: true,
            title: true,
            description: true,
            deadline: true,
          }
        }, 
        submissionFiles: true
      }
    });

    const gradedCompletions = await prisma.finalCompletion.findMany({
      where: {
        presentationId,
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
        final: {
          select: {
            id: true,
            title: true,
            description: true,
            deadline: true,
            
          }
        }, 
        submissionFiles: true
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
      message: 'Final completions fetched successfully',
      completions: allCompletions
    });
  } catch (error) {
    console.error('Error fetching lesson completions:', error);
    res.status(500).json({ error: 'Failed to fetch lesson completions', details: error.message });
  }
});

router.post("/note/:presentationId/presentation", protect, async (req, res) => {
  const { presentationId } = req.params;
  const { content, visibility } = req.body;

  try {
    if (!content || !visibility) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const graderId = req.user.id;
    const finalCompletion = await prisma.finalCompletion.findUnique({
      where: { id: presentationId },
      select: { userId: true }, // Only fetch the userId
    });

    if (!finalCompletion) {
      return res.status(404).json({ message: "completion id not found" });
    }

    const traineeId = finalCompletion.userId;
    const note = await prisma.note.create({
      data: {
        content,
        visibility,
        graderId,
        traineeId,
        finalCompletionId: presentationId,
      },
    });

    await prisma.finalCompletion.update({
      where: { id: presentationId },
      data: { status: "GRADED" },
    });

    res
      .status(201)
      .json({ message: "Note created and completion updated to GRADED", note });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error", error });
  }
});

module.exports = router;

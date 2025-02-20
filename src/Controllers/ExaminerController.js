const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { protect } = require("../Middlewares/Auth");

const prisma = new PrismaClient();
const router = express.Router();

router.get("/final-presentations", async (req, res) => {
  try {
    const { batchId, classId } = req.query;

    const whereClause = {};
    if (batchId) whereClause.batchId = batchId;
    if (classId) whereClause.classId = classId;

    const finalPresentations = await prisma.finalPresentation.findMany({
      where: whereClause, 
      include: {
        batch: {
          select: {
            id: true,
            batchTitle: true,
          },
        },
        class: {
          select: {
            id: true,
            className: true,
          },
        },
        mentor: {
          select: {
            id: true,
            fullName: true,
          },
        },
        files: {
          select: {
            id: true,
            filename: true,
            filepath: true,
          },
        },
      },
    });

    res.status(200).json(finalPresentations);
  } catch (error) {
    console.error("Error fetching final presentations:", error);
    res.status(500).json({ error: "Failed to fetch final presentations" });
  }
});

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

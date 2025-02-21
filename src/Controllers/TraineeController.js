const express = require("express");
const prisma = require("@prisma/client");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { protect } = require("../Middlewares/Auth");
const { verifyToken, verifyRoles } = require("../Middlewares/Auth");
const socket = require("./SocketHandler");

// Initialize Prisma Client
const { PrismaClient } = prisma;
const prismaClient = new PrismaClient();

const router = express.Router();

const SECRET_KEY = process.env.SECRET;
const REFRESH_KEY = process.env.REFRESH_SECRET;

router.post("/login", async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res
      .status(400)
      .json({ message: "Email, password, and role are required" });
  }

  try {
    const user = await prismaClient.user.findUnique({
      where: { email },
    });

    const accessToken = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, {
      expiresIn: "30m",
    });
    const refreshToken = jwt.sign(
      { id: user.id, role: user.role },
      REFRESH_KEY,
      { expiresIn: "1y" }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== role) {
      return res.status(403).json({ message: "Access denied" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ message: "Username or password is incorrect" });
    }

    await prismaClient.user.update({
      where: { id: user.id },
      data: {
        isLoggedIn: true,
        refreshToken,
      },
    });

    return res.status(200).json({
      message: "Login successful",
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Error during login:", error);
    return res
      .status(500)
      .json({ message: "Error during login", error: error.message });
  }
});

router.get("/status", protect, async (req, res) => {
  try {
    const { id } = req.user;

    // Fetch user status by ID
    const user = await prismaClient.user.findUnique({
      where: { id },
      select: { userstatus: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ Status: user.userstatus });
  } catch (error) {
    console.error("Error fetching user status:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Refresh Access Token Route
router.post("/refresh-token", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token is required" });
  }

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_KEY);

    const user = await prismaClient.user.findUnique({
      where: { id: decoded.id, refreshToken },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const accessToken = jwt.sign({ id: user.id }, SECRET_KEY, {
      expiresIn: "5m",
    });

    return res.status(200).json({
      message: "Access token refreshed successfully",
      accessToken,
    });
  } catch (error) {
    console.error("Error refreshing access token:", error);

    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Refresh token has expired, please login again" });
    }

    return res
      .status(500)
      .json({ message: "Error refreshing access token", error: error.message });
  }
});

// Submit Verification Form Route
router.put("/verify", protect, async (req, res) => {
  const { id } = req.user;
  const {
    fullName,
    nickname,
    pob,
    dob,
    address,
    mobile,
    lastEdu,
    lastEduInst,
    major,
    inCollege,
    college,
    currentMajor,
    github,
      skill1,
      skill2,
      skill3,
      skill4,
      skill5,
      skill6,
      skill7,
      skill8,
    confident,
  } = req.body;

  try {
    const updatedUser = await prismaClient.user.update({
      where: { id },
      data: {
        fullName,
        nickname,
        pob,
        dob: new Date(dob),
        address,
        mobile,
        lastEdu,
        lastEduInst,
        major,
        inCollege,
        college,
        currentMajor,
        github,
        skill1,
        skill2,
        skill3,
        skill4,
        skill5,
        skill6,
        skill7,
        skill8,
        confident,
        userstatus: "VERIFIED",
      },
    });

    return res
      .status(200)
      .json({ message: "Verification form submitted", user: updatedUser });
  } catch (error) {
    console.error("Error updating trainee details:", error);
    return res
      .status(500)
      .json({
        message: "Error submitting verification form",
        error: error.message,
      });
  }
});

router.put("/edit/:id", async (req, res) => {
  const { id } = req.params;
  const {
    fullName,
    nickname,
    address,
    mobile,
    github,
    profileFilePath,
    profileMimeType,
    profileSize,
  } = req.body;

  try {
    // Update the user with only the provided fields
    const updatedUser = await prismaClient.user.update({
      where: { id },
      data: {
        ...(fullName && { fullName }),
        ...(nickname && { nickname }),
        ...(address && { address }),
        ...(mobile && { mobile }),
        ...(github && { github }),
      },
    });

    // Update the PROFESSIONAL profile if any profile-related fields are provided
    let updatedProfile;
    if (profileFilePath || profileMimeType || profileSize) {
      updatedProfile = await prismaClient.profile.updateMany({
        where: {
          userId: id,
          type: "PROFESSIONAL",
        },
        data: {
          ...(profileFilePath && { filepath: profileFilePath }),
          ...(profileMimeType && { mimetype: profileMimeType }),
          ...(profileSize && { size: profileSize }),
        },
      });
    }

    const notifyUser = async (id) => {
      const userNotification = await prismaClient.notification.create({
        data: {
          userId: id,
          title: "Profile Updated!",
          description:
            "Your profile information has been successfully updated.",
          type: "Profile",
        },
      });

      console.log("User Notification Created", userNotification);

      // Emit notification to the user
      const io = socket.getIO();
      io.to(id).emit("receiveNotification", {
        id: userNotification.id,
        title: userNotification.title,
        description: userNotification.description,
        type: userNotification.type,
        createdAt: userNotification.createdAt,
      });
    };

    await notifyUser(id);

    return res.status(200).json({
      message: "User information updated successfully",
      user: {
        fullName: updatedUser.fullName,
        nickname: updatedUser.nickname,
        address: updatedUser.address,
        mobile: updatedUser.mobile,
      },
      profile: updatedProfile
        ? {
            filepath: profileFilePath,
            mimetype: profileMimeType,
            size: profileSize,
          }
        : null,
    });
  } catch (error) {
    console.error("Error updating user information:", error);
    return res.status(500).json({
      message: "An error occurred while updating user information",
      error: error.message,
    });
  }
});

// Logout Route
router.post("/logout", async (req, res) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    return res.status(400).json({ message: "Token is required" });
  }

  let decoded; // Define decoded outside the try block

  try {
    decoded = jwt.verify(accessToken, SECRET_KEY); // Assign decoded here

    await prismaClient.user.update({
      where: { id: decoded.id },
      data: {
        isLoggedIn: false,
        refreshToken: null,
      },
    });

    return res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Error during logout:", error);

    if (error.name === "TokenExpiredError") {
      if (decoded && decoded.id) {
        // Ensure decoded is valid before accessing its properties
        await prismaClient.user.update({
          where: { id: decoded.id },
          data: {
            isLoggedIn: false,
            refreshToken: null,
          },
        });
      }
      return res.status(401).json({ message: "Token already expired" });
    }
    return res
      .status(500)
      .json({ message: "Error during logout", error: error.message });
  }
});


router.get("/:id/pro", async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prismaClient.user.findUnique({
      where: { id },
      include: {
        profiles: {
          where: { type: "PROFESSIONAL" },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.profiles.length === 0) {
      return null;
    }

    // Only return the file path relative to the public directory
    const profileImageUrl = `${user.profiles[0].filepath.replace(
      "public",
      ""
    )}`;

    return res.status(200).json({
      profileImage: profileImageUrl, // Returning the relative path after public
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id/casual", async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prismaClient.user.findUnique({
      where: { id },
      include: {
        profiles: {
          where: { type: "CASUAL" },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.profiles.length === 0) {
      return res.status(404).json({ message: "No casual profile found" });
    }

    // Only return the file path relative to the public directory
    const profileImageUrl = `${user.profiles[0].filepath.replace(
      "public",
      ""
    )}`;

    return res.status(200).json({
      profileImage: profileImageUrl, // Returning the relative path after public
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id/pro", async (req, res) => {
  const { id } = req.params;

  try {
    // Find the user
    const user = await prismaClient.user.findUnique({
      where: { id },
      include: {
        profiles: {
          where: { type: "PROFESSIONAL" },
        },
      },
    });

    // Check if user exists
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find the professional profile to delete
    const professionalProfile = user.profiles[0];

    if (!professionalProfile) {
      return res.status(404).json({ message: "No professional profile found" });
    }

    // Delete the professional profile
    await prismaClient.profile.delete({
      where: {
        id: professionalProfile.id,
      },
    });

    return res
      .status(200)
      .json({ message: "Professional profile deleted successfully" });
  } catch (error) {
    console.error("Error deleting profile:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id/casual", async (req, res) => {
  const { id } = req.params;

  try {
    // Find the user
    const user = await prismaClient.user.findUnique({
      where: { id },
      include: {
        profiles: {
          where: { type: "CASUAL" },
        },
      },
    });

    // Check if user exists
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find the professional profile to delete
    const professionalProfile = user.profiles[0];

    if (!professionalProfile) {
      return res.status(404).json({ message: "No casual profile found" });
    }

    // Delete the professional profile
    await prismaClient.profile.delete({
      where: {
        id: professionalProfile.id,
      },
    });

    return res
      .status(200)
      .json({ message: "Professional profile deleted successfully" });
  } catch (error) {
    console.error("Error deleting profile:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id/certificate", async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prismaClient.user.findUnique({
      where: { id },
      include: { certificates: true }, // Include the certificates relation
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.certificates || user.certificates.length === 0) {
      return res
        .status(404)
        .json({ message: "No certificates found for this user" });
    }

    // Only return the file path relative to the public directory
    const CertificateUrl = `${user.certificates[0].filepath.replace(
      "public",
      ""
    )}`;

    return res.status(200).json({
      certificates: CertificateUrl, // Returning the relative path after public
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
});

// Get all certificates
router.get("/certificates", async (req, res) => {
  try {
    const certificates = await prismaClient.certificate.findMany({
      include: {
        trainee: {
          select: { fullName: true },
        },
        class: {
          select: { className: true },
        },
        batch: {
          select: {
            batchNum: true,
            batchTitle: true,
          },
        },
      },
    });

    res.status(200).json(certificates);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Internal server error.", error: error.message });
  }
});

// Get certificate by ID
router.get("/certificates/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const certificate = await prismaClient.certificate.findUnique({
      where: { id },
      include: {
        trainee: {
          select: { fullName: true },
        },
        class: {
          select: { className: true },
        },
        batch: {
          select: {
            batchNum: true,
            batchTitle: true,
          },
        },
      },
    });

    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found." });
    }

    res.status(200).json(certificate);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Internal server error.", error: error.message });
  }
});

// Middleware to extract userId from refreshToke
const getUserId = async (req, res, next) => {
  try {
    const refreshToken =
      req.headers.refreshToken || req.headers.authorization?.split(" ")[1];
    if (!refreshToken) {
      console.log("", refreshToken);
      return res.status(401).json({ error: "Refresh token is required." });
    }

    // Decode the JWT to get the user ID
    const decoded = jwt.decode(refreshToken);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: "Invalid refresh token." });
    }

    const user = await prismaClient.user.findUnique({
      where: { id: decoded.id },
      include: {
        classes: true,
        batches: true,
      },
    });
    console.log("id", decoded.id);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    req.user = user;
    next();
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to authenticate user.", details: error.message });
  }
};

// Route to get challenges based on userId
router.get("/challenges", getUserId, async (req, res) => {
  try {
    const { classes, batches } = req.user;

    const classIds = classes.map((cls) => cls.id);
    const batchIds = batches.map((batch) => batch.id);

    // Fetch challenges
    const challenges = await prismaClient.challenge.findMany({
      where: {
        classId: { in: classIds },
        batchId: { in: batchIds },
      },
    });

    // Find unique mentor for each challenge using mentorId
    const challengesWithMentor = await Promise.all(
      challenges.map(async (challenge) => {
        const mentor = await prismaClient.user.findUnique({
          where: { id: challenge.mentorId },
          select: {
            id: true,
            fullName: true, // Assuming fullName is a field in the User model
            nickname: true, // Assuming nickname is a field in the User model
          },
        });

        return {
          ...challenge,
          mentor, // Add mentor information to the challenge
        };
      })
    );

    res.status(200).json({ challenges: challengesWithMentor });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch challenges.", details: error.message });
  }
});

router.get("/challenge/:id", async (req, res) => {
  try {
    const { id } = req.params; // Get challengeId from the route parameters

    // Fetch a single challenge by challengeId using findUnique
    const challenge = await prismaClient.challenge.findUnique({
      where: { id },
      include: {
        mentor: {
          select: {
            fullName: true,
            nickname: true,
          }
        },
        files: true,
      }
    });

    // If the challenge doesn't exist, return a 404 response
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found." });
    }
    // Return the challenge with mentor details
    res.status(200).json(challenge);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch challenge.", details: error.message });
  }
});

// Route to get lessons based on userId
router.get("/lessons", getUserId, async (req, res) => {
  try {
    const { classes, batches } = req.user;

    const classIds = classes.map((cls) => cls.id);
    const batchIds = batches.map((batch) => batch.id);

    const lessons = await prismaClient.lesson.findMany({
      where: {
        classId: { in: classIds },
        batchId: { in: batchIds },
      },
    });

    res.status(200).json({ lessons });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch lessons.", details: error.message });
  }
});

router.get("/lesson/:id", async (req, res) => {
  try {
    const { id } = req.params; // Get challengeId from the route parameters

    const lesson = await prismaClient.lesson.findUnique({
      where: { id },
      include: {
        mentor: {
          select: {
            fullName: true,
            nickname: true,
          }
        },
        files: true,
      }
    });

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }
    res.status(200).json(lesson);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch lesson.", details: error.message });
  }
});

router.get("/:userId/cb", async (req, res) => {
  const { userId } = req.params;

  try {
    // Fetch the classes and batches associated with the userId
    const user = await prismaClient.user.findUnique({
      where: { id: userId },
      include: {
        classes: true, // Include related classes
        batches: true, // Include related batches (ensure your schema supports this)
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Extract classes and batches
    const { classes, batches } = user;

    // Return the classes and batches
    return res.status(200).json({
      userId,
      classes,
      batches,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({
        message: "An error occurred while fetching classes and batches.",
      });
  }
});

router.get("/class/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params; // userId is already a string

    const classes = await prismaClient.class.findMany({
      where: {
        users: {
          some: {
            id: userId,
          },
        },
      },
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
            profiles: {
              select: {
                filepath: true,
              },
            },
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
        cover: true,
      },
    });

    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/class/mentor/:mentorId", async (req, res) => {
  try {
    const { mentorId } = req.params; // userId is already a string

    const classes = await prismaClient.class.findMany({
      where: {
        mentors: {
          some: {
            id: mentorId,
          },
        },
      },
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
            profiles: {
              select: {
                filepath: true,
              },
            },
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

router.get("/users/:id", async (req, res) => {
  const { id } = req.params; // Extract user ID from request parameters

  try {
    const user = await prismaClient.user.findUnique({
      where: { id }, // Search for the specific user by ID
      select: {
        fullName: true,
        email: true,
        nickname: true,
        github: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const prisma = require("@prisma/client");
const { PrismaClient } = prisma;
const prismaClient = new PrismaClient(); // Adjust path to your Prisma client

// Middleware logic converted to a route
router.post("/check-token", async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(" ")[1]; // Get token from the Authorization header
    if (!accessToken) {
      return res.status(401).json({ message: "Access token is required" });
    }

    const decoded = jwt.decode(accessToken);
    if (!decoded || !decoded.exp || !decoded.id) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const isTokenExpired = decoded.exp * 1000 < Date.now();
    if (isTokenExpired) {
      // Update the user to set isLoggedIn to false
      await prismaClient.user.update({
        where: { id: decoded.id },
        data: {
          isLoggedIn: false,
        },
      });

      return res
        .status(401)
        .json({
          message:
            "Token expired. User has been logged out. Please login again.",
        });
    }

    return res.status(200).json({ message: "Token is valid", user: decoded });
  } catch (error) {
    console.error("Error during token check:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

router.get("/allowed", async (req, res) => {
  const { route } = req.query;
  if (!route) {
    return res.status(400).json({ message: "Route is required" });
  }

  try {
    const allowedRoles = await prismaClient.routePermissions.findMany({
      where: { route },
      select: { role: { select: { name: true } } },
    });

    const roleNames = allowedRoles.map((permission) => permission.role.name);
    res.json({ allowedRoles: roleNames });
  } catch (error) {
    console.error("Failed to fetch allowed roles:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 🔹 Create New Route Permission
router.post("/route-permissions", async (req, res) => {
  const { route, roleId } = req.body;

  if (!route || !roleId) {
    return res.status(400).json({ message: "Route and roleId are required" });
  }

  try {
    const newPermission = await prismaClient.routePermissions.create({
      data: { route, roleId },
    });

    res.status(201).json(newPermission);
  } catch (error) {
    console.error("Failed to create route permission:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 🔹 Update Existing Route Permission
router.put("/route-permissions/:id", async (req, res) => {
  const { id } = req.params;
  const { route, roleId } = req.body;

  if (!route || !roleId) {
    return res.status(400).json({ message: "Route and roleId are required" });
  }

  try {
    const updatedPermission = await prismaClient.routePermissions.update({
      where: { id },
      data: { route, roleId },
    });

    res.json(updatedPermission);
  } catch (error) {
    console.error("Failed to update route permission:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;

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
    const routePermission = await prismaClient.routePermissions.findUnique({
      where: { route },
      select: {
        role: {
          select: { name: true }, // Get role names
        },
      },
    });

    if (!routePermission) {
      return res.status(404).json({ message: "Route not found" });
    }

    // Extract role names from the array of role objects
    const roleNames = routePermission.role.map((r) => r.name);
    
    res.json({ allowedRoles: roleNames });
  } catch (error) {
    console.error("Failed to fetch allowed roles:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 🔹 Create New Route Permission
router.post("/route-permissions", async (req, res) => {
  const { route, roleIds } = req.body;

  if (!route || !roleIds || !Array.isArray(roleIds)) {
    return res.status(400).json({ message: "Route and roleIds (array) are required" });
  }

  try {
    // Validate if all roleIds exist
    const existingRoles = await prismaClient.roles.findMany({
      where: { id: { in: roleIds } },
      select: { id: true },
    });

    const existingRoleIds = existingRoles.map((role) => role.id);
    
    if (existingRoleIds.length !== roleIds.length) {
      return res.status(400).json({ message: "One or more roleIds do not exist" });
    }

    // Proceed with creating the Route Permission
    const newPermission = await prismaClient.routePermissions.create({
      data: {
        route,
        role: {
          connect: existingRoleIds.map((id) => ({ id })),
        },
      },
      include: { role: true },
    });

    res.status(201).json(newPermission);
  } catch (error) {
    console.error("Failed to create route permission:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Update Route Permission (Toggle Role Assignment)
router.put("/route-permissions/:id", async (req, res) => {
  const { addRoleIds, removeRoleIds } = req.body;
  const routeId = req.params.id;

  try {
    // Add new roles
    if (addRoleIds.length > 0) {
      await prismaClient.routePermissions.update({
        where: { id: routeId },
        data: {
          role: {
            connect: addRoleIds.map(id => ({ id })),
          },
        },
      });
    }

    // Remove roles
    if (removeRoleIds.length > 0) {
      await prismaClient.routePermissions.update({
        where: { id: routeId },
        data: {
          role: {
            disconnect: removeRoleIds.map(id => ({ id })),
          },
        },
      });
    }

    res.json({ message: "Permissions updated successfully" });
  } catch (error) {
    console.error("Error updating permissions:", error);
    res.status(500).json({ error: "Failed to update permissions" });
  }
});


router.get("/route-permissions", async (req, res) => {
  try {
    const permissions = await prismaClient.routePermissions.findMany(
      { include: { role: true}}
    );
    res.status(200).json(permissions);
  } catch (error) {
    console.error("Failed to fetch route permissions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 🔹 Get Route Permission by ID
router.get("/route-permissions/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const permission = await prismaClient.routePermissions.findUnique({
      where: { id },
      include: {
        role: {
          select: { id: true, name: true }, // Get role names
      }
    }
    });

    if (!permission) {
      return res.status(404).json({ message: "Route permission not found" });
    }

    res.status(200).json(permission);
  } catch (error) {
    console.error("Failed to fetch route permission:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;

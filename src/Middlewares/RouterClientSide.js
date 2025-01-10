const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const prisma = require('@prisma/client'); 
const { PrismaClient } = prisma;
const prismaClient = new PrismaClient(); // Adjust path to your Prisma client

// Middleware logic converted to a route
router.post('/check-token', async (req, res) => {
    try {
        const accessToken = req.headers.authorization?.split(' ')[1]; // Get token from the Authorization header
        if (!accessToken) {
            return res.status(401).json({ message: 'Access token is required' });
        }

        const decoded = jwt.decode(accessToken);
        if (!decoded || !decoded.exp || !decoded.id) {
            return res.status(401).json({ message: 'Invalid token' });
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

            return res.status(401).json({ message: 'Token expired. User has been logged out. Please login again.' });
        }

        return res.status(200).json({ message: 'Token is valid', user: decoded });
    } catch (error) {
        console.error('Error during token check:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

module.exports = router;

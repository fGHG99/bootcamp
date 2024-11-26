    const jwt = require('jsonwebtoken');
    const prisma = require('@prisma/client'); // Replace with the path to your Prisma client

    const { PrismaClient } = prisma;
    const prismaClient = new PrismaClient();

    const protect = async (req, res, next) => {
        try {
            // Get the token from the Authorization header
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ message: 'No token provided or invalid token format' });
            }

            const token = authHeader.split(' ')[1]; // Extract the token

            // Verify the token
            const decoded = jwt.verify(token, process.env.SECRET);

            // Fetch the user from the database using the ID in the token
            const user = await prismaClient.user.findUnique({
                where: { id: decoded.id },
                select: { id: true, role: true }, // Fetch only necessary fields
            });

            if (!user) {
                return res.status(401).json({ message: 'User no longer exists' });
            }

            // Attach user to the request object
            req.user = user;

            // Continue to the next middleware or route handler
            next();
        } catch (error) {
            console.error('Authentication error:', error);
            res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
        }
    };

    module.exports = { protect };

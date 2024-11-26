const jwt = require('jsonwebtoken');
const prisma = require('@prisma/client');

// Initialize Prisma Client
const { PrismaClient } = prisma;
const prismaClient = new PrismaClient();

const SECRET_KEY = process.env.SECRET;

const verifyStatus = async (req, res, next) => {
    try {
        // Check for Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized: Token missing or invalid format' });
        }

        // Extract token
        const token = authHeader.split(' ')[1];

        // Verify the token
        const decoded = jwt.verify(token, SECRET_KEY, { algorithms: ['HS256'] });

        // Retrieve the user from the database
        const user = await prismaClient.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, status: true }, // Fetch only required fields
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check user verification status
        if (user.status === 'Unverified') {
            return res.status(403).json({ message: 'Forbidden: User is not verified' });
        }

        // Attach user data to the request object for further use
        req.user = user;
        next();
    } catch (error) {
        console.error('Error in verifyStatus middleware:', error);
        return res.status(401).json({ message: 'Invalid or expired token', error: error.message });
    }
};

module.exports = verifyStatus;

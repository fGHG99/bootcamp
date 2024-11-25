const jwt = require('jsonwebtoken');
const prisma = require('@prisma/client');

// Initialize Prisma Client
const { PrismaClient } = prisma;
const prismaClient = new PrismaClient();

const SECRET_KEY = process.env.SECRET;

const verifyStatus = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const user = await prismaClient.user.findUnique({
            where: { id: decoded.id },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.fullName || !user.address || !user.lastEdu) {
            return res.status(403).json({ message: 'Forbidden: User is not verified' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token', error });
    }
};

module.exports = verifyStatus;

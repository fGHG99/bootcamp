    const jwt = require('jsonwebtoken');
    const prisma = require('@prisma/client'); 

    const { PrismaClient } = prisma;
    const prismaClient = new PrismaClient();

    const SECRET_KEY = process.env.SECRET;

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

    const verifyRoles = (allowedRoles) => {
        return async (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Unauthorized" });
        }
    
        const token = authHeader.split(" ")[1];
        try {
            const decoded = jwt.verify(token, SECRET_KEY);
            const user = await prismaClient.user.findUnique({
            where: { id: decoded.id },
            });
    
            if (!user) {
            return res.status(404).json({ message: "User not found" });
            }
    
            if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({ message: "Forbidden: Insufficient role" });
            }
    
            req.user = user;
            next();
        } catch (error) {
            return res.status(401).json({ message: "Invalid token", error });
        }
        };
    };

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
            if (user.userstatus === 'UNVERIFIED') {
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

    module.exports = { protect, verifyRoles, verifyStatus };

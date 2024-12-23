const express = require('express');
const cors = require('cors');
const adminRoutes = require('./Controllers/AdminController');
const traineeRoutes = require('./Controllers/TraineeController');
const Test = require('./Routes/Test');
const MentorNote = require('./Controllers/MentorController');
const UploadRoute = require('./Controllers/UploadController');
const path = require("path");
const { protect, verifyRoles, verifyStatus } = require('./Middlewares/Auth');
const os = require('os'); // For fetching the local IP address

const app = express();

app.use("/profile", express.static(path.join(__dirname, "../public/profile")));
app.use("/lesson", express.static(path.join(__dirname, "../public/lesson")));
app.use("/certificate", express.static(path.join(__dirname, "../public/certificate")));

// CORS Configuration
const corsOptions = {
    origin: ["http://localhost:5173"],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
};

// Apply CORS middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());

// Routes
app.use('/admin', adminRoutes);
app.use('/trainee', traineeRoutes);
app.use('/test', Test);
app.use('/mentor', MentorNote);
app.use('/uploads', UploadRoute);

// Get the local IP address of the server
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const iface in interfaces) {
        for (const alias of interfaces[iface]) {
            if (alias.family === 'IPv4' && !alias.internal) {
                return alias.address; 
            }
        }
    }
    return '127.0.0.1'; 
}
const serverIp = getLocalIpAddress();

app.get('/', (req, res) => {
    const ipAddress = req.ip;
    res.send(`Your IP address is: ${ipAddress}`);
    console.log(`Your IP address is: ${ipAddress}`);
});

const PORT = process.env.PORT || 4000;
const HOST = serverIp; 

app.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
});

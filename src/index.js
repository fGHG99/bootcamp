const express = require('express');
const cors = require('cors');
const http = require('http'); // Required for Socket.IO
const path = require("path");
const os = require('os'); 

const adminRoutes = require('./Controllers/AdminController');
const traineeRoutes = require('./Controllers/TraineeController');
const Test = require('./Routes/Test');
const MentorNote = require('./Controllers/MentorController');
const examinerRoutes = require('./Controllers/ExaminerController');
const UploadRoute = require('./Controllers/UploadController');
const Complete = require("./Controllers/CompletionLesson");
const Middleware = require('./Middlewares/RouterClientSide');
const socket = require('./Controllers/SocketHandler'); // Import the Socket.IO handler

const app = express();
const server = http.createServer(app);
const io = socket.init(server); // Initialize Socket.IO

// Static file configuration
app.use("/profile", express.static(path.join(__dirname, "../public/profile")));
app.use("/lesson", express.static(path.join(__dirname, "../public/lesson")));
app.use("/challenge", express.static(path.join(__dirname, "../public/challenge")));
app.use("/certificate", express.static(path.join(__dirname, "../public/certificate")));
app.use("/challenge_submissions", express.static(path.join(__dirname, "../public/challenge_submissions")));
app.use("/lesson_submissions", express.static(path.join(__dirname, "../public/lesson_submissions")));
app.use("/cover-class", express.static(path.join(__dirname, "../public/cover-class")));
app.use("/cover-batch", express.static(path.join(__dirname, "../public/cover-batch")));
app.use("/cover", express.static(path.join(__dirname, "../public/cover")));

// CORS Configuration
const corsOptions = {
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// Routes
app.use('/admin', adminRoutes);
app.use('/trainee', traineeRoutes);
app.use('/test', Test);
app.use('/mentor', MentorNote);
app.use('/uploads', UploadRoute);
app.use('/complete', Complete);
app.use('/api', Middleware);
app.use('/examiner', examinerRoutes)

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

const PORT = process.env.PORT || 4000;
const HOST = serverIp; 

// Start the server
server.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
    console.log(`Your IP address is: ${HOST}`);
});

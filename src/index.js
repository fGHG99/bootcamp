const express = require('express');
const adminRoutes = require('./Controllers/AdminController');
const traineeRoutes = require('./Controllers/TraineeController');
const Test = require('./Routes/Test');
const MentorNote = require('./Controllers/MentorController');
const UploadRoute = require('./Controllers/UploadController');
const path = require("path");
const { protect, verifyRoles, verifyStatus } = require('./Middlewares/Auth');

const app = express();

app.use("/profile", express.static(path.join(__dirname, "../public/profile")));
app.use("/lesson", express.static(path.join(__dirname, "../public/lesson")));
// Middleware
app.use(express.json());

// Routes
app.use('/admin', adminRoutes);
app.use('/trainee', traineeRoutes);
app.use('/test', Test);
app.use('/mentor', MentorNote);
app.use('/uploads', verifyRoles('ADMIN'), UploadRoute);


app.get('/', (req, res) => {
    res.send('Hello World');
});

// console.log("Serving static files from:", path.join(__dirname, "../public/profile"));


const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || "10.10.103.20";
app.listen(PORT, HOST, () => {
    console.log(`Server is running on port ${PORT}`);
});

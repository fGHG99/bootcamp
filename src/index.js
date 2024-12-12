const express = require('express');
const adminRoutes = require('./Controllers/AdminController');
const traineeRoutes = require('./Controllers/TraineeController');
const Test = require('./Routes/Test');
const MentorNote = require('./Controllers/MentorController');
const UploadRoute = require('./Controllers/UploadController');

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/admin', adminRoutes);
app.use('/trainee', traineeRoutes);
app.use('/test', Test);
app.use('/mentor', MentorNote);
app.use('/uploads', UploadRoute);
app.use("/public", express.static("public"));
app.get('/', (req, res) => {
    res.send('Hello World');
});


const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || "10.10.103.20";
app.listen(PORT, HOST, () => {
    console.log(`Server is running on port ${PORT}`);
});

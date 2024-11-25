const express = require('express');
const adminRoutes = require('./Routes/AdminRoute');
const traineeRoutes = require('./Routes/TraineeRoute');
const Test = require('./Routes/Test');

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/admin', adminRoutes);
app.use('/trainee', traineeRoutes);
app.use('/test', Test);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

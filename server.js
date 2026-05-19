const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();
const { errorHandler } = require('./middleware/errorMiddleware');
const authRoutes = require('./routes/authRoutes');

const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.set('trust proxy', 1); // Trust Railway proxy
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Adjust in production
        methods: ["GET", "POST"]
    }
});

// Middlewares
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
})); // Security Headers with CORS compatibility
app.use(cors({
    origin: [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev')); // Log requests to console

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', limiter);
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.io Logic
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`User ${userId} joined room`);
    });

    socket.on('admin_join', () => {
        socket.join('admins');
        console.log('Admin joined room');
    });

    socket.on('send_message', async (data) => {
        // data: { sender_id, receiver_id, message }
        const { sender_id, receiver_id, message } = data;
        
        // Save to DB
        const pool = require('./config/db');
        await pool.execute(
            'INSERT INTO chat_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
            [sender_id, receiver_id, message]
        );

        // Emit to receiver
        if (receiver_id === 0) {
            io.to('admins').emit('new_message', data);
        } else {
            io.to(`user_${receiver_id}`).emit('new_message', data);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Routes
app.use('/api', authRoutes);
const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);
const userRoutes = require('./routes/userRoutes');
app.use('/api/user', userRoutes);

// Test route
app.get('/', (req, res) => {
    res.send('Pre-Launch API is running with Socket.io...');
});

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

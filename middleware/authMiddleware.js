const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Check if user is suspended
            const [users] = await pool.execute('SELECT id, status FROM users WHERE id = ?', [decoded.id]);
            if (users.length === 0) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }
            if (users[0].status === 'Suspended' || users[0].status === 'suspended') {
                return res.status(401).json({ message: 'ACCOUNT_SUSPENDED' });
            }
            
            req.user = decoded;
            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as an admin' });
    }
};

module.exports = { protect, admin };

const express = require('express');
const { getAllUsers, getAdminStats, updateUserStatus, getAdminEarnings, updateWithdrawalStatus, updateAdminProfile } = require('../controllers/adminController');
const { getDownloads, uploadDownload, deleteDownload } = require('../controllers/downloadController');
const { getActiveConversations, getChatHistory } = require('../controllers/chatController');
const { protect, admin } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const router = express.Router();

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.get('/users', protect, admin, getAllUsers);
router.get('/stats', protect, admin, getAdminStats);
router.put('/users/:id/status', protect, admin, updateUserStatus);
router.get('/earnings', protect, admin, getAdminEarnings);
router.put('/withdrawals/:id/status', protect, admin, updateWithdrawalStatus);
router.put('/profile', protect, admin, updateAdminProfile);

// Downloads
router.get('/downloads', protect, admin, getDownloads);
router.post('/downloads', protect, admin, upload.single('file'), uploadDownload);
router.delete('/downloads/:id', protect, admin, deleteDownload);

// Chat
router.get('/chat/conversations', protect, admin, getActiveConversations);
router.get('/chat/history/:userId', protect, admin, getChatHistory);

module.exports = router;

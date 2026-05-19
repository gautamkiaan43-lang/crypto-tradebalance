const express = require('express');
const { getUserProfile, getUserStats, getUserNetwork, getUserEarnings } = require('../controllers/userController');
const { getDownloads } = require('../controllers/downloadController');
const { getChatHistory } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/profile', protect, getUserProfile);
router.get('/stats', protect, getUserStats);
router.get('/network', protect, getUserNetwork);
router.get('/earnings', protect, getUserEarnings);
router.get('/downloads', protect, getDownloads);
router.get('/chat/history', protect, (req, res) => {
    req.params.userId = req.user.id;
    getChatHistory(req, res);
});

module.exports = router;

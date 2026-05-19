const pool = require('../config/db');

// @desc    Get chat history between user and admin
// @route   GET /api/chat/history/:userId
// @access  Private
const getChatHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        const [messages] = await pool.execute(
            'SELECT * FROM chat_messages WHERE (sender_id = ? AND receiver_id = 0) OR (sender_id = 0 AND receiver_id = ?) ORDER BY created_at ASC',
            [userId, userId]
        );
        res.json(messages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get list of users who have sent messages (Admin only)
// @route   GET /api/admin/chat/conversations
// @access  Private/Admin
const getActiveConversations = async (req, res) => {
    try {
        const [conversations] = await pool.execute(`
            SELECT u.id, u.full_name, u.email,
            (SELECT message FROM chat_messages WHERE (sender_id = u.id OR receiver_id = u.id) ORDER BY created_at DESC LIMIT 1) as last_message,
            (SELECT created_at FROM chat_messages WHERE (sender_id = u.id OR receiver_id = u.id) ORDER BY created_at DESC LIMIT 1) as last_time
            FROM users u
            WHERE u.role != 'admin'
            ORDER BY last_time DESC, u.created_at DESC
        `);
        res.json(conversations);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getChatHistory,
    getActiveConversations
};

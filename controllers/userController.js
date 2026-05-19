const pool = require('../config/db');

// @desc    Get user profile
// @route   GET /api/user/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, full_name, email, is_verified, created_at FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(users[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get user stats
// @route   GET /api/user/stats
// @access  Private
const getUserStats = async (req, res) => {
    try {
        const userRefId = `TB-${req.user.id.toString().padStart(5, '0')}`;
        const [referrals] = await pool.execute(
            'SELECT COUNT(*) as count FROM users WHERE sponsor_id = ?',
            [userRefId]
        );

        const [userData] = await pool.execute(
            'SELECT wallet_balance FROM users WHERE id = ?',
            [req.user.id]
        );

        res.json({
            totalEarnings: userData[0].wallet_balance || "0.00",
            referralCount: referrals[0].count,
            activeNodes: referrals[0].count, // Assuming all referrals are active for now
            networkGrowth: "+0%"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getUserEarnings = async (req, res) => {
    try {
        const [transactions] = await pool.execute(
            'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );

        const [payouts] = await pool.execute(
            'SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );

        res.json({
            transactions,
            payouts
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
const getUserNetwork = async (req, res) => {
    try {
        const userRefId = `TB-${req.user.id.toString().padStart(5, '0')}`;
        const [referrals] = await pool.execute(
            'SELECT id, full_name, email, is_verified, created_at FROM users WHERE sponsor_id = ? ORDER BY created_at DESC',
            [userRefId]
        );
        res.json(referrals);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const bcrypt = require('bcryptjs');

const updateUserProfile = async (req, res) => {
    try {
        const { email, full_name, currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        // Fetch current user
        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ message: 'User not found' });
        
        const user = users[0];

        if (newPassword) {
            // Verify current password
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Incorrect current password' });
            }
            // Hash new password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);
            
            await pool.execute(
                'UPDATE users SET email = ?, full_name = ?, password = ? WHERE id = ?',
                [email, full_name, hashedPassword, userId]
            );
        } else {
            await pool.execute(
                'UPDATE users SET email = ?, full_name = ? WHERE id = ?',
                [email, full_name, userId]
            );
        }

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getUserProfile,
    updateUserProfile,
    getUserStats,
    getUserNetwork,
    getUserEarnings
};

const pool = require('../config/db');

// @desc    Get user profile
// @route   GET /api/user/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, full_name, email, is_verified, referral_code, created_at FROM users WHERE id = ?',
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
        const [userRows] = await pool.execute('SELECT id, full_name, referral_code, wallet_balance FROM users WHERE id = ?', [req.user.id]);
        if (userRows.length === 0) return res.status(404).json({ message: 'User not found' });
        const user = userRows[0];
        
        const code1 = user.referral_code || '';
        const code2 = `TB-MEMBER-${user.id}`;
        const code3 = `TB-${user.id.toString().padStart(5, '0')}`;
        const namePart = (user.full_name?.split(' ')[0] || '').replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 6) || 'USER';
        const code4 = `TB-${namePart}-${user.id.toString().padStart(3, '0')}`;

        const [referrals] = await pool.execute(
            `SELECT 
                COUNT(*) as count,
                SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) as active_count
             FROM users 
             WHERE sponsor_id IN (?, ?, ?, ?)`,
            [code1, code2, code3, code4]
        );

        res.json({
            totalEarnings: user.wallet_balance || "0.00",
            referralCount: referrals[0].count || 0,
            activeNodes: referrals[0].active_count || 0,
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
        const [userRows] = await pool.execute('SELECT id, full_name, referral_code FROM users WHERE id = ?', [req.user.id]);
        if (userRows.length === 0) return res.status(404).json({ message: 'User not found' });
        const user = userRows[0];
        
        const code1 = user.referral_code || '';
        const code2 = `TB-MEMBER-${user.id}`;
        const code3 = `TB-${user.id.toString().padStart(5, '0')}`;
        const namePart = (user.full_name?.split(' ')[0] || '').replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 6) || 'USER';
        const code4 = `TB-${namePart}-${user.id.toString().padStart(3, '0')}`;

        const [referrals] = await pool.execute(
            'SELECT id, full_name, email, is_verified, created_at FROM users WHERE sponsor_id IN (?, ?, ?, ?) ORDER BY created_at DESC',
            [code1, code2, code3, code4]
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

const pool = require('../config/db');

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
    try {
        const [users] = await pool.execute(
            "SELECT id, full_name, email, phone, telegram_id, role, sponsor_id, status, kyc_status, is_verified, created_at FROM users WHERE role != 'admin' ORDER BY created_at DESC"
        );
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
// @access  Private/Admin
const getAdminStats = async (req, res) => {
    try {
        const [[{ count: totalUsers }]] = await pool.execute("SELECT COUNT(*) as count FROM users WHERE role != 'admin'");
        const [[{ count: activeMembers }]] = await pool.execute("SELECT COUNT(*) as count FROM users WHERE role != 'admin' AND status = 'active'");
        const [[{ count: pendingVerifications }]] = await pool.execute("SELECT COUNT(*) as count FROM users WHERE role != 'admin' AND kyc_status = 'Pending'");
        const [[{ total: totalEarnings }]] = await pool.execute("SELECT SUM(wallet_balance) as total FROM users");
        
        res.json({
            totalUsers: totalUsers || 0,
            verifiedUsers: activeMembers || 0,
            pendingUsers: pendingVerifications || 0,
            totalEarnings: totalEarnings || "0.00"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        await pool.execute(
            'UPDATE users SET status = ? WHERE id = ?',
            [status, id]
        );

        res.json({ message: 'User status updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getAdminEarnings = async (req, res) => {
    try {
        const [withdrawals] = await pool.execute(
            'SELECT w.*, u.full_name, u.email FROM withdrawals w JOIN users u ON w.user_id = u.id ORDER BY w.created_at DESC'
        );

        const [stats] = await pool.execute(`
            SELECT 
                (SELECT SUM(amount) FROM transactions WHERE type = 'Referral Bonus' AND DATE(created_at) = CURDATE()) as todayCredits,
                (SELECT SUM(amount) FROM withdrawals WHERE status = 'Pending') as pendingPayouts,
                (SELECT COUNT(*) FROM withdrawals WHERE status = 'Pending') as reviewCount
        `);

        res.json({
            withdrawals,
            stats: {
                todayCredits: stats[0].todayCredits || 0,
                pendingPayouts: stats[0].pendingPayouts || 0,
                reviewCount: stats[0].reviewCount || 0
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updateWithdrawalStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        await pool.execute(
            'UPDATE withdrawals SET status = ? WHERE id = ?',
            [status, id]
        );

        res.json({ message: 'Withdrawal status updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const bcrypt = require('bcryptjs');

const updateAdminProfile = async (req, res) => {
    try {
        const { email, currentPassword, newPassword } = req.body;
        const adminId = req.user.id;

        // Verify admin
        const [admins] = await pool.execute('SELECT * FROM users WHERE id = ? AND role = "admin"', [adminId]);
        if (admins.length === 0) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        const admin = admins[0];

        // If changing password, verify current one
        if (newPassword) {
            const isMatch = await bcrypt.compare(currentPassword, admin.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Incorrect current password' });
            }
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);
            
            await pool.execute(
                'UPDATE users SET email = ?, password = ? WHERE id = ?',
                [email, hashedPassword, adminId]
            );
        } else {
            await pool.execute(
                'UPDATE users SET email = ? WHERE id = ?',
                [email, adminId]
            );
        }

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getNetworkTree = async (req, res) => {
    try {
        const { search } = req.query;
        let rootUser = null;

        if (search) {
            // Find user by TB-ID or Name
            const [users] = await pool.execute(
                "SELECT id, full_name, email, is_verified, created_at, status FROM users WHERE full_name LIKE ? OR CONCAT('TB-', LPAD(id, 5, '0')) = ?",
                [`%${search}%`, search]
            );
            if (users.length > 0) {
                rootUser = users[0];
            } else {
                return res.status(404).json({ message: 'User not found in network' });
            }
        }

        // Logic for fetching levels
        let currentLevelIds = rootUser ? [`TB-${rootUser.id.toString().padStart(5, '0')}`] : [];
        
        if (!rootUser) {
             const [level1] = await pool.execute("SELECT id FROM users WHERE sponsor_id IS NULL OR sponsor_id = '' OR sponsor_id = 'admin' OR sponsor_id = 'TB-00000'");
             currentLevelIds = level1.map(u => `TB-${u.id.toString().padStart(5, '0')}`);
        }

        const levels = [];
        // Max 4 levels for the UI
        for (let i = 1; i <= 4; i++) {
            if (currentLevelIds.length === 0) {
                levels.push({ level: i, count: 0, growth: "+0%" });
                continue;
            }

            const placeholders = currentLevelIds.map(() => '?').join(',');
            const [referrals] = await pool.execute(
                `SELECT id FROM users WHERE sponsor_id IN (${placeholders})`,
                currentLevelIds
            );

            levels.push({
                level: i,
                count: referrals.length,
                growth: referrals.length > 0 ? "+Active" : "+0%"
            });

            currentLevelIds = referrals.map(u => `TB-${u.id.toString().padStart(5, '0')}`);
        }

        res.json({
            rootUser,
            levels,
            anomalies: [
               "TB-10058: Pass-up mismatch detected",
               "TB-10291: Orphan node recovery required"
            ]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getAllUsers,
    getAdminStats,
    updateUserStatus,
    getAdminEarnings,
    updateWithdrawalStatus,
    updateAdminProfile,
    getNetworkTree
};

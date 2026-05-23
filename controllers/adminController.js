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
            // Find user by TB-ID or Name or Email
            const [users] = await pool.execute(
                "SELECT id, full_name, email, is_verified, created_at, status, referral_code FROM users WHERE full_name LIKE ? OR email LIKE ? OR referral_code = ? OR CONCAT('TB-', LPAD(id, 5, '0')) = ? OR CONCAT('TB-MEMBER-', id) = ? OR id = ?",
                [`%${search}%`, `%${search}%`, search, search, search, search]
            );
            if (users.length > 0) {
                rootUser = users[0];
            } else {
                return res.status(404).json({ message: 'User not found in network' });
            }
        }

        // Logic for fetching levels
        let currentLevelIds = [];
        let globalLevel1 = [];

        if (rootUser) {
             const namePart = (rootUser.full_name?.split(' ')[0] || '').replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 6) || 'USER';
             currentLevelIds = [
                 `TB-${rootUser.id.toString().padStart(5, '0')}`,
                 rootUser.id.toString(),
                 `TB-MEMBER-${rootUser.id}`,
                 rootUser.referral_code,
                 `TB-${namePart}-${rootUser.id.toString().padStart(3, '0')}`
             ].filter(Boolean);
        } else {
             // Global Level 1: users sponsored by the system itself
             const [level1] = await pool.execute("SELECT id, full_name, email, is_verified, created_at, referral_code FROM users WHERE sponsor_id IS NULL OR sponsor_id = '' OR sponsor_id = 'admin' OR sponsor_id = 'TB-00000' OR sponsor_id = 'SYSTEM'");
             globalLevel1 = level1;
             currentLevelIds = level1.flatMap(u => {
                 const namePart = (u.full_name?.split(' ')[0] || '').replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 6) || 'USER';
                 return [
                     `TB-${u.id.toString().padStart(5, '0')}`,
                     u.id.toString(),
                     `TB-MEMBER-${u.id}`,
                     u.referral_code,
                     `TB-${namePart}-${u.id.toString().padStart(3, '0')}`
                 ].filter(Boolean);
             });
        }

        const levels = [];
        // Max 4 levels for the UI
        for (let i = 1; i <= 4; i++) {
            let referrals = [];

            if (!rootUser && i === 1) {
                // For Global Audit, Level 1 is already fetched
                referrals = globalLevel1;
            } else {
                if (currentLevelIds.length > 0) {
                    const placeholders = currentLevelIds.map(() => '?').join(',');
                    const [res] = await pool.execute(
                        `SELECT id, full_name, email, is_verified, created_at, referral_code FROM users WHERE sponsor_id IN (${placeholders})`,
                        currentLevelIds
                    );
                    referrals = res;
                }
            }

            levels.push({
                level: i,
                count: referrals.length,
                growth: referrals.length > 0 ? "+Active" : "+0%",
                users: referrals.map(u => ({
                    id: u.id,
                    full_name: u.full_name,
                    email: u.email,
                    status: u.is_verified ? 'Active' : 'Pending',
                    created_at: u.created_at
                }))
            });

            currentLevelIds = referrals.flatMap(u => {
                 const namePart = (u.full_name?.split(' ')[0] || '').replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 6) || 'USER';
                 return [
                     `TB-${u.id.toString().padStart(5, '0')}`,
                     u.id.toString(),
                     `TB-MEMBER-${u.id}`,
                     u.referral_code,
                     `TB-${namePart}-${u.id.toString().padStart(3, '0')}`
                 ].filter(Boolean);
            });
        }

        // Detect real anomalies (users who have a sponsor_id that doesn't exist)
        const [orphanNodes] = await pool.execute(`
            SELECT u1.id, u1.sponsor_id 
            FROM users u1 
            LEFT JOIN users u2 ON 
                u1.sponsor_id = u2.referral_code OR 
                u1.sponsor_id = CONCAT('TB-MEMBER-', u2.id) OR 
                u1.sponsor_id = CONCAT('TB-', LPAD(u2.id, 5, '0')) OR
                u1.sponsor_id = CONCAT('TB-', SUBSTRING(UPPER(REGEXP_REPLACE(u2.full_name, '[^a-zA-Z]', '')), 1, 6), '-', LPAD(u2.id, 3, '0'))
            WHERE u1.sponsor_id IS NOT NULL 
            AND u1.sponsor_id != '' 
            AND u1.sponsor_id != 'SYSTEM' 
            AND u1.sponsor_id != 'admin' 
            AND u2.id IS NULL
            LIMIT 5
        `);

        const anomalies = orphanNodes.map(o => `TB-${o.id.toString().padStart(5, '0')}: Orphan node recovery required (Sponsor ${o.sponsor_id} missing)`);

        res.json({
            rootUser,
            levels,
            anomalies: anomalies.length > 0 ? anomalies : ["Network perfectly intact. No anomalies detected."]
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

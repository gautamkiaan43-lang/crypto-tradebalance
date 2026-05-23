const pool = require('../config/db');

// @desc    Validate referral code
// @route   POST /api/referral/validate
// @access  Public
const validateReferralCode = async (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ message: 'Referral code is required' });
    }

    try {
        const [users] = await pool.execute(
            'SELECT id, full_name, email FROM users WHERE referral_code = ? OR CONCAT("TB-MEMBER-", id) = ? OR CONCAT("TB-", LPAD(id, 5, "0")) = ?',
            [code, code, code]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'Invalid referral code' });
        }

        res.json({
            valid: true,
            sponsorName: users[0].full_name
        });
    } catch (error) {
        console.error('VALIDATE_REFERRAL_ERROR:', error);
        res.status(500).json({ message: 'Server error during validation' });
    }
};

// @desc    Get user's network statistics
// @route   GET /api/referral/stats
// @access  Private
const getReferralStats = async (req, res) => {
    try {
        const [userRows] = await pool.execute('SELECT id, referral_code FROM users WHERE id = ?', [req.user.id]);
        const user = userRows[0];
        const code1 = user.referral_code || '';
        const code2 = `TB-MEMBER-${user.id}`;
        const code3 = `TB-${user.id.toString().padStart(5, '0')}`;

        // Get stats counts
        const [counts] = await pool.execute(
            `SELECT 
                COUNT(*) as total_referrals,
                SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) as active_referrals
             FROM users
             WHERE sponsor_id IN (?, ?, ?)`,
            [code1, code2, code3]
        );

        // Get full members list
        const [members] = await pool.execute(
            `SELECT 
                id,
                full_name,
                email,
                referral_code,
                is_verified,
                created_at as joined_at,
                IF(is_verified, 'Active', 'Pending') as status,
                created_at as referred_at
             FROM users
             WHERE sponsor_id IN (?, ?, ?)
             ORDER BY created_at DESC`,
            [code1, code2, code3]
        );

        const totalReferrals = Number(counts[0].total_referrals) || 0;
        const activeReferrals = Number(counts[0].active_referrals) || 0;
        const totalEarnings = activeReferrals * 10; // $10 per active user

        res.json({
            totalReferrals,
            activeReferrals,
            totalEarnings,
            members
        });
    } catch (error) {
        console.error('REFERRAL_STATS_ERROR:', error);
        res.status(500).json({ message: 'Failed to fetch referral stats' });
    }
};

// @desc    Get detailed network list
// @route   GET /api/referral/my-network
// @access  Private
const getMyNetwork = async (req, res) => {
    try {
        const [userRows] = await pool.execute('SELECT id, referral_code FROM users WHERE id = ?', [req.user.id]);
        const user = userRows[0];
        const code1 = user.referral_code || '';
        const code2 = `TB-MEMBER-${user.id}`;
        const code3 = `TB-${user.id.toString().padStart(5, '0')}`;

        const [network] = await pool.execute(`
            SELECT id, full_name, email, referral_code, is_verified, IF(is_verified, 'Active', 'Pending') as status, created_at
            FROM users
            WHERE sponsor_id IN (?, ?, ?)
            ORDER BY created_at DESC
        `, [code1, code2, code3]);

        res.json(network);
    } catch (error) {
        console.error('MY_NETWORK_ERROR:', error);
        res.status(500).json({ message: 'Failed to fetch network' });
    }
};

module.exports = {
    validateReferralCode,
    getReferralStats,
    getMyNetwork
};

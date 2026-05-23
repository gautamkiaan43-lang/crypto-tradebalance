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
            'SELECT id, full_name, email FROM users WHERE referral_code = ? OR CONCAT("TB-", LPAD(id, 5, "0")) = ?',
            [code, code]
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
        const [referrals] = await pool.execute(
            'SELECT COUNT(*) as total_referrals, SUM(CASE WHEN status = "Active" THEN 1 ELSE 0 END) as active_referrals FROM referrals WHERE referrer_user_id = ?',
            [req.user.id]
        );

        // Calculate earnings if applicable (can be customized later)
        const totalReferrals = referrals[0].total_referrals || 0;
        const activeReferrals = referrals[0].active_referrals || 0;
        const totalEarnings = activeReferrals * 10; // example logic: 10 per active user

        res.json({
            totalReferrals,
            activeReferrals,
            totalEarnings
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
        const [network] = await pool.execute(`
            SELECT u.id, u.full_name, u.email, u.is_verified, r.status, r.created_at
            FROM referrals r
            JOIN users u ON r.referred_user_id = u.id
            WHERE r.referrer_user_id = ?
            ORDER BY r.created_at DESC
        `, [req.user.id]);

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

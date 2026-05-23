const express = require('express');
const router = express.Router();
const { validateReferralCode, getReferralStats, getMyNetwork } = require('../controllers/referralController');
const { protect } = require('../middleware/authMiddleware');

router.post('/validate', validateReferralCode);
router.get('/stats', protect, getReferralStats);
router.get('/my-network', protect, getMyNetwork);

module.exports = router;

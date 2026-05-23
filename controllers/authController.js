const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const generateOtp = require('../utils/generateOtp');
const { sendEmail } = require('../utils/sendEmail');

// @desc    Register a new user
// @route   POST /api/register
// @access  Public
const register = async (req, res) => {
    const { full_name, username, email, password, confirmPassword, sponsor_id, phone } = req.body;

    // 1. Validation
    if (!full_name || !username || !email || !password || !confirmPassword) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
    }

    try {
        // 2. Check for existing user
        const [existingUsers] = await pool.execute('SELECT id, is_verified FROM users WHERE email = ?', [email]);
        
        const hashedPassword = await bcrypt.hash(password, 12);
        const otp = generateOtp();
        const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
        const role = email.includes('admin') ? 'admin' : 'user';

        let userId;
        if (existingUsers.length > 0) {
            const user = existingUsers[0];
            if (user.is_verified) {
                return res.status(400).json({ message: 'Email already registered and verified' });
            }
            
            userId = user.id;
            // If exists but not verified, update the existing record
            await pool.execute(
                'UPDATE users SET full_name = ?, telegram_id = ?, password = ?, role = ?, sponsor_id = ?, phone = ?, otp = ?, otp_expiry = ? WHERE id = ?',
                [full_name, username, hashedPassword, role, sponsor_id || 'SYSTEM', phone || null, otp, otpExpiry, userId]
            );
        } else {
            // 5. Create User (New)
            const [result] = await pool.execute(
                'INSERT INTO users (full_name, telegram_id, email, password, is_verified, role, sponsor_id, phone, otp, otp_expiry) VALUES (?, ?, ?, ?, FALSE, ?, ?, ?, ?, ?)',
                [full_name, username, email, hashedPassword, role, sponsor_id || 'SYSTEM', phone || null, otp, otpExpiry]
            );
            userId = result.insertId;
        }

        // Generate and update unique referral code
        const namePart = (full_name.split(' ')[0] || '').replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 6) || 'USER';
        const referralCode = `TB-${namePart}-${userId.toString().padStart(3, '0')}`;
        
        await pool.execute(
            'UPDATE users SET referral_code = ?, referral_joined_at = CURRENT_TIMESTAMP WHERE id = ?',
            [referralCode, userId]
        );

        // Map into referrals table if sponsor_id is valid and not SYSTEM
        if (sponsor_id && sponsor_id !== 'SYSTEM') {
            try {
                const [sponsor] = await pool.execute('SELECT id, full_name, email FROM users WHERE referral_code = ? OR CONCAT("TB-", LPAD(id, 5, "0")) = ?', [sponsor_id, sponsor_id]);
                if (sponsor.length > 0) {
                    await pool.execute(
                        'INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code) VALUES (?, ?, ?)',
                        [sponsor[0].id, userId, sponsor_id]
                    );

                    // Send NEW_REFERRAL email to sponsor (non-blocking)
                    sendEmail({
                        email: sponsor[0].email,
                        subject: '🎉 New Referral Joined Trade Balance',
                        template: 'NEW_REFERRAL',
                        name: sponsor[0].full_name,
                        emailData: {
                            referredName: full_name,
                            joinedDate: new Date().toLocaleDateString()
                        }
                    }).catch(err => console.error('Failed to send referral email:', err));
                }
            } catch (e) {
                console.error('Referral mapping error:', e);
            }
        }

        // 6. Send Professional Welcome Email with OTP
        console.log('Attempting to send OTP to:', email);
        try {
            await sendEmail({
                email,
                subject: 'Authorization Key - Trade Crypto Protocol',
                template: 'WELCOME_OTP',
                name: full_name,
                otp
            });
        } catch (mailError) {
            console.error('Email delivery failed during registration:', mailError);
            // We still return 500, but the user record is now updated/ready for a retry or manual verification
            throw mailError;
        }

        res.status(201).json({
            message: 'Registration successful. Verification code sent to your email.',
            email
        });

    } catch (error) {
        console.error('REGISTRATION_ERROR:', error);
        res.status(500).json({ 
            message: 'Internal server security error', 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// @desc    Verify OTP for account activation
// @route   POST /api/verify-otp
// @access  Public
const verifyOtp = async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: 'Required credentials missing' });
    }

    try {
        const [users] = await pool.execute(
            'SELECT id, otp, otp_expiry FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'Protocol access denied: User not found' });
        }

        const user = users[0];

        // Validate OTP
        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid authorization key' });
        }

        // Check Expiry
        if (new Date() > new Date(user.otp_expiry)) {
            return res.status(400).json({ message: 'Authorization key expired' });
        }

        // Activate Account
        await pool.execute(
            'UPDATE users SET is_verified = TRUE, otp = NULL, otp_expiry = NULL WHERE id = ?',
            [user.id]
        );

        res.json({ message: 'Account activated successfully. You can now access the network.' });

    } catch (error) {
        console.error('VERIFY_OTP_ERROR:', error);
        res.status(500).json({ message: 'Verification protocol failed' });
    }
};

// @desc    Resend OTP
// @route   POST /api/resend-otp
// @access  Public
const resendOtp = async (req, res) => {
    const { email } = req.body;

    try {
        const [users] = await pool.execute('SELECT id, full_name FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];
        const otp = generateOtp();
        const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

        await pool.execute(
            'UPDATE users SET otp = ?, otp_expiry = ? WHERE email = ?',
            [otp, otpExpiry, email]
        );

        await sendEmail({
            email,
            subject: 'New Authorization Key - Trade Crypto',
            template: 'WELCOME_OTP',
            name: user.full_name,
            otp
        });

        res.json({ message: 'New authorization key sent to your encrypted mailbox' });

    } catch (error) {
        console.error('RESEND_OTP_ERROR:', error);
        res.status(500).json({ message: 'Failed to resend authorization key' });
    }
};

// @desc    Login user
// @route   POST /api/login
// @access  Public
const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid cryptographic credentials' });
        }

        const user = users[0];

        // Security Check: Account Verification
        if (!user.is_verified) {
            return res.status(403).json({ 
                message: 'Account not verified. Please check your email.', 
                email: user.email,
                unverified: true 
            });
        }

        // Security Check: Password Validation
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid cryptographic credentials' });
        }

        // Generate Secure Session Token (JWT)
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        // Update Last Login
        await pool.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        res.json({
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            token
        });

    } catch (error) {
        console.error('LOGIN_ERROR:', error);
        res.status(500).json({ message: 'Authentication process failed' });
    }
};

// @desc    Forgot Password
// @route   POST /api/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const [users] = await pool.execute('SELECT id, full_name FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'No protocol account associated with this email' });
        }

        const user = users[0];
        const otp = generateOtp();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await pool.execute(
            'UPDATE users SET otp = ?, otp_expiry = ? WHERE email = ?',
            [otp, otpExpiry, email]
        );

        await sendEmail({
            email,
            subject: 'Password Recovery Protocol - Trade Crypto',
            template: 'FORGOT_PASSWORD',
            name: user.full_name,
            otp
        });

        res.json({ message: 'Recovery authorization key sent to your email' });

    } catch (error) {
        console.error('FORGOT_PASS_ERROR:', error);
        res.status(500).json({ 
            message: 'Recovery process failed', 
            error: error.message 
        });
    }
};

// @desc    Reset Password
// @route   POST /api/reset-password
// @access  Public
const resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
        return res.status(400).json({ message: 'Incomplete recovery data' });
    }

    try {
        const [users] = await pool.execute(
            'SELECT id, full_name, otp, otp_expiry FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];

        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid recovery authorization key' });
        }

        if (new Date() > new Date(user.otp_expiry)) {
            return res.status(400).json({ message: 'Recovery authorization key expired' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await pool.execute(
            'UPDATE users SET password = ?, otp = NULL, otp_expiry = NULL WHERE id = ?',
            [hashedPassword, user.id]
        );

        // Send Confirmation Email
        await sendEmail({
            email,
            subject: 'Security Alert: Password Successfully Updated',
            template: 'PASSWORD_CHANGED',
            name: user.full_name
        });

        res.json({ message: 'Password reset successful. Access protocols restored.' });

    } catch (error) {
        console.error('RESET_PASS_ERROR:', error);
        res.status(500).json({ message: 'Password reset failed: ' + error.message });
    }
};

// @desc    Get user profile
// @route   GET /api/profile
// @access  Private
const getProfile = async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, full_name, email, phone, telegram_id, role, sponsor_id, referral_code, wallet_balance, created_at, last_login FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(users[0]);
    } catch (error) {
        console.error('GET_PROFILE_ERROR:', error);
        res.status(500).json({ message: 'Failed to retrieve profile data' });
    }
};

// @desc    Change password
// @route   POST /api/change-password
// @access  Private
const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid current password' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);

        // Send Confirmation Email
        await sendEmail({
            email: user.email,
            subject: 'Security Alert: Password Successfully Updated',
            template: 'PASSWORD_CHANGED',
            name: user.full_name
        });

        res.json({ message: 'Password changed successfully' });

    } catch (error) {
        console.error('CHANGE_PASS_ERROR:', error);
        res.status(500).json({ message: 'Password change failed' });
    }
};

// @desc    Pre-register a new user from Landing Page
// @route   POST /api/pre-register
// @access  Public
const preRegister = async (req, res) => {
    const { full_name, email } = req.body;

    if (!full_name || !email) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }

    try {
        // 1. Check if user already exists
        const [existingUsers] = await pool.execute('SELECT id, is_verified FROM users WHERE email = ?', [email]);
        
        const otp = generateOtp();
        const otpExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry for pre-registration password setup

        let userId;
        if (existingUsers.length > 0) {
            const user = existingUsers[0];
            if (user.is_verified) {
                return res.status(400).json({ message: 'This email is already registered and verified.' });
            }
            
            userId = user.id;
            // If they registered before but are not verified/didn't set password, update their OTP
            await pool.execute(
                'UPDATE users SET full_name = ?, otp = ?, otp_expiry = ? WHERE id = ?',
                [full_name, otp, otpExpiry, userId]
            );
        } else {
            // Create user with a dummy/temporary password hash since password is NOT NULL in database schema
            const dummyPassword = await bcrypt.hash('PRELAUNCH_TEMP_PASS_' + Math.random().toString(36).slice(-8), 12);
            const [result] = await pool.execute(
                'INSERT INTO users (full_name, email, password, is_verified, role, sponsor_id, otp, otp_expiry) VALUES (?, ?, ?, FALSE, "user", "SYSTEM", ?, ?)',
                [full_name, email, dummyPassword, otp, otpExpiry]
            );
            userId = result.insertId;
        }

        // Generate and update unique referral code
        const namePart = (full_name.split(' ')[0] || '').replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 6) || 'USER';
        const referralCode = `TB-${namePart}-${userId.toString().padStart(3, '0')}`;
        
        await pool.execute(
            'UPDATE users SET referral_code = ?, referral_joined_at = CURRENT_TIMESTAMP WHERE id = ?',
            [referralCode, userId]
        );

        // 2. Send Pre-Register setup email to User
        console.log('Attempting to send pre-launch registration setup email to:', email);
        try {
            await sendEmail({
                email,
                subject: 'Complete Registration - Trade Crypto Pre-Launch',
                template: 'PRE_REGISTER',
                name: full_name,
                otp
            });
        } catch (mailError) {
            console.error('Email delivery failed to user:', mailError);
            throw mailError;
        }

        // 3. Send Notification to Admin
        console.log('Attempting to send registration notification to admin...');
        try {
            // Fetch all admin emails from database
            const [admins] = await pool.execute('SELECT email FROM users WHERE role = "admin"');
            
            // Collect all admin emails, also add FROM_EMAIL as fallback/default
            const adminEmails = new Set();
            if (process.env.FROM_EMAIL) {
                adminEmails.add(process.env.FROM_EMAIL.trim());
            }
            admins.forEach(adm => adminEmails.add(adm.email.trim()));

            // Send to each admin email
            for (const adminEmail of adminEmails) {
                await sendEmail({
                    email: adminEmail,
                    subject: `[New Registration] - ${full_name} has pre-registered`,
                    template: 'ADMIN_NOTIFICATION',
                    name: full_name,
                    emailData: email,
                    otp: ''
                });
            }
        } catch (adminMailError) {
            console.error('Admin notification email failed (non-blocking):', adminMailError);
            // Don't crash the request if admin email fails
        }

        res.status(201).json({
            message: 'Registration initialized. Please check your email to set up your password and complete registration.',
            email
        });

    } catch (error) {
        console.error('PRE_REGISTRATION_ERROR:', error);
        res.status(500).json({ 
            message: 'Failed to initialize registration', 
            error: error.message
        });
    }
};

// @desc    Setup Password for pre-registered user
// @route   POST /api/setup-password
// @access  Public
const setupPassword = async (req, res) => {
    const { email, token, password } = req.body;

    if (!email || !token || !password) {
        return res.status(400).json({ message: 'Missing credentials' });
    }

    try {
        const [users] = await pool.execute(
            'SELECT id, full_name, otp, otp_expiry, is_verified FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];

        if (user.is_verified) {
            return res.status(400).json({ message: 'Account is already verified and active.' });
        }

        // Validate Token/OTP
        if (user.otp !== token) {
            return res.status(400).json({ message: 'Invalid or expired setup token' });
        }

        // Check Expiry
        if (new Date() > new Date(user.otp_expiry)) {
            return res.status(400).json({ message: 'Registration setup token has expired. Please register again.' });
        }

        // Hash and Update Password, set verified to true
        const hashedPassword = await bcrypt.hash(password, 12);
        await pool.execute(
            'UPDATE users SET password = ?, is_verified = TRUE, otp = NULL, otp_expiry = NULL WHERE id = ?',
            [hashedPassword, user.id]
        );

        // Send Welcome/Confirmation Email
        await sendEmail({
            email,
            subject: 'Account Active - Welcome to Trade Crypto',
            template: 'PASSWORD_CHANGED', // re-use password changed template which says "Access Dashboard"
            name: user.full_name
        });

        res.json({ message: 'Account completed successfully. You can now login.' });

    } catch (error) {
        console.error('SETUP_PASSWORD_ERROR:', error);
        res.status(500).json({ message: 'Failed to complete registration password setup' });
    }
};

module.exports = {
    register,
    verifyOtp,
    resendOtp,
    login,
    forgotPassword,
    resetPassword,
    changePassword,
    getProfile,
    preRegister,
    setupPassword
};

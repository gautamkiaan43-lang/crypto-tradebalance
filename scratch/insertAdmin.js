const pool = require('../config/db');
const bcrypt = require('bcrypt');

const insertAdmin = async () => {
    try {
        const email = 'admin@gmail.com';
        const password = '123456';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await pool.execute(
            'INSERT INTO users (full_name, email, password, is_verified) VALUES (?, ?, ?, TRUE) ON DUPLICATE KEY UPDATE password = ?, is_verified = TRUE',
            ['System Admin', email, hashedPassword, hashedPassword]
        );
        
        console.log('Admin user inserted/updated successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error inserting admin:', error);
        process.exit(1);
    }
};

insertAdmin();

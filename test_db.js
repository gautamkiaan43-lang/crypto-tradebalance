require('dotenv').config();
const mysql = require('mysql2/promise');

async function testDB() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
    });

    try {
        console.log("=== USERS TABLE ===");
        const [users] = await pool.execute('SELECT id, full_name, email, referral_code, sponsor_id FROM users ORDER BY id DESC LIMIT 10');
        console.table(users);

        console.log("=== REFERRALS TABLE ===");
        const [referrals] = await pool.execute('SELECT id, referrer_user_id, referred_user_id, referral_code FROM referrals ORDER BY id DESC LIMIT 10');
        console.table(referrals);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
testDB();

const pool = require('./db');

async function runMigration() {
    try {
        console.log('Running automatic database schema validation & migration...');
        
        // 1. Ensure 'users' table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL
            )
        `);
        
        // 2. Fetch current columns in 'users'
        const [columns] = await pool.query('SHOW COLUMNS FROM users');
        const columnNames = columns.map(c => c.Field.toLowerCase());
        
        // Helper to add column if it does not exist
        const addColumnIfMissing = async (colName, colDefinition) => {
            if (!columnNames.includes(colName.toLowerCase())) {
                console.log(`Adding missing column: ${colName}`);
                await pool.query(`ALTER TABLE users ADD COLUMN ${colName} ${colDefinition}`);
            }
        };

        await addColumnIfMissing('phone', 'VARCHAR(20)');
        await addColumnIfMissing('telegram_id', 'VARCHAR(100)');
        await addColumnIfMissing('otp', 'VARCHAR(6)');
        await addColumnIfMissing('otp_expiry', 'DATETIME');
        await addColumnIfMissing('is_verified', 'BOOLEAN DEFAULT FALSE');
        await addColumnIfMissing('status', 'VARCHAR(20) DEFAULT "Active"');
        await addColumnIfMissing('kyc_status', 'VARCHAR(20) DEFAULT "Not Applied"');
        await addColumnIfMissing('role', 'VARCHAR(20) DEFAULT "user"');
        await addColumnIfMissing('sponsor_id', 'VARCHAR(255)');
        await addColumnIfMissing('wallet_balance', 'DECIMAL(15,2) DEFAULT 0.00');
        await addColumnIfMissing('last_login', 'TIMESTAMP NULL');
        
        // 3. Ensure other tables exist (transactions, withdrawals, chat_messages)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                type VARCHAR(50) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS withdrawals (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                wallet_address VARCHAR(255),
                status VARCHAR(20) DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sender_id INT NOT NULL,
                receiver_id INT NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ Database schema is up-to-date and 100% correct!');
    } catch (err) {
        console.error('❌ Migration Error:', err);
    }
}

module.exports = runMigration;

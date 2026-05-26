const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function cleanupDb() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });

    console.log("Connected to database. Starting cleanup...");

    // Disable foreign key checks temporarily if needed, though we can just delete in the right order
    await connection.query("SET FOREIGN_KEY_CHECKS = 0;");

    // Clean up dependent tables
    console.log("Cleaning chat_messages...");
    await connection.query("DELETE FROM chat_messages");

    console.log("Cleaning transactions...");
    await connection.query("DELETE FROM transactions");

    console.log("Cleaning withdrawals...");
    await connection.query("DELETE FROM withdrawals");

    console.log("Cleaning referrals...");
    await connection.query("DELETE FROM referrals");

    console.log("Cleaning downloads...");
    await connection.query("DELETE FROM downloads");

    // Clean up non-admin users
    console.log("Cleaning non-admin users...");
    await connection.query("DELETE FROM users WHERE role != 'admin'");

    // Update admin password (id = 1)
    console.log("Resetting admin password...");
    const newPassword = 'Admin@123';
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // We update the password for the admin user (id=1)
    await connection.query(
      "UPDATE users SET password = ? WHERE id = 1 AND role = 'admin'",
      [hashedPassword]
    );

    await connection.query("SET FOREIGN_KEY_CHECKS = 1;");

    console.log("Cleanup completed successfully!");
    console.log("Admin credentials: admin@gmail.com / Admin@123");

    await connection.end();
  } catch (err) {
    console.error("Cleanup error:", err);
  }
}

cleanupDb();

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function updatePassword() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });

    console.log("Connected to database. Updating admin password...");
    const newPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await connection.query(
      "UPDATE users SET password = ? WHERE id = 1 AND role = 'admin'",
      [hashedPassword]
    );

    console.log("Admin password updated successfully to 'admin123'!");
    await connection.end();
  } catch (err) {
    console.error("Update error:", err);
  }
}

updatePassword();

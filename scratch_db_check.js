const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDb() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });

    console.log("Connected to database.");
    
    const [tables] = await connection.query("SHOW TABLES");
    console.log("Tables:", tables);

    const [users] = await connection.query("SELECT id, email, full_name, role FROM users");
    console.log("Users:", users);

    await connection.end();
  } catch (err) {
    console.error(err);
  }
}

checkDb();

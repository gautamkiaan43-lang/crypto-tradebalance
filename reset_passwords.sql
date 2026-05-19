USE prelaunch_db;
UPDATE users SET password = '$2b$10$kamTcp6VB.RWZQQyHHgQKO2GXvZV1C3oKtG.eM5o.ryXWv/04Kx72', role = 'admin', is_verified = 1 WHERE email = 'admin@gmail.com';
UPDATE users SET password = '$2b$10$kamTcp6VB.RWZQQyHHgQKO2GXvZV1C3oKtG.eM5o.ryXWv/04Kx72', role = 'user', is_verified = 1 WHERE email = 'abc@gmail.com';

const nodemailer = require('nodemailer');
require('dotenv').config();

async function testSMTP() {
    console.log('--- SMTP Configuration Test ---');
    console.log('Host:', process.env.SMTP_HOST);
    console.log('Port:', process.env.SMTP_PORT);
    console.log('User:', process.env.SMTP_USER);
    
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: parseInt(process.env.SMTP_PORT) === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        tls: {
            rejectUnauthorized: false,
            minVersion: 'TLSv1.2'
        },
        connectionTimeout: 25000,
        greetingTimeout: 25000,
        socketTimeout: 25000,
    });

    try {
        console.log('\nChecking connection to SMTP server...');
        await transporter.verify();
        console.log('✅ Success: SMTP connection verified!');

        console.log('\nSending test email...');
        const info = await transporter.sendMail({
            from: `"${process.env.FROM_NAME}" <${process.env.SMTP_USER}>`,
            to: process.env.SMTP_USER, // Send to yourself
            subject: 'SMTP Configuration Test',
            text: 'If you are reading this, your Brevo SMTP configuration is correct!',
            html: '<b>If you are reading this, your Brevo SMTP configuration is correct!</b>'
        });

        console.log('✅ Success: Test email sent!');
        console.log('Message ID:', info.messageId);
    } catch (error) {
        console.log('\n❌ Error: SMTP Test Failed');
        console.error('Details:', error.message);
        if (error.message.includes('Invalid login')) {
            console.log('\n💡 Tip: Your SMTP_PASS ("intersnack1!") is likely incorrect.');
            console.log('Go to Brevo -> SMTP & API -> Create a new SMTP Key and use that as SMTP_PASS.');
        }
    }
}

testSMTP();

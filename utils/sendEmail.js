const axios = require('axios');
require('dotenv').config();

const sendEmail = async (options) => {
    const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
    // Remove any accidental quotes or whitespace
    const API_KEY = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim().replace(/^["']|["']$/g, '') : '';

    if (!API_KEY) {
        throw new Error('Brevo API Key (SMTP_PASS) is missing in environment variables');
    }

    const data = {
        sender: {
            name: process.env.FROM_NAME || 'Trade Crypto',
            email: process.env.FROM_EMAIL || 's.k.81@outlook.de'
        },
        to: [{
            email: options.email,
            name: options.name || 'User'
        }],
        subject: options.subject,
        htmlContent: '' // Will be set below
    };

    const commonStyles = `
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background-color: #050706;
        color: #ffffff;
        padding: 40px;
        border-radius: 24px;
        border: 1px solid rgba(201, 162, 39, 0.2);
        max-width: 600px;
        margin: 20px auto;
        box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    `;

    const headerStyle = `text-align: center; margin-bottom: 40px;`;
    const otpBoxStyle = `background: linear-gradient(135deg, rgba(201, 162, 39, 0.1) 0%, rgba(201, 162, 39, 0.05) 100%); padding: 40px; border-radius: 20px; border: 1px solid rgba(201, 162, 39, 0.3); text-align: center; margin: 30px 0;`;
    const otpTextStyle = `font-size: 48px; font-weight: 800; color: #c9a227; letter-spacing: 12px; margin: 0; text-shadow: 0 0 20px rgba(201, 162, 39, 0.3);`;
    const footerStyle = `margin-top: 40px; text-align: center; border-top: 1px solid rgba(201, 162, 39, 0.1); padding-top: 30px;`;
    const buttonStyle = `display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #c9a227 0%, #a3811c 100%); color: #000000; text-decoration: none; font-weight: bold; border-radius: 12px; text-transform: uppercase; letter-spacing: 2px; font-size: 14px; margin: 20px 0;`;

    let content = '';

    switch (options.template) {
        case 'WELCOME_OTP':
            content = `
                <div style="${headerStyle}">
                    <h1 style="color: #c9a227; text-transform: uppercase; letter-spacing: 4px; font-size: 28px;">Welcome to Protocol</h1>
                </div>
                <div style="background-color: rgba(255,255,255,0.02); padding: 30px; border-radius: 16px;">
                    <p style="font-size: 16px; color: rgba(255,255,255,0.8);">Hello ${options.name || 'User'},</p>
                    <p style="font-size: 14px; line-height: 1.8; color: rgba(255,255,255,0.6);">
                        Thank you for joining the Trade Crypto network. To activate your secure access and start your journey, please verify your identity using the authorization key below.
                    </p>
                    <div style="${otpBoxStyle}">
                        <p style="font-size: 12px; color: rgba(201, 162, 39, 0.6); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 15px;">Your Authorization Key</p>
                        <h2 style="${otpTextStyle}">${options.otp}</h2>
                    </div>
                    <p style="font-size: 12px; color: #ff4444; text-align: center;">This key will expire in 5 minutes for security purposes.</p>
                </div>
            `;
            break;

        case 'FORGOT_PASSWORD':
            content = `
                <div style="${headerStyle}">
                    <h1 style="color: #c9a227; text-transform: uppercase; letter-spacing: 4px; font-size: 28px;">Password Recovery</h1>
                </div>
                <div style="background-color: rgba(255,255,255,0.02); padding: 30px; border-radius: 16px;">
                    <p style="font-size: 16px; color: rgba(255,255,255,0.8);">Password Reset Requested</p>
                    <p style="font-size: 14px; line-height: 1.8; color: rgba(255,255,255,0.6);">
                        We received a request to reset your Protocol password. If you didn't make this request, please secure your account immediately.
                    </p>
                    <div style="${otpBoxStyle}">
                        <p style="font-size: 12px; color: rgba(201, 162, 39, 0.6); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 15px;">Reset Authorization Code</p>
                        <h2 style="${otpTextStyle}">${options.otp}</h2>
                    </div>
                    <p style="font-size: 12px; color: rgba(255,255,255,0.4); text-align: center;">Valid for 10 minutes only.</p>
                </div>
            `;
            break;

        case 'PASSWORD_CHANGED':
            content = `
                <div style="${headerStyle}">
                    <h1 style="color: #00ff88; text-transform: uppercase; letter-spacing: 4px; font-size: 28px;">Security Update</h1>
                </div>
                <div style="background-color: rgba(255,255,255,0.02); padding: 30px; border-radius: 16px; text-align: center;">
                    <div style="width: 60px; height: 60px; background: rgba(0, 255, 136, 0.1); border-radius: 50%; display: inline-block; padding: 20px; margin-bottom: 20px;">
                        <span style="font-size: 30px;">🛡️</span>
                    </div>
                    <h2 style="color: #ffffff; font-size: 20px; margin-bottom: 15px;">Password Successfully Reset</h2>
                    <p style="font-size: 14px; line-height: 1.8; color: rgba(255,255,255,0.6);">
                        Your account password has been successfully updated. If you did not perform this action, please contact our emergency response team immediately.
                    </p>
                    <a href="${process.env.FRONTEND_URL}/login" style="${buttonStyle}">Access Dashboard</a>
                </div>
            `;
            break;

        default:
            content = options.html || `<p>${options.message}</p>`;
    }

    data.htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #000000;">
            <div style="${commonStyles}">
                <div style="text-align: left; margin-bottom: 40px;">
                    <span style="color: #c9a227; font-weight: 900; letter-spacing: 5px; font-size: 20px;">TRADE CRYPTO</span>
                </div>
                ${content}
                <div style="${footerStyle}">
                    <p style="font-size: 10px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 2px;">
                        Advanced Cryptographic Environment • AES-256 Encrypted
                    </p>
                    <p style="font-size: 10px; color: rgba(201, 162, 39, 0.4); margin-top: 10px;">
                        © 2026 Trade Balance Network. All Rights Reserved.
                    </p>
                </div>
            </div>
        </body>
        </html>
    `;

    try {
        console.log('Attempting to send email via Brevo API...');
        const response = await axios.post(BREVO_API_URL, data, {
            headers: {
                'api-key': API_KEY,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            }
        });
        console.log('Email sent successfully via API:', response.data.messageId);
        return response.data;
    } catch (error) {
        console.error('Email delivery failed via API:', error.response?.data || error.message);
        throw error;
    }
};

module.exports = { sendEmail };

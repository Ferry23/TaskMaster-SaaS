import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

if (!SMTP_USER || !SMTP_PASS) {
    console.warn('⚠️ SMTP_USER or SMTP_PASS is not set. Email dispatch will fail.');
}

// Gmail SMTP configuration
export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});

export const EMAIL_SENDER = process.env.EMAIL_SENDER || `TaskMaster <${SMTP_USER}>`;

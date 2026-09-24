import nodemailer from 'nodemailer';

let transporter = null;

// Lazily creates the SMTP transporter so a missing config doesn't crash server startup;
// it only surfaces as an error when someone actually tries to send an email.
const getTransporter = () => {
  if (transporter) return transporter;

  const { SMTP_SERVICE, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error('Email authentication credentials are not configured. Set SMTP_USER and SMTP_PASS in the environment.');
  }

  if (SMTP_SERVICE === 'gmail' || SMTP_HOST === 'smtp.gmail.com') {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
  } else {
    if (!SMTP_HOST) {
      throw new Error('Email SMTP server host is not configured. Set SMTP_HOST or SMTP_SERVICE in the environment.');
    }

    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
  }

  return transporter;
};

export const sendMail = async ({ to, subject, html, text }) => {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await t.sendMail({ from, to, subject, html, text });
};

export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

/**
 * Send 2FA OTP verification code email with professional ELS Construction branding
 */
export const sendOtpEmail = async ({ to, name, otp }) => {
  const safeName = escapeHtml(name || 'User');
  const safeOtp = escapeHtml(otp);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Your CMMS Security Verification Code</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #1e293b; }
        .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #0d1b4b 0%, #1e3a8a 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }
        .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.85; letter-spacing: 0.5px; }
        .content { padding: 36px 32px; text-align: center; }
        .greeting { font-size: 16px; font-weight: 600; color: #334155; margin-bottom: 12px; }
        .message { font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 28px; }
        .otp-box { background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; margin: 0 auto 28px; max-width: 280px; }
        .otp-code { font-family: 'Courier New', monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0d1b4b; margin: 0; }
        .expiry-badge { display: inline-block; background: #fff7ed; border: 1px solid #ffedd5; color: #c2410c; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 24px; }
        .warning { font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 24px; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>ELS Construction (Pvt) Ltd</h1>
          <p>Construction Material Management System (CMMS)</p>
        </div>
        <div class="content">
          <div class="greeting">Hello, ${safeName}</div>
          <p class="message">You have requested to sign in to your CMMS account. Please use the following 6-digit verification code to complete your two-factor authentication:</p>
          
          <div class="otp-box">
            <div class="otp-code">${safeOtp}</div>
          </div>
          
          <div class="expiry-badge">⏱ Code expires in 5 minutes</div>

          <div class="warning">
            <strong>Security Notice:</strong> If you did not initiate this login request, please disregard this email or immediately notify your system administrator. Never share this code with anyone.
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} ELS Construction (Pvt) Ltd. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Hello ${name || 'User'},\n\nYour CMMS verification code is: ${otp}\n\nThis code will expire in 5 minutes.\nIf you did not request this code, please ignore this email.\n\nELS Construction (Pvt) Ltd`;

  await sendMail({
    to,
    subject: `CMMS Security Verification Code: ${otp}`,
    html,
    text,
  });
};


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

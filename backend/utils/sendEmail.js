import nodemailer from 'nodemailer';

let transporter = null;

/**
 * Initialize SMTP transporter with support for both SMTP_* and EMAIL_* environment variables
 */
const getTransporter = () => {
  if (transporter) return transporter;

  const authUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const authPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const service = process.env.SMTP_SERVICE || (process.env.SMTP_HOST === 'smtp.gmail.com' ? 'gmail' : undefined);
  const host = process.env.SMTP_HOST || (service === 'gmail' ? 'smtp.gmail.com' : undefined);
  const port = Number(process.env.SMTP_PORT) || (service === 'gmail' ? 465 : 587);
  const secure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : port === 465;

  if (!authUser || !authPass) {
    throw new Error('Email credentials missing: set SMTP_USER and SMTP_PASS (or EMAIL_USER and EMAIL_PASS) in .env');
  }

  if (service === 'gmail' || host === 'smtp.gmail.com') {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: authUser, pass: authPass }
    });
  } else {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user: authUser, pass: authPass }
    });
  }

  return transporter;
};

/**
 * Isolated, non-blocking email dispatch helper.
 * Catches transport errors internally so it never throws an unhandled rejection
 * to the calling database transaction or HTTP route handler.
 *
 * @param {Object} options - { to, subject, html, text, attachments }
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
export const sendEmail = async ({ to, subject, html, text, attachments }) => {
  if (!to) {
    console.warn('[Email Warning] Skipped dispatch: no recipient address ("to") provided.');
    return { success: false, error: 'Recipient email missing' };
  }

  try {
    const t = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER;

    const info = await t.sendMail({
      from,
      to,
      subject,
      html,
      text,
      attachments
    });

    console.log(`[Email Success] Sent to: ${to} | Subject: "${subject}" | ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    // Log the error for diagnostics, but do NOT crash or bubble to the caller
    console.error(`[Email Error] Failed dispatching to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Non-blocking fire-and-forget email helper using setImmediate.
 * Use this in controllers when you want to return the HTTP response immediately
 * without waiting for SMTP transport resolution.
 *
 * @param {Object} options - { to, subject, html, text, attachments }
 */
export const sendEmailSafe = (options) => {
  setImmediate(async () => {
    try {
      await sendEmail(options);
    } catch (err) {
      console.error('[Email Safe Wrapper Error]:', err.message);
    }
  });
};

export default sendEmail;

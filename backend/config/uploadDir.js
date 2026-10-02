import os from 'os';
import path from 'path';
import fs from 'fs';

// Where uploaded files (avatars, supplier documents, invoices, quotations,
// project drawings) are written and served from. Locally that is ./uploads.
// On Vercel the deployment directory is read-only and only the OS temp
// directory is writable, so uploads go there instead - note that temp storage
// is per-instance and not durable, so files uploaded on Vercel can disappear
// after a cold start.
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  || (process.env.VERCEL ? path.join(os.tmpdir(), 'uploads') : path.resolve('uploads'));

export const ensureDir = (dir) => {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error(`Could not create upload directory ${dir}:`, err.message);
  }
  return dir;
};

ensureDir(UPLOAD_DIR);

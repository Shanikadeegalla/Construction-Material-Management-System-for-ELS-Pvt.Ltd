import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Where uploaded files (avatars, supplier documents, invoices, quotations,
// project drawings) are written and served from. Use an absolute path relative
// to __dirname so it does not depend on the CWD Node is launched from.
const defaultUploadDir = path.resolve(__dirname, '..', 'uploads');

export const UPLOAD_DIR = process.env.UPLOAD_DIR
  || (process.env.VERCEL ? path.join(os.tmpdir(), 'uploads') : defaultUploadDir);

export const ensureDir = (dir) => {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error(`Could not create upload directory ${dir}:`, err.message);
  }
  return dir;
};

ensureDir(UPLOAD_DIR);


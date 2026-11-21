// Permanent storage for uploaded files (drawings, quotations, invoices, supplier documents, avatars).
//
// Multer still writes each upload to UPLOAD_DIR as before. On Vercel that folder is temporary
// and is emptied whenever the server restarts, so every upload is ALSO copied into MongoDB
// (GridFS bucket "uploads"). When a file is missing from the folder it is served from - and
// restored from - the database. No extra account or npm package is needed.
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import mongoose from 'mongoose';
import { UPLOAD_DIR, ensureDir } from '../config/uploadDir.js';

const BUCKET_NAME = 'uploads';

const getBucket = () => {
  const conn = mongoose.connection;
  if (!conn || conn.readyState !== 1 || !conn.db) return null;   // not connected (e.g. tests)
  return new mongoose.mongo.GridFSBucket(conn.db, { bucketName: BUCKET_NAME });
};

const filesOf = (req) => {
  const list = [];
  if (req.file) list.push(req.file);
  if (Array.isArray(req.files)) list.push(...req.files);
  else if (req.files && typeof req.files === 'object') Object.values(req.files).forEach(arr => list.push(...arr));
  return list.filter(f => f && f.path && f.filename);
};

// Copies one uploaded file into the database (replacing an older copy with the same name)
export const saveUploadCopy = async (file) => {
  const bucket = getBucket();
  if (!bucket) return false;
  const old = await bucket.find({ filename: file.filename }).toArray();
  for (const f of old) await bucket.delete(f._id);
  await pipeline(
    fs.createReadStream(file.path),
    bucket.openUploadStream(file.filename, {
      contentType: file.mimetype,
      metadata: { originalname: file.originalname }
    })
  );
  return true;
};

// Express middleware: place it right after the multer middleware of an upload route
export const persistUploads = async (req, res, next) => {
  try {
    for (const file of filesOf(req)) await saveUploadCopy(file);
  } catch (err) {
    console.error('[FileStore] Could not copy upload to the database:', err.message);
  }
  next();
};

// Removes the database copy when a file is deleted
export const removeUploadCopy = async (filename) => {
  const bucket = getBucket();
  if (!bucket || !filename) return;
  const found = await bucket.find({ filename: path.basename(filename) }).toArray();
  for (const f of found) await bucket.delete(f._id);
};

// Express handler used after express.static: serves a file that is not on disk from the database
export const serveUploadFromStore = async (req, res) => {
  const bucket = getBucket();
  const filename = path.basename(decodeURIComponent(req.path || ''));
  if (!bucket || !filename) return res.status(404).json({ success: false, message: 'File not found.' });

  const [stored] = await bucket.find({ filename }).limit(1).toArray();
  if (!stored) return res.status(404).json({ success: false, message: 'File not found.' });

  // Put it back on disk so later requests (and file-exists checks) find it there
  try {
    ensureDir(UPLOAD_DIR);
    await pipeline(bucket.openDownloadStream(stored._id), fs.createWriteStream(path.join(UPLOAD_DIR, filename)));
    if (stored.contentType) res.type(stored.contentType);
    return res.sendFile(path.join(UPLOAD_DIR, filename));
  } catch (err) {
    console.error('[FileStore] Could not restore file:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load the file.' });
  }
};

// Called once after the database connects: restores every stored file that is missing on disk
export const restoreUploads = async () => {
  const bucket = getBucket();
  if (!bucket) return 0;
  ensureDir(UPLOAD_DIR);
  let restored = 0;
  for (const stored of await bucket.find({}).toArray()) {
    const target = path.join(UPLOAD_DIR, path.basename(stored.filename));
    if (fs.existsSync(target)) continue;
    await pipeline(bucket.openDownloadStream(stored._id), fs.createWriteStream(target));
    restored += 1;
  }
  if (restored) console.log(`[FileStore] Restored ${restored} uploaded file(s) from the database.`);
  return restored;
};

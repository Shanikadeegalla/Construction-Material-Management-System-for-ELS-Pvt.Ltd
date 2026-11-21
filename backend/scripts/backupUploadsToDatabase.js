// One-time script: copies every file already in backend/uploads into the database, so files
// uploaded before the GridFS change are also kept permanently.
// Run from the backend folder:  node scripts/backupUploadsToDatabase.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { UPLOAD_DIR } from '../config/uploadDir.js';
import { saveUploadCopy } from '../utils/fileStore.js';

await mongoose.connect(process.env.MONGO_URI);
let count = 0;
for (const name of fs.readdirSync(UPLOAD_DIR)) {
  const full = path.join(UPLOAD_DIR, name);
  if (!fs.statSync(full).isFile() || name.startsWith('.')) continue;
  await saveUploadCopy({ filename: name, path: full, originalname: name });
  count += 1;
  console.log('Saved', name);
}
console.log(`Done: ${count} file(s) copied to the database.`);
await mongoose.disconnect();

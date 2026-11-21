// One-time script: re-encrypts every encrypted database field with a NEW ENCRYPTION_KEY.
// Use it after replacing the old key (which was published in the frontend code and in
// .env.example) with a new secret one.
//
//   1. Generate a new key:  node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"
//   2. In backend/.env set   OLD_ENCRYPTION_KEY=<the current key>   and   ENCRYPTION_KEY=<the new key>
//   3. Run from the backend folder:   node scripts/rotateEncryptionKey.js
//   4. Remove OLD_ENCRYPTION_KEY from .env and set the new ENCRYPTION_KEY on Vercel too.
//
// The script is safe to run twice: values already encrypted with the new key are skipped.
import 'dotenv/config';
import crypto from 'crypto';
import mongoose from 'mongoose';

const OLD = process.env.OLD_ENCRYPTION_KEY;
const NEW = process.env.ENCRYPTION_KEY;
if (!OLD || !NEW || OLD.length < 32 || NEW.length < 32) {
  console.error('Set OLD_ENCRYPTION_KEY and ENCRYPTION_KEY (each at least 32 characters) in backend/.env');
  process.exit(1);
}
if (OLD === NEW) {
  console.error('OLD_ENCRYPTION_KEY and ENCRYPTION_KEY are the same - nothing to do.');
  process.exit(1);
}

const IV = Buffer.from('1234567890123456');
const keyOf = (k) => Buffer.from(k.substring(0, 32), 'utf8');
const decrypt = (hex, key) => {
  if (typeof hex !== 'string' || hex.length < 32 || hex.length % 32 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  try {
    const d = crypto.createDecipheriv('aes-256-cbc', keyOf(key), IV);
    return d.update(hex, 'hex', 'utf8') + d.final('utf8');
  } catch { return null; }
};
const encrypt = (text, key) => {
  const c = crypto.createCipheriv('aes-256-cbc', keyOf(key), IV);
  return c.update(String(text), 'utf8', 'hex') + c.final('hex');
};

// Collections and the fields that are stored encrypted
const TARGETS = [
  { collection: 'materials', fields: ['name', 'quantity'] },        // Site Store rows
  { collection: 'materialusages', fields: ['materialName', 'actualQty', 'variance'] },
  { collection: 'transferlogs', fields: ['materialName', 'quantity'] },
];

await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;
let changed = 0;
for (const { collection, fields } of TARGETS) {
  const cursor = db.collection(collection).find({});
  for await (const doc of cursor) {
    const update = {};
    for (const f of fields) {
      const plain = decrypt(doc[f], OLD);
      if (plain !== null && decrypt(doc[f], NEW) === null) update[f] = encrypt(plain, NEW);
    }
    if (Object.keys(update).length) {
      await db.collection(collection).updateOne({ _id: doc._id }, { $set: update });
      changed += 1;
    }
  }
  console.log(`${collection}: done`);
}
console.log(`Re-encrypted ${changed} record(s) with the new key.`);
await mongoose.disconnect();

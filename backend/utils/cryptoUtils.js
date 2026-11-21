import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
if (!process.env.ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is missing.');
}
const SECRET_KEY = process.env.ENCRYPTION_KEY;
if (SECRET_KEY.length < 32) {
  throw new Error('ENCRYPTION_KEY must be at least 32 characters long.');
}
// The key is used only here, on the server. The browser never receives it: Site Store
// data is decrypted before it is sent (middleware/decryptResponses.js) and HTTPS protects
// all data on its way between the browser and the server.
const KEY_BUFFER = Buffer.from(SECRET_KEY.substring(0, 32), 'utf8');
const FIXED_IV = Buffer.from('1234567890123456'); // 16 bytes fixed IV for database fields

// For Database: fixed IV (deterministic)
export function encryptDB(text) {
  if (text === null || text === undefined) return text;
  const cipher = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, FIXED_IV);
  let encrypted = cipher.update(String(text), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

export function decryptDB(text) {
  if (!text || typeof text !== 'string') return text;
  // Encrypted strings are hex representations of encrypted content (even length, only hex characters)
  if (!/^[0-9a-fA-F]+$/.test(text)) return text;
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, FIXED_IV);
    let decrypted = decipher.update(text, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return text;
  }
}

// Decrypts a value only if it really is an encrypted database field: a hex string whose
// length is a whole number of AES blocks and which decrypts to readable text. Any other
// value (ObjectIds, names, numbers) is returned unchanged.
export function decryptIfEncrypted(value) {
  if (typeof value !== 'string' || value.length < 32 || value.length % 32 !== 0) return value;
  if (!/^[0-9a-f]+$/i.test(value)) return value;
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, FIXED_IV);
    let decrypted = decipher.update(value, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u0008\u000E-\u001F\uFFFD]/.test(decrypted)) return value;
    return decrypted;
  } catch (err) {
    return value;
  }
}

import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'mysecretkeymustbe32byteslong12345';
const KEY_BUFFER = Buffer.from(SECRET_KEY.substring(0, 32), 'utf8');
const FIXED_IV = Buffer.from('1234567890123456'); // 16 bytes fixed IV for database fields

// For Transit: random IV
export function encryptTransit(text) {
  if (text === null || text === undefined) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, iv);
  let encrypted = cipher.update(String(text), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptTransit(text) {
  if (!text || typeof text !== 'string' || !text.includes(':')) return text;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    return text;
  }
}

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

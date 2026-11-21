import { decryptIfEncrypted } from '../utils/cryptoUtils.js';

// Site Store material names and quantities, usage records and transfer logs are stored
// encrypted (AES-256) in the database. This middleware makes sure the browser always
// receives them already decrypted, so the encryption key never has to leave the server.
// Every controller still decrypts its own data; this is the safety net that guarantees
// no encrypted value reaches a screen.
const ENCRYPTED_FIELDS = new Set(['name', 'materialName', 'quantity', 'actualQty', 'variance']);
const NUMERIC_FIELDS = new Set(['quantity', 'actualQty', 'variance']);

const decryptDeep = (value) => {
  if (Array.isArray(value)) return value.map(decryptDeep);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    if (ENCRYPTED_FIELDS.has(key) && typeof v === 'string') {
      const plain = decryptIfEncrypted(v);
      out[key] = plain !== v && NUMERIC_FIELDS.has(key) && plain.trim() !== '' && !Number.isNaN(Number(plain))
        ? Number(plain)
        : plain;
    } else {
      out[key] = decryptDeep(v);
    }
  }
  return out;
};

export const decryptResponses = (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    try {
      // Turn Mongoose documents, ObjectIds and dates into plain JSON values first
      const plain = body === undefined ? body : JSON.parse(JSON.stringify(body));
      return originalJson(decryptDeep(plain));
    } catch (err) {
      return originalJson(body);
    }
  };
  next();
};

export { decryptDeep };

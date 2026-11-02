import CryptoJS from 'crypto-js';

const SECRET_KEY = 'mysecretkeymustbe32byteslong12345'; // must match backend
const KEY_STRING = SECRET_KEY.substring(0, 32);

// Key is a SHA-256 hash of SECRET_KEY (always exactly 32 bytes) rather than
// parsing the string directly - SECRET_KEY isn't actually 32 bytes long, and
// this must derive identically to the backend's crypto.createHash('sha256').
const TRANSIT_KEY = CryptoJS.SHA256(SECRET_KEY);

// Encryption with random IV (transit)
export function encryptTransit(text) {
  if (text === null || text === undefined) return text;
  const key = TRANSIT_KEY;
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(String(text)), key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  // Return IV as hex and ciphertext as hex
  return iv.toString(CryptoJS.enc.Hex) + ':' + encrypted.ciphertext.toString(CryptoJS.enc.Hex);
}

export function decryptTransit(ciphertextWithIv) {
  if (!ciphertextWithIv || typeof ciphertextWithIv !== 'string' || !ciphertextWithIv.includes(':')) {
    return ciphertextWithIv;
  }
  try {
    const parts = ciphertextWithIv.split(':');
    const iv = CryptoJS.enc.Hex.parse(parts[0]);
    const ciphertext = CryptoJS.enc.Hex.parse(parts[1]);
    const key = TRANSIT_KEY;

    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: ciphertext
    });
    
    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (err) {
    return ciphertextWithIv;
  }
}

// Fixed IV and key for database field encryption (AES-256-CBC deterministic)
const DB_KEY = CryptoJS.enc.Utf8.parse(KEY_STRING);
const FIXED_IV = CryptoJS.enc.Utf8.parse('1234567890123456');

export function decryptDB(cipherHex) {
  if (!cipherHex || typeof cipherHex !== 'string') return cipherHex;
  // If not pure hex or odd length, return as-is
  if (!/^[0-9a-fA-F]+$/.test(cipherHex) || cipherHex.length % 2 !== 0) {
    return cipherHex;
  }
  try {
    const ciphertext = CryptoJS.enc.Hex.parse(cipherHex);
    const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: ciphertext });
    const decrypted = CryptoJS.AES.decrypt(cipherParams, DB_KEY, {
      iv: FIXED_IV,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    const str = decrypted.toString(CryptoJS.enc.Utf8);
    return str || cipherHex;
  } catch (err) {
    return cipherHex;
  }
}

export function encryptDB(text) {
  if (text === null || text === undefined) return text;
  try {
    const encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(String(text)), DB_KEY, {
      iv: FIXED_IV,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    return encrypted.ciphertext.toString(CryptoJS.enc.Hex);
  } catch (err) {
    return text;
  }
}

export function isHexString(str) {
  return typeof str === 'string' && str.length >= 16 && /^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0;
}

export function resolveMaterialName(item, itemMasterMap = {}) {
  if (!item) return '';
  if (typeof item === 'string') {
    if (isHexString(item)) {
      const dec = decryptDB(item);
      if (dec && !isHexString(dec)) return dec;
      return '-';
    }
    return item;
  }

  const rawName = item.name || item.materialName || '';
  const code = item.materialCode || item.code || '';
  let resolved = rawName;

  // 1. Decrypt the Site Store name using decryptDB
  if (item.location === 'SiteStore' || isHexString(rawName)) {
    const dec = decryptDB(rawName);
    if (dec && !isHexString(dec)) {
      resolved = dec;
    }
  }

  // 2. If decryption is not possible/fails (remains hex), lookup from Item Master using materialCode
  if ((!resolved || isHexString(resolved)) && code) {
    if (itemMasterMap) {
      const match = typeof itemMasterMap.get === 'function'
        ? itemMasterMap.get(code)
        : itemMasterMap[code];
      if (match) {
        resolved = typeof match === 'string' ? match : (match.materialName || match.name);
      }
    }
  }

  // 3. If neither works, show material code instead of a hex string (never show raw encrypted text)
  if (!resolved || isHexString(resolved)) {
    resolved = code || '-';
  }

  return resolved;
}

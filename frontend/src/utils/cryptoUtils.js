import CryptoJS from 'crypto-js';

const SECRET_KEY = 'mysecretkeymustbe32byteslong12345'; // must match backend

// Encryption with random IV (transit)
export function encryptTransit(text) {
  if (text === null || text === undefined) return text;
  const key = CryptoJS.enc.Utf8.parse(SECRET_KEY);
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
    const key = CryptoJS.enc.Utf8.parse(SECRET_KEY);
    
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

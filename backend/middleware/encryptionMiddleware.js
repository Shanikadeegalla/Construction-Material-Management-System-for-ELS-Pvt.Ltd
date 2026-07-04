import { encryptTransit, decryptTransit } from '../utils/cryptoUtils.js';

export const handleEncryption = (req, res, next) => {
  // If the request has x-site-store header, it means it's a SiteStore API communication
  if (req.headers['x-site-store'] === 'true') {
    // 1. Decrypt incoming request body if encrypted
    if (req.body && req.body.ciphertext) {
      try {
        const decryptedBody = decryptTransit(req.body.ciphertext);
        req.body = JSON.parse(decryptedBody);
      } catch (err) {
        return res.status(400).json({ success: false, message: 'Invalid encrypted payload' });
      }
    }

    // 2. Intercept response and encrypt the outgoing JSON payload
    const originalJson = res.json;
    res.json = function (body) {
      try {
        const encryptedBody = encryptTransit(JSON.stringify(body));
        return originalJson.call(this, { ciphertext: encryptedBody });
      } catch (err) {
        return originalJson.call(this, body);
      }
    };
  }
  next();
};

import { encryptTransit, decryptTransit } from '../utils/cryptoUtils.js';

export const handleEncryption = (req, res, next) => {
  // Decrypt an incoming ciphertext-wrapped body regardless of caller - both
  // the Main Store and Site Store dashboards submit AES-encrypted bodies via
  // encryptTransit(), but only Site Store used to identify itself via the
  // x-site-store header, which left Main Store's encrypted bodies (e.g.
  // Approve/Reject/Issue on Material Transfer Notes) undecrypted.
  if (req.body && req.body.ciphertext) {
    try {
      const decryptedBody = decryptTransit(req.body.ciphertext);
      req.body = JSON.parse(decryptedBody);
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid encrypted payload' });
    }
  }

  // Only Site Store additionally expects its responses encrypted the same way.
  if (req.headers['x-site-store'] === 'true') {
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

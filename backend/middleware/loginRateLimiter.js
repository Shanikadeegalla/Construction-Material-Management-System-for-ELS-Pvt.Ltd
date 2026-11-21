// Blocks repeated failed logins: after MAX_FAILED wrong attempts from the same IP address
// for the same account within WINDOW_MS, further attempts are refused until the window ends.
// A successful login clears the counter. No extra npm package is needed.
const WINDOW_MS = 15 * 60 * 1000;   // 15 minutes
const MAX_FAILED = 5;
const attempts = new Map();          // key -> { count, firstAt }

const keyFor = (req) => {
  const id = String((req.body && (req.body.email || req.body.username)) || '').trim().toLowerCase();
  return `${req.ip || 'unknown'}|${id}`;
};

export const loginRateLimiter = (req, res, next) => {
  const key = keyFor(req);
  const now = Date.now();
  const entry = attempts.get(key);

  if (entry && now - entry.firstAt > WINDOW_MS) attempts.delete(key);
  const current = attempts.get(key);
  if (current && current.count >= MAX_FAILED) {
    const minutes = Math.ceil((WINDOW_MS - (now - current.firstAt)) / 60000);
    return res.status(429).json({
      success: false,
      message: `Too many failed login attempts. Please try again in ${minutes} minute(s).`
    });
  }

  res.on('finish', () => {
    if (res.statusCode === 401) {
      const e = attempts.get(key);
      if (e) e.count += 1;
      else attempts.set(key, { count: 1, firstAt: Date.now() });
    } else if (res.statusCode === 200) {
      attempts.delete(key);
    }
  });
  next();
};

// Used by the automated tests
export const resetLoginAttempts = () => attempts.clear();

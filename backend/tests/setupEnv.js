// Test-only settings, so `npm test` works on any computer even without a backend/.env file.
// These values are used ONLY by the automated tests (real keys stay in .env and on Vercel).
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-only-encryption-key-32-chars!!';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-jwt-secret';

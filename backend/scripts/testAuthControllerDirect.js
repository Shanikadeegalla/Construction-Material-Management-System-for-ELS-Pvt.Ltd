import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { loginUser } from '../controllers/authController.js';

dotenv.config();

const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.data = data;
    return res;
  };
  return res;
};

const testDirect = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    await mongoose.connect(mongoUri);

    const testCases = [
      { label: 'director@els.com / dir123', body: { email: 'director@els.com', password: 'dir123' } },
      { label: 'director@els.com / director123', body: { email: 'director@els.com', password: 'director123' } },
      { label: 'username director / dir123', body: { username: 'director', password: 'dir123' } },
      { label: 'yushika@els.com / dir123', body: { email: 'yushika@els.com', password: 'dir123' } },
      { label: 'admin@els.com / admin123', body: { email: 'admin@els.com', password: 'admin123' } },
      { label: 'pm@els.com / pm123', body: { email: 'pm@els.com', password: 'pm123' } }
    ];

    for (const tc of testCases) {
      const req = { body: tc.body, ip: '127.0.0.1', headers: {}, socket: {} };
      const res = mockRes();
      let nextError = null;
      const next = (err) => { nextError = err; };

      await loginUser(req, res, next);

      if (res.statusCode === 200 && res.data?.success) {
        console.log(`✅ SUCCESS: ${tc.label}`);
        console.log(`   Logged in as: ${res.data.data.name} (${res.data.data.role})\n`);
      } else {
        console.log(`❌ FAILED: ${tc.label}`);
        console.log(`   Status: ${res.statusCode} | Error: ${nextError?.message || res.data?.message}\n`);
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

testDirect();

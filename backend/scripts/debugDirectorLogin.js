import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';

dotenv.config();

const debugDirector = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    await mongoose.connect(mongoUri);

    console.log('=== Checking Director Users in DB ===');
    const directors = await User.find({ role: 'Director' });
    for (const d of directors) {
      console.log(`\nUser ID: ${d._id}`);
      console.log(`  Name: "${d.name}"`);
      console.log(`  Email: "${d.email}"`);
      console.log(`  Username: "${d.username}"`);
      console.log(`  Role: "${d.role}"`);
      console.log(`  Status (isActive): ${d.status}`);

      const testPwds = ['director123', 'dir123', 'els123', 'Director123', 'yushika123', '123456', 'admin123'];
      for (const pwd of testPwds) {
        if (await bcrypt.compare(pwd, d.password)) {
          console.log(`  -> Password "${pwd}" MATCHES!`);
        }
      }
    }

    console.log('\n=== Testing Login API Logic in authController ===');
    const testIdentifiers = ['director@els.com', 'DIRECTOR@ELS.COM', 'director', 'yushika@els.com', 'YUSHIKA@ELS.COM'];
    for (const id of testIdentifiers) {
      const cleanIdentifier = id.trim().toLowerCase();
      const user = await User.findOne({
        $or: [{ email: cleanIdentifier }, { username: id.trim() }]
      });
      console.log(`Identifier "${id}" -> Found User? ${user ? `${user.email} (${user.role})` : 'NO USER FOUND'}`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

debugDirector();

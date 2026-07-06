import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';

dotenv.config();

const listAllUsers = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    await mongoose.connect(mongoUri);

    const users = await User.find({}).sort({ role: 1 });
    console.log(`\nTotal users in database: ${users.length}`);
    users.forEach((u, i) => {
      console.log(`\nUser #${i + 1}:`);
      console.log(`  Name:     ${u.name}`);
      console.log(`  Email:    ${u.email}`);
      console.log(`  Role:     ${u.role}`);
      console.log(`  Status:   ${u.status !== undefined ? u.status : 'N/A'}`);
      console.log(`  isActive: ${u.isActive !== undefined ? u.isActive : 'N/A'}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

listAllUsers();

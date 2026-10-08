import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import User from './models/userModel.js';

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({});
  users.forEach(u => {
    console.log(`Email: ${u.email} | Role: ${u.role} | Status: ${u.status}`);
  });
  await mongoose.disconnect();
}
main().catch(console.error);

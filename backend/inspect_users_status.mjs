import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import User from './models/userModel.js';

async function checkUsers() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({});
  console.log('Total users:', users.length);
  users.forEach(u => console.log(`Email: ${u.email} | Role: ${u.role} | Status: ${u.status} | ProjectId: ${u.projectId || u.project_id}`));
  await mongoose.disconnect();
}
checkUsers().catch(console.error);

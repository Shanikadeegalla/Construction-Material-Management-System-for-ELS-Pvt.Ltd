import mongoose from 'mongoose';
import User from './models/userModel.js';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB');
    console.log('Connected to DB');
    
    // Find director@els.com
    const user = await User.findOne({ email: 'director@els.com' });
    if (!user) {
      console.log('Director user not found, creating one...');
      const newUser = await User.create({
        name: 'Director User',
        email: 'director@els.com',
        role: 'Director',
        password: 'password123',
        status: true
      });
      console.log('Created director user:', newUser);
    } else {
      user.password = 'password123';
      await user.save();
      console.log('Updated director@els.com password to password123');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};
run();

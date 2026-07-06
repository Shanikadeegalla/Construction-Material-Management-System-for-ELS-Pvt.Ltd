import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';

dotenv.config();

const resetPMPassword = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    const pm = await User.findOne({ email: 'pm@els.com' });
    if (!pm) {
      console.log('PM user pm@els.com not found.');
      return;
    }

    pm.password = 'pm123456';
    pm.status = true;
    await pm.save();
    console.log(`Successfully reset password for ${pm.email} to 'pm123'.`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
};

resetPMPassword();

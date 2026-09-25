import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';

dotenv.config();

const resetSiteStorePassword = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    const user = await User.findOne({ email: 'sitestore@els.com' });
    if (!user) {
      console.log('SiteStoreOfficer user sitestore@els.com not found.');
      return;
    }

    user.password = 'site123';
    user.status = true;
    await user.save();
    console.log(`Successfully reset password for ${user.email} to 'site123'.`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
};

resetSiteStorePassword();

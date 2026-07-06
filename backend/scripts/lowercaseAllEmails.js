import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';

dotenv.config();

const lowercaseAllEmails = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected successfully!');

    const users = await User.find({});
    console.log(`Checking ${users.length} users...`);

    let updatedCount = 0;
    for (const user of users) {
      const lowercased = user.email.toLowerCase().trim();
      if (user.email !== lowercased) {
        console.log(`Updating "${user.email}" ➔ "${lowercased}"`);
        user.email = lowercased;
        // Since we are not modifying password, .save() is safe
        await user.save();
        updatedCount++;
      }
    }

    console.log(`Migration complete. Lowercased ${updatedCount} email(s).`);

  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

lowercaseAllEmails();

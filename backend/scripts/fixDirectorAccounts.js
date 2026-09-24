import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/userModel.js';

dotenv.config();

const fixAccounts = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected successfully!');

    const accountsToFix = [
      { email: 'admino@els.com', username: 'admino', role: 'Admin', password: 'admin123', status: true },
      { email: 'admin@els.com', username: 'admin', role: 'Admin', password: 'admin123', status: true },
      { email: 'purchasemanager@els.com', username: 'purchasemanager', role: 'PurchaseManager', password: 'Purchase@123', status: true },
      { email: 'purchase@els.com', username: 'purchase', role: 'PurchaseManager', password: 'Purchase@123', status: true },
      { email: 'pofficer@gmail.com', username: 'pofficer', role: 'PurchaseManager', password: 'purchase123', status: true },
      { email: 'director@els.com', username: 'director', role: 'Director', password: 'dir123', status: true },
      { email: 'yushika@els.com', username: 'yushika', role: 'Director', password: 'dir123', status: true },
      { email: 'pm@els.com', username: 'pm', role: 'ProjectManager', password: 'pm123456', status: true },
      { email: 'promanager@gmail.com', username: 'promanager', role: 'ProjectManager', password: 'pm123456', status: true },
      { email: 'store@els.com', username: 'store', role: 'MainStoreOfficer', password: 'store123', status: true },
      { email: 'sitestore@els.com', username: 'sitestore', role: 'SiteStoreOfficer', password: 'site123', status: true }
    ];

    for (const acc of accountsToFix) {
      let u = await User.findOne({ email: acc.email });
      if (!u) {
        console.log(`Creating account ${acc.email}...`);
        u = new User({
          name: acc.username,
          email: acc.email,
          username: acc.username,
          role: acc.role,
          password: acc.password,
          status: acc.status
        });
      } else {
        u.username = acc.username;
        u.status = acc.status;
        u.role = acc.role;
        u.password = acc.password;
      }
      await u.save();
      console.log(`✅ Fixed ${acc.email} (Username: "${acc.username}", Role: "${acc.role}", Password: "${acc.password}")`);
    }

    console.log('\nAll handwritten image account credentials updated in MongoDB!');
  } catch (err) {
    console.error('Error fixing accounts:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

fixAccounts();

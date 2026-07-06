import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Project from '../models/Project.js';

dotenv.config();

const dropProjectIndex = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected successfully!');

    console.log('Dropping index "name_1"...');
    try {
      await mongoose.connection.db.collection('projects').dropIndex('name_1');
      console.log('Successfully dropped "name_1" index.');
    } catch (err) {
      console.log(`Index drop warning (already dropped?): ${err.message}`);
    }

    console.log('Syncing Mongoose indexes for Project model...');
    await Project.syncIndexes();
    console.log('Successfully synced indexes.');

    // Print resulting indexes
    const indexes = await mongoose.connection.db.collection('projects').listIndexes().toArray();
    console.log('\n--- Resulting indexes on "projects" collection ---');
    console.log(JSON.stringify(indexes, null, 2));

  } catch (err) {
    console.error('Error in drop index script:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  }
};

dropProjectIndex();

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const checkProjectIndexes = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected successfully!');

    // Get raw indexes
    const indexes = await mongoose.connection.db.collection('projects').listIndexes().toArray();
    console.log('\n--- Indexes on "projects" collection ---');
    console.log(JSON.stringify(indexes, null, 2));

  } catch (err) {
    console.error('Error getting indexes:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  }
};

checkProjectIndexes();

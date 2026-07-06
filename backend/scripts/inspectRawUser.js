import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const inspectRawUser = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected successfully!');

    // Fetch raw document from collection 'users'
    const rawUsers = await mongoose.connection.db.collection('users').find({}).toArray();

    console.log(`Total users in collection: ${rawUsers.length}`);
    if (rawUsers.length > 0) {
      console.log('\nKeys and values for the first user document:');
      console.log(JSON.stringify(rawUsers[0], null, 2));

      console.log('\nList of all users emails/usernames in database:');
      rawUsers.forEach((u, i) => {
        console.log(`User #${i + 1}: email=${u.email}, username=${u.username}, name=${u.name}, role=${u.role}`);
      });
    }

  } catch (err) {
    console.error('Error during query:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  }
};

inspectRawUser();

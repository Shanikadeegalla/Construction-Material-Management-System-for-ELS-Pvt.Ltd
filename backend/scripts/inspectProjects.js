import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const inspectProjects = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    await mongoose.connect(mongoUri);

    const projects = await mongoose.connection.db.collection('projects').find({}).toArray();
    console.log(`Total projects in database: ${projects.length}`);
    projects.forEach((p, i) => {
      console.log(`\nProject #${i + 1}:`);
      console.log(JSON.stringify(p, null, 2));
    });

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

inspectProjects();

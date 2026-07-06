import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Project from '../models/Project.js';

dotenv.config();

const migrateProjects = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected successfully!');

    // First drop name_1 index if it still exists
    try {
      await mongoose.connection.db.collection('projects').dropIndex('name_1');
      console.log('Successfully dropped "name_1" index.');
    } catch (err) {
      console.log(`Index drop info: ${err.message}`);
    }

    // Fetch raw documents to avoid schema validation errors during loop
    const rawProjects = await mongoose.connection.db.collection('projects').find({}).toArray();
    console.log(`Found ${rawProjects.length} total projects in database.`);

    let migratedCount = 0;
    let pmId = '6a3f801c2cc2c988fd01cb9b'; // Kamal Silva (PM)

    for (let idx = 0; idx < rawProjects.length; idx++) {
      const rp = rawProjects[idx];
      
      // If this is a legacy project (missing projectName)
      if (!rp.projectName) {
        const generatedProjId = `PRJ-2026-${String(migratedCount + 2).padStart(3, '0')}`;
        console.log(`Migrating Project "${rp.name || 'Unnamed'}" (ID: ${rp._id}) ➔ Project Code: ${generatedProjId}`);

        await mongoose.connection.db.collection('projects').updateOne(
          { _id: rp._id },
          {
            $set: {
              projectId: generatedProjId,
              projectName: rp.name || `Legacy Project ${migratedCount + 2}`,
              clientName: 'Legacy Client',
              location: 'Legacy Location',
              startDate: rp.createdAt || new Date(),
              expectedEndDate: rp.updatedAt || new Date(),
              budget: 0,
              description: 'Migrated legacy project.',
              drawingFile: '',
              status: 'Completed',
              createdBy: new mongoose.Types.ObjectId(pmId)
            },
            $unset: { name: 1 } // Remove legacy name field
          }
        );
        migratedCount++;
      }
    }

    console.log(`\nSuccessfully migrated ${migratedCount} projects.`);

    console.log('Syncing Mongoose indexes for Project model...');
    await Project.syncIndexes();
    console.log('Successfully synced indexes!');

    // Fetch resulting indexes
    const indexes = await mongoose.connection.db.collection('projects').listIndexes().toArray();
    console.log('\n--- Resulting indexes on "projects" collection ---');
    console.log(JSON.stringify(indexes, null, 2));

  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  }
};

migrateProjects();

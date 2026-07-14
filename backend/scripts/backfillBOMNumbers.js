import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BOM from '../models/BOM.js';
import Project from '../models/Project.js';

dotenv.config();

// One-time backfill for BOM documents saved before bomNumber generation existed.
// Groups all BOM docs (drafts/versions) by projectId so they share one BOM
// number, matching the "constant across versions" rule the live controller uses.
const backfillBOMNumbers = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected successfully!');

    // The bomNumber field used to have a hard unique index, which conflicts with
    // the design (many version-documents per project intentionally share one
    // bomNumber). Drop the stale index and let Mongoose rebuild from the
    // current (non-unique) schema definition.
    try {
      await mongoose.connection.db.collection('boms').dropIndex('bomNumber_1');
      console.log('Dropped stale unique index "bomNumber_1".');
    } catch (err) {
      console.log(`Index drop info: ${err.message}`);
    }
    await BOM.syncIndexes();
    console.log('Synced BOM indexes.');

    const missing = await BOM.find({ $or: [{ bomNumber: { $exists: false } }, { bomNumber: null }, { bomNumber: '' }] });
    console.log(`Found ${missing.length} BOM document(s) missing a bomNumber.`);

    const byProject = new Map();
    for (const bom of missing) {
      const key = String(bom.projectId);
      if (!byProject.has(key)) byProject.set(key, []);
      byProject.get(key).push(bom);
    }

    let updated = 0;
    for (const [projectIdStr, boms] of byProject.entries()) {
      // Reuse this project's existing bomNumber if any other document (already
      // backfilled, or created before this document) already has one - only
      // mint a new number if the project truly has none yet.
      const existingForProject = await BOM.findOne({
        projectId: projectIdStr,
        bomNumber: { $exists: true, $ne: null, $ne: '' }
      }).sort({ createdAt: 1 });

      let bomNumber;
      if (existingForProject) {
        bomNumber = existingForProject.bomNumber;
      } else {
        const project = await Project.findById(projectIdStr);
        const projectCode = project?.projectId || projectIdStr.slice(-6).toUpperCase();
        bomNumber = `BOM-${projectCode}`;
        let suffix = 1;
        while (await BOM.exists({ bomNumber })) {
          suffix += 1;
          bomNumber = `BOM-${projectCode}-${suffix}`;
        }
      }

      boms.sort((a, b) => a.createdAt - b.createdAt);
      for (const bom of boms) {
        bom.bomNumber = bomNumber;
        await bom.save();
        updated++;
        console.log(`  BOM ${bom._id} (${bom.projectName || projectCode}) -> ${bomNumber}`);
      }
    }

    console.log(`\nBackfilled ${updated} BOM document(s) across ${byProject.size} project(s).`);
  } catch (err) {
    console.error('Error during backfill:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

backfillBOMNumbers();

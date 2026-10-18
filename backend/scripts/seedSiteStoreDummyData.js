import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MaterialTransferNote from '../models/MaterialTransferNote.js';
import MaterialIssuanceNote from '../models/MaterialIssuanceNote.js';
import Project from '../models/Project.js';

dotenv.config();

export const seedSiteStoreDemoData = async () => {
  try {
    // 1. Fetch or create a reference project for MINs
    let targetProject = await Project.findOne({
      name: { $regex: /viva|bmich|colombo|lotus/i }
    }) || await Project.findOne({});

    if (!targetProject) {
      targetProject = await Project.create({
        projectName: 'Viva Verification Project 2026',
        name: 'Viva Verification Project 2026',
        projectCode: 'VIVA-2026-01',
        description: 'ELS Construction Viva Demo Project',
        location: 'Colombo Site Yard 01',
        status: 'Active'
      });
    }

    const projectId = targetProject._id;
    const projectName = targetProject.projectName || targetProject.name || 'Viva Verification Project 2026';

    console.log(`[SiteStore Demo Seed] Using project: ${projectName} (${projectId})`);

    // 2. Seed In-Transit Material Transfer Notes
    const dummyMTNs = [
      {
        mtnNumber: 'MTN-2026-008',
        requestNo: 'SSR-2026-002',
        siteStoreName: 'Site Store',
        transferDate: new Date('2026-10-18T09:30:00.000Z'),
        reference: 'Main Central Yard',
        notes: 'Source: Main Central Yard - Urgent reinforcement steel transfer for site foundation',
        materials: [
          {
            materialName: 'Tor Steel 16mm',
            unit: 'MT',
            requestedQty: 2.5,
            transferQty: 2.5
          }
        ],
        status: 'In Transit',
        createdBy: 'Central Warehouse Officer'
      },
      {
        mtnNumber: 'MTN-2026-009',
        requestNo: 'SSR-2026-003',
        siteStoreName: 'Site Store',
        transferDate: new Date('2026-10-18T10:15:00.000Z'),
        reference: 'Central Depot',
        notes: 'Source: Central Depot - Batch delivery for structural concreting',
        materials: [
          {
            materialName: 'OPC Cement 50kg',
            unit: 'Bags',
            requestedQty: 250,
            transferQty: 250
          }
        ],
        status: 'In Transit',
        createdBy: 'Logistics Officer'
      },
      {
        mtnNumber: 'MTN-2026-010',
        requestNo: 'SSR-2026-004',
        siteStoreName: 'Site Store',
        transferDate: new Date('2026-10-18T11:00:00.000Z'),
        reference: 'Main Central Yard',
        notes: 'Source: Main Central Yard - Fine aggregates for plastering work',
        materials: [
          {
            materialName: 'River Sand',
            unit: 'Cu.M',
            requestedQty: 15,
            transferQty: 15
          }
        ],
        status: 'In Transit',
        createdBy: 'Central Warehouse Officer'
      }
    ];

    for (const mtn of dummyMTNs) {
      const existing = await MaterialTransferNote.findOne({ mtnNumber: mtn.mtnNumber });
      if (!existing) {
        await MaterialTransferNote.create(mtn);
        console.log(`[SiteStore Demo Seed] Created MTN: ${mtn.mtnNumber} (In Transit)`);
      } else if (existing.status !== 'In Transit' && !existing.receivedAt) {
        existing.status = 'In Transit';
        existing.notes = mtn.notes;
        existing.reference = mtn.reference;
        existing.createdBy = mtn.createdBy;
        existing.materials = mtn.materials;
        await existing.save();
        console.log(`[SiteStore Demo Seed] Updated MTN to In Transit: ${mtn.mtnNumber}`);
      }
    }

    // 3. Seed Material Issuance Notes (MIN Status Logs)
    const dummyMINs = [
      {
        minNumber: 'MIN-2026-1142',
        projectId,
        projectName,
        requestedBy: 'K. Perera (Civil Foreman)',
        transferDate: new Date('2026-10-17T08:30:00.000Z'),
        requiredDate: new Date('2026-10-17T08:30:00.000Z'),
        createdAt: new Date('2026-10-17T08:30:00.000Z'),
        materials: [
          {
            materialName: 'Ready-Mix Grout',
            quantity: 20,
            unit: 'Bags',
            reason: 'Column base grouting'
          }
        ],
        status: 'Issued',
        issuedBy: 'Site Store Officer',
        notes: 'Subcontractor: Civil Works. Issued by Site Store Officer for column base plate grouting.'
      },
      {
        minNumber: 'MIN-2026-1145',
        projectId,
        projectName,
        requestedBy: 'Apex Builders (MEP Subcon)',
        transferDate: new Date('2026-10-18T09:00:00.000Z'),
        requiredDate: new Date('2026-10-18T09:00:00.000Z'),
        createdAt: new Date('2026-10-18T09:00:00.000Z'),
        materials: [
          {
            materialName: '1" PVC Ball Valves',
            quantity: 45,
            unit: 'Nos',
            reason: 'MEP plumbing riser installation'
          }
        ],
        status: 'Pending Approval',
        issuedBy: 'Site Engineer',
        notes: 'Subcontractor: Apex Builders. Pending Site Engineer approval for plumbing line phase 2.'
      },
      {
        minNumber: 'MIN-2026-1146',
        projectId,
        projectName,
        requestedBy: 'R. Wickramasinghe (Bar Bender)',
        transferDate: new Date('2026-10-18T10:30:00.000Z'),
        requiredDate: new Date('2026-10-18T10:30:00.000Z'),
        createdAt: new Date('2026-10-18T10:30:00.000Z'),
        materials: [
          {
            materialName: 'Rebar Binding Wire',
            quantity: 50,
            unit: 'Kg',
            reason: 'Slab reinforcement tying'
          }
        ],
        status: 'Partially Issued',
        issuedBy: 'Site Store Officer',
        notes: 'Subcontractor: Rebar Gang. Partially issued 25kg initially, remaining 25kg awaiting verification.'
      }
    ];

    for (const min of dummyMINs) {
      const existing = await MaterialIssuanceNote.findOne({ minNumber: min.minNumber });
      if (!existing) {
        await MaterialIssuanceNote.create(min);
        console.log(`[SiteStore Demo Seed] Created MIN: ${min.minNumber} (${min.status})`);
      } else {
        existing.status = min.status;
        existing.requestedBy = min.requestedBy;
        existing.issuedBy = min.issuedBy;
        existing.notes = min.notes;
        existing.materials = min.materials;
        await existing.save();
        console.log(`[SiteStore Demo Seed] Updated MIN: ${min.minNumber} (${min.status})`);
      }
    }

    console.log('[SiteStore Demo Seed] All dummy data seeded successfully.');
  } catch (error) {
    console.error('[SiteStore Demo Seed Error]:', error);
  }
};

// If executed directly
if (process.argv[1]?.endsWith('seedSiteStoreDummyData.js')) {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ConstructionDB';
  mongoose.connect(uri)
    .then(async () => {
      console.log('Connected to MongoDB. Running seed...');
      await seedSiteStoreDemoData();
      await mongoose.disconnect();
      console.log('Disconnected. Done!');
      process.exit(0);
    })
    .catch(err => {
      console.error('MongoDB connection error:', err);
      process.exit(1);
    });
}

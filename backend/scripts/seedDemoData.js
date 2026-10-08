import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import ItemMaster from '../models/ItemMaster.js';
import Project from '../models/Project.js';
import BOM from '../models/BOM.js';
import Supplier from '../models/Supplier.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ConstructionDB';

const seedDemoData = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB.');

    // 1. Seed Demo Users
    console.log('\n👤 Seeding Demo Users...');
    const { ensureDefaultUsersExist } = await import('./verifyAndSeedUsers.js');
    await ensureDefaultUsersExist();
    console.log('  ✓ Canonical test users synchronized.');

    // 2. Seed Item Master Materials
    console.log('\n📦 Seeding Item Master...');
    const demoItems = [
      { materialCode: 'MAT0145', materialName: 'Portland Cement 50kg', category: 'Cement & Concrete', unit: 'bags', estimatedUnitCost: 1850, minimumStock: 100, reorderLevel: 150, maximumStock: 1000 },
      { materialCode: 'MAT0146', materialName: 'Tor Steel 12mm', category: 'Reinforcement Steel', unit: 'ton', estimatedUnitCost: 185000, minimumStock: 10, reorderLevel: 15, maximumStock: 100 },
      { materialCode: 'MAT0147', materialName: 'River Sand m³', category: 'Aggregates', unit: 'm3', estimatedUnitCost: 8500, minimumStock: 20, reorderLevel: 30, maximumStock: 200 },
      { materialCode: 'MAT0148', materialName: '20mm Aggregate m³', category: 'Aggregates', unit: 'm3', estimatedUnitCost: 6500, minimumStock: 25, reorderLevel: 35, maximumStock: 250 }
    ];

    const seededItems = [];
    for (const item of demoItems) {
      const saved = await ItemMaster.findOneAndUpdate(
        { materialName: item.materialName },
        item,
        { upsert: true, new: true }
      );
      seededItems.push(saved);
      console.log(`  ✓ Item Master: ${item.materialName} (${item.materialCode})`);
    }

    // 3. Seed Active Project & Approved BOM
    console.log('\n🏗️ Seeding Active Project & Approved BOM...');
    const adminUser = await User.findOne({ email: 'admin@elslanka.com' });

    const project = await Project.findOneAndUpdate(
      { projectId: 'PRJ-2026-001' },
      {
        projectId: 'PRJ-2026-001',
        projectName: 'Head Office Extension',
        clientName: 'ELS Construction (Pvt) Ltd',
        location: 'Colombo 03',
        description: 'Construction of 4-storey commercial office extension.',
        budget: 25000000,
        status: 'Active',
        startDate: new Date('2026-01-15'),
        expectedEndDate: new Date('2026-12-31'),
        createdBy: adminUser ? adminUser._id : new mongoose.Types.ObjectId()
      },
      { upsert: true, new: true }
    );
    console.log(`  ✓ Project: ${project.projectName} (${project.projectId})`);

    const bomMaterials = seededItems.map(item => {
      const plannedQty = item.category.includes('Cement') ? 500 : item.category.includes('Steel') ? 20 : 100;
      return {
        itemCode: item.materialCode,
        name: item.materialName,
        materialName: item.materialName,
        category: item.category,
        unit: item.unit,
        plannedQty,
        estimatedUnitCost: item.estimatedUnitCost,
        estimatedTotalCost: plannedQty * item.estimatedUnitCost
      };
    });

    const totalEstimatedCost = bomMaterials.reduce((sum, m) => sum + m.estimatedTotalCost, 0);

    const bom = await BOM.findOneAndUpdate(
      { projectId: project._id },
      {
        projectId: project._id,
        projectName: project.projectName,
        version: 'v1.0',
        versionLabel: 'v1.0',
        status: 'Approved',
        materials: bomMaterials,
        totalEstimatedCost,
        approvedAt: new Date()
      },
      { upsert: true, new: true }
    );
    console.log(`  ✓ Approved BOM v1.0 created for ${project.projectName} (Total Estimated: LKR ${totalEstimatedCost.toLocaleString()}).`);

    // 4. Seed Active Suppliers
    console.log('\n🏢 Seeding Suppliers...');
    const demoSuppliers = [
      { supplierId: 'SUP-0001', name: 'Lanka Cement Ltd', contactPerson: 'Nimal Perera', phone: '0711122334', email: 'supplier1@lankacement.lk', categories: ['Cement & Concrete'], status: 'Active' },
      { supplierId: 'SUP-0002', name: 'Melwa Steel', contactPerson: 'Kamal Silva', phone: '0722233445', email: 'supplier2@melwa.lk', categories: ['Reinforcement Steel'], status: 'Active' }
    ];

    for (const sup of demoSuppliers) {
      await Supplier.findOneAndUpdate(
        { supplierId: sup.supplierId },
        sup,
        { upsert: true, new: true }
      );
      console.log(`  ✓ Supplier: ${sup.name} (${sup.email})`);
    }

    console.log('\n=================================================');
    console.log('🎉 DEMO DATA SEEDING COMPLETE FOR ELS VIVA DEMO!');
    console.log('=================================================');
    console.log('Accounts ready:');
    console.log('  • Admin:            adminO@els.com / admin123');
    console.log('  • Director:         director@els.com / dir123');
    console.log('  • Project Manager:  pm@els.com / pm123456');
    console.log('  • Purchase Manager: PurchaseManager@els.com / Purchase@123');
    console.log('  • Main Store:       store@els.com / store123');
    console.log('  • Site Store:       sitestore@els.com / site123');
    console.log('=================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    process.exit(1);
  }
};

seedDemoData();

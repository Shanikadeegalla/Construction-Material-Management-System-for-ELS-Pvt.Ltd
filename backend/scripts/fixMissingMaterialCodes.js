// One-off remediation script: some Material stock rows (MainStore/SiteStore)
// were created (via addMaterial / GRN auto-create / PO free-text resolution)
// with no materialCode, either because no ItemMaster row with that exact name
// existed yet, or because the ItemMaster row was created after the Material
// row and the pre-save backfill hook only runs on new/name-modified docs.
//
// For each distinct material name with a blank materialCode:
//   - If an ItemMaster row already exists with that name (case-insensitive
//     exact match), reuse its materialCode.
//   - Otherwise, create a new ItemMaster row (so the material is properly
//     catalogued going forward) with the next free MAT#### code, using the
//     existing Material row's category/unit/thresholds/unitPrice so nothing
//     changes except the missing code being filled in.
// Then sets materialCode on every Material row (any location) sharing that
// name, matching the same updateMany-by-name approach itemMasterController's
// createItemMaster uses.
//
// Safe to re-run. Usage: node backend/scripts/fixMissingMaterialCodes.js
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import ItemMaster from '../models/ItemMaster.js';
import Material from '../models/Material.js';

dotenv.config();

const CATEGORY_ENUM = new Set([
  'Cement & Concrete', 'Aggregates', 'Road Construction', 'Bridge Construction',
  'Reinforcement Steel', 'Structural Steel', 'Railway Materials', 'Drainage & Culvert',
  'Geotechnical', 'Formwork & Scaffolding', 'Fasteners & Hardware', 'Waterproofing & Joints',
  'Safety Materials', 'Survey & Site', 'Miscellaneous', 'Other'
]);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const generateNextMaterialCode = async () => {
  let next = (await ItemMaster.countDocuments()) + 1;
  let candidate;
  do {
    candidate = `MAT${String(next).padStart(4, '0')}`;
    next++;
  } while (await ItemMaster.findOne({ materialCode: candidate }));
  return candidate;
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ConstructionDB');
  console.log('Connected to MongoDB for material code backfill.');

  const blankCodeMaterials = await Material.find({
    $or: [{ materialCode: '' }, { materialCode: { $exists: false } }]
  });

  const namesSeen = new Set();
  let matched = 0, created = 0, rowsUpdated = 0;

  for (const material of blankCodeMaterials) {
    // Material.name is encrypted for SiteStore rows, so only key off
    // MainStore rows to get a plaintext name to work with.
    if (material.location !== 'MainStore') continue;
    const name = material.name;
    const key = name.toLowerCase();
    if (namesSeen.has(key)) continue;
    namesSeen.add(key);

    let itemMaster = await ItemMaster.findOne({
      materialName: new RegExp(`^${escapeRegex(name)}$`, 'i')
    });

    if (itemMaster) {
      matched++;
    } else {
      const materialCode = await generateNextMaterialCode();
      const category = CATEGORY_ENUM.has(material.category) ? material.category : 'Other';
      itemMaster = await ItemMaster.create({
        materialCode,
        materialName: name,
        category,
        unit: material.unit,
        estimatedUnitCost: material.unitPrice || 0,
        description: material.description || '',
        minimumStock: material.minimumStock,
        maximumStock: material.maximumStock,
        reorderLevel: material.reorderLevel,
        status: 'Active'
      });
      created++;
      console.log(`Created ItemMaster ${materialCode} for "${name}" (category was "${material.category}" -> "${category}")`);
    }

    const result = await Material.updateMany(
      { name, materialCode: { $in: ['', null] } },
      { materialCode: itemMaster.materialCode }
    );
    rowsUpdated += result.modifiedCount;
    console.log(`"${name}" -> ${itemMaster.materialCode} (${result.modifiedCount} Material row(s) updated)`);
  }

  console.log(`Done. ${matched} matched to existing ItemMaster, ${created} new ItemMaster row(s) created, ${rowsUpdated} Material row(s) updated.`);
  await mongoose.disconnect();
};

run().catch(err => {
  console.error('Material code backfill failed:', err);
  process.exit(1);
});

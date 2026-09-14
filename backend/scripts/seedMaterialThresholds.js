// One-time / re-runnable initialization script:
//  1. Normalizes every existing ItemMaster/Material materialCode from the old
//     hyphenated "MAT-0001" format to the no-hyphen "MAT0001" format used going
//     forward (see itemMasterController.js's generateNextMaterialCode).
//  2. Seeds the initial Minimum / Pre-Order (reorderLevel) / Maximum stock
//     thresholds for the academic system's starting material catalog, matched
//     by materialCode. Existing records are only ever matched/updated by code;
//     a record is created only when no ItemMaster with that code OR that exact
//     name already exists (prevents duplicate materials and prevents silently
//     reactivating/renaming a record such as the inactive helmet special-case).
//  3. Cascades the updated thresholds/unit cost to matching Material stock
//     rows (MainStore + SiteStore) via the same shared utility the Item Master
//     controller uses.
//
// Safe to re-run. Usage: node backend/scripts/seedMaterialThresholds.js
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import ItemMaster from '../models/ItemMaster.js';
import Material from '../models/Material.js';
import { syncThresholdsToMaterials } from '../utils/materialSync.js';

dotenv.config();

// code | materialName | unit | minimumStock | reorderLevel (Pre-Order) | maximumStock | category
const CATALOG_TSV = `
MAT0001|Ordinary Portland Cement 50kg|Bag|100|200|400|Cement & Concrete
MAT0002|Portland Pozzolana Cement 50kg|Bag|100|200|400|Cement & Concrete
MAT0003|Sulphate Resistant Cement|Bag|50|100|200|Cement & Concrete
MAT0004|Ready Mix Concrete Grade 20|m³|10|20|40|Cement & Concrete
MAT0005|Ready Mix Concrete Grade 25|m³|10|20|40|Cement & Concrete
MAT0006|Ready Mix Concrete Grade 30|m³|10|20|40|Cement & Concrete
MAT0007|Ready Mix Concrete Grade 35|m³|5|10|20|Cement & Concrete
MAT0008|Concrete Admixture|Litre|100|200|400|Cement & Concrete
MAT0009|Water Proofing Admixture|Litre|50|100|200|Cement & Concrete
MAT0010|Grout|Bag|30|60|120|Cement & Concrete
MAT0101|River Sand|m³|20|40|80|Aggregates
MAT0102|Washed Sand|m³|20|40|80|Aggregates
MAT0103|Quarry Dust|m³|20|40|80|Aggregates
MAT0104|6mm Aggregate|m³|20|40|80|Aggregates
MAT0105|12mm Aggregate|m³|20|40|80|Aggregates
MAT0106|20mm Aggregate|m³|30|60|120|Aggregates
MAT0107|40mm Aggregate|m³|15|30|60|Aggregates
MAT0108|Crusher Run|m³|30|60|120|Aggregates
MAT0109|ABC Aggregate|Ton|20|40|80|Aggregates
MAT0110|Sub Base Material|Ton|20|40|80|Aggregates
MAT0201|Asphalt Concrete Wearing Course|Ton|5|10|20|Road Construction
MAT0202|Asphalt Binder Course|Ton|5|10|20|Road Construction
MAT0203|Prime Coat|Litre|200|400|800|Road Construction
MAT0204|Tack Coat|Litre|200|400|800|Road Construction
MAT0205|Bitumen VG-30|Drum|2|4|8|Road Construction
MAT0206|Bitumen Emulsion|Drum|2|4|8|Road Construction
MAT0207|Road Base Material|Ton|20|40|80|Road Construction
MAT0208|GSB|Ton|20|40|80|Road Construction
MAT0209|Dense Bituminous Macadam|Ton|5|10|20|Road Construction
MAT0210|Cold Mix Asphalt|Ton|5|10|20|Road Construction
MAT0211|Road Marking Paint|Can|10|20|40|Road Construction
MAT0301|Prestressed Concrete Beam|Piece|1|2|4|Bridge Construction
MAT0302|Bearing Pad|Piece|2|4|8|Bridge Construction
MAT0303|Expansion Joint|Set|1|2|4|Bridge Construction
MAT0304|Elastomeric Bearing|Piece|2|4|8|Bridge Construction
MAT0305|Bridge Deck Drain|Piece|2|5|10|Bridge Construction
MAT0306|Bridge Parapet|Meter|5|10|20|Bridge Construction
MAT0307|Steel Girder|Ton|2|4|8|Bridge Construction
MAT0308|Bridge Handrail|Meter|5|10|20|Bridge Construction
MAT0309|Shear Connector|Piece|20|50|100|Bridge Construction
MAT0310|Anchor Bolt|Piece|10|20|40|Bridge Construction
MAT0401|6mm TMT Bar|Piece|20|40|80|Reinforcement Steel
MAT0402|8mm TMT Bar|Piece|20|40|80|Reinforcement Steel
MAT0403|10mm TMT Bar|Piece|20|40|80|Reinforcement Steel
MAT0404|12mm TMT Bar|Piece|20|40|80|Reinforcement Steel
MAT0405|16mm TMT Bar|Piece|15|30|60|Reinforcement Steel
MAT0406|20mm TMT Bar|Piece|10|20|40|Reinforcement Steel
MAT0407|25mm TMT Bar|Piece|10|20|40|Reinforcement Steel
MAT0408|32mm TMT Bar|Piece|5|10|20|Reinforcement Steel
MAT0409|Steel Binding Wire|Kg|50|100|200|Reinforcement Steel
MAT0410|Welded Wire Mesh|Roll|5|10|20|Reinforcement Steel
MAT0501|I Beam|Meter|5|10|20|Structural Steel
MAT0502|H Beam|Meter|5|10|20|Structural Steel
MAT0503|Channel Section|Meter|10|20|40|Structural Steel
MAT0504|Angle Bar|Meter|10|20|40|Structural Steel
MAT0505|Flat Bar|Meter|10|20|40|Structural Steel
MAT0506|Steel Plate|Sheet|5|10|20|Structural Steel
MAT0507|Hollow Section|Meter|10|20|40|Structural Steel
MAT0508|Steel Pipe|Meter|10|20|40|Structural Steel
MAT0601|Railway Rail|Meter|20|40|80|Railway Materials
MAT0602|Concrete Sleeper|Piece|20|40|80|Railway Materials
MAT0603|Wooden Sleeper|Piece|10|20|40|Railway Materials
MAT0604|Ballast Stone|Ton|20|40|80|Railway Materials
MAT0605|Rail Clip|Piece|50|100|200|Railway Materials
MAT0606|Fish Plate|Piece|20|40|80|Railway Materials
MAT0607|Rail Bolt|Piece|50|100|200|Railway Materials
MAT0608|Base Plate|Piece|20|40|80|Railway Materials
MAT0609|Turnout Assembly|Set|1|2|3|Railway Materials
MAT0610|Rubber Rail Pad|Piece|50|100|200|Railway Materials
MAT0701|RCC Pipe 300mm|Piece|10|20|40|Drainage & Culvert
MAT0702|RCC Pipe 450mm|Piece|10|20|40|Drainage & Culvert
MAT0703|RCC Pipe 600mm|Piece|5|10|20|Drainage & Culvert
MAT0704|Box Culvert Unit|Piece|1|2|4|Drainage & Culvert
MAT0705|HDPE Drain Pipe|Meter|20|40|80|Drainage & Culvert
MAT0706|Catch Pit Cover|Piece|5|10|20|Drainage & Culvert
MAT0707|Manhole Cover|Piece|5|10|20|Drainage & Culvert
MAT0708|Drain Grating|Piece|5|10|20|Drainage & Culvert
MAT0709|Headwall Block|Piece|5|10|20|Drainage & Culvert
MAT0710|Filter Fabric|Roll|5|10|20|Drainage & Culvert
MAT0801|Geotextile Fabric|Roll|5|10|20|Geotechnical
MAT0802|Geogrid|Roll|5|10|20|Geotechnical
MAT0803|Gabion Basket|Piece|10|20|40|Geotechnical
MAT0804|Rock Fill|m³|20|40|80|Geotechnical
MAT0805|Riprap Stone|Ton|20|40|80|Geotechnical
MAT0806|Soil Stabilizer|Bag|20|40|80|Geotechnical
MAT0807|Lime|Bag|20|40|80|Geotechnical
MAT0808|Bentonite|Bag|20|40|80|Geotechnical
MAT0901|Steel Form Panel|Piece|10|20|40|Formwork & Scaffolding
MAT0902|Timber Formwork|Piece|10|20|40|Formwork & Scaffolding
MAT0903|Marine Plywood|Sheet|10|20|40|Formwork & Scaffolding
MAT0904|Adjustable Steel Prop|Piece|10|20|40|Formwork & Scaffolding
MAT0905|Scaffolding Pipe|Piece|20|40|80|Formwork & Scaffolding
MAT0906|Base Jack|Piece|10|20|40|Formwork & Scaffolding
MAT0907|U Head Jack|Piece|10|20|40|Formwork & Scaffolding
MAT0908|Coupler|Piece|50|100|200|Formwork & Scaffolding
MAT1001|Hex Bolt|Piece|100|200|500|Fasteners & Hardware
MAT1002|High Tensile Bolt|Piece|50|100|250|Fasteners & Hardware
MAT1003|Nut|Piece|100|200|500|Fasteners & Hardware
MAT1004|Washer|Piece|100|200|500|Fasteners & Hardware
MAT1005|Expansion Bolt|Piece|50|100|250|Fasteners & Hardware
MAT1006|Chemical Anchor|Tube|10|20|40|Fasteners & Hardware
MAT1007|Roofing Screw|Box|10|20|40|Fasteners & Hardware
MAT1101|Expansion Joint Filler|Roll|5|10|20|Waterproofing & Joints
MAT1102|Water Stop PVC|Roll|5|10|20|Waterproofing & Joints
MAT1103|Bituminous Membrane|Roll|5|10|20|Waterproofing & Joints
MAT1104|PU Sealant|Tube|20|40|80|Waterproofing & Joints
MAT1105|Silicone Sealant|Tube|20|40|80|Waterproofing & Joints
MAT1106|Epoxy Injection Resin|Litre|20|40|80|Waterproofing & Joints
MAT1201|Safety Helmet|Piece|10|20|40|Safety Materials
MAT1202|Reflective Safety Vest|Piece|20|40|80|Safety Materials
MAT1203|Safety Shoes|Pair|10|20|40|Safety Materials
MAT1204|Gloves|Pair|50|100|200|Safety Materials
MAT1205|Safety Goggles|Piece|20|40|80|Safety Materials
MAT1206|Traffic Cone|Piece|10|20|40|Safety Materials
MAT1207|Barricade Tape|Roll|10|20|40|Safety Materials
MAT1208|Warning Sign Board|Piece|5|10|20|Safety Materials
MAT1301|Wooden Peg|Piece|50|100|250|Survey & Site
MAT1302|Steel Peg|Piece|50|100|250|Survey & Site
MAT1303|Marking Paint|Can|10|20|40|Survey & Site
MAT1304|Survey Nail|Box|5|10|20|Survey & Site
MAT1305|Reflective Marker|Piece|20|40|80|Survey & Site
MAT1306|Nylon String|Roll|10|20|40|Survey & Site
MAT1401|Diesel|Litre|500|1000|2000|Miscellaneous
MAT1402|Water|Litre|1000|2000|5000|Miscellaneous
MAT1403|Lubricating Oil|Litre|50|100|200|Miscellaneous
MAT1404|Grease|Kg|20|40|80|Miscellaneous
MAT1405|Generator Fuel|Litre|500|1000|2000|Miscellaneous
MAT1406|Cleaning Solvent|Litre|20|40|80|Miscellaneous
`.trim();

// Existing special records: thresholds are only applied if the record already
// exists (matched by normalized code). None are created if missing.
const SPECIAL_EXISTING_TSV = `
MAT0129|concrete sand|Bag|30|60|120
MAT0130|Ready Mix Concrete C30|Bag|10|20|40
MAT0132|pvc 10mm|Meter|20|40|80
MAT0134|materialtest|Bag|10|20|40
`.trim();

// MAT-0133 (helmet) is INACTIVE and must never be auto-activated or otherwise
// touched by this script.
const EXCLUDED_CODES = new Set(['MAT0133']);

const parseCatalog = (tsv) => tsv.split('\n').map(line => {
  const [materialCode, materialName, unit, minimumStock, reorderLevel, maximumStock, category] = line.split('|');
  return {
    materialCode,
    materialName,
    unit,
    minimumStock: Number(minimumStock),
    reorderLevel: Number(reorderLevel),
    maximumStock: Number(maximumStock),
    category
  };
});

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeMaterialCodes = async () => {
  let itemsNormalized = 0;
  const items = await ItemMaster.find({ materialCode: /-/ });
  for (const it of items) {
    const normalized = it.materialCode.replace(/-/g, '');
    const collision = await ItemMaster.findOne({ materialCode: normalized, _id: { $ne: it._id } });
    if (collision) {
      console.warn(`Skipping code normalization for ${it.materialCode} -> ${normalized}: a record with that code already exists.`);
      continue;
    }
    it.materialCode = normalized;
    await it.save();
    itemsNormalized++;
  }

  let materialsNormalized = 0;
  const mats = await Material.find({ materialCode: /-/ });
  for (const m of mats) {
    m.materialCode = m.materialCode.replace(/-/g, '');
    await m.save();
    materialsNormalized++;
  }

  console.log(`Normalized material codes: ${itemsNormalized} ItemMaster record(s), ${materialsNormalized} Material record(s).`);
};

const seedCatalog = async () => {
  const rows = parseCatalog(CATALOG_TSV);
  let updated = 0, created = 0, skippedNameCollision = 0, excluded = 0, provisioned = 0;

  for (const row of rows) {
    if (EXCLUDED_CODES.has(row.materialCode)) {
      excluded++;
      continue;
    }

    const existingByCode = await ItemMaster.findOne({ materialCode: row.materialCode });
    if (existingByCode) {
      existingByCode.minimumStock = row.minimumStock;
      existingByCode.maximumStock = row.maximumStock;
      existingByCode.reorderLevel = row.reorderLevel;
      await existingByCode.save();
      await syncThresholdsToMaterials(existingByCode);

      // This ItemMaster predates the auto-provisioning logic in
      // createItemMaster, so it may never have gotten a MainStore stock row.
      // Use the ItemMaster's own current name (not the seed table's), since
      // that's what any existing Material rows/pre-save sync match against.
      const existingMainStoreRow = await Material.findOne({ name: existingByCode.materialName, location: 'MainStore' });
      if (!existingMainStoreRow) {
        await Material.create({
          materialCode: existingByCode.materialCode,
          name: existingByCode.materialName,
          category: existingByCode.category,
          unit: existingByCode.unit,
          quantity: 0,
          minimumStock: existingByCode.minimumStock,
          maximumStock: existingByCode.maximumStock,
          reorderLevel: existingByCode.reorderLevel,
          location: 'MainStore',
          unitPrice: existingByCode.estimatedUnitCost,
          description: existingByCode.description || ''
        });
        provisioned++;
      }

      updated++;
      continue;
    }

    const existingByName = await ItemMaster.findOne({ materialName: new RegExp(`^${escapeRegex(row.materialName)}$`, 'i') });
    if (existingByName) {
      console.warn(`Skipped creating ${row.materialCode} (${row.materialName}): an ItemMaster named "${existingByName.materialName}" already exists as ${existingByName.materialCode}. Left untouched.`);
      skippedNameCollision++;
      continue;
    }

    const created_item = await ItemMaster.create({
      materialCode: row.materialCode,
      materialName: row.materialName,
      category: row.category,
      unit: row.unit,
      estimatedUnitCost: 0,
      minimumStock: row.minimumStock,
      maximumStock: row.maximumStock,
      reorderLevel: row.reorderLevel,
      status: 'Active'
    });

    const existingMainStoreRow = await Material.findOne({ name: row.materialName, location: 'MainStore' });
    if (!existingMainStoreRow) {
      await Material.create({
        materialCode: row.materialCode,
        name: row.materialName,
        category: row.category,
        unit: row.unit,
        quantity: 0,
        minimumStock: row.minimumStock,
        maximumStock: row.maximumStock,
        reorderLevel: row.reorderLevel,
        location: 'MainStore',
        unitPrice: 0,
        description: ''
      });
    }
    created++;
  }

  console.log(`Catalog seed: ${updated} updated (${provisioned} of those got a newly-provisioned MainStore row), ${created} created, ${skippedNameCollision} skipped (name collision), ${excluded} excluded.`);
};

const seedSpecialExisting = async () => {
  let updated = 0, notFound = 0, provisioned = 0;

  for (const line of SPECIAL_EXISTING_TSV.split('\n')) {
    const [materialCode, materialName, unit, minimumStock, reorderLevel, maximumStock] = line.split('|');
    if (EXCLUDED_CODES.has(materialCode)) continue;

    const existing = await ItemMaster.findOne({ materialCode });
    if (!existing) {
      console.log(`Special record ${materialCode} (${materialName}) not found - skipped (not created).`);
      notFound++;
      continue;
    }
    existing.minimumStock = Number(minimumStock);
    existing.maximumStock = Number(maximumStock);
    existing.reorderLevel = Number(reorderLevel);
    await existing.save();
    await syncThresholdsToMaterials(existing);

    const existingMainStoreRow = await Material.findOne({ name: existing.materialName, location: 'MainStore' });
    if (!existingMainStoreRow) {
      await Material.create({
        materialCode: existing.materialCode,
        name: existing.materialName,
        category: existing.category,
        unit: existing.unit,
        quantity: 0,
        minimumStock: existing.minimumStock,
        maximumStock: existing.maximumStock,
        reorderLevel: existing.reorderLevel,
        location: 'MainStore',
        unitPrice: existing.estimatedUnitCost,
        description: existing.description || ''
      });
      provisioned++;
    }

    updated++;
  }

  console.log(`Special existing records: ${updated} updated (${provisioned} of those got a newly-provisioned MainStore row), ${notFound} not found.`);
};

// Catch-all safety net: any ItemMaster record at all (including ones outside
// the catalog/special-records tables above, e.g. items added directly through
// the Admin UI) that still has no MainStore stock row gets one provisioned,
// using its own current fields. Excludes MAT0133 (helmet) as instructed.
const provisionAnyRemainingMissingRows = async () => {
  const items = await ItemMaster.find({});
  let provisioned = 0;

  for (const item of items) {
    if (EXCLUDED_CODES.has(item.materialCode)) continue;

    const existingMainStoreRow = await Material.findOne({ name: item.materialName, location: 'MainStore' });
    if (existingMainStoreRow) continue;

    await Material.create({
      materialCode: item.materialCode,
      name: item.materialName,
      category: item.category,
      unit: item.unit,
      quantity: 0,
      minimumStock: item.minimumStock,
      maximumStock: item.maximumStock,
      reorderLevel: item.reorderLevel,
      location: 'MainStore',
      unitPrice: item.estimatedUnitCost,
      description: item.description || ''
    });
    provisioned++;
  }

  console.log(`Catch-all MainStore row provisioning: ${provisioned} additional row(s) created.`);
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ConstructionDB');
  console.log('Connected to MongoDB for material threshold seeding.');

  await normalizeMaterialCodes();
  await seedCatalog();
  await seedSpecialExisting();
  await provisionAnyRemainingMissingRows();

  await mongoose.disconnect();
  console.log('Done.');
};

run().catch(err => {
  console.error('Seed script failed:', err);
  process.exit(1);
});

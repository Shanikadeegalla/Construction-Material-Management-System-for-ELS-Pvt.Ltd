// One-off remediation script: brings existing data in line with the single
// material category list (utils/materialCategories.js).
//
//   - Material stock rows (MainStore and SiteStore) take the category of the
//     Item Master record with the same name. Rows with no Item Master match
//     and a category outside the list fall back to 'Other'.
//   - Supplier categories from the old supplier-only list are converted to
//     their closest Item Master category.
//
// Dry run by default (prints what would change, writes nothing).
// Usage: node backend/scripts/syncCategoriesToItemMaster.js [--apply]
import 'dotenv/config';
import mongoose from 'mongoose';
import ItemMaster from '../models/ItemMaster.js';
import Material from '../models/Material.js';
import Supplier from '../models/Supplier.js';
import { decryptDB } from '../utils/cryptoUtils.js';
import { getAllCategories } from '../utils/materialCategories.js';

const OLD_SUPPLIER_CATEGORY_MAP = {
  Cement: 'Cement & Concrete',
  Sand: 'Aggregates',
  Aggregate: 'Aggregates',
  Gravel: 'Aggregates',
  Steel: 'Reinforcement Steel',
  Hardware: 'Fasteners & Hardware',
  Timber: 'Formwork & Scaffolding',
  Wood: 'Formwork & Scaffolding',
  Plumbing: 'Drainage & Culvert',
  Bricks: 'Miscellaneous',
  Paint: 'Miscellaneous',
  Electrical: 'Miscellaneous',
  Tiles: 'Miscellaneous'
};

export const syncCategories = async ({ apply = false, log = console.log } = {}) => {
  const valid = new Set(await getAllCategories());

  // Site Store names are encrypted at rest, so match on the decrypted name
  // (same technique as utils/materialSync.js).
  const masters = await ItemMaster.find({}).select('materialName category').lean();
  const categoryByName = new Map(masters.map(m => [m.materialName, m.category]));

  let materialsChanged = 0, materialsUnmatched = 0;
  const materials = await Material.find({}).select('name category location').lean();
  for (const mat of materials) {
    const name = categoryByName.has(mat.name) ? mat.name : decryptDB(mat.name);
    let target = categoryByName.get(name);
    if (!target) {
      materialsUnmatched++;
      target = valid.has(mat.category) ? mat.category : 'Other';
    }
    if (target === mat.category) continue;
    materialsChanged++;
    log(`Material [${mat.location}] "${name}": "${mat.category}" -> "${target}"`);
    if (apply) await Material.updateOne({ _id: mat._id }, { $set: { category: target } });
  }

  let suppliersChanged = 0;
  const suppliers = await Supplier.find({}).select('supplierId name categories').lean();
  for (const sup of suppliers) {
    const current = sup.categories || [];
    const next = [...new Set(current.map(c => (valid.has(c) ? c : OLD_SUPPLIER_CATEGORY_MAP[c] || 'Other')))];
    if (next.length === current.length && next.every((c, i) => c === current[i])) continue;
    suppliersChanged++;
    log(`Supplier ${sup.supplierId} "${sup.name}": [${current.join(', ')}] -> [${next.join(', ')}]`);
    if (apply) await Supplier.updateOne({ _id: sup._id }, { $set: { categories: next } });
  }

  return { materialsChanged, materialsUnmatched, suppliersChanged };
};

const run = async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ConstructionDB');
  console.log(`Connected to "${mongoose.connection.name}" (${apply ? 'APPLY' : 'dry run'}).`);

  const { materialsChanged, materialsUnmatched, suppliersChanged } = await syncCategories({ apply });

  console.log(`Done. ${materialsChanged} Material row(s) and ${suppliersChanged} Supplier(s) ${apply ? 'updated' : 'would be updated'}; ${materialsUnmatched} Material row(s) have no Item Master match.`);
  if (!apply) console.log('Dry run only - re-run with --apply to write these changes.');
  await mongoose.disconnect();
};

if (process.argv[1] && process.argv[1].endsWith('syncCategoriesToItemMaster.js')) {
  run().catch(err => {
    console.error('Category sync failed:', err);
    process.exit(1);
  });
}

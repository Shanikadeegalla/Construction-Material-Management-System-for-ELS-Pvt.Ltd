import Material from '../models/Material.js';
import { decryptDB } from './cryptoUtils.js';
import { levelsForLocation } from './siteStoreLevels.js';

// Propagates an ItemMaster's current stock thresholds, unit cost and category onto every
// existing Material stock row (MainStore and SiteStore) with the same name.
// Site Store names are encrypted at rest, so matching reuses the same
// decrypt-then-compare technique as Material's pre-save hook (models/Material.js).
export const syncThresholdsToMaterials = async (item) => {
  const allMaterials = await Material.find({});
  const matchingMaterials = allMaterials.filter(m => {
    const decryptedName = decryptDB(m.name);
    return m.name === item.materialName || decryptedName === item.materialName;
  });

  for (const mat of matchingMaterials) {
    Object.assign(mat, levelsForLocation(item, mat.location));
    mat.unitPrice = item.estimatedUnitCost;
    mat.category = item.category;
    await mat.save();
  }

  return matchingMaterials.length;
};

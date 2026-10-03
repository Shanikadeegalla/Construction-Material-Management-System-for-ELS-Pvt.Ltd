import MaterialCategory from '../models/MaterialCategory.js';

// Single source of truth for material categories. The Item Master, stock rows
// (Main Store / Site Store) and Suppliers all use this one list: the built-in
// defaults below plus any categories the Admin has added (MaterialCategory).
// Keep the defaults in sync with frontend/src/constants/materialCategories.js.
export const MATERIAL_CATEGORIES = [
  'Cement & Concrete',
  'Aggregates',
  'Road Construction',
  'Bridge Construction',
  'Reinforcement Steel',
  'Structural Steel',
  'Railway Materials',
  'Drainage & Culvert',
  'Geotechnical',
  'Formwork & Scaffolding',
  'Fasteners & Hardware',
  'Waterproofing & Joints',
  'Safety Materials',
  'Survey & Site',
  'Miscellaneous',
  'Other'
];

// Defaults followed by Admin-added categories, with 'Other' kept last.
export const getAllCategories = async () => {
  const custom = await MaterialCategory.find({}).sort({ name: 1 }).lean();
  const customNames = custom.map(c => c.name).filter(n => !MATERIAL_CATEGORIES.includes(n));
  return [...MATERIAL_CATEGORIES.filter(c => c !== 'Other'), ...customNames, 'Other'];
};

export const isValidCategory = async (name) => {
  if (MATERIAL_CATEGORIES.includes(name)) return true;
  return !!(await MaterialCategory.exists({ name }));
};

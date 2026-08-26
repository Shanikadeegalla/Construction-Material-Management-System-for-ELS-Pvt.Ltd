import StockMovement from '../models/StockMovement.js';
import { encryptDB, decryptDB } from './cryptoUtils.js';

// The only place in the codebase allowed to change Material.quantity.
// Every call both mutates the Material document and writes an immutable
// StockMovement entry, so current stock always traces back to a system
// transaction (GRN receipt, MIN issue/receipt, usage, or an authorized
// Stock Adjustment).

export const getDecryptedQuantity = (materialDoc) => {
  return materialDoc.location === 'SiteStore'
    ? Number(decryptDB(materialDoc.quantity)) || 0
    : Number(materialDoc.quantity) || 0;
};

export const recordMovement = async ({
  materialDoc,
  type,
  quantityChange,
  reference = '',
  performedBy = '',
  reason = '',
  notes = ''
}) => {
  const isSite = materialDoc.location === 'SiteStore';
  const currentQty = getDecryptedQuantity(materialDoc);
  const newQty = currentQty + quantityChange;

  if (newQty < 0) {
    throw new Error(`Insufficient stock for ${isSite ? decryptDB(materialDoc.name) : materialDoc.name}. Current: ${currentQty}, requested change: ${quantityChange}`);
  }

  materialDoc.quantity = isSite ? encryptDB(String(newQty)) : newQty;
  await materialDoc.save();

  const materialName = isSite ? decryptDB(materialDoc.name) : materialDoc.name;

  const movement = await StockMovement.create({
    material: materialDoc._id,
    materialName,
    unit: materialDoc.unit,
    location: materialDoc.location,
    type,
    quantityChange,
    balanceAfter: newQty,
    reference,
    reason,
    notes,
    performedBy
  });

  return { material: materialDoc, movement };
};

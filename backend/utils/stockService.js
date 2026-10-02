import StockMovement from '../models/StockMovement.js';
import { encryptDB, decryptDB } from './cryptoUtils.js';
import { notifyRoles } from '../controllers/notificationController.js';

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

// Raises a persisted low-stock notification the moment a stock-reducing
// movement takes a material across its Pre-Order (reorder) level or its
// Minimum level - only on the crossing, so repeated issues while already low
// don't spam the same alert. Main Store shortages go to the Purchase Manager
// (who must procure) and the Main Store Officer; Site Store shortages go to
// the Site Store Officer (who must request a transfer).
const notifyIfLowStock = async ({ materialDoc, materialName, previousQty, newQty }) => {
  const minimum = Number(materialDoc.minimumStock) || 0;
  const reorder = Number(materialDoc.reorderLevel) || minimum;

  let level = null;
  if (previousQty > minimum && newQty <= minimum) level = 'Critical';
  else if (previousQty > reorder && newQty <= reorder) level = 'Low';
  if (!level) return;

  const isSite = materialDoc.location === 'SiteStore';
  const where = isSite ? 'Site Store' : 'Main Store';
  const threshold = level === 'Critical' ? `minimum level ${minimum}` : `reorder level ${reorder}`;
  const msg = `${level === 'Critical' ? 'CRITICAL' : 'Low'} stock in ${where}: ${materialName} is at ${newQty} ${materialDoc.unit} (${threshold} ${materialDoc.unit}).`;

  if (isSite) {
    await notifyRoles(['SiteStoreOfficer'], msg, 'LOW_STOCK', '/site-store-dashboard');
  } else {
    await notifyRoles(['PurchaseManager'], msg, 'LOW_STOCK', '/purchase-orders');
    await notifyRoles(['MainStoreOfficer'], msg, 'LOW_STOCK', '/main-store-dashboard');
  }
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

  if (quantityChange < 0) {
    await notifyIfLowStock({ materialDoc, materialName, previousQty: currentQty, newQty });
  }

  return { material: materialDoc, movement };
};

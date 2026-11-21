// Validation helpers for Item Master records.

// Checks the stock thresholds of a material: no negative values, and
// Minimum ≤ Pre-Order (reorder) ≤ Maximum. A reorder level of 0 or empty
// means "not set" and is calculated by the controller, so it is not checked.
// Returns an error message, or null when the values are valid.
export const validateStockLevels = ({ minimumStock, reorderLevel, maximumStock }) => {
  const min = Number(minimumStock);
  const max = Number(maximumStock);
  const reorder = Number(reorderLevel);

  if ([min, max, reorder].some((v) => Number.isNaN(v))) {
    return 'Stock levels must be numbers.';
  }
  if (min < 0 || max < 0 || reorder < 0) {
    return 'Stock levels cannot be negative.';
  }
  if (max > 0 && min > max) {
    return 'Minimum stock cannot exceed maximum stock.';
  }
  if (reorder > 0 && (reorder < min || (max > 0 && reorder > max))) {
    return 'Pre-order level must be between the minimum and maximum stock.';
  }
  return null;
};

// Turns a MongoDB duplicate-key error (code 11000) into a clear message.
// Returns null for any other error.
export const duplicateMaterialMessage = (error) => {
  if (!error || error.code !== 11000) return null;
  const field = Object.keys(error.keyPattern || error.keyValue || {})[0];
  if (field === 'materialCode') return 'Material code already exists. Please use a different code.';
  if (field === 'materialName') return 'A material with this name already exists.';
  return 'This material already exists.';
};

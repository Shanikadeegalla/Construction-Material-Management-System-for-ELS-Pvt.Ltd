// The Site Store is a much smaller holding area than the Main Store, so its
// stock rows carry a fraction of the Item Master's Min / Pre-Order / Max
// levels instead of the full Main Store thresholds.
export const SITE_STORE_SCALE = 0.25;

const scale = (value) => Math.max(1, Math.ceil((Number(value) || 0) * SITE_STORE_SCALE));

// Thresholds a Material row should carry for its location, derived from the
// Item Master record it belongs to.
export const levelsForLocation = (master, location) => {
  if (location !== 'SiteStore') {
    return {
      minimumStock: master.minimumStock,
      maximumStock: master.maximumStock,
      reorderLevel: master.reorderLevel
    };
  }
  return {
    minimumStock: scale(master.minimumStock),
    maximumStock: scale(master.maximumStock),
    reorderLevel: scale(master.reorderLevel)
  };
};

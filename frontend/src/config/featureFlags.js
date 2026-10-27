/**
 * Feature flags for toggling UI elements on dashboards.
 * Set any flag to true to restore the respective summary / KPI cards.
 */

// Controls the Payment page KPI cards under PurchaseOrderPage (only page intended to have cards hidden)
export const SHOW_PURCHASE_MANAGER_PAYMENT_KPI = false;

// Backwards compatibility alias
export const SHOW_PURCHASE_MANAGER_KPI = SHOW_PURCHASE_MANAGER_PAYMENT_KPI;

// Controls the top summary cards on the Executive Board (Director) dashboard
export const SHOW_DIRECTOR_SUMMARY_CARDS = false;

// Controls the summary cards under the "Site Store Operations Center" header
export const SHOW_SITE_STORE_SUMMARY_CARDS = true;


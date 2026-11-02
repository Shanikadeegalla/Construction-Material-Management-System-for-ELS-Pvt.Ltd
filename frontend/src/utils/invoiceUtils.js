/**
 * Calculates due date based on invoice date and purchase order payment terms.
 * Mapping:
 * - "30 Days Credit" = 30 days
 * - "Cash on Delivery", "Full Payment", "50% Advance" = 0 days (due on invoice date)
 * - Any other "X Days Credit" = X days
 * - Missing / empty terms = 30 days (default)
 */
export const calculateDueDate = (invoiceDate, paymentTerms) => {
  if (!invoiceDate) return null;
  const invDate = new Date(invoiceDate);
  if (isNaN(invDate.getTime())) return null;

  let creditDays = 30; // default to 30 days if terms are missing

  if (paymentTerms && typeof paymentTerms === 'string') {
    const t = paymentTerms.trim();
    if (t === 'Cash on Delivery' || t === 'Full Payment' || t === '50% Advance') {
      creditDays = 0;
    } else if (t === '30 Days Credit') {
      creditDays = 30;
    } else {
      const match = t.match(/^(\d+)\s*Days?\s*Credit$/i);
      if (match) {
        creditDays = parseInt(match[1], 10);
      } else {
        creditDays = 30;
      }
    }
  }

  const due = new Date(invDate);
  due.setDate(due.getDate() + creditDays);
  return due;
};


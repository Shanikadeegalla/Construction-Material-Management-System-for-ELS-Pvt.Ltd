import Quotation from '../models/Quotation.js';

const generateNextQuotationNumber = async () => {
  let next = (await Quotation.countDocuments()) + 1;
  let candidate;
  do {
    candidate = `QT-${String(next).padStart(4, '0')}`;
    next++;
  } while (await Quotation.findOne({ quotationNumber: candidate }));
  return candidate;
};

// @desc    Create a new quotation for a supplier (optional PDF/JPG attachment)
// @route   POST /api/quotations
// @access  Private (Manage Quotations)
export const createQuotation = async (req, res) => {
  try {
    const { supplier, material, quantity, unit, price, date, poReference, notes } = req.body;

    if (!supplier || !material || !price) {
      return res.status(400).json({ success: false, message: 'Supplier, material and price are required.' });
    }

    const quotationNumber = await generateNextQuotationNumber();

    const quotation = new Quotation({
      quotationNumber,
      supplier,
      material,
      quantity: quantity || undefined,
      unit: unit || '',
      price: Number(price),
      date: date || new Date(),
      poReference: poReference || undefined,
      notes: notes || '',
      uploadedBy: req.user ? req.user.name : '',
      file: req.file ? { url: `/uploads/${req.file.filename}`, filename: req.file.originalname } : undefined
    });

    await quotation.save();

    res.status(201).json({ success: true, message: 'Quotation added successfully!', data: quotation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get quotations, optionally filtered by supplier
// @route   GET /api/quotations?supplier=<id>
// @access  Private
export const getQuotations = async (req, res) => {
  try {
    const query = {};
    if (req.query.supplier) {
      query.supplier = req.query.supplier;
    }
    const quotations = await Quotation.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: quotations.length, data: quotations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a single quotation
// @route   GET /api/quotations/:id
// @access  Private
export const getQuotationById = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }
    res.status(200).json({ success: true, data: quotation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

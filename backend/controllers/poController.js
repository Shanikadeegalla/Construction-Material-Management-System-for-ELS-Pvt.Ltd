import PurchaseOrder from '../models/PurchaseOrder.js';
import PurchaseRequest from '../models/PurchaseRequest.js';

// Get all purchase orders
export const getPOs = async (req, res) => {
  try {
    const pos = await PurchaseOrder.find()
      .populate('supplier')
      .populate('items.material')
      .populate('prId')
      .sort({ createdAt: -1 });
    res.json(pos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new purchase order
export const createPO = async (req, res) => {
  const { prId, supplier, items, totalAmount, createdBy } = req.body;

  if (!prId || !supplier || !items || !Array.isArray(items) || items.length === 0 || !totalAmount || !createdBy) {
    return res.status(400).json({ message: 'Missing required PO fields.' });
  }

  try {
    // Save new PO
    const po = new PurchaseOrder({
      prId,
      supplier,
      items,
      totalAmount: Number(totalAmount),
      createdBy,
      status: 'Draft'
    });

    await po.save();

    // Populate and return
    const populatedPo = await PurchaseOrder.findById(po._id)
      .populate('supplier')
      .populate('items.material')
      .populate('prId');

    res.status(201).json({ message: 'Purchase Order created successfully!', po: populatedPo });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update PO status (e.g. Sent, Delivered, Cancelled)
export const updatePOStatus = async (req, res) => {
  const { status } = req.body;
  if (!status || !['Draft', 'Sent', 'Delivered', 'Cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid PO status.' });
  }

  try {
    const po = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
      .populate('supplier')
      .populate('items.material')
      .populate('prId');

    if (!po) {
      return res.status(404).json({ message: 'Purchase order not found.' });
    }

    res.json({ message: `Purchase Order status updated to ${status}!`, po });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

import express from 'express';
import GRN from '../models/GRN.js';
import Material from '../models/Material.js';

const router = express.Router();

// GET all GRNs
router.get('/', async (req, res) => {
  try {
    const grns = await GRN.find().sort({ createdAt: -1 });
    res.json(grns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST create GRN (and increment materials in MainStore)
router.post('/', async (req, res) => {
  const { grnNumber, supplier, receivedDate, items, notes } = req.body;

  if (!grnNumber || !supplier || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Missing required GRN information' });
  }

  try {
    // Save the GRN note
    const grn = new GRN({
      grnNumber,
      supplier,
      receivedDate,
      items,
      notes
    });

    await grn.save();

    // Update Material stocks
    for (const item of items) {
      const { name, category, unit, quantity, unitPrice } = item;
      const parsedQty = Number(quantity);
      const parsedPrice = Number(unitPrice);

      // Find if the material exists in MainStore
      let material = await Material.findOne({
        name: name.trim(),
        location: 'MainStore'
      });

      if (material) {
        // Increment quantity and update unit price to latest received price
        material.quantity += parsedQty;
        material.unitPrice = parsedPrice;
        await material.save();
      } else {
        // Create a new material entry for MainStore
        material = new Material({
          name: name.trim(),
          category,
          unit,
          quantity: parsedQty,
          minimumStock: 10, // default minimum stock
          location: 'MainStore',
          unitPrice: parsedPrice
        });
        await material.save();
      }
    }

    res.status(201).json({ message: 'GRN recorded and inventory updated successfully!', grn });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;

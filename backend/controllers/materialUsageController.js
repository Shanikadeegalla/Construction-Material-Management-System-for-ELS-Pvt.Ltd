import MaterialUsage from '../models/MaterialUsage.js';
import BOM from '../models/BOM.js';
import { decryptDB } from '../utils/cryptoUtils.js';

// @desc    Get all material usage records
// @route   GET /api/material-usage
// @access  Private
export const getUsageRecords = async (req, res) => {
  try {
    const usages = await MaterialUsage.find({}).sort({ usageDate: -1 });
    const decrypted = usages.map(u => {
      const doc = u.toObject();
      doc.materialName = decryptDB(doc.materialName);
      
      const rawActual = doc.actualQty !== undefined ? doc.actualQty : doc.quantityUsed;
      const decryptedActual = decryptDB(rawActual);
      doc.actualQty = Number(decryptedActual) || Number(rawActual) || 0;
      
      const rawPlanned = doc.plannedQty !== undefined ? doc.plannedQty : 0;
      const decryptedPlanned = decryptDB(rawPlanned);
      doc.plannedQty = Number(decryptedPlanned) || Number(rawPlanned) || 0;
      
      const rawVariance = doc.variance !== undefined ? doc.variance : 0;
      const decryptedVariance = decryptDB(rawVariance);
      doc.variance = Number(decryptedVariance) || Number(rawVariance) || 0;
      
      return doc;
    });
    res.status(200).json({ success: true, count: decrypted.length, data: decrypted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Record actual material usage
// @route   POST /api/material-usage
// @access  Private
export const addUsageRecord = async (req, res) => {
  try {
    const { projectName, materialName, actualQty, usageDate, unit } = req.body;
    const recordedBy = req.user ? req.user.name : 'Store Officer';

    if (!projectName || !materialName || actualQty === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required usage fields.' });
    }

    // Lookup planned quantity from the approved BOM for this project
    let plannedQty = 0;
    let materialUnit = unit || 'bag';

    const approvedBOM = await BOM.findOne({ projectName, status: 'Approved' });
    if (approvedBOM) {
      const match = approvedBOM.materials.find(
        m => m.name.toLowerCase() === materialName.toLowerCase()
      );
      if (match) {
        plannedQty = match.plannedQty;
        if (!unit) {
          materialUnit = match.unit;
        }
      }
    }

    const variance = Number(actualQty) - plannedQty;

    const usage = new MaterialUsage({
      projectName,
      materialName,
      unit: materialUnit,
      plannedQty,
      actualQty: Number(actualQty),
      variance,
      recordedBy,
      usageDate: usageDate || new Date()
    });

    await usage.save();

    res.status(201).json({ success: true, message: 'Material usage recorded successfully!', data: usage });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getVarianceReport = async (req, res) => {
  try {
    // 1. Get all approved BOMs
    const boms = await BOM.find({ status: 'Approved' });
    
    // 2. Get all usage records
    const usages = await MaterialUsage.find({});
    const decryptedUsages = usages.map(u => {
      const doc = u.toObject();
      doc.materialName = decryptDB(doc.materialName);
      
      const rawActual = doc.actualQty !== undefined ? doc.actualQty : doc.quantityUsed;
      const decryptedActual = decryptDB(rawActual);
      doc.actualQty = Number(decryptedActual) || Number(rawActual) || 0;
      
      const rawPlanned = doc.plannedQty !== undefined ? doc.plannedQty : 0;
      const decryptedPlanned = decryptDB(rawPlanned);
      doc.plannedQty = Number(decryptedPlanned) || Number(rawPlanned) || 0;
      
      const rawVariance = doc.variance !== undefined ? doc.variance : 0;
      const decryptedVariance = decryptDB(rawVariance);
      doc.variance = Number(decryptedVariance) || Number(rawVariance) || 0;
      
      return doc;
    });

    // 3. Process data by project and material
    const projectMaterials = {};

    // First, populate using approved BOMs (planned quantities)
    boms.forEach(bom => {
      const proj = bom.projectName;
      if (!projectMaterials[proj]) {
        projectMaterials[proj] = {};
      }
      bom.materials.forEach(mat => {
        const key = mat.name.toLowerCase().trim();
        projectMaterials[proj][key] = {
          projectName: proj,
          materialName: mat.name,
          unit: mat.unit,
          plannedQty: Number(mat.plannedQty) || 0,
          actualQty: 0,
          unitCost: Number(mat.estimatedUnitCost) || 0,
        };
      });
    });

    // Second, populate/accumulate using usage records (actual quantities)
    decryptedUsages.forEach(use => {
      const proj = use.projectName;
      const matName = use.materialName || '';
      const key = matName.toLowerCase().trim();
      
      if (!projectMaterials[proj]) {
        projectMaterials[proj] = {};
      }
      if (!projectMaterials[proj][key]) {
        projectMaterials[proj][key] = {
          projectName: proj,
          materialName: matName,
          unit: use.unit || 'bag',
          plannedQty: 0,
          actualQty: 0,
          unitCost: 0,
        };
      }
      projectMaterials[proj][key].actualQty += Number(use.actualQty) || 0;
    });

    // Third, flatten into a list and calculate variance
    const reportData = [];
    Object.keys(projectMaterials).forEach(proj => {
      Object.keys(projectMaterials[proj]).forEach(key => {
        const item = projectMaterials[proj][key];
        const diff = item.actualQty - item.plannedQty;
        // Variance % = (Actual - Planned) / Planned * 100
        let variancePct = 0;
        if (item.plannedQty > 0) {
          variancePct = (diff / item.plannedQty) * 100;
        } else if (item.actualQty > 0) {
          variancePct = 100; // If no planned quantity but usage occurs
        }
        const numericVariancePct = Number(variancePct.toFixed(2));
        const wastageQty = Math.max(diff, 0);
        const wastageCost = wastageQty * (item.unitCost || 0);

        let severity = 'None';
        if (numericVariancePct > 10) {
          severity = 'Significant';
        } else if (numericVariancePct > 0) {
          severity = 'Moderate';
        }

        reportData.push({
          projectName: item.projectName,
          materialName: item.materialName,
          unit: item.unit,
          plannedQty: item.plannedQty,
          actualQty: item.actualQty,
          varianceQty: diff,
          variancePct: numericVariancePct,
          wastageQty,
          wastageCost,
          severity
        });
      });
    });

    // 4. Usage timeline data (for line charts)
    const usageTimeline = decryptedUsages.map(u => ({
      projectName: u.projectName,
      materialName: u.materialName,
      actualQty: u.actualQty,
      usageDate: u.usageDate,
      recordedBy: u.recordedBy
    })).sort((a,b) => new Date(a.usageDate) - new Date(b.usageDate));

    const totalWastageCost = reportData.reduce((sum, item) => sum + (item.wastageCost || 0), 0);

    res.status(200).json({
      success: true,
      report: reportData,
      timeline: usageTimeline,
      totalWastageCost
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

import dotenv from 'dotenv';
dotenv.config();

const base = 'http://localhost:5000/api';

async function runFR4Tests() {
  console.log('=== STARTING FR4 LIVE SYSTEM VERIFICATION ===\n');

  // 1. Authenticate users
  const mainRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mainstore@elslanka.com', password: 'Password123!' })
  });
  const mainData = await mainRes.json();
  const mainToken = mainData.data?.token || mainData.token;

  const siteRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sitestore@elslanka.com', password: 'Password123!' })
  });
  const siteData = await siteRes.json();
  const siteToken = siteData.data?.token || siteData.token;

  if (!mainToken || !siteToken) {
    console.error('Failed to log in mainstore or sitestore officer', { mainData, siteData });
    process.exit(1);
  }

  const mainHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${mainToken}` };
  const siteHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${siteToken}` };

  // Step 1: Use existing approved & sent Purchase Order PO-2026-025
  console.log('Step 1: Fetching PO-2026-025...');
  const poRes = await fetch(`${base}/purchase-orders`, { headers: mainHeaders });
  const posData = await poRes.json();
  const poList = posData.data || posData;
  const targetPO = poList.find(p => p.poNumber === 'PO-2026-025');

  console.log('Target PO:', targetPO ? {
    id: targetPO._id,
    poNumber: targetPO.poNumber,
    status: targetPO.status,
    supplier: targetPO.supplier,
    prId: targetPO.prId,
    items: targetPO.items
  } : 'NOT FOUND');

  // Step 2 & 3 & 4: Verify auto-population data for PO-2026-025
  const supplierName = targetPO?.supplier?.name || targetPO?.supplier || 'N/A';
  const projectName = targetPO?.prId?.project?.projectName || targetPO?.prId?.projectName || 'Port City Bridge — Phase 1';
  const orderedQty = targetPO?.items?.[0]?.quantity || 0;
  const materialName = targetPO?.items?.[0]?.materialName || 'TMT Steel 12mm';

  console.log('Step 4 Auto-populated values:', {
    supplier: supplierName,
    poNumber: targetPO?.poNumber,
    project: projectName,
    materialName,
    orderedQty
  });

  // Step 5, 6, 7, 8: Create GRN against PO-2026-025 with Received Qty = 12, Condition = Good
  console.log('\nStep 5-8: Submitting GRN for PO-2026-025 (Qty=12, Condition=Good)...');
  
  // Get Main Store stock before GRN
  const invBeforeRes = await fetch(`${base}/inventory?location=MainStore`, { headers: mainHeaders });
  const invBefore = await invBeforeRes.json();
  const tmtBefore = invBefore.find(m => m.name === materialName || m.name === 'TMT Steel 12mm');
  const qtyBeforeGRN = tmtBefore ? tmtBefore.quantity : 0;
  console.log('Main Store TMT Steel 12mm qty before GRN:', qtyBeforeGRN);

  const grnPayload = {
    poReference: 'PO-2026-025',
    supplier: typeof targetPO.supplier === 'object' ? targetPO.supplier.name : (targetPO.supplier || 'Building Supplies Co'),
    supplierId: typeof targetPO.supplier === 'object' ? targetPO.supplier._id : undefined,
    receivedBy: 'Main Store Officer',
    receivedDate: new Date().toISOString(),
    items: [
      {
        material: tmtBefore?._id,
        materialName: 'TMT Steel 12mm',
        expectedQty: 12,
        receivedQty: 12,
        condition: 'Good',
        damagedQty: 0
      }
    ],
    notes: 'FR4 End-to-end verification test delivery'
  };

  const grnRes = await fetch(`${base}/inventory/grn`, {
    method: 'POST',
    headers: mainHeaders,
    body: JSON.stringify(grnPayload)
  });
  const grnResult = await grnRes.json();
  console.log('GRN Creation API Status:', grnRes.status);
  console.log('GRN Creation Response:', grnResult);

  // Step 9: Check Main Store Inventory after GRN
  const invAfterRes = await fetch(`${base}/inventory?location=MainStore`, { headers: mainHeaders });
  const invAfter = await invAfterRes.json();
  const tmtAfter = invAfter.find(m => m.name === materialName || m.name === 'TMT Steel 12mm');
  const qtyAfterGRN = tmtAfter ? tmtAfter.quantity : 0;
  console.log('\nStep 9: Main Store TMT Steel 12mm qty after GRN:', qtyAfterGRN);
  console.log('GRN Quantity Increase:', qtyAfterGRN - qtyBeforeGRN, '(Expected: +12)');

  // Step 10 & 11: View History / Stock Movement for TMT Steel 12mm
  const movementsRes = await fetch(`${base}/inventory/stock-ledger`, { headers: mainHeaders });
  const movementsData = await movementsRes.json();
  const ledger = movementsData.data || movementsData;
  const grnMovements = ledger.filter(m => (m.materialName === 'TMT Steel 12mm' || m.material === tmtBefore?._id) && m.type === 'GRN Receipt');
  console.log('\nStep 10 & 11: Stock movement entries for GRN Receipt:', grnMovements.length > 0 ? grnMovements[0] : 'None');

  // Step 12, 13, 14, 15: Material Transfer from Main Store to Site Store
  console.log('\nStep 12-15: Testing Main Store -> Site Store Material Transfer (5 tons)...');
  const projectsRes = await fetch(`${base}/projects`, { headers: mainHeaders });
  const projectsData = await projectsRes.json();
  const projects = projectsData.data || projectsData;
  const targetProject = projects[0];
  const siteStoreId = targetProject._id;
  const siteStoreName = `${targetProject.projectName} Site Store`;

  // Main Store issues MTN
  const mtnPayload = {
    siteStoreId,
    transferDate: new Date().toISOString(),
    materials: [
      {
        materialName: 'TMT Steel 12mm',
        quantity: 5,
        unit: 'ton'
      }
    ],
    reference: 'FR4-TEST-MTN',
    notes: 'Testing Main Store to Site Store Transfer'
  };

  const mtnRes = await fetch(`${base}/material-transfer-notes`, {
    method: 'POST',
    headers: mainHeaders,
    body: JSON.stringify(mtnPayload)
  });
  const mtnResult = await mtnRes.json();
  console.log('MTN Issue API Status:', mtnRes.status);
  console.log('MTN Issue Response:', mtnResult);

  // Main store stock after transfer out
  const invAfterMTNRes = await fetch(`${base}/inventory?location=MainStore`, { headers: mainHeaders });
  const invAfterMTN = await invAfterMTNRes.json();
  const tmtAfterMTN = invAfterMTN.find(m => m.name === 'TMT Steel 12mm');
  console.log('Main Store qty after MTN transfer out:', tmtAfterMTN?.quantity, '(Expected:', qtyAfterGRN - 5, ')');

  // Site Store confirms receipt
  const mtnId = mtnResult.data?._id;
  if (mtnId) {
    const siteInvBeforeRes = await fetch(`${base}/site/inventory?projectId=${siteStoreId}`, { headers: siteHeaders });
    const siteInvBefore = await siteInvBeforeRes.json();
    const siteMatBefore = siteInvBefore.find(m => m.name === 'TMT Steel 12mm');
    const siteQtyBefore = siteMatBefore ? siteMatBefore.quantity : 0;

    const receiveRes = await fetch(`${base}/material-transfer-notes/${mtnId}/receive`, {
      method: 'POST',
      headers: siteHeaders
    });
    const receiveResult = await receiveRes.json();
    console.log('Site Store Confirm Receipt Status:', receiveRes.status);
    console.log('Site Store Confirm Receipt Response:', receiveResult);

    const siteInvAfterRes = await fetch(`${base}/site/inventory?projectId=${siteStoreId}`, { headers: siteHeaders });
    const siteInvAfter = await siteInvAfterRes.json();
    const siteMatAfter = siteInvAfter.find(m => m.name === 'TMT Steel 12mm');
    const siteQtyAfter = siteMatAfter ? siteMatAfter.quantity : 0;
    console.log('Site Store TMT Steel 12mm qty after receipt:', siteQtyAfter, '(Increased by:', siteQtyAfter - siteQtyBefore, ')');
  }

  // Step 16, 17, 18: Site Store Material Issue through MIN
  console.log('\nStep 16-18: Testing Site Store Material Issue (MIN) and Usage Record...');
  const siteInvForIssueRes = await fetch(`${base}/site/inventory?projectId=${siteStoreId}`, { headers: siteHeaders });
  const siteInvForIssue = await siteInvForIssueRes.json();
  const siteMatToIssue = siteInvForIssue.find(m => m.name === 'TMT Steel 12mm');

  if (siteMatToIssue) {
    const issuePayload = {
      projectId: siteStoreId,
      materialId: siteMatToIssue._id,
      quantity: 2,
      activity: 'Beam reinforcement work'
    };

    const issueRes = await fetch(`${base}/site/material-usage`, {
      method: 'POST',
      headers: siteHeaders,
      body: JSON.stringify(issuePayload)
    });
    const issueResult = await issueRes.json();
    console.log('Material Issue API Status:', issueRes.status);
    console.log('Material Issue Response:', issueResult);

    // Verify Site Store stock decrease
    const siteInvFinalRes = await fetch(`${base}/site/inventory?projectId=${siteStoreId}`, { headers: siteHeaders });
    const siteInvFinal = await siteInvFinalRes.json();
    const siteMatFinal = siteInvFinal.find(m => m.name === 'TMT Steel 12mm');
    console.log('Site Store stock after MIN issue:', siteMatFinal?.quantity, '(Expected:', siteMatToIssue.quantity - 2, ')');

    // Verify Material Usage Record
    const usageRes = await fetch(`${base}/material-usage?projectId=${siteStoreId}`, { headers: siteHeaders });
    const usageData = await usageRes.json();
    const usageList = usageData.data || usageData;
    console.log('Material Usage Records Count:', usageList.length);
    console.log('Latest Usage Record:', usageList[0]);
  }

  // Step 19: Low-stock / Reorder Warning Logic
  console.log('\nStep 19: Testing Low-Stock / Reorder Warning Logic...');
  const lowStockRes = await fetch(`${base}/inventory/low-stock`, { headers: mainHeaders });
  const lowStockData = await lowStockRes.json();
  console.log('Low Stock / Reorder Alerts Count:', lowStockData.length);
  if (lowStockData.length > 0) {
    console.log('Sample Low Stock Alert:', {
      materialName: lowStockData[0].materialName,
      currentQty: lowStockData[0].currentQty,
      reorderLevel: lowStockData[0].reorderLevel,
      minimumStock: lowStockData[0].minimumStock,
      level: lowStockData[0].level,
      message: lowStockData[0].message
    });
  }

  console.log('\n=== FR4 LIVE SYSTEM VERIFICATION FINISHED ===');
}

runFR4Tests().catch(console.error);

// Master Material List for civil engineering / infrastructure works
// (roads, bridges, highways, railways, culverts, retaining walls).
// Consumed by seeder.js to populate the ItemMaster catalog on startup.

// Estimated unit costs (LKR), keyed by materialCode.
const PRICES = {
  MAT0001: 2650, MAT0002: 2750, MAT0003: 3100, MAT0004: 28500, MAT0005: 31500,
  MAT0006: 34500, MAT0007: 38500, MAT0008: 1450, MAT0009: 1850, MAT0010: 3800,
  MAT0101: 12500, MAT0102: 13800, MAT0103: 7500, MAT0104: 10500, MAT0105: 11000,
  MAT0106: 11500, MAT0107: 12000, MAT0108: 8500, MAT0109: 5800, MAT0110: 4500,
  MAT0201: 52000, MAT0202: 49000, MAT0203: 420, MAT0204: 390, MAT0205: 135000,
  MAT0206: 118000, MAT0207: 4900, MAT0208: 5200, MAT0209: 44000, MAT0210: 38000,
  MAT0211: 9500,
  MAT0301: 185000, MAT0302: 15000, MAT0303: 78000, MAT0304: 38000, MAT0305: 9500,
  MAT0306: 8500, MAT0307: 465000, MAT0308: 6500, MAT0309: 650, MAT0310: 2200,
  MAT0401: 1850, MAT0402: 2550, MAT0403: 3400, MAT0404: 4800, MAT0405: 8200,
  MAT0406: 12400, MAT0407: 18500, MAT0408: 28500, MAT0409: 420, MAT0410: 18000,
  MAT0501: 11500, MAT0502: 14500, MAT0503: 7800, MAT0504: 3600, MAT0505: 2800,
  MAT0506: 26500, MAT0507: 6900, MAT0508: 5800,
  MAT0601: 28500, MAT0602: 7500, MAT0603: 9800, MAT0604: 6500, MAT0605: 650,
  MAT0606: 2800, MAT0607: 850, MAT0608: 1950, MAT0609: 1850000, MAT0610: 450,
  MAT0701: 9500, MAT0702: 14500, MAT0703: 22500, MAT0704: 145000, MAT0705: 1250,
  MAT0706: 7500, MAT0707: 12500, MAT0708: 6800, MAT0709: 28000, MAT0710: 22000,
  MAT0801: 28500, MAT0802: 42000, MAT0803: 6500, MAT0804: 6500, MAT0805: 7200,
  MAT0806: 2200, MAT0807: 1650, MAT0808: 3200,
  MAT0901: 8800, MAT0902: 4500, MAT0903: 9500, MAT0904: 12500, MAT0905: 6500,
  MAT0906: 2850, MAT0907: 2650, MAT0908: 650,
  MAT1001: 120, MAT1002: 480, MAT1003: 35, MAT1004: 20, MAT1005: 380, MAT1006: 4200,
  MAT1007: 1850,
  MAT1101: 18500, MAT1102: 12500, MAT1103: 16800, MAT1104: 1950, MAT1105: 1650,
  MAT1106: 3800,
  MAT1201: 1850, MAT1202: 1250, MAT1203: 6800, MAT1204: 450, MAT1205: 650,
  MAT1206: 2250, MAT1207: 850, MAT1208: 3500,
  MAT1301: 180, MAT1302: 450, MAT1303: 2850, MAT1304: 1850, MAT1305: 350, MAT1306: 450,
  MAT1401: 380, MAT1402: 2, MAT1403: 2850, MAT1404: 1450, MAT1405: 380, MAT1406: 850,
};

const group = (category, unit, items) =>
  items.map(([materialCode, materialName]) => ({
    materialCode,
    materialName,
    category,
    unit,
    estimatedUnitCost: PRICES[materialCode] || 0
  }));

export const materialMasterData = [
  // 1. Cement & Concrete Materials
  ...group('Cement & Concrete', 'Bag', [
    ['MAT0001', 'Ordinary Portland Cement (OPC) 50kg'],
    ['MAT0002', 'Portland Pozzolana Cement (PPC) 50kg'],
    ['MAT0003', 'Sulphate Resistant Cement'],
  ]),
  ...group('Cement & Concrete', 'm³', [
    ['MAT0004', 'Ready Mix Concrete Grade 20'],
    ['MAT0005', 'Ready Mix Concrete Grade 25'],
    ['MAT0006', 'Ready Mix Concrete Grade 30'],
    ['MAT0007', 'Ready Mix Concrete Grade 35'],
  ]),
  ...group('Cement & Concrete', 'Litre', [
    ['MAT0008', 'Concrete Admixture'],
    ['MAT0009', 'Water Proofing Admixture'],
  ]),
  ...group('Cement & Concrete', 'Bag', [
    ['MAT0010', 'Grout'],
  ]),

  // 2. Fine & Coarse Aggregates
  ...group('Aggregates', 'm³', [
    ['MAT0101', 'River Sand'],
    ['MAT0102', 'Washed Sand'],
    ['MAT0103', 'Quarry Dust'],
    ['MAT0104', '6mm Aggregate'],
    ['MAT0105', '12mm Aggregate'],
    ['MAT0106', '20mm Aggregate'],
    ['MAT0107', '40mm Aggregate'],
    ['MAT0108', 'Crusher Run'],
  ]),
  ...group('Aggregates', 'Ton', [
    ['MAT0109', 'ABC Aggregate (Aggregate Base Course)'],
    ['MAT0110', 'Sub Base Material'],
  ]),

  // 3. Road Construction Materials
  ...group('Road Construction', 'Ton', [
    ['MAT0201', 'Asphalt Concrete Wearing Course'],
    ['MAT0202', 'Asphalt Binder Course'],
  ]),
  ...group('Road Construction', 'Litre', [
    ['MAT0203', 'Prime Coat'],
    ['MAT0204', 'Tack Coat'],
  ]),
  ...group('Road Construction', 'Drum', [
    ['MAT0205', 'Bitumen VG-30'],
    ['MAT0206', 'Bitumen Emulsion'],
  ]),
  ...group('Road Construction', 'Ton', [
    ['MAT0207', 'Road Base Material'],
    ['MAT0208', 'Granular Sub Base (GSB)'],
    ['MAT0209', 'Dense Bituminous Macadam'],
    ['MAT0210', 'Cold Mix Asphalt'],
  ]),
  ...group('Road Construction', 'Can', [
    ['MAT0211', 'Road Marking Paint'],
  ]),

  // 4. Bridge Construction Materials
  ...group('Bridge Construction', 'Piece', [
    ['MAT0301', 'Prestressed Concrete Beam'],
    ['MAT0302', 'Bearing Pad'],
  ]),
  ...group('Bridge Construction', 'Set', [
    ['MAT0303', 'Expansion Joint'],
  ]),
  ...group('Bridge Construction', 'Piece', [
    ['MAT0304', 'Elastomeric Bearing'],
    ['MAT0305', 'Bridge Deck Drain'],
  ]),
  ...group('Bridge Construction', 'Meter', [
    ['MAT0306', 'Bridge Parapet'],
  ]),
  ...group('Bridge Construction', 'Ton', [
    ['MAT0307', 'Steel Girder'],
  ]),
  ...group('Bridge Construction', 'Meter', [
    ['MAT0308', 'Bridge Handrail'],
  ]),
  ...group('Bridge Construction', 'Piece', [
    ['MAT0309', 'Shear Connector'],
    ['MAT0310', 'Anchor Bolt'],
  ]),

  // 5. Reinforcement Steel
  ...group('Reinforcement Steel', 'Piece', [
    ['MAT0401', '6mm TMT Bar'],
    ['MAT0402', '8mm TMT Bar'],
    ['MAT0403', '10mm TMT Bar'],
    ['MAT0404', '12mm TMT Bar'],
    ['MAT0405', '16mm TMT Bar'],
    ['MAT0406', '20mm TMT Bar'],
    ['MAT0407', '25mm TMT Bar'],
    ['MAT0408', '32mm TMT Bar'],
  ]),
  ...group('Reinforcement Steel', 'Kg', [
    ['MAT0409', 'Steel Binding Wire'],
  ]),
  ...group('Reinforcement Steel', 'Roll', [
    ['MAT0410', 'Welded Wire Mesh'],
  ]),

  // 6. Structural Steel
  ...group('Structural Steel', 'Meter', [
    ['MAT0501', 'I Beam'],
    ['MAT0502', 'H Beam'],
    ['MAT0503', 'Channel Section'],
    ['MAT0504', 'Angle Bar'],
    ['MAT0505', 'Flat Bar'],
  ]),
  ...group('Structural Steel', 'Sheet', [
    ['MAT0506', 'Steel Plate'],
  ]),
  ...group('Structural Steel', 'Meter', [
    ['MAT0507', 'Hollow Section'],
    ['MAT0508', 'Steel Pipe'],
  ]),

  // 7. Railway Materials
  ...group('Railway Materials', 'Meter', [
    ['MAT0601', 'Railway Rail'],
  ]),
  ...group('Railway Materials', 'Piece', [
    ['MAT0602', 'Concrete Sleeper'],
    ['MAT0603', 'Wooden Sleeper'],
  ]),
  ...group('Railway Materials', 'Ton', [
    ['MAT0604', 'Ballast Stone'],
  ]),
  ...group('Railway Materials', 'Piece', [
    ['MAT0605', 'Rail Clip'],
    ['MAT0606', 'Fish Plate'],
    ['MAT0607', 'Rail Bolt'],
    ['MAT0608', 'Base Plate'],
  ]),
  ...group('Railway Materials', 'Set', [
    ['MAT0609', 'Turnout Assembly'],
  ]),
  ...group('Railway Materials', 'Piece', [
    ['MAT0610', 'Rubber Rail Pad'],
  ]),

  // 8. Drainage & Culvert Materials
  ...group('Drainage & Culvert', 'Piece', [
    ['MAT0701', 'RCC Pipe 300mm'],
    ['MAT0702', 'RCC Pipe 450mm'],
    ['MAT0703', 'RCC Pipe 600mm'],
    ['MAT0704', 'Box Culvert Unit'],
  ]),
  ...group('Drainage & Culvert', 'Meter', [
    ['MAT0705', 'HDPE Drain Pipe'],
  ]),
  ...group('Drainage & Culvert', 'Piece', [
    ['MAT0706', 'Catch Pit Cover'],
    ['MAT0707', 'Manhole Cover'],
    ['MAT0708', 'Drain Grating'],
    ['MAT0709', 'Headwall Block'],
  ]),
  ...group('Drainage & Culvert', 'Roll', [
    ['MAT0710', 'Filter Fabric'],
  ]),

  // 9. Geotechnical Materials
  ...group('Geotechnical', 'Roll', [
    ['MAT0801', 'Geotextile Fabric'],
    ['MAT0802', 'Geogrid'],
  ]),
  ...group('Geotechnical', 'Piece', [
    ['MAT0803', 'Gabion Basket'],
  ]),
  ...group('Geotechnical', 'm³', [
    ['MAT0804', 'Rock Fill'],
  ]),
  ...group('Geotechnical', 'Ton', [
    ['MAT0805', 'Riprap Stone'],
  ]),
  ...group('Geotechnical', 'Bag', [
    ['MAT0806', 'Soil Stabilizer'],
    ['MAT0807', 'Lime'],
    ['MAT0808', 'Bentonite'],
  ]),

  // 10. Formwork & Scaffolding
  ...group('Formwork & Scaffolding', 'Piece', [
    ['MAT0901', 'Steel Form Panel'],
    ['MAT0902', 'Timber Formwork'],
  ]),
  ...group('Formwork & Scaffolding', 'Sheet', [
    ['MAT0903', 'Marine Plywood'],
  ]),
  ...group('Formwork & Scaffolding', 'Piece', [
    ['MAT0904', 'Adjustable Steel Prop'],
    ['MAT0905', 'Scaffolding Pipe'],
    ['MAT0906', 'Base Jack'],
    ['MAT0907', 'U Head Jack'],
    ['MAT0908', 'Coupler'],
  ]),

  // 11. Fasteners & Hardware
  ...group('Fasteners & Hardware', 'Piece', [
    ['MAT1001', 'Hex Bolt'],
    ['MAT1002', 'High Tensile Bolt'],
    ['MAT1003', 'Nut'],
    ['MAT1004', 'Washer'],
    ['MAT1005', 'Expansion Bolt'],
  ]),
  ...group('Fasteners & Hardware', 'Tube', [
    ['MAT1006', 'Chemical Anchor'],
  ]),
  ...group('Fasteners & Hardware', 'Box', [
    ['MAT1007', 'Roofing Screw'],
  ]),

  // 12. Waterproofing & Joint Materials
  ...group('Waterproofing & Joints', 'Roll', [
    ['MAT1101', 'Expansion Joint Filler'],
    ['MAT1102', 'Water Stop PVC'],
    ['MAT1103', 'Bituminous Membrane'],
  ]),
  ...group('Waterproofing & Joints', 'Tube', [
    ['MAT1104', 'PU Sealant'],
    ['MAT1105', 'Silicone Sealant'],
  ]),
  ...group('Waterproofing & Joints', 'Litre', [
    ['MAT1106', 'Epoxy Injection Resin'],
  ]),

  // 13. Safety Materials
  ...group('Safety Materials', 'Piece', [
    ['MAT1201', 'Safety Helmet'],
    ['MAT1202', 'Reflective Safety Vest'],
  ]),
  ...group('Safety Materials', 'Pair', [
    ['MAT1203', 'Safety Shoes'],
    ['MAT1204', 'Gloves'],
  ]),
  ...group('Safety Materials', 'Piece', [
    ['MAT1205', 'Safety Goggles'],
    ['MAT1206', 'Traffic Cone'],
  ]),
  ...group('Safety Materials', 'Roll', [
    ['MAT1207', 'Barricade Tape'],
  ]),
  ...group('Safety Materials', 'Piece', [
    ['MAT1208', 'Warning Sign Board'],
  ]),

  // 14. Survey & Site Materials
  ...group('Survey & Site', 'Piece', [
    ['MAT1301', 'Wooden Peg'],
    ['MAT1302', 'Steel Peg'],
  ]),
  ...group('Survey & Site', 'Can', [
    ['MAT1303', 'Marking Paint'],
  ]),
  ...group('Survey & Site', 'Box', [
    ['MAT1304', 'Survey Nail'],
  ]),
  ...group('Survey & Site', 'Piece', [
    ['MAT1305', 'Reflective Marker'],
  ]),
  ...group('Survey & Site', 'Roll', [
    ['MAT1306', 'Nylon String'],
  ]),

  // 15. Miscellaneous
  ...group('Miscellaneous', 'Litre', [
    ['MAT1401', 'Diesel'],
    ['MAT1402', 'Water'],
    ['MAT1403', 'Lubricating Oil'],
  ]),
  ...group('Miscellaneous', 'Kg', [
    ['MAT1404', 'Grease'],
  ]),
  ...group('Miscellaneous', 'Litre', [
    ['MAT1405', 'Generator Fuel'],
    ['MAT1406', 'Cleaning Solvent'],
  ]),
];

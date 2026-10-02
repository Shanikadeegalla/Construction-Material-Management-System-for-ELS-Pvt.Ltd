import fs from 'fs';
import path from 'path';

function findFiles(dir, exts) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(filePath, exts));
    } else {
      if (exts.some(ext => filePath.endsWith(ext))) {
        results.push(filePath);
      }
    }
  });
  return results;
}

const files = findFiles('c:/Users/USER/.gemini/antigravity/scratch/mern-boilerplate/frontend/src', ['.js', '.jsx']);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('\u0000')) {
    content = fs.readFileSync(file, 'utf16le');
  }
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Find all `{ ... }` inside lines that look like JSX
    const regex = /\{([^}]+)\}/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
      const expr = match[1].trim();
      // Skip inline styles: style={{ ... }}
      if (expr.startsWith('{') && expr.endsWith('}')) continue;
      // Skip arrow functions in handlers: onClick={() => ...}
      if (expr.includes('=>') || expr.startsWith('e =>') || expr.startsWith('(e) =>')) continue;
      // Skip comments
      if (expr.startsWith('/*')) continue;

      // Print all interpolations that are NOT basic primitives or standard logic
      // e.g. check if expr could be an object
      const tokens = expr.split(/[\s?:|&()+*-/]+/).filter(Boolean);
      tokens.forEach(tok => {
        // If token is a raw variable or property that might hold a material/project object
        if (/^(item|m|mat|material|doc|notif|alert|n|r|g|po|pr|req|sugg|p|s|row|info|entry|inventory|stock|data)$/i.test(tok) ||
            /\.(material|project|project_id|projectId|supplier|supplierId|user|userId|data|item|inventory)$/i.test(tok)) {
          // Check if this token is printed directly without a safe property access like .name, .materialName, .quantity, .unit, ._id, .status, etc.
          if (!/(\.name|\.materialName|\.quantity|\.unit|\.code|\.materialCode|\.status|\.price|\.unitPrice|\.amount|\.date|\.createdAt|\.updatedAt|\.count|\._id|\.length|\.level|\.message|\.title|\.email|\.role|\.description|\.location|\.reorderLevel|\.minimumStock|\.maximumStock|\.projectName|\.clientName|\.poNumber|\.grnNumber|\.requestNo|\.transferredAt|\.issueDate|\.usageDate|\.available|\.actualQty|\.plannedQty|\.variance|\.totalCost|\.estimatedUnitCost|\.exceedAmount|\.fulfilledQty|\.receivedQty|\.damagedQty|\.insufficientQty|\.id|\.tier|\.fileName|\.filePath)$/i.test(tok)) {
            console.log(`${path.basename(file)}:${idx + 1}: tok: "${tok}" | line: "${line.trim()}"`);
          }
        }
      });
    }
  });
});

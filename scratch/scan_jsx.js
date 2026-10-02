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
    // Look for JSX curly braces containing variable names that might be objects
    // e.g. {item}, {material}, {alert}, {m}, {notif}, {n}, {doc}, {row}, {proj}, {p}, {pr}, {po}
    const curlyRegex = /\{([^}]+)\}/g;
    let match;
    while ((match = curlyRegex.exec(line)) !== null) {
      const expr = match[1].trim();
      // Skip simple strings, boolean expressions, style objects, comments, functions
      if (expr.startsWith('/*') || expr.startsWith('style=') || expr.startsWith('() =>') || expr.includes(':') && !expr.includes('?')) {
        continue;
      }
      // Check if expression is an identifier alone, or a property that might be populated object like item.material, m.materialId, pr.project_id
      if (/^(item|material|mat|alert|notif|n|m|doc|row|g|po|pr|req|sugg)$/.test(expr) || 
          /\.(material|materialId|projectId|project_id|supplierId|supplier|prId|user|userId)$/.test(expr)) {
        console.log(`${path.basename(file)}:${idx + 1}: line: "${line.trim()}" | expr: "{${expr}}"`);
      }
    }
  });
});

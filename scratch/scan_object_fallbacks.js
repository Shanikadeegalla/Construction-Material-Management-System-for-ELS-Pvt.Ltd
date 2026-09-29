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
    // Find all JSX interpolations { ... }
    const regex = /\{([^}]+)\}/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
      const expr = match[1].trim();
      if (expr.includes('||')) {
        const parts = expr.split('||').map(p => p.trim());
        parts.forEach((part, pIdx) => {
          // Check if part ends with a reference to an object field (project, supplier, material, user, etc.)
          if (/(\.project|\.project_id|\.projectId|\.supplier|\.supplierId|\.material|\.materialId|\.user|\.userId|\.prId|\.poId)$/i.test(part) ||
              /^(project|project_id|projectId|supplier|supplierId|material|materialId|user|userId|prId|poId|item|data|mat|m|doc|n|notif)$/i.test(part)) {
            console.log(`${path.basename(file)}:${idx + 1}: part "${part}" in expr "{${expr}}"`);
          }
        });
      }
    }
  });
});

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
    // Search for JSX child interpolations between tags >{...}< or >  {...}  <
    // Or JSX child interpolations in table cells, divs, spans
    const matches = line.match(/>\s*\{([^}]+)\}\s*</g);
    if (matches) {
      matches.forEach(m => {
        const inner = m.replace(/^>\s*\{/, '').replace(/\}\s*</, '').trim();
        // Check if inner expression is suspect
        // Suspect if it contains raw object properties like .supplier, .material, .projectId, .project_id, .user, .item, .mat, or raw variable
        if (/^[a-zA-Z0-9_$]+$/.test(inner) || /\.(supplier|material|project|project_id|projectId|user|userId|item|data)$/.test(inner)) {
          console.log(`${path.basename(file)}:${idx + 1}: expression "{${inner}}" in line: "${line.trim()}"`);
        }
      });
    }
  });
});

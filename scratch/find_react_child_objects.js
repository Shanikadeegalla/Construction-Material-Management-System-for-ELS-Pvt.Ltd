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
    // Look for JSX interpolations inside elements: >...{expr}...<
    const regex = />[^<{]*\{([^}]+)\}[^>}]*</g;
    let match;
    while ((match = regex.exec(line)) !== null) {
      const expr = match[1].trim();
      // Ignore string literals, function calls that return strings/jsx, standard template strings, simple conditions
      if (
        expr.startsWith('"') || expr.startsWith("'") || expr.startsWith('`') ||
        expr.startsWith('format') || expr.startsWith('Number(') || expr.startsWith('String(') ||
        expr.includes('.length') || expr.includes('.toFixed') || expr.includes('.toLocaleString') ||
        expr.includes('&&') || expr.includes('?') || expr.includes('||') ||
        expr.includes('+') || expr.includes('-') || expr.includes('*') || expr.includes('/') ||
        expr.includes('===') || expr.includes('!==') || expr.includes('>') || expr.includes('<') ||
        expr.includes('JSON.stringify') || expr.includes('typeof')
      ) {
        // Let's check if ternary or || might evaluate to an object!
        if (expr.includes('||')) {
          const parts = expr.split('||').map(p => p.trim());
          const lastPart = parts[parts.length - 1];
          // If fallback is an object or raw variable like item.material or m or mat
          if (/^(item|m|mat|material|doc|notif|alert|n|r|g|po|pr|project_id|projectId)$/.test(lastPart) ||
              /\.(material|project_id|projectId|supplier)$/.test(lastPart)) {
            console.log(`POTENTIAL FALLBACK OBJECT: ${path.basename(file)}:${idx + 1}: line: "${line.trim()}" | expr: "{${expr}}"`);
          }
        }
        continue;
      }
      // Direct expressions: {m}, {material}, {item}, {mat}, {doc}, {notif}, {alert}, {n}, {r}, {g}, {po}, {pr}, {project_id}, {projectId}, {m.project_id}, {item.material}, etc.
      if (/^(item|m|mat|material|doc|notif|alert|n|r|g|po|pr|project_id|projectId)$/.test(expr) ||
          /\.(material|project_id|projectId|supplier)$/.test(expr)) {
        console.log(`RAW OBJECT CHILD: ${path.basename(file)}:${idx + 1}: line: "${line.trim()}" | expr: "{${expr}}"`);
      }
    }
  });
});

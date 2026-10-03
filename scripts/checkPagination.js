import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_SRC = path.resolve(__dirname, '../frontend/src');

// Allowlist of files that contain intentionally short / dynamic form lists or small UI elements
// (e.g. form line item rows in modals, dropdown option lists, chart legends, static tabs)
const ALLOWLIST = new Set([
  'DateInput.js',
  'LoadingButton.js',
  'Pagination.js',
  'PaginatedTable.js',
  'ToastContext.js',
  'SettingsPage.js'
]);

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

function checkPaginationInFile(filePath) {
  const basename = path.basename(filePath);
  if (ALLOWLIST.has(basename)) {
    return { ok: true, file: basename, reason: 'Allowlisted short/utility component' };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const hasTable = content.includes('<table') || content.includes('<tbody');

  if (!hasTable) {
    return { ok: true, file: basename };
  }

  const usesPagination =
    content.includes('usePagination') ||
    content.includes('<Pagination') ||
    content.includes('PaginatedTable');

  if (usesPagination) {
    return { ok: true, file: basename };
  }

  return {
    ok: false,
    file: basename,
    filePath,
    reason: 'Renders <table> / <tbody> without importing or using usePagination / <Pagination />'
  };
}

function runCheck() {
  console.log('🔍 Checking frontend codebase for table pagination compliance...\n');
  const files = getAllFiles(FRONTEND_SRC);
  const failures = [];
  let checkedCount = 0;

  files.forEach(file => {
    checkedCount++;
    const res = checkPaginationInFile(file);
    if (!res.ok) {
      failures.push(res);
    }
  });

  if (failures.length > 0) {
    console.error('❌ PAGINATION CHECK FAILED!');
    console.error(`Found ${failures.length} file(s) rendering tables without pagination:\n`);
    failures.forEach(f => {
      console.error(` - ${f.file} (${f.filePath}): ${f.reason}`);
    });
    console.error('\nPlease wrap all table lists with usePagination / <Pagination /> or add to ALLOWLIST with justification.');
    process.exit(1);
  } else {
    console.log(`✅ SUCCESS: All ${checkedCount} components with tables use usePagination / <Pagination />!`);
    process.exit(0);
  }
}

runCheck();

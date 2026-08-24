const fs = require('fs');
const path = require('path');

function walk(dir, list = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) {
      if (it.name === 'node_modules') continue;
      walk(full, list);
    } else if (it.isFile() && it.name.endsWith('.js')) {
      list.push(full);
    }
  }
  return list;
}

const root = process.cwd();
const files = walk(root);
let hasError = false;

console.log('Checking', files.length, 'JS files...');
for (const f of files) {
  try {
    const src = fs.readFileSync(f, 'utf8');
    // Try to parse by creating a Function. This detects SyntaxError in most cases.
    new Function(src);
    console.log('OK', path.relative(root, f));
  } catch (e) {
    console.error('ERR', path.relative(root, f), '-', e && e.message ? e.message : e);
    hasError = true;
  }
}

if (hasError) process.exit(1);
process.exit(0);

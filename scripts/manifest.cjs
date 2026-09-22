const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const preserve = new Set(['config.json', 'module.config.json']);
function walk(relative) {
  const absolute = path.join(root, relative);
  if (fs.statSync(absolute).isFile()) return [relative];
  return fs.readdirSync(absolute).sort().flatMap(name => walk(relative + '/' + name));
}
const files = {};
for (const file of ['index.js', 'module.json', 'module.config.json', 'config.json', 'skills.json', ...walk('libs'), ...walk('skills')].sort()) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex').toUpperCase();
  files[file] = preserve.has(file) ? {overwrite: false, hash} : hash;
}
const result = JSON.stringify({files}, null, 2) + '\n';
const manifest = path.join(root, 'manifest.json');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(manifest) || fs.readFileSync(manifest, 'utf8') !== result) {
    console.error('Manifest is stale. Run node scripts/manifest.cjs before committing.');
    process.exitCode = 1;
  } else console.log('Verified ' + Object.keys(files).length + ' update files.');
} else {
  fs.writeFileSync(manifest, result);
  console.log('Generated manifest for ' + Object.keys(files).length + ' update files.');
}

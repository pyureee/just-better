const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const input = process.argv[2] || '';
const match = input.match(/^(?:https:\/\/github\.com\/)?([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
if (!match || ['.', '..'].includes(match[2])) {
  console.error('Usage: node scripts/configure-repo.cjs OWNER/REPOSITORY');
  process.exit(1);
}
const [, owner, repository] = match;
const infoPath = path.join(root, 'module.json');
const info = JSON.parse(fs.readFileSync(infoPath));
info.servers = [`https://raw.githubusercontent.com/${owner}/${repository}/main/`];
info.disableAutoUpdate = false;
delete info.drmKey;
fs.writeFileSync(infoPath, JSON.stringify(info, null, 2) + '\n');
const configPath = path.join(root, 'module.config.json');
const config = JSON.parse(fs.readFileSync(configPath));
config.disableAutoUpdate = false;
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
require('./manifest.cjs');
console.log('Update source: ' + info.servers[0]);
console.log('This changes the share copy only. Publish and verify it before enabling your installed copy.');

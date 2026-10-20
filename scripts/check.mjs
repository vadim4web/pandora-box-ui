import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json')));
for (const [subpath, target] of Object.entries(pkg.exports)) {
  const data = readFileSync(path.join(root, target), 'utf8');
  if (!data.trim()) throw Error(`Empty export: ${subpath}`);
}
if (!pkg.private) throw Error('Release is intentionally private; verify npm name before removing private.');
console.log('All CSS exports exist; release remains unpublished/private.');

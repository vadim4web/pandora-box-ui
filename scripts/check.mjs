import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json')));
for (const [subpath, target] of Object.entries(pkg.exports)) {
  const data = readFileSync(path.join(root, target), 'utf8');
  if (!data.trim()) throw Error(`Empty export: ${subpath}`);
}
if (pkg.private === true) console.log('All CSS exports exist; private:true currently blocks npm publication.');
else console.log('All CSS exports exist; npm publication is enabled in package metadata.');

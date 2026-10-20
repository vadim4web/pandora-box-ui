import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json')));
for (const [subpath, target] of Object.entries(pkg.exports)) {
  const data = readFileSync(path.join(root, target), 'utf8');
  if (!data.trim()) throw Error(`Empty export: ${subpath}`);
}
if (pkg.private === true) throw Error('Remove private:true before publishing the public package.');
if (pkg.name !== 'pandora-box-ui' || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(pkg.version)) throw Error('Invalid package name or version.');
if (pkg.publishConfig?.registry !== 'https://registry.npmjs.org/' || pkg.publishConfig?.access !== 'public') throw Error('The package must target the public npm registry.');
if (pkg.homepage !== 'https://vadim4web.github.io/pandora-box-ui/') throw Error('The homepage must point to the root Playground.');
if (!pkg.author || !pkg.license || !pkg.repository?.url || !pkg.bugs?.url) throw Error('Author, license, repository and issue tracker metadata are required.');
for (const target of Object.values(pkg.bin || {})) readFileSync(path.join(root,target),'utf8');
for (const file of ['index.html','demo/index.html','demo/demo.js','demo/editor.js']) {
  const sourcePath = path.join(root,file);
  // The source checkout contains the Playground; the runtime tarball excludes it.
  if (!existsSync(sourcePath)) continue;
  if (/\p{Script=Cyrillic}/u.test(readFileSync(sourcePath,'utf8'))) throw Error(`English-only source expected: ${file}`);
}
console.log('CSS exports, CLI and public npm metadata are valid; Playground sources are English-only.');

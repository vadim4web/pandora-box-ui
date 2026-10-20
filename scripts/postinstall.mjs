/** npm runs postinstall for registry/tarball installs (when scripts enabled).
 * Only the installed package's own CSS is updated, never consumer source files.
 */
import {existsSync, lstatSync} from 'node:fs';
import path from 'node:path';
import {packageRoot,writeCompiledCSS,readProjectConfig} from './config-build.mjs';

const root = process.env.INIT_CWD;
if (!root || path.resolve(root) === packageRoot) process.exit(0);
try {
  const {files} = readProjectConfig(root);
  if (files.length === 0) process.exit(0);
  const installed = path.join(root,'node_modules','pandora-box-ui');
  if (!existsSync(installed)) {
    console.log('[pandora-box-ui] Root config found. Run `npx pandora-box-ui build` to generate CSS in the project.');
    process.exit(0);
  }
  // Local `npm install ../pandora-box-ui` creates a symlink on many npm
  // versions. Never change its development sources through postinstall.
  if (lstatSync(installed).isSymbolicLink()) {
    console.log('[pandora-box-ui] Linked development install: run `npx pandora-box-ui build` instead (source files unchanged).');
    process.exit(0);
  }
  const output = path.join(packageRoot,'dist','pandora-box-ui.css');
  const result = writeCompiledCSS(root,output);
  console.log(`[pandora-box-ui] Applied project override from: ${result.files.map(f=>path.basename(f)).join(', ')}`);
} catch(error) {
  console.error(`[pandora-box-ui] Configuration error: ${error.message}`);
  process.exitCode = 1;
}

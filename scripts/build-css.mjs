import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { packageRoot, bundleBase } from './config-build.mjs';
mkdirSync(path.join(packageRoot,'dist'), { recursive: true });
const baseline = bundleBase();
writeFileSync(path.join(packageRoot,'dist','pandora-box-ui.base.css'),baseline);
writeFileSync(path.join(packageRoot,'dist','pandora-box-ui.css'),baseline);
console.log('Built immutable base + default dist/pandora-box-ui.css');

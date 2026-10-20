#!/usr/bin/env node
import path from 'node:path';
import {writeCompiledCSS, writeCompiledHTML} from '../scripts/config-build.mjs';

const args = process.argv.slice(2);
const action = args[0];
if (!['build','help','--help','-h'].includes(action)) {
  console.error('Usage: pandora-box-ui build [--root /path/to/project] [--out ./src/pandora-box-ui.css] [--html ./menu.html]');
  process.exitCode = 1;
} else if (action === 'help' || action?.startsWith('-')) {
  console.log('pandora-box-ui build [--root path] [--out path] [--html path]\nReads root pandora.config.json / pandora.config.css and generates standalone CSS.\n--html also writes a standalone HTML example with item content and a link to that CSS.');
} else {
  function flag(name, fallback) {
    const i = args.indexOf(name);
    if (i === -1) return fallback;
    if (!args[i+1] || args[i+1].startsWith('--')) throw Error(`${name} requires a path`);
    return args[i+1];
  }
  try {
    for (let i = 1; i < args.length; i += 2) {
      if (!['--root', '--out', '--html'].includes(args[i])) throw Error(`Unknown option: ${args[i]}`);
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error(`${args[i]} requires a path`);
    }
    const root = path.resolve(flag('--root',process.cwd()));
    const output = path.resolve(root,flag('--out','./pandora-box-ui.generated.css'));
    const htmlOutput = args.includes('--html') ? path.resolve(root, flag('--html')) : null;
    if (htmlOutput === output) throw Error('--html and --out must use different paths');
    const result = writeCompiledCSS(root,output);
    console.log(`[pandora-box-ui] Generated ${output}`);
    console.log(result.files.length ? `[pandora-box-ui] Applied: ${result.files.map(f=>path.basename(f)).join(', ')}` : '[pandora-box-ui] No root config found; generated defaults.');
    if (htmlOutput) {
      writeCompiledHTML(root, htmlOutput, output);
      console.log(`[pandora-box-ui] Generated ${htmlOutput}`);
    }
  } catch (err) { console.error(`[pandora-box-ui] ${err.message}`); process.exitCode = 1; }
}

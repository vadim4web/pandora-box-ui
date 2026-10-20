import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { renderCSS, writeCompiledCSS, bundleBase, appliedConfigCSS, packageRoot } from './config-build.mjs';
import { normalizeMenuState, renderMenuHTML, renderItemsCSS, sanitizeSVG, safeURL } from './menu-model.mjs';

const temp = mkdtempSync(path.join(os.tmpdir(), 'pandora-test-'));
const jsonFile = path.join(temp, 'pandora.config.json');
const cssFile = path.join(temp, 'pandora.config.css');
const writeConfig = value => writeFileSync(jsonFile, JSON.stringify(value));
const customSVG = '<svg viewBox="0 0 24 24"><path d="M2 2h20v20H2z" fill="currentColor"/></svg>';

try {
  assert.equal(renderCSS(temp).css, bundleBase());
  writeConfig({
    format: 'pandora-box-ui', state: { metal: 'gold', palette: 'ocean', textHover: '#ffeecc', fontSize: 49 },
    variables: { '--pb-menu-front': '#123456' },
    documents: { config: { draft: '.pb-menu { --pb-menu-front: #abcdef; }' }, core: { applied: '.pb-menu { letter-spacing: .2ch; }' } }
  });
  writeFileSync(cssFile, '.pb-menu { --pb-menu-front: #fa8833; }');
  const compiled = renderCSS(temp);
  assert.deepEqual(compiled.files.map(file => path.basename(file)), ['pandora.config.json', 'pandora.config.css']);
  assert.match(compiled.css, /--pb-menu-gradient-0: #1a7285/);
  assert.match(compiled.css, /--pb-menu-font-size: 49px/);
  const ordered = ['--pb-menu-front: #123456', '--pb-menu-front: #abcdef', '--pb-menu-front: #fa8833'].map(item => compiled.css.lastIndexOf(item));
  assert.ok(ordered[0] < ordered[1] && ordered[1] < ordered[2], 'Override priority must be JSON variables < editor CSS < root CSS');
  assert.match(compiled.css, /^@layer pandora-base/m);
  assert.match(compiled.css, /@layer pandora-custom-core \{\s*\.pb-menu \{ letter-spacing: \.2ch;/);
  const out = path.join(temp, 'generated/style.css');
  writeCompiledCSS(temp, out);
  assert.equal(readFileSync(out, 'utf8'), compiled.css);

  assert.equal(appliedConfigCSS({ version: 3, documents: { config: { draft: 'pending', applied: 'shown', dirty: true } } }), 'shown');
  assert.equal(appliedConfigCSS({ version: 3, documents: { config: { draft: 'pending', applied: '', dirty: true } } }), '');
  assert.equal(appliedConfigCSS({ version: 3, documents: { config: { draft: 'clean', applied: '', dirty: false } } }), 'clean');
  assert.equal(appliedConfigCSS({ version: 2, documents: { config: { draft: 'legacy draft', applied: 'old', dirty: true } } }), 'legacy draft');

  const modes = ['normal', 'clip', 'cutout'];
  for (let count = 2; count <= 9; count++) {
    for (const textMode of modes) for (const iconMode of modes) {
      const state = normalizeMenuState({ itemCount: count, textMode, iconMode, maskScale: 1.4, maskX: 35, maskY: 65, maskOpacity: .7 });
      const html = renderMenuHTML(state);
      const css = renderItemsCSS(state);
      assert.equal((html.match(/<li\b/g) || []).length, count, `HTML count ${count} (${textMode}/${iconMode})`);
      assert.equal(state.textMode, textMode);
      assert.equal(state.iconMode, iconMode);
      assert.ok(css.trim(), `Exported CSS ${count} (${textMode}/${iconMode})`);
      assert.ok(!html.includes('contenteditable'), 'Production export must not include editing controls');
      writeConfig({ format: 'pandora-box-ui', version: 3, state });
      assert.ok(renderCSS(temp).css.includes(css), 'The CLI compiler must use the same masks as Playground');
    }
  }

  // State-only exports must retain manually recognized and unknown CSS tokens,
  // including the typography used to bake an actual transparent text opening.
  const stateOnly = {
    itemCount: 2, textMode: 'cutout',
    variables: { '--pb-menu-width': '10em', '--pb-menu-font-family': 'Arial', '--pb-menu-custom-surface': '#abcdef' }
  };
  writeConfig({ format: 'pandora-box-ui', version: 3, state: stateOnly });
  const stateOnlyCSS = renderCSS(temp).css;
  assert.match(stateOnlyCSS, /--pb-menu-width: 10em;/);
  assert.match(stateOnlyCSS, /--pb-menu-font-family: Arial;/);
  assert.match(stateOnlyCSS, /--pb-menu-custom-surface: #abcdef;/);
  const decodedMasks = [...stateOnlyCSS.matchAll(/data:image\/svg\+xml,([^"\s]+)/g)].map(([, encoded]) => decodeURIComponent(encoded));
  assert.ok(decodedMasks.some(svg => svg.includes('viewBox="0 0 1000 ') && svg.includes('font-family="Arial"')), 'State typography must change the baked text cutout geometry');
  writeConfig({ format: 'pandora-box-ui', version: 3, state: stateOnly, variables: { '--pb-menu-width': '11em', '--pb-menu-custom-surface': '#123456' } });
  const topLevelCSS = renderCSS(temp).css;
  const overriddenMasks = [...topLevelCSS.matchAll(/data:image\/svg\+xml,([^"\s]+)/g)].map(([, encoded]) => decodeURIComponent(encoded));
  assert.ok(overriddenMasks.some(svg => svg.includes('viewBox="0 0 1100 ')), 'Top-level variables must override state variables for mask geometry');
  assert.match(topLevelCSS, /--pb-menu-width: 11em;/);
  assert.match(topLevelCSS, /--pb-menu-custom-surface: #123456;/);
  assert.ok(!topLevelCSS.includes('--pb-menu-custom-surface: #abcdef;'));

  const allItems = Array.from({ length: 9 }, (_, i) => ({
    label: `Saved ${i + 1}`, url: `/page-${i + 1}`, icon: customSVG, mask: customSVG,
    variables: { '--pb-menu-text': '#123456', '--pb-menu-width': '10em' }
  }));
  const reduced = normalizeMenuState({ itemCount: 2, items: allItems });
  assert.equal(reduced.items.length, 9, 'Inactive menu items must survive reducing the count');
  const restored = normalizeMenuState({ ...JSON.parse(JSON.stringify(reduced)), itemCount: 9 });
  assert.equal(restored.items[8].label, 'Saved 9');
  assert.equal(restored.items[8].url, '/page-9');
  assert.ok(restored.items[8].mask.includes('<path'));
  assert.equal(restored.items[8].variables['--pb-menu-text'], '#123456');
  assert.ok(renderItemsCSS(restored).includes('#123456'));
  assert.equal(normalizeMenuState({ itemCount: 0 }).itemCount, 2);
  assert.equal(normalizeMenuState({ itemCount: 100 }).itemCount, 9);
  assert.equal(normalizeMenuState({ textMode: 'invalid', iconMode: 'invalid' }).textMode, 'normal');

  const maliciousSVG = '<svg viewBox="0 0 24 24" onload="alert(1)"><script>alert(1)</script><foreignObject><div>bad</div></foreignObject><path d="M0 0h24v24z" onclick="alert(1)" style="fill:url(https://evil.invalid/x)"/></svg>';
  const safeSVG = sanitizeSVG(maliciousSVG);
  assert.ok(safeSVG.includes('<path'));
  assert.doesNotMatch(safeSVG, /script|foreignObject|onload|onclick|style=|https:/i);
  assert.equal(sanitizeSVG('<svg><script>alert(1)</script></svg>'), '');
  for (const unsafeURL of ['javascript:alert(1)', 'data:text/html,bad', '//evil.invalid', 'vbscript:bad']) assert.equal(safeURL(unsafeURL), '#');
  assert.equal(safeURL('https://example.com/path?q=1'), 'https://example.com/path?q=1');
  const untrusted = normalizeMenuState({ itemCount: 2, items: [
    { label: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)', icon: maliciousSVG, mask: maliciousSVG, variables: { '--pb-menu-text': '#fff; color:red', color: 'red' } },
    { label: 'Second', url: '/safe', icon: customSVG }
  ] });
  const safeMarkup = renderMenuHTML(untrusted);
  assert.doesNotMatch(safeMarkup, /<img|javascript:|onload=|onclick=/i);
  assert.ok(safeMarkup.includes('&lt;img'));
  assert.deepEqual(untrusted.items[0].variables, {});
  assert.ok(renderItemsCSS(normalizeMenuState({ itemCount: 2, items: allItems, textMode: 'cutout', iconMode: 'cutout' })).includes('data:image/svg+xml'), 'Alpha masks must be embedded for CSS-only delivery');

  writeConfig({ format: 'pandora-box-ui', version: 3, state: { ...restored, textMode: 'cutout', iconMode: 'clip', metal: 'titanium', palette: 'aurora' }, documents: { config: { draft: '.pb-menu { --pb-menu-text: red; }', applied: '', dirty: true } } });
  const cli = path.join(packageRoot, 'bin', 'pandora-box-ui.mjs');
  const result = spawnSync(process.execPath, [cli, 'build', '--root', temp, '--out', 'consumer assets/menu.css', '--html', 'consumer pages/menu.html'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  const generatedCSS = path.join(temp, 'consumer assets/menu.css');
  const generatedHTML = path.join(temp, 'consumer pages/menu.html');
  assert.ok(existsSync(generatedCSS) && existsSync(generatedHTML));
  const html = readFileSync(generatedHTML, 'utf8');
  assert.equal((html.match(/<li\b/g) || []).length, 9);
  assert.match(html, /href="\.\.\/consumer assets\/menu\.css"/);
  assert.ok(html.includes('Saved 9'));
  assert.doesNotMatch(html, /<script|contenteditable/i);
  assert.ok(!readFileSync(generatedCSS, 'utf8').includes('--pb-menu-text: red;'), 'Pending v3 CSS drafts must not affect consumer output');
  const invalidCLI = spawnSync(process.execPath, [cli, 'build', '--root', temp, '--unknown', 'value'], { encoding: 'utf8' });
  assert.equal(invalidCLI.status, 1, invalidCLI.error?.message || invalidCLI.stderr);
  assert.match(invalidCLI.stderr, /Unknown option/);

  writeConfig({ variables: { body: 'red' } });
  assert.throws(() => renderCSS(temp), /Unsupported CSS variable/);
  writeConfig({ variables: { '--pb-menu-text': '#fff; color:red' } });
  assert.throws(() => renderCSS(temp), /Invalid value/);
  writeConfig({ state: [] });
  assert.throws(() => renderCSS(temp), /state must be an object/);
  writeConfig({ state: { palette: 'custom', customStops: ['#fff'] } });
  assert.throws(() => renderCSS(temp), /exactly five/);
  console.log('OK: 2–9 items × all mode pairs, retained items, SVG/URL safety, CSS-only masks, JSON priority/drafts, external config and consumer CLI HTML/CSS.');
} finally {
  const resolved = path.resolve(temp);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith('pandora-test-'));
  rmSync(resolved, { recursive: true, force: true });
}

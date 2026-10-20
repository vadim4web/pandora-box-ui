/** Dependency-free configuration compiler. No JS config files are evaluated. */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeMenuState, renderMenuHTML, renderItemsCSS } from './menu-model.mjs';

export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const encoding = 'utf8';
const read = file => readFileSync(file, encoding);
const packageVersion = JSON.parse(read(path.join(packageRoot, 'package.json'))).version;

export function bundleBase() {
  const names = ['pandora-menu.css', 'pandora-metals.css', 'pandora-palettes.css'];
  const css = names.map(name => `/* === ${name} === */\n${read(path.join(packageRoot,'src',name)).trim()}`).join('\n\n');
  // Project overrides are UNLAYERED. They override defaults/presets regardless
  // of selector specificity; no !important is needed, and base remains portable.
  return `/* PandoraBox UI v${packageVersion} · CSS-only base · layer: pandora-base */\n@layer pandora-base {\n${css}\n}\n`;
}

const allowedVars = /^--pb-menu-[a-z0-9-]+$/;
const allowedValue = value => typeof value === 'string' || typeof value === 'number';
function declarationEntries(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw Error('"variables" must be an object of CSS tokens');
  return Object.entries(values).map(([name,value]) => {
    if (!allowedVars.test(name)) throw Error(`Unsupported CSS variable: ${name}`);
    if (!allowedValue(value) || /[;{}\r\n]/.test(String(value))) throw Error(`Invalid value for ${name}`);
    return `  ${name}: ${String(value).trim()};`;
  });
}
function presetTokens(type, name) {
  if (name === 'custom') return [];
  if (!/^[a-z-]+$/.test(name)) throw Error(`Invalid ${type} name`);
  const filename = type === 'metal' ? 'pandora-metals.css' : 'pandora-palettes.css';
  const selector = type === 'metal' ? 'data-pb-metal' : 'data-pb-palette';
  const css = read(path.join(packageRoot,'src',filename));
  const match = css.match(new RegExp(`\\.pb-menu\\[${selector}="${name}"\\]\\s*\\{([^}]+)\\}`));
  if (!match) throw Error(`Unknown ${type} preset: ${name}`);
  return [...match[1].matchAll(/(--pb-menu-[\w-]+):\s*([^;]+);/g)].map(([,key,value]) => [key,value.trim()]);
}
function stateTokens(state) {
  if (!state) return {};
  if (typeof state !== 'object' || Array.isArray(state)) throw Error('state must be an object');
  const values = {};
  for (const type of ['metal','palette']) {
    if (state[type]) Object.assign(values,Object.fromEntries(presetTokens(type,state[type])));
  }
  if (state.metal === 'custom' && state.metalCustom) values['--pb-menu-front'] = state.metalCustom;
  if (state.palette === 'custom' && Array.isArray(state.customStops)) {
    if (state.customStops.length !== 5) throw Error('customStops must contain exactly five colors');
    state.customStops.forEach((value,i)=>{values[`--pb-menu-gradient-${i}`] = value;});
  }
  const colors = {textIdle:'text',textHover:'hover-text',iconIdle:'icon-color',iconHover:'hover-icon-color'};
  for (const [field,token] of Object.entries(colors)) {
    if (state[field]) values[`--pb-menu-${token}`] = state[field];
  }
  const numeric = {fontSize:['font-size','px'],offset:['hover-offset','%'],moveDuration:['move-duration','ms'],colorDuration:['color-duration','ms'],overlap:['item-overlap','px']};
  for (const [field,[token,unit]] of Object.entries(numeric)) {
    if (typeof state[field] === 'number' && Number.isFinite(state[field])) values[`--pb-menu-${token}`] = `${state[field]}${unit}`;
  }
  return values;
}

export function readProjectConfig(projectRoot) {
  const jsonPath = path.join(projectRoot,'pandora.config.json');
  const cssPath = path.join(projectRoot,'pandora.config.css');
  const result = { json: existsSync(jsonPath) ? JSON.parse(read(jsonPath)) : null,
    css: existsSync(cssPath) ? read(cssPath) : '',
    files: [jsonPath,cssPath].filter(existsSync) };
  if (result.json && (typeof result.json !== 'object' || Array.isArray(result.json))) throw Error('pandora.config.json must be an object');
  return result;
}

// Version 3 keeps pending editor drafts separate from the CSS actually shown
// in the preview. Version 2 retains its original draft-first build behavior.
export function appliedConfigCSS(json) {
  const doc = json.documents?.config;
  if (Number(json.version) >= 3 && doc) {
    if (typeof doc.applied === 'string' && doc.applied.trim()) return doc.applied;
    return doc.dirty !== true && typeof doc.draft === 'string' ? doc.draft : '';
  }
  return doc?.draft ?? json.css;
}

export function compileProjectConfig(projectRoot) {
  const { json, css, files } = readProjectConfig(projectRoot);
  const parts = [];
  let coreCSS = '';
  if (json) {
    if (json.format && json.format !== 'pandora-box-ui') throw Error('Unsupported config format');
    if (json.state !== undefined && (!json.state || typeof json.state !== 'object' || Array.isArray(json.state))) throw Error('state must be an object');
    // An applied Core CSS snapshot from the Playground is a real component
    // override; HTML remains an application markup concern, not CSS.
    const customCore = json.documents?.core?.applied;
    if (typeof customCore === 'string' && customCore.trim()) {
      coreCSS = `\n/* === CUSTOM CORE FROM PLAYGROUND === */\n@layer pandora-custom-core {\n${customCore}\n}\n`;
    }
    const menuState = normalizeMenuState(json.state || {});
    const stateVariables = json.state?.variables || {};
    const projectVariables = json.variables || {};
    declarationEntries(stateVariables);
    declarationEntries(projectVariables);
    const customVariables = { ...stateVariables, ...projectVariables };
    // Per-item tokens include precomputed SVG masks. They work in a plain
    // stylesheet, with no editor or JavaScript on the consuming website.
    if (json.state && ['items','itemCount','textMode','iconMode','maskScale','maskX','maskY','maskOpacity'].some(key => key in json.state)) {
      const itemsCSS = renderItemsCSS({ ...menuState, variables: customVariables, fontSize: json.state.fontSize });
      if (itemsCSS.trim()) parts.push(`/* Menu items and alpha masks */\n${itemsCSS}`);
    }
    const vars = {...stateTokens(json.state), ...customVariables};
    const declarations = declarationEntries(vars);
    if (declarations.length) parts.push(`/* JSON configuration · ${path.basename('pandora.config.json')} */\n.pb-menu {\n${declarations.join('\n')}\n}`);
    const studioCSS = appliedConfigCSS(json);
    if (studioCSS !== undefined) {
      if (typeof studioCSS !== 'string') throw Error('config CSS must be a string');
      if (studioCSS.trim()) parts.push(`/* Config CSS from Playground */\n${studioCSS}`);
    }
  }
  if (css.trim()) parts.push(`/* Project CSS · pandora.config.css · final priority */\n${css}`);
  return {files, coreCSS, css:parts.length ? `\n/* === PROJECT OVERRIDES (highest priority) === */\n${parts.join('\n\n')}\n` : ''};
}
export function renderCSS(projectRoot) {
  const {css,coreCSS,files} = compileProjectConfig(projectRoot);
  return {css:bundleBase()+coreCSS+css, files};
}
export function writeCompiledCSS(projectRoot, outfile) {
  const {css,files} = renderCSS(projectRoot);
  mkdirSync(path.dirname(outfile),{recursive:true});
  writeFileSync(outfile,css);
  return {files,outfile};
}

const escapeAttribute = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

/** Optional companion markup; CSS compilation never modifies app HTML. */
export function renderProjectHTML(projectRoot, stylesheet = './pandora-box-ui.generated.css') {
  const { json, files } = readProjectConfig(projectRoot);
  if (json?.format && json.format !== 'pandora-box-ui') throw Error('Unsupported config format');
  const state = { ...json?.state, ...normalizeMenuState(json?.state || {}) };
  const markup = renderMenuHTML(state);
  const html = `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>PandoraBox UI</title>\n  <link rel="stylesheet" href="${escapeAttribute(stylesheet)}">\n  <style>body { display: grid; place-items: center; min-height: 100vh; margin: 0; background: radial-gradient(circle, #535863, #151820); } .my-navigation { padding: 5rem 3rem; }</style>\n</head>\n<body>\n${markup}\n</body>\n</html>\n`;
  return { html, files };
}

export function writeCompiledHTML(projectRoot, outfile, stylesheetFile) {
  const stylesheet = stylesheetFile ? path.relative(path.dirname(outfile), stylesheetFile).split(path.sep).join('/') : './pandora-box-ui.generated.css';
  const { html, files } = renderProjectHTML(projectRoot, stylesheet);
  mkdirSync(path.dirname(outfile), { recursive: true });
  writeFileSync(outfile, html);
  return { files, outfile };
}

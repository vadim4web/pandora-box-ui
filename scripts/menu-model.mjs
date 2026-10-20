/** Shared, dependency-free menu model for the Playground and the npm compiler. */
const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = content => `<svg xmlns="${SVG_NS}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;

export const DEFAULT_ITEMS = Object.freeze([
  {label:'Home', url:'#home', icon:svg('<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>')},
  {label:'Projects', url:'#projects', icon:svg('<path d="M3 5h7l2 3h9v11H3z"/><path d="M3 8h18"/>')},
  {label:'Lab', url:'#lab', icon:svg('<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 4l-4 16"/>')},
  {label:'About', url:'#about', icon:svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3.5-7 8-7s8 2 8 7"/>')},
  {label:'Contact', url:'#contact', icon:svg('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>')}
].map(item => Object.freeze({...item, mask:'', variables:Object.freeze({})})));

const escapeXML = value => String(value)
  .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g, character => character.length === 2 ? character : '\ufffd')
  .replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;'}[character]));
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const number = (value, fallback, min, max) => {
  const parsed = typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};
const mode = value => ['normal','clip','cutout'].includes(value) ? value : 'normal';

/** Only application navigation URLs are accepted; no executable or embedded data. */
export function safeURL(source) {
  if (typeof source !== 'string') return '#';
  const value = source.trim();
  if (!value || /[\u0000-\u0020\u007f\\<>]/.test(value) || value.startsWith('//')) return '#';
  const scheme = value.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme) {
    if (!/^(https?|mailto)$/i.test(scheme[1])) return '#';
    if (/^https?:/i.test(value)) {
      try { const parsed = new URL(value); if (!parsed.hostname) return '#'; } catch { return '#'; }
    }
  } else if (value.includes(':') && !/^[#/?]/.test(value)) return '#';
  return value;
}

const tags = new Set(['svg','g','path','circle','ellipse','rect','line','polyline','polygon']);
const shapes = new Set(['path','circle','ellipse','rect','line','polyline','polygon']);
const coordinates = new Set(['x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','width','height','stroke-width','stroke-dashoffset']);
const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%?$/i;
const numbers = /^[\deE+.,\s-]+$/;
const paint = /^(?:none|currentColor|transparent|[a-z]{1,24}|#[\da-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([\d.,%+\s/-]+\))$/i;

function safeAttribute(name, value) {
  if (name === 'viewBox') {
    const values = value.trim().split(/[\s,]+/).map(Number);
    return values.length === 4 && values.every(v => Number.isFinite(v) && Math.abs(v) <= 1e7) && values[2] > 0 && values[3] > 0;
  }
  if (name === 'd') return value.length <= 40000 && /^[MmZzLlHhVvCcSsQqTtAaEe\d+.,\s-]*$/.test(value);
  if (name === 'points' || name === 'stroke-dasharray') return value === 'none' || numbers.test(value);
  if (coordinates.has(name)) return decimal.test(value) && Math.abs(parseFloat(value)) <= 1e7;
  if (['opacity','fill-opacity','stroke-opacity'].includes(name)) return decimal.test(value) && Number(value) >= 0 && Number(value) <= 1;
  if (name === 'fill' || name === 'stroke' || name === 'color') return paint.test(value);
  if (name === 'fill-rule' || name === 'clip-rule') return /^(nonzero|evenodd)$/.test(value);
  if (name === 'stroke-linecap') return /^(butt|round|square)$/.test(value);
  if (name === 'stroke-linejoin') return /^(miter|round|bevel)$/.test(value);
  if (name === 'stroke-miterlimit') return decimal.test(value);
  if (name === 'vector-effect') return value === 'non-scaling-stroke' || value === 'none';
  if (name === 'preserveAspectRatio') return /^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?:\s+(?:meet|slice))?)$/.test(value);
  if (name === 'transform') return /^(?:\s*(?:matrix|translate|scale|rotate|skewX|skewY)\([\deE+.,\s-]+\)\s*)+$/.test(value);
  return false;
}

/**
 * Reconstruct SVG from a shape/attribute allowlist, without a DOM dependency.
 * Unsupported subtrees and references never reach the returned markup. Text,
 * CSS, SMIL, foreignObject, use, images and external resources are not allowed.
 */
export function sanitizeSVG(source) {
  if (typeof source !== 'string' || source.length > 65536) return '';
  const input = source.replace(/<!--[\s\S]*?-->/g, '').trim();
  const output = [], stack = [];
  let cursor = 0, root = false, closed = false, shapeCount = 0;
  while (cursor < input.length) {
    const start = input.indexOf('<', cursor);
    if (start < 0) break;
    let end = start + 1, quote = '';
    for (; end < input.length; end++) {
      const character = input[end];
      if (quote) { if (character === quote) quote = ''; }
      else if (character === '"' || character === "'") quote = character;
      else if (character === '>') break;
    }
    if (end >= input.length) return '';
    const token = input.slice(start + 1, end).trim();
    cursor = end + 1;
    if (/^[!?]/.test(token)) continue;
    const match = token.match(/^(\/?)\s*([a-z][\w:.-]*)([\s\S]*)$/i);
    if (!match) return '';
    const closing = !!match[1], tag = match[2], tail = match[3];
    if (closing) {
      const entry = stack.pop();
      if (!entry || entry.tag !== tag || tail.trim()) return '';
      if (entry.keep) output.push(`</${tag}>`);
      if (tag === 'svg' && !stack.length) closed = true;
      continue;
    }
    if (closed) return '';
    const selfClosing = /\/\s*$/.test(tail);
    const parent = stack[stack.length - 1];
    const keep = tags.has(tag) && (!parent || parent.keep) && (root || tag === 'svg');
    if (!root) {
      if (tag !== 'svg') return '';
      root = true;
    }
    if (keep) {
      const attributes = [];
      const body = tail.replace(/\/\s*$/, '');
      const pattern = /\s+([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
      const seen = new Set();
      for (const attribute of body.matchAll(pattern)) {
        const name = attribute[1], value = attribute[2] ?? attribute[3] ?? attribute[4];
        if (!seen.has(name) && safeAttribute(name, value)) {
          seen.add(name); attributes.push(`${name}="${escapeXML(value)}"`);
        }
      }
      if (tag === 'svg' && !parent) {
        attributes.unshift(`xmlns="${SVG_NS}"`);
        if (!seen.has('viewBox')) attributes.push('viewBox="0 0 24 24"');
      }
      output.push(`<${tag}${attributes.length ? ' ' + attributes.join(' ') : ''}${selfClosing ? '/>' : '>'}`);
      if (shapes.has(tag)) shapeCount++;
    }
    if (!selfClosing) stack.push({tag, keep});
    else if (tag === 'svg' && !stack.length) closed = true;
  }
  return root && closed && !stack.length && shapeCount ? output.join('') : '';
}

function safeVariables(source) {
  const result = {};
  for (const [name,value] of Object.entries(record(source))) {
    if (!/^--pb-menu-[a-z0-9-]+$/.test(name) || !['string','number'].includes(typeof value)) continue;
    const token = String(value).trim();
    if (!token || token.length > 2000 || /[;{}<>\\\u0000-\u001f\u007f]|\/\*|\*\/|url\s*\(|expression\s*\(|@import|!important/i.test(token)) continue;
    result[name] = token;
  }
  return result;
}

export function normalizeMenuState(raw = {}) {
  const state = record(raw);
  const itemCount = Math.round(number(state.itemCount, 5, 2, 9));
  const source = Array.isArray(state.items) ? state.items.slice(0,9) : [];
  const items = Array.from({length:Math.max(5, itemCount, source.length)}, (_, index) => {
    const fallback = DEFAULT_ITEMS[index % DEFAULT_ITEMS.length];
    const item = record(source[index]);
    return {
      label:typeof item.label === 'string' ? item.label.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0,200) : index < 5 ? fallback.label : `Item ${index + 1}`,
      url:safeURL(item.url ?? (index < 5 ? fallback.url : `#item-${index + 1}`)),
      icon:sanitizeSVG(item.icon) || fallback.icon,
      mask:sanitizeSVG(item.mask),
      variables:safeVariables(item.variables)
    };
  });
  return {
    itemCount, items,
    textMode:mode(state.textMode), iconMode:mode(state.iconMode),
    maskScale:number(state.maskScale,1,.25,3),
    maskX:number(state.maskX,50,0,100), maskY:number(state.maskY,50,0,100),
    maskOpacity:number(state.maskOpacity,1,0,1)
  };
}

export function renderMenuHTML(raw = {}) {
  raw = record(raw);
  const state = normalizeMenuState(raw);
  const preset = (value, fallback) => typeof value === 'string' && /^[a-z][a-z0-9-]*$/.test(value) ? value : fallback;
  return `<nav class="my-navigation" aria-label="Main navigation">\n  <ul class="pb-menu" data-pb-metal="${preset(raw.metal,'steel')}" data-pb-palette="${preset(raw.palette,'rainbow')}" data-pb-item-count="${state.itemCount}" data-pb-text-mode="${state.textMode}" data-pb-icon-mode="${state.iconMode}">\n${state.items.slice(0,state.itemCount).map(item => `    <li class="pb-menu__item">\n      <span class="pb-menu__icon" aria-hidden="true">${item.icon}</span>\n      <a class="pb-menu__link" href="${escapeXML(item.url)}"><span class="pb-menu__label">${escapeXML(item.label)}</span></a>\n    </li>`).join('\n')}\n  </ul>\n</nav>`;
}

const image = source => `url("data:image/svg+xml,${encodeURIComponent(source).replace(/'/g,'%27').replace(/\(/g,'%28').replace(/\)/g,'%29')}")`;
const n = value => Number(value.toFixed(7));

function alphaSVG(source, color = 'white') {
  // Alpha masks ignore color. Preserve authored fills, strokes and their alpha,
  // including rgba()/hex-alpha; only currentColor needs an explicit context.
  return source.replace(/^<svg\b([^>]*)>/, (_match, attrs) => `<svg${attrs.replace(/\scolor="[^"]*"/g,'')} color="${color}">`);
}

function geometryFor(raw, item) {
  const variables = {...safeVariables(raw.variables), ...item.variables};
  const fontToken = String(variables['--pb-menu-font-size'] ?? '').trim().match(/^([\d.]+)(px|rem|em)$/);
  const fontPixels = fontToken ? number(Number(fontToken[1]) * (fontToken[2] === 'px' ? 1 : 16),48,1,1000) : number(raw.fontSize,48,1,1000);
  const lengthInEm = (value, fallback) => {
    const match = String(value ?? '').trim().match(/^([\d.]+)(em|px|rem)$/);
    if (!match) return fallback;
    const result = Number(match[1]) * (match[2] === 'px' ? 1 / fontPixels : match[2] === 'rem' ? 16 / fontPixels : 1);
    return Number.isFinite(result) && result > .1 && result <= 100 ? result : fallback;
  };
  const weight = String(variables['--pb-menu-font-weight'] ?? raw.fontWeight ?? 800);
  return {
    width:lengthInEm(variables['--pb-menu-width'],8.5) * 100,
    height:120.5833333,
    fontFamily:variables['--pb-menu-font-family'] || raw.fontFamily || "Georgia, 'Times New Roman', Times, serif",
    fontWeight:/^(?:[1-9]\d{0,2}|1000|normal|bold)$/.test(weight) ? weight : '800',
    iconSize:number(parseFloat(variables['--pb-menu-icon-size']),55,1,300) / 100
  };
}

function inverseText(item, state, geometry) {
  const {width,height,fontFamily,fontWeight} = geometry;
  // The SVG and label share configured typography, including the .075ch spacing.
  // Full-surface alpha masking keeps the face transparent at the letter shapes.
  const scale = state.maskScale;
  const offsetX = (width - width * scale) * state.maskX / 100;
  const offsetY = (height - height * scale) * state.maskY / 100;
  const text = `<text x="75" y="${height / 2}" dominant-baseline="central" font-family="${escapeXML(fontFamily)}" font-size="100" font-weight="${fontWeight}" letter-spacing=".075ch" fill="black">${escapeXML(item.label)}</text>`;
  return image(`<svg xmlns="${SVG_NS}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><defs><mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" style="mask-type:luminance"><rect width="${width}" height="${height}" fill="white"/><g opacity="${state.maskOpacity}" transform="translate(${n(offsetX)} ${n(offsetY)}) scale(${scale})">${text}</g></mask></defs><rect width="${width}" height="${height}" fill="white" mask="url(#cut)"/></svg>`);
}

function inverseIcon(item, state, geometry) {
  const width = geometry.width / 2, height = geometry.height / .9681476404;
  const iconWidth = width * geometry.iconSize * state.maskScale, iconHeight = height * geometry.iconSize * state.maskScale;
  const x = (width - iconWidth) * state.maskX / 100, y = (height - iconHeight) * state.maskY / 100;
  const content = alphaSVG(item.mask || item.icon, 'black').replace(/^<svg\b([^>]*)>/, (_match, attrs) => `<svg${attrs.replace(/\s(?:x|y|width|height)="[^"]*"/g,'')} x="${n(x)}" y="${n(y)}" width="${n(iconWidth)}" height="${n(iconHeight)}">`);
  // A color matrix makes the graphic black while retaining every alpha channel.
  const filter = '<filter id="black" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"/></filter>';
  return image(`<svg xmlns="${SVG_NS}" viewBox="0 0 ${width} ${n(height)}" preserveAspectRatio="none"><defs>${filter}<mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${n(height)}" style="mask-type:luminance"><rect width="${width}" height="${n(height)}" fill="white"/><g opacity="${state.maskOpacity}" filter="url(#black)">${content}</g></mask></defs><rect width="${width}" height="${n(height)}" fill="white" mask="url(#cut)"/></svg>`);
}

/** CSS is standalone: the exported HTML needs no Playground JavaScript. */
export function renderItemsCSS(raw = {}, selector = '.pb-menu') {
  raw = record(raw);
  if (typeof selector !== 'string' || !selector.trim() || /[{};<>\r\n]/.test(selector)) throw Error('Invalid menu CSS selector');
  const state = normalizeMenuState(raw);
  const lines = [
    `/* PandoraBox menu data: ${encodeURIComponent(JSON.stringify(state))} */`,
    `/* Menu items and alpha masks · generated from saved item data */`,
    `${selector} {`,
    `  --pb-menu-text-mode: ${state.textMode};`,
    `  --pb-menu-icon-mode: ${state.iconMode};`,
    `  --pb-menu-mask-scale: ${state.maskScale};`,
    `  --pb-menu-mask-x: ${state.maskX}%;`,
    `  --pb-menu-mask-y: ${state.maskY}%;`,
    `  --pb-menu-mask-opacity: ${state.maskOpacity};`,
    `}`
  ];
  state.items.slice(0,state.itemCount).forEach((item, index) => {
    const geometry = geometryFor(raw,item);
    const clip = image(alphaSVG(item.mask || item.icon, 'white'));
    const variables = {
      '--pb-menu-text-clip':state.textMode === 'clip' ? clip : 'none',
      '--pb-menu-front-mask':state.textMode === 'cutout' ? inverseText(item,state,geometry) : 'none',
      '--pb-menu-label-opacity':state.textMode === 'cutout' ? 0 : state.textMode === 'clip' ? 'var(--pb-menu-mask-opacity)' : 1,
      '--pb-menu-icon-clip':state.iconMode === 'clip' ? clip : 'none',
      '--pb-menu-side-mask':state.iconMode === 'cutout' ? inverseIcon(item,state,geometry) : 'none',
      '--pb-menu-icon-opacity':state.iconMode === 'cutout' ? 0 : state.iconMode === 'clip' ? 'var(--pb-menu-mask-opacity)' : 1,
      ...item.variables
    };
    lines.push(`${selector} > .pb-menu__item:nth-child(${index + 1}) {`,...Object.entries(variables).map(([name,value]) => `  ${name}: ${value};`),'}');
  });
  return lines.join('\n');
}

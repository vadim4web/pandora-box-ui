/** Shared default theme; keep the Playground, source CSS and npm bundle aligned. */
import { normalizeMenuState, renderItemsCSS } from './menu-model.mjs';

const stops = ['#9b473d', '#bf623a', '#c28b3a', '#aaa34a', '#678e69'];
export function createDefaultState() {
  return {
    metal: 'obsidian', palette: 'solar', metalCustom: '#333740', customStops: [...stops],
    textIdle: '#305085', textHover: '#302565', iconIdle: '#2657a6', iconHover: '#2b00ff',
    fontSize: 60, offset: -12, moveDuration: 857, colorDuration: 1000, overlap: 1.5,
    ...normalizeMenuState({ itemCount: 5, textMode: 'cutout', iconMode: 'cutout', maskScale: .95 }),
    variables: { '--pb-menu-top-light': '23%', '--pb-menu-side-shade': '30%', '--pb-menu-edge-light': '19%' }
  };
}

export function defaultTokens() {
  const state = createDefaultState();
  return {
    '--pb-menu-front': state.metalCustom,
    ...state.variables,
    '--pb-menu-text': state.textIdle, '--pb-menu-hover-text': state.textHover,
    '--pb-menu-icon-color': state.iconIdle, '--pb-menu-hover-icon-color': state.iconHover,
    ...Object.fromEntries(stops.map((color, index) => [`--pb-menu-gradient-${index}`, color])),
    '--pb-menu-font-size': `${state.fontSize}px`, '--pb-menu-hover-offset': `${state.offset}%`,
    '--pb-menu-move-duration': `${state.moveDuration}ms`, '--pb-menu-color-duration': `${state.colorDuration}ms`,
    '--pb-menu-item-overlap': `${state.overlap}px`, '--pb-menu-mask-scale': String(state.maskScale)
  };
}

const marker = '/* Generated default Cutout theme — scripts/default-theme.mjs */';
export function applyDefaultTheme(source) {
  let core = source.split(marker)[0].trimEnd();
  const tokens = defaultTokens();
  core = core.replace(/\.pb-menu \{([\s\S]*?)\n\}/, (rule, body) => {
    const missing = new Set(Object.keys(tokens));
    body = body.replace(/(\s*)(--pb-menu-[\w-]+):\s*([^;]+);/g, (declaration, space, key) => {
      if (!(key in tokens)) return declaration;
      missing.delete(key); return `${space}${key}: ${tokens[key]};`;
    });
    return `.pb-menu {${body}${[...missing].map(key => `\n  ${key}: ${tokens[key]};`).join('')}\n}`;
  });
  // Low-specificity enhanced-item selectors preserve legacy direct-text links
  // and let exported normal/clip/custom masks override these baked defaults.
  const masks = renderItemsCSS(createDefaultState())
    .replace(/\/\* PandoraBox menu data: [\s\S]*?\*\/\n/, '')
    .replaceAll('> .pb-menu__item:nth-child', '> :where(.pb-menu__item:has(.pb-menu__label)):nth-child');
  return `${core}\n\n${marker}\n${masks}\n`;
}

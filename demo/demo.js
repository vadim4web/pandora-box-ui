/* PandoraBox UI v0.2.0 — only for the interactive demo.
   The actual Pandora Menu component remains CSS-only. */
import { normalizeMenuState, renderMenuHTML, renderItemsCSS, sanitizeSVG, safeURL } from '../scripts/menu-model.mjs';
(() => {
  'use strict';
  let menu = document.querySelector('#menu');
  const STORAGE_KEY = 'pandora-box-ui:playground:v0.2.0';
  const LAST_STORAGE_KEY = 'pandora-box-ui:playground:v0.1.6';
  const PRIOR_STORAGE_KEY = 'pandora-box-ui:playground:v0.1.4';
  const metals = new Set([...document.querySelectorAll('[data-metal]')].map(el => el.dataset.metal));
  const palettes = new Set([...document.querySelectorAll('[data-palette]')].map(el => el.dataset.palette));
  const defaults = () => ({
    metal: 'steel', palette: 'rainbow',
    metalCustom: '#808080',
    customStops: ['#009db2','#40bbbc','#d8b52e','#ce7175','#a84aaf'],
    textIdle: null, textHover: null, iconIdle: null, iconHover: null,
    fontSize: 44, offset: -5, moveDuration: 857, colorDuration: 1000, overlap: 1,
    ...normalizeMenuState({}), variables: {}
  });
  const colorVars = {
    textIdle: '--pb-menu-text',
    textHover: '--pb-menu-hover-text',
    iconIdle: '--pb-menu-icon-color',
    iconHover: '--pb-menu-hover-icon-color'
  };
  const sliderVars = {
    fontSize: ['--pb-menu-font-size','px',26,60],
    offset: ['--pb-menu-hover-offset','%',-12,0],
    moveDuration: ['--pb-menu-move-duration','ms',0,1500],
    colorDuration: ['--pb-menu-color-duration','ms',0,2000],
    overlap: ['--pb-menu-item-overlap','px',0,4]
  };
  const validHex = /^#[a-f\d]{6}$/i;
  const normalizeHex = value => {
    const v = String(value || '').trim();
    if (/^#[\da-f]{3}$/i.test(v)) return `#${[...v.slice(1)].map(c => c+c).join('')}`.toLowerCase();
    return validHex.test(v) ? v.toLowerCase() : null;
  };
  function contrastText(hex) {
    const n = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255)
      .map(c => c <= .04045 ? c / 12.92 : ((c+.055)/1.055)**2.4);
    return (n[0]*.2126+n[1]*.7152+n[2]*.0722) > .28 ? '#17212a' : '#ffffff';
  }
  function sanitizeState(raw) {
    const clean = defaults();
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      if (raw.variables && typeof raw.variables === 'object' && !Array.isArray(raw.variables)) {
        for (const [name,value] of Object.entries(raw.variables)) if (/^--pb-menu-[a-z0-9-]+$/.test(name) && ['string','number'].includes(typeof value) && !/[;{}<>\r\n]/.test(String(value))) clean.variables[name] = String(value);
      }
      if (metals.has(raw.metal)) clean.metal = raw.metal;
      if (palettes.has(raw.palette)) clean.palette = raw.palette;
      if (normalizeHex(raw.metalCustom)) clean.metalCustom = normalizeHex(raw.metalCustom);
      if (Array.isArray(raw.customStops) && raw.customStops.length === 5 && raw.customStops.every(c => normalizeHex(c))) clean.customStops = raw.customStops.map(normalizeHex);
      for (const name of Object.keys(colorVars)) if (normalizeHex(raw[name])) clean[name] = normalizeHex(raw[name]);
      for (const [name,[, ,min,max]] of Object.entries(sliderVars)) {
        if (typeof raw[name] === 'number' && Number.isFinite(raw[name])) clean[name] = Math.min(max,Math.max(min,raw[name]));
      }
    }
    return Object.assign(clean, normalizeMenuState(raw || {}));
  }
  function loadState() {
    try {
      return sanitizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LAST_STORAGE_KEY) || localStorage.getItem(PRIOR_STORAGE_KEY) || '{}'));
    } catch (_) { return defaults(); }
  }
  let state = loadState();
  let editMode = false;
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {} }
  function computed(variable) { return getComputedStyle(menu).getPropertyValue(variable).trim(); }
  function getStops() { return Array.from({length:5},(_,i) => normalizeHex(computed(`--pb-menu-gradient-${i}`)) || defaults().customStops[i]); }
  function effectiveColor(name) {
    if (state[name]) return state[name];
    if (name === 'iconIdle') return effectiveColor('textIdle');
    if (name === 'iconHover') return effectiveColor('textHover');
    if (name === 'textIdle' && state.metal === 'custom') return contrastText(state.metalCustom);
    return normalizeHex(computed(colorVars[name])) || '#ffffff';
  }
  function reflectChoices(kind) {
    document.querySelectorAll(`[data-${kind}]`).forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset[kind] === state[kind]));
    });
  }
  function reflectMetal() {
    const active = state.metal === 'custom' ? state.metalCustom : normalizeHex(computed('--pb-menu-front')) || '#808080';
    document.querySelector('#metal-color').value = active;
    document.querySelector('#metal-hex').value = active.toUpperCase();
    document.querySelector('#custom-metal-dot').style.setProperty('--dot', state.metalCustom);
    reflectChoices('metal');
  }
  function reflectGradient() {
    const stops = getStops();
    document.querySelector('#gradient-preview').style.backgroundImage = `linear-gradient(90deg in oklch, ${stops.join(', ')})`;
    stops.forEach((color,i) => {
      document.querySelector(`[data-stop="${i}"]`).value = color;
      document.querySelector(`[data-stop-hex="${i}"]`).value = color.toUpperCase();
    });
    document.querySelector('#custom-gradient-dot').style.setProperty('--dot-gradient',`linear-gradient(90deg,${state.customStops.join(',')})`);
    reflectChoices('palette');
  }
  function reflectColors() {
    for (const name of Object.keys(colorVars)) {
      const color = effectiveColor(name);
      document.querySelector(`[data-color-picker="${name}"]`).value = color;
      document.querySelector(`[data-color-hex="${name}"]`).value = color.toUpperCase();
      document.querySelector(`[data-color-field="${name}"] .mini-reset`).disabled = state[name] === null;
      document.querySelector(`[data-color-field="${name}"] .mini-reset`).style.opacity = state[name] === null ? '.32' : '1';
    }
  }
  function reflectSliders() {
    for (const [key,[,unit]] of Object.entries(sliderVars)) {
      document.querySelector(`[data-slider="${key}"]`).value = state[key];
      document.querySelector(`#output-${key}`).textContent = `${state[key]} ${unit}`;
    }
  }
  function presetValues(kind, value) {
    const values = {};
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      for (const rule of rules) if (rule.selectorText === `.pb-menu[data-pb-${kind}="${value}"]`) {
        for (const name of rule.style) if (name.startsWith('--pb-menu-')) values[name] = rule.style.getPropertyValue(name).trim();
      }
    }
    return values;
  }
  function apply() {
    menu.dataset.pbMetal = state.metal;
    menu.dataset.pbPalette = state.palette;
    menu.dataset.pbItemCount = state.itemCount;
    menu.dataset.pbTextMode = state.textMode;
    menu.dataset.pbIconMode = state.iconMode;
    // Preview CSS is maintained in a normal stylesheet, NOT in inline styles.
    // This allows the editor's applied CSS to override the generated settings.
    const values = {...presetValues('metal',state.metal), ...presetValues('palette',state.palette), ...state.variables};
    if (state.metal === 'custom') values['--pb-menu-front'] = state.metalCustom;
    if (state.palette === 'custom') state.customStops.forEach((color, i) => { values[`--pb-menu-gradient-${i}`] = color; });
    for (const [name, variable] of Object.entries(colorVars)) {
      if (state[name]) values[variable] = state[name];
      else if (name === 'textIdle' && state.metal === 'custom') values[variable] = contrastText(state.metalCustom);
    }
    for (const [name,[variable,unit]] of Object.entries(sliderVars)) {
      if (name !== 'fontSize' || state.fontSize !== defaults().fontSize) values[variable] = `${state[name]}${unit}`;
    }
    document.querySelector('#studio-generated-style').textContent =
      `.demo-nav .pb-menu {\n${Object.entries(values).map(([name,value]) => `  ${name}: ${value};`).join('\n')}\n}\n${renderItemsCSS(state, '.demo-nav .pb-menu')}`;
    save();
    document.dispatchEvent(new CustomEvent('pb-studio:controls-changed'));
    reflectMetal(); reflectGradient(); reflectColors(); reflectSliders(); reflectMenuControls();
  }
  // Dataset key maps directly to data attribute; no JS is needed for actual hover.
  document.querySelectorAll('[data-metal]').forEach(button => {
    button.addEventListener('click', () => { state.metal = button.dataset.metal; apply(); });
  });
  document.querySelectorAll('[data-palette]').forEach(button => {
    button.addEventListener('click', () => { state.palette = button.dataset.palette; apply(); });
  });
  function bindHex(hex, picker, update) {
    picker.addEventListener('input', () => update(picker.value));
    hex.addEventListener('input', () => {
      const val = normalizeHex(hex.value);
      hex.classList.toggle('invalid', !val);
      if (val) { picker.value = val; update(val); }
    });
    hex.addEventListener('blur', () => { hex.classList.remove('invalid'); hex.value = picker.value.toUpperCase(); });
  }
  bindHex(document.querySelector('#metal-hex'), document.querySelector('#metal-color'), value => {
    state.metalCustom = value.toLowerCase(); state.metal = 'custom'; apply();
  });
  for (let i=0;i<5;i++) {
    const picker = document.querySelector(`[data-stop="${i}"]`);
    const hex = document.querySelector(`[data-stop-hex="${i}"]`);
    bindHex(hex,picker,value => {
      // On first edit capture the *selected* palette as starting point.
      if (state.palette !== 'custom') state.customStops = getStops();
      state.palette = 'custom'; state.customStops[i] = value.toLowerCase(); apply();
    });
  }
  for (const name of Object.keys(colorVars)) {
    const picker = document.querySelector(`[data-color-picker="${name}"]`);
    const hex = document.querySelector(`[data-color-hex="${name}"]`);
    bindHex(hex,picker,value => { state[name] = value.toLowerCase(); apply(); });
  }
  document.querySelectorAll('[data-reset-color]').forEach(btn => btn.addEventListener('click',() => {
    state[btn.dataset.resetColor] = null; apply();
  }));
  document.querySelectorAll('[data-slider]').forEach(slider => {
    slider.addEventListener('input',() => { state[slider.dataset.slider] = Number(slider.value); apply(); });
  });
  let toastTimer;
  function toast(message) {
    const el = document.querySelector('#toast');
    el.textContent = message; el.classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'),2500);
  }
  document.querySelector('#reset-all').addEventListener('click',() => {
    state = defaults(); syncMenu(); renderItemFields(); apply(); toast('Все настройки восстановлены');
  });
  function exportCSS() {
    const lines = [
      '/* PandoraBox UI · Pandora Menu v0.2.0 · User configuration */',
      '/* Include pandora-menu.css, pandora-metals.css and pandora-palettes.css. */',
      `/* HTML: <ul class="pb-menu" data-pb-metal="${state.metal}" data-pb-palette="${state.palette}">...</ul> */`,
      '',
      '/* Add this CSS after the library stylesheets: */',
      '.my-navigation .pb-menu {'
    ];
    for (const [name,value] of Object.entries({...presetValues('metal',state.metal),...presetValues('palette',state.palette)})) lines.push(`  ${name}: ${value};`);
    for (const [name,value] of Object.entries(state.variables)) lines.push(`  ${name}: ${value};`);
    if (state.metal === 'custom') lines.push(`  --pb-menu-front: ${state.metalCustom};`);
    if (state.palette === 'custom') state.customStops.forEach((c,i) => lines.push(`  --pb-menu-gradient-${i}: ${c};`));
    for (const [name,variable] of Object.entries(colorVars)) {
      if (state[name]) lines.push(`  ${variable}: ${state[name]};`);
      else if (name === 'textIdle' && state.metal === 'custom') lines.push(`  ${variable}: ${contrastText(state.metalCustom)};`);
    }
    for (const [name,[variable,unit]] of Object.entries(sliderVars)) lines.push(`  ${variable}: ${state[name]}${unit};`);
    lines.push('}');
    return lines.join('\n') + '\n' + renderItemsCSS(state, '.my-navigation .pb-menu');
  }
  window.PandoraPlayground = {
    exportCSS,
    getState: () => JSON.parse(JSON.stringify(state)),
    getDefaults: defaults,
    getMetals: () => [...metals],
    getPalettes: () => [...palettes],
    getPresetValues: presetValues,
    importState: input => {
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Некорректный формат настроек');
      state = sanitizeState(input);
      syncMenu(); renderItemFields();
      apply();
    },
    toast,
    get menu() { return menu; },
    setMenu: replacement => {
      menu = replacement;
      const items = [...menu.children].filter(el => el.matches('li.pb-menu__item'));
      if (items.length < 2 || items.length > 9) throw Error('Меню должно содержать от 2 до 9 пунктов');
      state.itemCount = items.length;
      items.forEach((li, i) => {
        const link = li.querySelector('.pb-menu__link');
        const label = li.querySelector('.pb-menu__label');
        state.items[i] = { ...state.items[i], label: (label || link)?.textContent || '', url: safeURL(link?.getAttribute('href') || '#'), icon: sanitizeSVG(li.querySelector('.pb-menu__icon svg')?.outerHTML || state.items[i]?.icon || '') };
      });
      state = sanitizeState(state);
      syncMenu(); renderItemFields(); apply();
    }
  };
  document.querySelector('#copy-css').addEventListener('click',async () => {
    if (window.PandoraStudio) { await window.PandoraStudio.copyCSS(); return; }

    const code = exportCSS();
    try {
      await navigator.clipboard.writeText(code);
      toast('CSS и HTML-подсказка скопированы');
    } catch(_) {
      const text = document.createElement('textarea');
      text.value = code; text.style.position = 'fixed'; text.style.opacity = '0';
      document.body.appendChild(text); text.select();
      const ok = document.execCommand('copy'); text.remove();
      toast(ok ? 'HTML + CSS скопированы в буфер обмена' : 'Не удалось скопировать — проверь доступ к буферу');
    }
  });
  function reflectMenuControls() {
    document.querySelector('#item-count').value = state.itemCount;
    document.querySelector('#item-count-value').value = state.itemCount;
    document.querySelector('#add-item').disabled = state.itemCount === 9;
    document.querySelector('#remove-item').disabled = state.itemCount === 2;
    document.querySelector('#text-mode').value = state.textMode;
    document.querySelector('#icon-mode').value = state.iconMode;
    for (const [id,key] of [['scale','maskScale'],['x','maskX'],['y','maskY'],['opacity','maskOpacity']]) {
      document.querySelector(`#mask-${id}`).value = state[key];
      document.querySelector(`#mask-${id}-value`).value = state[key] + (id === 'x' || id === 'y' ? '%' : '');
    }
  }
  function syncMenu() {
    const parsed = new DOMParser().parseFromString(renderMenuHTML(state), 'text/html');
    const incoming = [...parsed.querySelectorAll('.pb-menu__item')];
    const existing = [...menu.children].filter(el => el.matches('.pb-menu__item'));
    existing.slice(state.itemCount).forEach(el => el.remove());
    incoming.forEach((source, i) => {
      let li = existing[i];
      if (!li) { li = document.importNode(source, true); menu.append(li); }
      let link = li.querySelector('.pb-menu__link');
      if (!link) { link = document.importNode(source.querySelector('.pb-menu__link'), true); li.append(link); }
      let label = link.querySelector('.pb-menu__label');
      if (!label) { link.textContent = ''; label = document.createElement('span'); label.className = 'pb-menu__label'; link.append(label); }
      if (label.textContent !== state.items[i].label) label.textContent = state.items[i].label;
      link.setAttribute('href', state.items[i].url);
      let icon = li.querySelector('.pb-menu__icon');
      if (!icon) { icon = document.createElement('span'); icon.className = 'pb-menu__icon'; icon.setAttribute('aria-hidden','true'); li.prepend(icon); }
      if (sanitizeSVG(icon.innerHTML) !== state.items[i].icon) icon.innerHTML = state.items[i].icon;
      label.contentEditable = editMode ? 'true' : 'false';
      label.setAttribute('spellcheck', 'false');
      if (editMode) { label.setAttribute('role','textbox'); label.setAttribute('aria-label',`Название пункта ${i + 1}`); }
      else { label.removeAttribute('role'); label.removeAttribute('aria-label'); }
    });
    menu.dataset.pbEdit = String(editMode);
  }
  function renderItemFields() {
    const host = document.querySelector('#item-fields');
    host.replaceChildren();
    state.items.slice(0,state.itemCount).forEach((item,i) => {
      const group = document.createElement('details'); group.className = 'item-field';
      const summary = document.createElement('summary'); summary.textContent = `${i+1}. ${item.label || '(без названия)'}`; group.append(summary);
      for (const [key,title,multiline] of [['label','Название',false],['url','URL',false],['icon','SVG-иконка',true],['mask','SVG-маска (пусто — встроенная иконка)',true],['variables','CSS-параметры пункта (JSON)',true]]) {
        const label = document.createElement('label'); label.textContent = title;
        const input = document.createElement(multiline ? 'textarea' : 'input');
        input.dataset.itemIndex = i; input.dataset.itemKey = key;
        input.value = key === 'variables' ? JSON.stringify(item.variables || {},null,2) : item[key] || '';
        input.spellcheck = false;
        input.addEventListener(key === 'label' ? 'input' : 'change', () => {
          try {
            let value = input.value;
            if (key === 'variables') { value = JSON.parse(value || '{}'); if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Нужен JSON-объект'); }
            if (key === 'icon' || (key === 'mask' && value.trim())) { value = sanitizeSVG(value); if (!value) throw Error('Нужен SVG с безопасными path / shape элементами'); }
            if (key === 'url') value = safeURL(value);
            state.items[i][key] = value || (key === 'mask' ? null : value);
            state = sanitizeState(state);
            if (key === 'label') summary.textContent = `${i+1}. ${state.items[i].label || '(без названия)'}`;
            input.setCustomValidity(''); syncMenu(); apply();
          } catch (error) { input.setCustomValidity(error.message); input.reportValidity(); }
        });
        label.append(input); group.append(label);
      }
      host.append(group);
    });
  }
  function setCount(n) { state = sanitizeState({...state,itemCount:n}); syncMenu(); renderItemFields(); apply(); }
  document.querySelector('#item-count').addEventListener('input', event => setCount(Number(event.target.value)));
  document.querySelector('#add-item').addEventListener('click', () => setCount(state.itemCount + 1));
  document.querySelector('#remove-item').addEventListener('click', () => setCount(state.itemCount - 1));
  document.querySelector('#edit-mode').addEventListener('change', event => { document.activeElement?.blur(); editMode = event.target.checked; syncMenu(); });
  for (const [id,key] of [['text-mode','textMode'],['icon-mode','iconMode'],['mask-scale','maskScale'],['mask-x','maskX'],['mask-y','maskY'],['mask-opacity','maskOpacity']]) {
    document.querySelector(`#${id}`).addEventListener('input', event => { state[key] = id.endsWith('mode') ? event.target.value : Number(event.target.value); apply(); });
  }
  // Delegation keeps editing/navigation handlers valid after HTML Apply.
  const editing = new WeakMap();
  document.querySelector('.scene-body').addEventListener('focusin', event => {
    if (event.target.matches('.pb-menu__label[contenteditable="true"]')) editing.set(event.target, event.target.textContent);
  });
  function commitLabel(label) {
    if (!editing.has(label)) return;
    const index = [...menu.querySelectorAll('.pb-menu__label')].indexOf(label);
    if (index < 0) return;
    state.items[index].label = label.textContent.replace(/[\r\n]+/g,' ').slice(0,120);
    if (label.textContent !== state.items[index].label) label.textContent = state.items[index].label;
    renderItemFields(); apply();
  }
  document.querySelector('.scene-body').addEventListener('input', event => {
    const label = event.target.closest('.pb-menu__label[contenteditable="true"]');
    if (label) commitLabel(label);
  });
  document.querySelector('.scene-body').addEventListener('focusout', event => {
    const label = event.target;
    if (editing.has(label)) { commitLabel(label); editing.delete(label); }
  });
  document.querySelector('.scene-body').addEventListener('keydown', event => {
    const label = event.target.closest('.pb-menu__label[contenteditable="true"]');
    if (!label) return;
    if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); label.blur(); }
    if (event.key === 'Escape') { event.preventDefault(); label.textContent = editing.get(label) ?? label.textContent; commitLabel(label); label.blur(); }
  });
  document.querySelector('.scene-body').addEventListener('paste', event => {
    const label = event.target.closest('.pb-menu__label[contenteditable="true"]');
    if (!label) return;
    event.preventDefault();
    const text = (event.clipboardData?.getData('text/plain') || '').replace(/[\r\n]+/g,' ');
    const selection = window.getSelection();
    if (selection?.rangeCount && label.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0); range.deleteContents();
      const node = document.createTextNode(text); range.insertNode(node); range.setStartAfter(node); range.collapse(true); selection.removeAllRanges(); selection.addRange(range);
      commitLabel(label);
    }
  });
  document.querySelector('.scene-body').addEventListener('drop', event => { if (event.target.closest('[contenteditable="true"]')) event.preventDefault(); });
  document.querySelector('.scene-body').addEventListener('beforeinput', event => {
    if (event.target.closest('[contenteditable="true"]') && /^(format|insertFromDrop|insertHTML)/.test(event.inputType)) event.preventDefault();
  });
  document.querySelector('.scene-body').addEventListener('click', event => { if (editMode && event.target.closest('.pb-menu__link')) event.preventDefault(); });
  syncMenu(); renderItemFields(); apply();
})();
await import('./editor.js');

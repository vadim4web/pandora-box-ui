/* PandoraBox UI v0.2.0 · Playground editor only (not included in runtime).
 * Three Monaco models, all editable, independently persisted and applicable.
 * The no-build demo retains a native textarea fallback when offline.
 */
import { normalizeMenuState, renderItemsCSS, safeURL, sanitizeSVG } from '../scripts/menu-model.mjs';
(() => {
  'use strict';
  const api = window.PandoraPlayground;
  const $ = selector => document.querySelector(selector);
  const STORAGE_KEY = 'pandora-box-ui:studio:v0.2.0';
  const OLD_STORAGE_KEY = 'pandora-box-ui:studio:v0.1.6';
  const VS_BASE = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs';
  const textarea = $('#editor-fallback');
  const engineStatus = $('#editor-engine');
  const appliedConfigStyle = $('#studio-user-style');
  const appliedCoreStyle = $('#studio-core-style');
  const tabNames = ['config', 'html', 'core'];
  const filenames = {
    config: 'pandora-menu.config.css',
    html: 'pandora-menu.html',
    core: 'pandora-menu.core.css'
  };
  const labels = { config:'Config CSS', html:'HTML', core:'Core CSS' };
  const renderingMarker = '/* PandoraBox: item rendering */';
  let active = 'config';
  let editor = null;
  let models = {};
  let internalUpdate = false;
  let suppressControls = false;
  let saveTimer;

  function currentMarkup() {
    const nav = document.querySelector('.demo-nav').cloneNode(true);
    nav.classList.remove('demo-nav');
    nav.classList.add('my-navigation');
    nav.querySelector('.pb-menu')?.removeAttribute('id');
    nav.querySelector('.pb-menu')?.removeAttribute('data-pb-edit');
    nav.querySelectorAll('[contenteditable]').forEach(el => {
      el.removeAttribute('contenteditable'); el.removeAttribute('spellcheck');
      if (el.classList.contains('pb-menu__label')) { el.removeAttribute('role'); el.removeAttribute('aria-label'); }
    });
    return `<!-- PandoraBox UI · Paste in your website -->\n${nav.outerHTML.replace(/></g, '>\n<')}`;
  }
  const docs = {
    config: { draft: api.exportCSS(), applied: '', dirty: false },
    html: { draft: currentMarkup(), applied: '', dirty: false },
    core: { draft: '/* Loading Pandora Menu core CSS… */', applied: '', dirty: false }
  };
  let hasRestoredCore = false;
  let persisted = null;
  try { persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY) || '{}'); }
  catch (_) { /* Blocked or invalid browser storage. */ }
  for (const key of tabNames) {
    const incoming = persisted?.documents?.[key] || (key === 'config' ? persisted : null);
    if (!incoming) continue;
    if (typeof incoming.draft === 'string' && incoming.draft.length < 400000) {
      docs[key].draft = incoming.draft;
      if (key === 'core') hasRestoredCore = true;
    }
    if (typeof incoming.applied === 'string' && incoming.applied.length < 400000) docs[key].applied = incoming.applied;
    docs[key].dirty = incoming.dirty === true;
    if (typeof incoming.backup === 'string') docs[key].backup = incoming.backup;
  }
  if (tabNames.includes(persisted?.active)) active = persisted.active;

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ documents: docs, active })); }
    catch (_) { /* Incognito/storage restriction. */ }
  }
  function schedulePersist() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 250); }
  function notice(message, kind = '') {
    $('#code-status').textContent = message;
    $('#code-status').className = `code-status ${kind}`;
    for (const key of tabNames) {
      const button = $(`[data-code-tab="${key}"]`);
      button.classList.toggle('is-dirty', docs[key].dirty);
    }
    $('#code-dirty').classList.toggle('visible', docs.config.dirty);
  }
  const readActive = () => editor ? editor.getValue() : textarea.value;
  function setDraft(key, value) {
    docs[key].draft = value;
    if (models[key] && models[key].getValue() !== value) {
      internalUpdate = true; models[key].setValue(value); internalUpdate = false;
    }
    if (active === key) textarea.value = value;
    schedulePersist();
  }
  function changeFromEditor() {
    if (internalUpdate) return;
    const doc = docs[active];
    doc.draft = readActive();
    doc.dirty = doc.draft !== doc.applied;
    notice(`${labels[active]} изменён. Нажми Apply для просмотра изменений.`, 'warning');
    schedulePersist();
  }
  textarea.addEventListener('input', changeFromEditor);

  function switchTab(next) {
    if (!tabNames.includes(next)) return;
    if (active !== next) docs[active].draft = readActive();
    active = next;
    document.querySelectorAll('[data-code-tab]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.codeTab === next);
      btn.setAttribute('aria-selected', String(btn.dataset.codeTab === next));
    });
    $('#editor-mode').textContent = `${labels[next]} · editable`;
    $('#save-css').textContent = `↓ Save ${next === 'html' ? '.html' : '.css'}`;
    $('#apply-css').textContent = `▶ Apply ${labels[next]}`;
    textarea.readOnly = false;
    textarea.value = docs[next].draft;
    textarea.scrollTop = 0; textarea.scrollLeft = 0;
    if (editor && models[next]) { editor.setModel(models[next]); editor.updateOptions({ readOnly:false }); }
    engineStatus.textContent = editor ? `Monaco Editor · ${next === 'html' ? 'HTML' : 'CSS'}` : engineStatus.textContent;
    notice(docs[next].dirty ? 'Есть неприменённые изменения.' : `Редактируй ${labels[next]}, затем Apply или Save.`, docs[next].dirty ? 'warning' : '');
    schedulePersist();
  }
  document.querySelectorAll('[data-code-tab]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.codeTab)));

  const forPreview = css => css.replaceAll('.my-navigation', '.demo-nav');
  function validateCSS(css) {
    if (!css.trim()) throw Error('CSS пуст.');
    if ((css.match(/\{/g) || []).length !== (css.match(/\}/g) || []).length) throw Error('Количество скобок { } не совпадает.');
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(forPreview(css));
    if (!sheet.cssRules.length) throw Error('Не удалось распознать CSS-правила.');
    return sheet;
  }
  function cssToState(css) {
    const updated = api.getState();
    const metadata = [...css.matchAll(/\/\* PandoraBox menu data: ([\s\S]*?)\*\//g)].at(-1);
    if (metadata) Object.assign(updated, normalizeMenuState(JSON.parse(decodeURIComponent(metadata[1].trim()))));
    const metalHint = [...css.matchAll(/data-pb-metal=["']([^"']+)["']/g)].at(-1);
    const paletteHint = [...css.matchAll(/data-pb-palette=["']([^"']+)["']/g)].at(-1);
    if (metalHint && api.getMetals().includes(metalHint[1])) updated.metal = metalHint[1];
    if (paletteHint && api.getPalettes().includes(paletteHint[1])) updated.palette = paletteHint[1];
    const colorTokens = {
      '--pb-menu-text':'textIdle', '--pb-menu-hover-text':'textHover',
      '--pb-menu-icon-color':'iconIdle', '--pb-menu-hover-icon-color':'iconHover'
    };
    const numericTokens = {
      '--pb-menu-font-size':['fontSize','px',26,60],
      '--pb-menu-hover-offset':['offset','%',-12,0],
      '--pb-menu-move-duration':['moveDuration','ms',0,1500],
      '--pb-menu-color-duration':['colorDuration','ms',0,2000],
      '--pb-menu-item-overlap':['overlap','px',0,4],
      '--pb-menu-mask-scale':['maskScale','',.25,3],
      '--pb-menu-mask-x':['maskX','%',0,100],
      '--pb-menu-mask-y':['maskY','%',0,100],
      '--pb-menu-mask-opacity':['maskOpacity','',0,1]
    };
    const sheet = validateCSS(css);
    for (const rule of sheet.cssRules) {
      if (!(rule instanceof CSSStyleRule) || !rule.selectorText.includes('.pb-menu')) continue;
      const itemMatch = rule.selectorText.match(/\.pb-menu__item:nth-child\((\d+)\)/);
      if (itemMatch) {
        const item = updated.items[Number(itemMatch[1]) - 1];
        if (item) {
          const generated = new Set(['--pb-menu-text-clip','--pb-menu-front-mask','--pb-menu-label-opacity','--pb-menu-icon-clip','--pb-menu-side-mask','--pb-menu-icon-opacity','--pb-menu-clip-opacity']);
          for (const property of rule.style) if (/^--pb-menu-[a-z0-9-]+$/.test(property) && !generated.has(property)) item.variables[property] = rule.style.getPropertyValue(property).trim();
        }
        continue;
      }
      for (const property of rule.style) {
        if (/^--pb-menu-[a-z0-9-]+$/.test(property) && !['--pb-menu-front','--pb-menu-text','--pb-menu-hover-text','--pb-menu-icon-color','--pb-menu-hover-icon-color','--pb-menu-font-size','--pb-menu-hover-offset','--pb-menu-move-duration','--pb-menu-color-duration','--pb-menu-item-overlap','--pb-menu-text-mode','--pb-menu-icon-mode','--pb-menu-mask-scale','--pb-menu-mask-x','--pb-menu-mask-y','--pb-menu-mask-opacity'].includes(property) && !/^--pb-menu-gradient-\d$/.test(property)) updated.variables[property] = rule.style.getPropertyValue(property).trim();
      }
      for (const [variable, key] of [['--pb-menu-text-mode','textMode'],['--pb-menu-icon-mode','iconMode']]) {
        const mode = rule.style.getPropertyValue(variable).trim();
        if (['normal','clip','cutout'].includes(mode)) updated[key] = mode;
      }
      for (const [property,key] of Object.entries(colorTokens)) {
        const value = rule.style.getPropertyValue(property).trim();
        if (/^#[a-f0-9]{6}$/i.test(value)) updated[key] = value.toLowerCase();
      }
      const front = rule.style.getPropertyValue('--pb-menu-front').trim();
      if (/^#[a-f0-9]{6}$/i.test(front)) {
        const preset = api.getPresetValues('metal',metalHint?.[1]);
        updated.metal = front.toLowerCase() === preset['--pb-menu-front']?.toLowerCase() ? metalHint[1] : 'custom';
        updated.metalCustom = front.toLowerCase();
      }
      const stops = Array.from({length:5},(_,i) => rule.style.getPropertyValue(`--pb-menu-gradient-${i}`).trim());
      if (stops.every(color => /^#[a-f0-9]{6}$/i.test(color))) {
        const preset = api.getPresetValues('palette',paletteHint?.[1]);
        updated.palette = stops.every((color,i)=>color.toLowerCase()===preset[`--pb-menu-gradient-${i}`]?.toLowerCase()) ? paletteHint[1] : 'custom'; updated.customStops = stops.map(color => color.toLowerCase());
      }
      for (const [property,[key,unit,min,max]] of Object.entries(numericTokens)) {
        const value = rule.style.getPropertyValue(property).trim();
        if (!value.endsWith(unit)) continue;
        if (!value) continue;
        const n = Number(unit ? value.slice(0,-unit.length) : value);
        if (Number.isFinite(n)) updated[key] = Math.max(min,Math.min(max,n));
      }
    }
    return updated;
  }

  // Validate HTML in an inert DOM and allow only navigation/SVG tags and
  // known safe attributes. HTML text is always saved exactly as authored;
  // sanitization only applies to its live preview representation.
  const safeTags = new Set(['nav','ul','li','span','a','svg','path','circle','rect','line','ellipse','polygon','polyline','g','title','desc']);
  const safeAttrs = new Set([
    'class','id','href','role','tabindex','viewbox','xmlns','d','points','cx','cy','r',
    'rx','ry','x','y','x1','x2','y1','y2','width','height','stroke','stroke-width',
    'stroke-linecap','stroke-linejoin','fill','transform', 'aria-label','aria-hidden',
    'data-pb-metal','data-pb-palette','data-pb-item-count','data-pb-text-mode','data-pb-icon-mode',
    'fill-rule','clip-rule','opacity','fill-opacity','stroke-opacity','color','preserveaspectratio','vector-effect','stroke-dasharray','stroke-dashoffset','stroke-miterlimit'
  ]);
  function safeMenuMarkup(source) {
    const parsed = new DOMParser().parseFromString(source, 'text/html');
    const nav = parsed.querySelector('nav');
    const ul = nav?.querySelector('ul.pb-menu');
    const count = ul ? [...ul.children].filter(el => el.matches('li.pb-menu__item')).length : 0;
    if (!nav || !ul || count < 2 || count > 9) throw Error('Нужны <nav>, <ul class="pb-menu"> и от 2 до 9 <li class="pb-menu__item">.');
    const wantedMetal = ul.getAttribute('data-pb-metal');
    const wantedPalette = ul.getAttribute('data-pb-palette');
    const wantedTextMode = ul.getAttribute('data-pb-text-mode');
    const wantedIconMode = ul.getAttribute('data-pb-icon-mode');
    for (const el of [nav, ...nav.querySelectorAll('*')]) {
      if (!safeTags.has(el.localName.toLowerCase())) { el.remove(); continue; }
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase();
        if (!safeAttrs.has(name)) el.removeAttribute(attr.name);
        else if (name === 'href') el.setAttribute('href', safeURL(attr.value));
      }
    }
    nav.querySelectorAll('.pb-menu__icon svg').forEach(svg => { svg.outerHTML = sanitizeSVG(svg.outerHTML); });
    nav.classList.add('demo-nav'); nav.classList.remove('my-navigation');
    ul.id = 'menu';
    return { nav: document.importNode(nav,true), wantedMetal, wantedPalette, wantedTextMode, wantedIconMode };
  }
  function renderedConfig(value) {
    return `${value.split(renderingMarker)[0].trim()}\n\n${renderingMarker}\n${renderItemsCSS(api.getState(), '.my-navigation .pb-menu')}`;
  }
  function refreshRendering() {
    docs.config.applied = renderedConfig(docs.config.applied);
    appliedConfigStyle.textContent = forPreview(docs.config.applied);
    if (!docs.config.dirty) setDraft('config', docs.config.applied);
  }
  function applyTab(key, value) {
    if (key === 'config') {
      const newState = cssToState(value);
      suppressControls = true;
      try { api.importState(newState); }
      finally { suppressControls = false; }
      value = renderedConfig(value);
      appliedConfigStyle.textContent = forPreview(value);
    } else if (key === 'core') {
      validateCSS(value);
      appliedCoreStyle.textContent = value;
    } else {
      const { nav, wantedMetal, wantedPalette, wantedTextMode, wantedIconMode } = safeMenuMarkup(value);
      const old = document.querySelector('.demo-nav');
      old.replaceWith(nav);
      suppressControls = true;
      try { api.setMenu(nav.querySelector('.pb-menu')); }
      finally { suppressControls = false; }
      const updated = api.getState();
      if (api.getMetals().includes(wantedMetal)) updated.metal = wantedMetal;
      if (api.getPalettes().includes(wantedPalette)) updated.palette = wantedPalette;
      if (['normal','clip','cutout'].includes(wantedTextMode)) updated.textMode = wantedTextMode;
      if (['normal','clip','cutout'].includes(wantedIconMode)) updated.iconMode = wantedIconMode;
      suppressControls = true;
      try { api.importState(updated); }
      finally { suppressControls = false; }
      refreshRendering();
    }
    docs[key].applied = value;
    docs[key].draft = value;
    docs[key].dirty = false;
    setDraft(key, value);
  }
  function applyActive() {
    const key = active;
    const value = readActive();
    docs[key].draft = value;
    try {
      applyTab(key, value);
      notice(`${labels[key]} применён к превью. Сохрани файл через Save, если нужно использовать его в проекте.`);
      persist();
      api.toast(`${labels[key]} применён`);
      return true;
    } catch (error) {
      docs[key].dirty = true;
      notice(`Не удалось применить ${labels[key]}: ${error.message}`, 'error');
      schedulePersist();
      return false;
    }
  }

  function download(value, filename, mime) {
    const url = URL.createObjectURL(new Blob([value], {type:mime}));
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copyText(value) {
    try { await navigator.clipboard.writeText(value); }
    catch (_) {
      const t = document.createElement('textarea');
      t.value = value; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.append(t); t.select();
      const ok = document.execCommand('copy'); t.remove();
      if (!ok) throw Error('Буфер обмена недоступен');
    }
    api.toast('Код скопирован');
  }
  function saveActive() {
    docs[active].draft = readActive();
    download(docs[active].draft, filenames[active], active === 'html' ? 'text/html' : 'text/css');
    persist();
    api.toast(`${filenames[active]} сохранён в Downloads`);
  }
  window.PandoraStudio = {
    copyCSS: () => { if (active === 'config') docs.config.draft = readActive(); return copyText(docs.config.draft); },
    getDocuments: () => structuredClone(docs)
  };
  $('#editor-copy').addEventListener('click', () => {
    docs[active].draft = readActive();
    copyText(docs[active].draft).catch(e => notice(e.message,'error'));
  });
  $('#apply-css').addEventListener('click', applyActive);
  $('#save-css').addEventListener('click', saveActive);
  function shortcuts(event) {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === 's') { event.preventDefault(); saveActive(); }
    else if (key === 'enter') { event.preventDefault(); applyActive(); }
  }
  textarea.addEventListener('keydown', shortcuts);

  $('#sync-from-controls').addEventListener('click', () => {
    if (docs.config.dirty && !confirm('Заменить изменения в Config CSS настройками панелей?')) return;
    docs.config.backup = docs.config.draft;
    docs.config.applied = '';
    appliedConfigStyle.textContent = '';
    docs.config.dirty = false;
    setDraft('config', api.exportCSS());
    switchTab('config');
    api.toast('Config CSS пересоздан из настроек');
  });
  $('#restore-draft').addEventListener('click', () => {
    const backup = docs[active].backup;
    if (typeof backup !== 'string') { notice('Для этой вкладки ещё нет предыдущего черновика.'); return; }
    docs[active].backup = docs[active].draft;
    setDraft(active, backup); docs[active].dirty = backup !== docs[active].applied;
    notice('Предыдущий черновик восстановлен. Apply применит его к превью.', 'warning');
  });
  $('#export-settings').addEventListener('click', () => {
    docs[active].draft = readActive();
    const data = { format:'pandora-box-ui', version:3, state:api.getState(), documents:docs, active };
    download(JSON.stringify(data,null,2)+'\n','pandora.config.json','application/json');
    api.toast('Настройки и все три документа экспортированы');
  });
  $('#import-settings').addEventListener('change', async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (file.size > 400000) { notice('Лимит импорта — 400 KB.','error'); return; }
    try {
      const source = await file.text();
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.json')) {
        const incoming = JSON.parse(source);
        if (incoming.format && incoming.format !== 'pandora-box-ui') throw Error('Неизвестный формат JSON');
        if (incoming.state) {
          suppressControls = true;
          try { api.importState(incoming.state); }
          finally { suppressControls = false; }
        }
        if (incoming.documents) {
          for (const key of tabNames) {
            const d = incoming.documents[key];
            if (d && typeof d.draft === 'string' && d.draft.length < 400000) {
              docs[key].backup = docs[key].draft;
              setDraft(key, d.draft);
              docs[key].applied = typeof d.applied === 'string' ? d.applied : '';
              docs[key].dirty = !!d.dirty;
            }
          }
        } else if (typeof incoming.css === 'string') {
          setDraft('config',incoming.css); docs.config.dirty = true;
        } else if (incoming.variables) {
          const css = `.my-navigation .pb-menu {\n${Object.entries(incoming.variables).map(([key,value])=>`  ${key}: ${value};`).join('\n')}\n}`;
          setDraft('config',css); docs.config.dirty = true;
        }
        if (!incoming.documents) {
          docs.config.backup = docs.config.draft; docs.html.backup = docs.html.draft;
          const generated = typeof incoming.css === 'string' ? incoming.css : api.exportCSS() + (incoming.variables ? `\n.my-navigation .pb-menu {\n${Object.entries(incoming.variables).filter(([name,value]) => /^--pb-menu-[a-z0-9-]+$/.test(name) && ['string','number'].includes(typeof value) && !/[;{}<>\r\n]/.test(String(value))).map(([name,value]) => `  ${name}: ${value};`).join('\n')}\n}` : '');
          setDraft('config', generated); docs.config.applied = generated; docs.config.dirty = false;
          applyTab('config', generated);
          setDraft('html', currentMarkup()); docs.html.applied = docs.html.draft; docs.html.dirty = false;
        }
        for (const key of incoming.documents ? ['core','html','config'] : []) {
          if (!incoming.documents[key]) continue;
          const imported = {...docs[key]};
          const value = incoming.documents?.[key]?.applied || (!imported.dirty ? imported.draft : '');
          if (value) { applyTab(key, value); setDraft(key, imported.draft); docs[key].dirty = imported.dirty; }
        }
        switchTab(tabNames.includes(incoming.active) ? incoming.active : 'config');
        notice('JSON восстановлен в превью. Неприменённые черновики сохранены отдельно.');
      } else if (lower.endsWith('.html')) {
        docs.html.backup = docs.html.draft; setDraft('html',source); docs.html.dirty = true; switchTab('html');
        notice('HTML импортирован. Нажми Apply HTML.','warning');
      } else if (lower.endsWith('.css')) {
        const key = active === 'core' ? 'core' : 'config';
        docs[key].backup = docs[key].draft; setDraft(key,source); docs[key].dirty = true; switchTab(key);
        notice(`${labels[key]} загружен. Нажми Apply.`, 'warning');
      } else throw Error('Поддерживаются .css, .html и .json');
      persist();
      api.toast('Файл импортирован');
    } catch(error) { notice(`Ошибка импорта: ${error.message}`, 'error'); }
  });

  document.addEventListener('pb-studio:controls-changed', () => {
    if (suppressControls) return;
    const marker = '/* PandoraBox: visual overrides */';
    const existing = docs.config.applied.split(marker)[0].trim();
    const combined = `${existing ? existing + '\n\n' : ''}${marker}\n${api.exportCSS()}`;
    docs.config.applied = combined;
    appliedConfigStyle.textContent = forPreview(combined);
    if (!docs.config.dirty) setDraft('config', combined);
    docs.html.applied = currentMarkup();
    if (!docs.html.dirty) { docs.html.backup ||= docs.html.draft; setDraft('html', docs.html.applied); }
    const dirty = docs.config.dirty || docs.html.dirty;
    notice(dirty ? 'Превью обновлено. Ручные черновики сохранены; Apply применит их отдельно.' : 'Настройки, HTML и редактор синхронизированы.', dirty ? 'warning' : '');
    schedulePersist();
  });

  function initMonaco() {
    const script = document.createElement('script');
    script.src = `${VS_BASE}/loader.js`;
    script.async = true;
    script.onerror = () => { engineStatus.textContent = 'Offline textarea · CDN недоступен'; };
    script.onload = () => {
      if (!window.require?.config) { engineStatus.textContent = 'Offline textarea'; return; }
      const workerScript = `self.MonacoEnvironment={baseUrl:'${VS_BASE.replace(/\/vs$/, '')}/'};importScripts('${VS_BASE}/base/worker/workerMain.js');`;
      const workerUrl = URL.createObjectURL(new Blob([workerScript],{type:'text/javascript'}));
      window.MonacoEnvironment = {getWorkerUrl:()=>workerUrl};
      window.require.config({paths:{vs:VS_BASE}});
      window.require(['vs/editor/editor.main'], () => {
        try {
          const m = window.monaco;
          models = Object.fromEntries(tabNames.map(key => [key, m.editor.createModel(docs[key].draft,key === 'html' ? 'html' : 'css')]));
          editor = m.editor.create($('#monaco-container'), {
            model:models[active], theme:'vs-dark', automaticLayout:true,
            fontFamily:"'Cascadia Code',Consolas,monospace", fontSize:12,
            minimap:{enabled:false}, scrollBeyondLastLine:false,
            wordWrap:'on', tabSize:2, readOnly:false, folding:true,
            renderLineHighlight:'line', overviewRulerLanes:0
          });
          editor.onDidChangeModelContent(changeFromEditor);
          editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyS,saveActive);
          editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Enter,applyActive);
          $('#monaco-container').classList.add('ready');
          textarea.classList.add('hidden');
          engineStatus.textContent = `Monaco Editor · ${active === 'html' ? 'HTML' : 'CSS'}`;
          const observer = new ResizeObserver(()=>editor?.layout());
          observer.observe($('#editor-stage'));
          $('#panel-code').addEventListener('toggle',()=>setTimeout(()=>editor?.layout(),60));
          window.addEventListener('pagehide',()=>{observer.disconnect(); URL.revokeObjectURL(workerUrl); Object.values(models).forEach(model=>model.dispose());});
        } catch (_) { engineStatus.textContent = 'Offline textarea · Monaco failed'; editor = null; }
      },()=>{engineStatus.textContent='Offline textarea · CDN недоступен';});
    };
    document.head.append(script);
  }

  // Restore previews from the most recent applied versions. Their drafts stay
  // independent and remain editable even when one preview cannot be restored.
  for (const key of ['core','html','config']) {
    if (!docs[key].applied) continue;
    const original = {...docs[key]};
    try { applyTab(key,original.applied); }
    catch (_) { docs[key].applied = ''; docs[key].dirty = true; }
    finally {
      // Applying persisted preview snapshots must NEVER discard later drafts.
      docs[key].draft = original.draft;
      docs[key].dirty = original.dirty || docs[key].applied !== original.draft;
    }
  }
  switchTab(active);
  fetch('../src/pandora-menu.css')
    .then(r=>{if(!r.ok)throw Error('HTTP');return r.text();})
    .then(css=>{if(!hasRestoredCore) { setDraft('core',css); docs.core.dirty=false; }} )
    .catch(()=>{if(!hasRestoredCore) setDraft('core','/* Открой через Live Server, чтобы загрузить Core CSS. */');});
  initMonaco();
})();

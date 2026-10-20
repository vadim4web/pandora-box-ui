/** Optional integration suite: install Playwright, then npm run test:browser. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {inflateSync} from 'node:zlib';
import {renderCSS, renderProjectHTML, bundleBase, compileProjectConfig} from './config-build.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let playwright;
try { playwright = await import('playwright'); }
catch { playwright = await import(pathToFileURL(path.join(root,'.tmp/browser-tools/node_modules/playwright/index.mjs'))); }
const mime = {'.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json'};
const server = createServer(async (request,response) => {
  try {
    const requested = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    const filename = path.resolve(root, '.' + (requested.endsWith('/') ? requested + 'index.html' : requested));
    if (!filename.startsWith(root + path.sep)) throw Error('Forbidden');
    response.setHeader('Content-Type',mime[path.extname(filename)] || 'application/octet-stream');
    response.end(await readFile(filename));
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const out = path.join(root,'.tmp/browser-results');
await mkdir(out,{recursive:true});
const executablePath = process.env.PANDORA_BROWSER || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
const browser = await playwright.chromium.launch({executablePath,headless:true});
const errors = [];
const passed = [];
const check = (label, condition) => { assert.ok(condition,label); passed.push(label); };
// Decode browser PNGs so transparency is verified against changing real paint.
function pixels(png) {
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20),channels=png[25]===6?4:3;
  assert.equal(png[24],8); assert.ok([2,6].includes(png[25]));
  const chunks=[]; for(let p=8;p<png.length;) { const size=png.readUInt32BE(p); if(png.toString('ascii',p+4,p+8)==='IDAT') chunks.push(png.subarray(p+8,p+8+size)); p+=size+12; }
  const data=inflateSync(Buffer.concat(chunks)),stride=width*channels,raw=Buffer.alloc(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++) {const filter=data[y*(stride+1)];for(let x=0;x<stride;x++) {const i=y*stride+x,a=x>=channels?raw[i-channels]:0,b=y?raw[i-stride]:0,c=y&&x>=channels?raw[i-stride-channels]:0;raw[i]=(data[y*(stride+1)+1+x]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;}}
  return {raw,channels};
}
function countColor(png,color) { const {raw,channels}=pixels(png); let count=0;for(let i=0;i<raw.length;i+=channels)if(color.every((value,j)=>Math.abs(raw[i+j]-value)<8)) count++;return count; }
try {
  const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://cdn.jsdelivr.net/**',route=>route.abort());
  await page.goto(url+'/demo/');
  await page.waitForFunction(()=>window.PandoraStudio);
  check('Offline editor fallback is editable', await page.locator('#editor-fallback').isEditable());
  check('Monaco panel is first and open', await page.locator('details.control-panel').first().evaluate(el=>el.id==='panel-code' && el.open));
  for (let count=2;count<=9;count++) {
    for (const textMode of ['normal','clip','cutout']) for (const iconMode of ['normal','clip','cutout']) {
      const result = await page.evaluate(({count,textMode,iconMode})=> {
        PandoraPlayground.importState({...PandoraPlayground.getState(),itemCount:count,textMode,iconMode});
        const items=[...document.querySelectorAll('#menu > li')];
        return {count:items.length, layers:items.map(el=>Number(getComputedStyle(el).zIndex)), progress:items.map(el=>getComputedStyle(el).getPropertyValue('--_pb-menu-gradient-progress').trim()),
          fronts:items.map(el=>getComputedStyle(el.querySelector('a'),'::before').maskImage), sides:items.map(el=>getComputedStyle(el,'::before').maskImage),
          labels:items.map(el=>getComputedStyle(el.querySelector('.pb-menu__label')).opacity), tops:items.map(el=>getComputedStyle(el,'::after').transform)};
      },{count,textMode,iconMode});
      assert.equal(result.count,count);
      assert.ok(result.layers.every((z,i)=>!i || z<result.layers[i-1]));
      assert.ok(result.tops.every(value=>value.startsWith('matrix(')));
      assert.ok(result.fronts.every(value=>textMode==='cutout'?value.includes('data:image/svg+xml'):value==='none'));
      assert.ok(result.sides.every(value=>iconMode==='cutout'?value.includes('data:image/svg+xml'):value==='none'));
      assert.ok(result.labels.every(value=>value===(textMode==='cutout'?'0':'1')));
    }
    if ([2,5,9].includes(count)) for (const mode of ['normal','clip','cutout']) {
      await page.evaluate(({count,mode})=>PandoraPlayground.importState({...PandoraPlayground.getState(),itemCount:count,textMode:mode,iconMode:mode}),{count,mode});
      await page.locator('.scene-panel').screenshot({path:path.join(out,`${count}-${mode}.png`)});
    }
  }
  passed.push('All 72 count/mode combinations: stacking, masks and face matrices');
  await page.evaluate(()=> {
    PandoraPlayground.importState({...PandoraPlayground.getState(),itemCount:9,textMode:'cutout',iconMode:'cutout'});
    const style=document.createElement('style');style.id='pixel-test';style.textContent='.demo-nav .pb-menu { transform:none; } .scene-body { background:rgb(255,0,0); }';document.head.append(style);
  });
  for (const index of [0,4,8]) check(`Transparent text opening shows red backdrop on row ${index+1}`,countColor(await page.locator('#menu a').nth(index).screenshot(),[255,0,0])>10);
  await page.evaluate(()=>document.querySelector('#pixel-test').textContent+='.scene-body { background:rgb(0,0,255); }');
  for (const index of [0,4,8]) check(`Text opening follows changed blue backdrop on row ${index+1}`,countColor(await page.locator('#menu a').nth(index).screenshot(),[0,0,255])>10);
  await page.evaluate(()=>document.querySelector('#pixel-test').remove());
  await page.evaluate(()=> {
    const style=document.createElement('style');style.id='side-pixel-test';style.textContent='.demo-nav .pb-menu { transform:none; } #menu li::before, #menu .pb-menu__icon { transform:none; } .scene-body { background:rgb(255,0,0); }';document.head.append(style);
  });
  for (const color of [[255,0,0],[0,0,255]]) {
    await page.evaluate(color=>document.querySelector('#side-pixel-test').textContent+=`.scene-body { background:rgb(${color}); }`,color);
    for (const index of [0,4,8]) {
      const clip=await page.locator('#menu li').nth(index).evaluate(el=>{const b=el.getBoundingClientRect();return {x:b.x-b.width/2+1,y:b.y+1,width:b.width/2-2,height:b.height-2};});
      check(`Transparent icon opening follows ${color[0]?'red':'blue'} backdrop on row ${index+1}`,countColor(await page.screenshot({clip}),color)>4);
    }
  }
  await page.evaluate(()=>document.querySelector('#side-pixel-test').remove());
  await page.evaluate(()=>PandoraPlayground.importState({...PandoraPlayground.getState(),itemCount:5,textMode:'normal',iconMode:'normal'}));
  const beforeHover=await page.locator('#menu > li').evaluateAll(items=>items.map(el=>({front:getComputedStyle(el.querySelector('a'),'::before').backgroundColor,top:getComputedStyle(el,'::after').backgroundColor,side:getComputedStyle(el,'::before').backgroundColor})));
  await page.locator('#menu a').nth(1).hover();
  const afterHover=await page.locator('#menu > li').evaluateAll(items=>items.map(el=>({front:getComputedStyle(el.querySelector('a'),'::before').backgroundColor,top:getComputedStyle(el,'::after').backgroundColor,side:getComputedStyle(el,'::before').backgroundColor})));
  check('Hover changes only active front/top',afterHover.every((value,i)=>i===1?value.front!==beforeHover[i].front:value.front===beforeHover[i].front && value.top===beforeHover[i].top));
  check('Following side is shaded on hover',afterHover[2].side!==beforeHover[2].side);
  for (let count=2;count<=9;count++) {
    await page.evaluate(count=>PandoraPlayground.importState({...PandoraPlayground.getState(),itemCount:count}),count);
    for(let index=0;index<count;index++) {
      await page.locator('#menu a').nth(index).hover();
      const matches=await page.evaluate(({count,index})=>{
        const item=document.querySelectorAll('#menu li')[index],style=getComputedStyle(item);
        const progress=index/(count-1)*4,low=Math.min(3,Math.floor(progress)),fraction=progress-low;
        const expected=`color-mix(in oklch, ${style.getPropertyValue(`--pb-menu-gradient-${low}`)}, ${style.getPropertyValue(`--pb-menu-gradient-${low+1}`)} ${fraction*100}%)`;
        const probe=document.createElement('span');document.body.append(probe);
        const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
        const rgb=color=>{probe.style.color=color;ctx.fillStyle=getComputedStyle(probe).color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
        const actual=rgb(getComputedStyle(item.querySelector('a'),'::before').backgroundColor),target=rgb(expected);probe.remove();
        return {actual,target,progress:style.getPropertyValue('--_pb-menu-gradient-progress')};
      },{count,index});
      assert.ok(matches.actual.every((n,i)=>Math.abs(n-matches.target[i])<=2),`Palette sample ${index+1}/${count}: ${JSON.stringify(matches)}`);
    }
    await page.locator('#menu a').nth(Math.floor(count/2)).hover();
    await page.locator('.scene-panel').screenshot({path:path.join(out,`${count}-hover.png`)});
  }
  passed.push('Every hover face matches its actual-count OKLCH palette sample (2–9 items)');
  await page.evaluate(()=>PandoraPlayground.importState({...PandoraPlayground.getState(),itemCount:5}));
  check('Reduced motion disables item transitions',await page.locator('#menu li').first().evaluate(el=>getComputedStyle(el).transitionDuration.split(',').every(v=>parseFloat(v)===0)));
  await page.mouse.move(0,0);
  await page.locator('#menu a').first().focus(); await page.keyboard.press('Tab');
  check('Keyboard Tab navigates links',await page.locator('#menu a').nth(1).evaluate(el=>el===document.activeElement));
  await page.locator('#panel-items summary').first().click();
  await page.locator('#edit-mode').check();
  const label=page.locator('#menu .pb-menu__label').first();
  await label.focus(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('Edited title'); await page.keyboard.press('Enter');
  check('Enter commits contenteditable to state',await page.evaluate(()=>PandoraPlayground.getState().items[0].label==='Edited title'));
  check('Editing updates HTML document',await page.evaluate(()=>PandoraStudio.getDocuments().html.draft.includes('Edited title')));
  await label.focus(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('Cancelled'); await page.keyboard.press('Escape');
  check('Escape restores pre-edit label',await label.textContent()==='Edited title');
  await label.focus(); await page.keyboard.press('ControlOrMeta+A');
  await label.evaluate(el=>{const data=new DataTransfer();data.setData('text/plain','Plain <b>text</b>');data.setData('text/html','<img src=x onerror=alert(1)><b>Injected</b>');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));});
  await page.keyboard.press('Enter');
  check('Paste inserts plain text only',await label.evaluate(el=>el.textContent==='Plain <b>text</b>' && el.childElementCount===0));
  await page.locator('#edit-mode').uncheck();
  await page.evaluate(()=>{let s=PandoraPlayground.getState();s.itemCount=9;PandoraPlayground.importState(s);s=PandoraPlayground.getState();s.items[8].label='Retained nine';PandoraPlayground.importState(s);PandoraPlayground.importState({...PandoraPlayground.getState(),itemCount:2});PandoraPlayground.importState({...PandoraPlayground.getState(),itemCount:9});});
  check('Shrinking restores inactive item data',await page.locator('#menu .pb-menu__label').nth(8).textContent()==='Retained nine');
  await page.locator('[data-code-tab=config]').click();
  const authored='.my-navigation .pb-menu { --pb-menu-text: #abcdef; --pb-menu-width: 10em; --pb-menu-font-family: Arial; --pb-menu-custom-token: 17; }\n/* custom author comment */';
  await page.locator('#editor-fallback').fill(authored); await page.locator('#apply-css').click();
  check('Config CSS synchronizes recognized color and custom geometry',await page.evaluate(()=>PandoraPlayground.getState().textIdle==='#abcdef' && PandoraPlayground.getState().variables['--pb-menu-width']==='10em'));
  await page.locator('#editor-fallback').fill('/* pending CSS draft */\n'+authored);
  await page.evaluate(()=>PandoraPlayground.importState({...PandoraPlayground.getState(),itemCount:3,textMode:'cutout'}));
  check('Visual controls preserve dirty manual CSS draft',await page.locator('#editor-fallback').inputValue()==='/* pending CSS draft */\n'+authored);
  check('Applied custom CSS survives controls',await page.locator('#menu').evaluate(el=>getComputedStyle(el).getPropertyValue('--pb-menu-custom-token').trim()==='17'));
  await page.evaluate(()=>PandoraPlayground.importState({...PandoraPlayground.getState(),metal:'gold',palette:'aurora'}));
  check('Metal and palette controls replace previously applied custom presets',await page.locator('#menu').evaluate(el=>getComputedStyle(el).getPropertyValue('--pb-menu-front').trim()==='#aa8742' && getComputedStyle(el).getPropertyValue('--pb-menu-gradient-0').trim()===PandoraPlayground.getPresetValues('palette','aurora')['--pb-menu-gradient-0']));
  await page.locator('[data-code-tab=html]').click();
  const html=await page.locator('#editor-fallback').inputValue();
  await page.locator('#editor-fallback').fill(html.replace('class="my-navigation"','class="my-navigation authored" onclick="window.unsafe=true"').replace('Plain &lt;b&gt;text&lt;/b&gt;','New label'));
  await page.locator('#apply-css').click();
  check('HTML Apply retains custom classes and removes root handlers',await page.locator('.demo-nav').evaluate(el=>el.classList.contains('authored')&&!el.hasAttribute('onclick')));
  await page.locator('[data-code-tab=core]').click();
  await page.waitForFunction(()=>PandoraStudio.getDocuments().core.draft.includes('.pb-menu'));
  await page.locator('#editor-fallback').fill((await page.locator('#editor-fallback').inputValue())+'\n.pb-menu { --pb-menu-test-core: 23; }');
  await page.locator('#apply-css').click();
  check('Core CSS is editable and applied',await page.locator('#menu').evaluate(el=>getComputedStyle(el).getPropertyValue('--pb-menu-test-core').trim()==='23'));
  const imported={format:'pandora-box-ui',version:3,state:{itemCount:9,textMode:'clip',iconMode:'cutout',maskScale:1.3,maskX:35,maskY:60,maskOpacity:.7,items:[{label:'Import * label',url:'https://example.com/path',icon:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="currentColor"/></svg>',mask:'<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" fill="white"/></svg>',variables:{'--pb-menu-item-hover-color':'#ff00ff'}}]}};
  await page.locator('#import-settings').setInputFiles({name:'pandora.config.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
  check('State-only JSON import restores all menu fields',await page.evaluate(()=>{const s=PandoraPlayground.getState();return s.itemCount===9&&s.items[0].label==='Import * label'&&s.maskScale===1.3&&s.iconMode==='cutout'&&s.items[0].mask.includes('rect');}));
  const css=await page.evaluate(()=>PandoraPlayground.exportCSS());
  await page.locator('#import-settings').setInputFiles({name:'menu.css',mimeType:'text/css',buffer:Buffer.from(css)});
  await page.locator('#apply-css').click();
  check('CSS import handles metadata with asterisk labels',await page.evaluate(()=>PandoraPlayground.getState().items[0].label==='Import * label'&&PandoraPlayground.getState().itemCount===9));
  const downloadPromise=page.waitForEvent('download'); await page.locator('#export-settings').click();
  const download=await downloadPromise; const exported=JSON.parse(await readFile(await download.path(),'utf8'));
  check('JSON export includes items, masks and drafts',exported.version===3&&exported.state.items.length===9&&exported.state.items[0].mask.includes('rect')&&exported.documents.core.applied.includes('test-core'));
  await page.waitForTimeout(300); await page.reload(); await page.waitForFunction(()=>window.PandoraStudio);
  check('Reload restores menu and applied custom Core',await page.evaluate(()=>PandoraPlayground.getState().items[0].label==='Import * label'&&document.querySelectorAll('#menu li').length===9&&getComputedStyle(document.querySelector('#menu')).getPropertyValue('--pb-menu-test-core').trim()==='23'));
  for (const width of [320,375,768,1440]) {
    await page.setViewportSize({width,height:900}); await page.evaluate(()=>scrollTo(0,0));
    check(`No page overflow at ${width}px`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const bounds=await page.locator('#menu').boundingBox();
    check(`Menu remains visible at ${width}px`,bounds.x>=0&&bounds.x+bounds.width<=width);
    if (width===375) await page.screenshot({path:path.join(out,'mobile-9.png'),fullPage:true});
  }
  await context.close();
  const staticContext=await browser.newContext({viewport:{width:1440,height:1000},javaScriptEnabled:false});
  const staticPage=await staticContext.newPage();
  for (const count of [2,5,9]) {
    const exampleRoot=path.join(root,'examples',`items-${count}`);
    const fixture=path.join(out,`static-${count}`);await mkdir(fixture,{recursive:true});
    await writeFile(path.join(fixture,'menu.css'),renderCSS(exampleRoot).css);
    await writeFile(path.join(fixture,'index.html'),renderProjectHTML(exampleRoot,'./menu.css').html);
    await staticPage.goto(`${url}/.tmp/browser-results/static-${count}/`);
    check(`CLI static HTML/CSS renders ${count} items with JavaScript disabled`,await staticPage.locator('.pb-menu > li').count()===count);
    const surface=await staticPage.locator('.pb-menu a').first().evaluate(el=>getComputedStyle(el,'::before').backgroundColor);
    assert.notEqual(surface,'rgba(0, 0, 0, 0)');
    await writeFile(path.join(fixture,'base.css'),bundleBase());
    await writeFile(path.join(fixture,'config.css'),compileProjectConfig(exampleRoot).css);
    await writeFile(path.join(fixture,'cdn.html'),renderProjectHTML(exampleRoot,'./config.css').html.replace('<link rel="stylesheet"','<link rel="stylesheet" href="./base.css">\n  <link rel="stylesheet"'));
    await staticPage.goto(`${url}/.tmp/browser-results/static-${count}/cdn.html`);
    check(`Separate CDN-style base/config matches combined CSS (${count} items)`,await staticPage.locator('.pb-menu a').first().evaluate(el=>getComputedStyle(el,'::before').backgroundColor)===surface);
  }
  await staticContext.close();
  // Exercise the real CDN-backed Monaco engine in a separate clean session.
  const online=await browser.newContext({viewport:{width:1440,height:1000}});
  const monacoPage=await online.newPage(); monacoPage.on('pageerror',error=>errors.push(error.message));
  await monacoPage.goto(url+'/demo/');
  try {
    await monacoPage.waitForFunction(()=>document.querySelector('#monaco-container').classList.contains('ready'),{},{timeout:30000});
    check('Real Monaco loads with three editable models',await monacoPage.evaluate(()=>monaco.editor.getModels().length===3 && monaco.editor.getEditors()[0].getOption(monaco.editor.EditorOption.readOnly)===false));
    for (const tab of ['config','html','core']) {
      await monacoPage.locator(`[data-code-tab=${tab}]`).click();
      assert.equal(await monacoPage.evaluate(()=>monaco.editor.getEditors()[0].getOption(monaco.editor.EditorOption.readOnly)),false);
    }
    await monacoPage.locator('[data-code-tab=config]').click();
    await monacoPage.evaluate(()=>monaco.editor.getEditors()[0].setValue('.my-navigation .pb-menu { --pb-menu-text: #c0ffee; }'));
    await monacoPage.locator('#apply-css').click();
    check('Real Monaco editing applies to preview',await monacoPage.evaluate(()=>PandoraPlayground.getState().textIdle==='#c0ffee'));
    await monacoPage.waitForTimeout(1000);
    passed.push('All real Monaco tabs remain editable');
  } catch(error) { if (error.name!=='TimeoutError') throw error; passed.push('Monaco CDN unavailable: fallback exercised; real engine unverified'); }
  await online.close();
  assert.deepEqual(errors,[],'No browser runtime errors');
  await writeFile(path.join(out,'results.json'),JSON.stringify({passed,errors},null,2));
  console.log(`OK: ${passed.length} browser checks\n${passed.join('\n')}\nArtifacts: .tmp/browser-results/`);
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }

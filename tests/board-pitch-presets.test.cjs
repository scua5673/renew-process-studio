'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
function part(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const pitchMarkup=part('id="pitchSeg"','</div></div>');
const htmlPitch=(source.match(/<html\b[^>]*\bdata-pitch="([^"]*)"/)||[])[1]||'';
const implementation=[
  part('/* Personal board appearance is restored only after its account is verified.','</script>'),
  part('const state={orientation:','function normPitchView('),
  'globalThis.state=state;',
  part('function captureSnap(){','function renderPitchImg(){'),
  part('window.__setPitchImg=function(u){','window.__getPitchN=function(){'),
  part('function loadSnap(s,opts){','/* 저장 무결성 자가점검:'),
  part('  function lum(hex){','  // ---------- custom pitch color ----------'),
  part('  function applyCustom(color, _silent){','  // ---------- emblem ----------'),
  part('  function hookPresets(){','  // ---------- init: restore saved ----------'),
  part('  // ---------- init: restore saved ----------','  if(document.readyState!=="loading") init();'),
  part('  (function(){var _sg=$("pitchSeg");','  seg("labelSeg"'),
  part('  function blankSnap(){','  function loadIdx(i){'),
  part('  function newBoardItem(type){','  function openSaveSheet('),
  'hookPresets();'
].join('\n');
const copy=value=>JSON.parse(JSON.stringify(value));

function setup({stored={}}={}){
  const values=new Map(Object.entries(stored)),css=new Map(),listeners=[],saves=[],timers=[];
  const buttons=Array.from(pitchMarkup.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g),([,markup,label])=>{
    const p=(markup.match(/\bdata-p="([^"]+)"/)||[])[1];
    const classes=new Set(((markup.match(/\bclass="([^"]*)"/)||[])[1]||'').split(/\s+/).filter(Boolean));
    const attrs=new Map(Array.from(markup.matchAll(/([\w-]+)="([^"]*)"/g),([,k,v])=>[k,v]));
    return {dataset:{p},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k),
      toggle(k,on){if(on===undefined)on=!classes.has(k);if(on)classes.add(k);else classes.delete(k);}},
      textContent:label,getAttribute:k=>k==='data-p'?p:attrs.get(k),setAttribute:(k,v)=>attrs.set(k,String(v)),closest:selector=>selector==='button'?buttons.find(b=>b.dataset.p===p):null};
  });
  const seg={children:buttons,querySelectorAll:()=>buttons,addEventListener:(type,fn,capture)=>listeners.push({type,fn,capture:!!capture})};
  const document={documentElement:{dataset:{pitch:htmlPitch},style:{setProperty:(k,v)=>css.set(k,v),getPropertyValue:k=>css.get(k)||'',removeProperty:k=>css.delete(k)}},
    body:{classList:{contains:()=>false}},getElementById:id=>id==='pitchSeg'?seg:null,
    querySelectorAll:selector=>selector==='#pitchSeg button'?buttons:[]};
  let c;
  const context={document,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)},
    $:id=>document.getElementById(id),dc:copy,CX:555,CY:370,PITCH_SPECS:{fifa:{}},world:null,
    sel:null,multiSel:[],uid:2,performance:{now:()=>0},setTimeout(fn){timers.push(fn);},hookBuild(){},tryBuildUI(){},
    normPitchView:v=>v||'full',pitchViewKey:()=>c.state.pitchView||'full',defaultTokenScale:()=>0.46,
    mergeCustomEquip:(items)=>items,loadCustomEquipLib:()=>[],
    buildPitch(){},buildLines(){},buildGrid(){},renderPitchImg(){},applyView(){},renderTokens(){},renderDrawings(){},
    updateDelUI(){},updateAlignBar(){},renderMultiGuides(){},syncBoardLock(){},
    psVaultRequireLogin:()=>true,vaultBoardBegin:()=>({}),curFolder:()=>'',setView(){},showCreateBar(){},toast(){},parent:{postMessage(){}},
    boardSaveLive(){saves.push(copy(c.captureSnap()));},_snap:()=>c.captureSnap()};
  c=vm.createContext(context);c.window=c;
  vm.runInContext(implementation,c,{filename:'board-pitch-presets.js'});
  function select(p){const button=buttons.find(b=>b.dataset.p===p);assert.ok(button,p);const event={target:button,isTrusted:true};
    for(const capture of [true,false])for(const l of listeners)if(l.type==='click'&&l.capture===capture)l.fn(event);}
  return {c,document,css,values,saves,buttons,select,flushTimers(){const pending=timers.splice(0);pending.forEach(fn=>fn());}};
}

function selected(h){return h.buttons.filter(b=>b.classList.contains('on')).map(b=>b.dataset.p);}
function addObjects(h){h.c.state.players=[{id:1,x:123,y:456}];h.c.state.equipment=[{id:2,x:20,y:30}];h.c.state.drawings=[{type:'line',pts:[]}];}

test('first-time board uses navy before and after startup while retaining all five pitch choices',()=>{
  const h=setup();
  assert.equal(htmlPitch,'','the initial HTML must not flash a different pitch');
  assert.deepEqual(h.buttons.map(b=>[b.dataset.p,b.textContent]),[['real','잔디'],['calm','딥그린'],['navy','네이비'],['white','화이트'],['train','훈련']]);
  assert.match(pitchMarkup,/<input\b[^>]*\bid="pitchColPick"/,'custom color selection remains available');
  assert.equal(h.document.documentElement.dataset.pitch,'');assert.equal(h.c.state.pitchImg,null);
  assert.deepEqual(selected(h),['navy']);
  h.c.init();h.flushTimers();
  assert.equal(h.c.captureSnap().pitchTheme,'');assert.equal(h.c.captureSnap().pitchImg,null);
  assert.equal(h.c.__pitchDef.theme,'');assert.equal(h.saves.length,0);
});

test('unowned device pitch preferences cannot tint a new account board during startup',()=>{
  const stored={cs_pitch_img:'@real',cs_pitch_custom:'#aabbcc',cs_pitch_set:'1'};
  const h=setup({stored});h.c.init();h.flushTimers();
  assert.equal(h.document.documentElement.dataset.pitch,'');assert.equal(h.c.state.pitchImg,null);
  assert.equal(h.css.has('--pitchbg'),false);assert.deepEqual(selected(h),['navy']);
  assert.deepEqual(Object.fromEntries(h.values),stored,'reading the board must not delete stored legacy preferences');
  assert.equal(h.saves.length,0);
});

test('choosing grass replaces a custom uploaded pitch and saves the grass theme with the real texture',()=>{
  const h=setup();addObjects(h);h.c.state.pitchImg='data:image/png;base64,synthetic';h.c.__applyPitch('custom','#aabbcc');
  const players=copy(h.c.state.players);h.select('real');
  assert.equal(h.document.documentElement.dataset.pitch,'grass');assert.equal(h.c.state.pitchImg,'@real');
  assert.equal(h.css.has('--pitchbg'),false);assert.equal(h.values.get('cs_pitch_img'),'@real');
  assert.equal(h.saves.at(-1).pitchTheme,'grass');assert.equal(h.saves.at(-1).pitchCustom,null);assert.equal(h.saves.at(-1).pitchImg,'@real');
  assert.deepEqual(copy(h.c.state.players),players);
  assert.deepEqual(selected(h),['real']);assert.equal(h.buttons.find(b=>b.dataset.p==='real').getAttribute('aria-pressed'),'true');
});

test('choosing navy clears both the real texture and an uploaded image without changing board objects',()=>{
  for(const image of ['@real','data:image/png;base64,synthetic']){
    const h=setup();addObjects(h);h.c.state.pitchImg=image;h.values.set('cs_pitch_img','@real');h.c.__applyPitch('custom','#aabbcc');
    const players=copy(h.c.state.players);h.select('navy');
    assert.equal(h.document.documentElement.dataset.pitch,'');assert.equal(h.c.state.pitchImg,null,image);
    assert.equal(h.css.has('--pitchbg'),false);assert.equal(h.values.has('cs_pitch_img'),false);
    assert.equal(h.saves.at(-1).pitchTheme,'');assert.equal(h.saves.at(-1).pitchCustom,null);assert.equal(h.saves.at(-1).pitchImg,null);
    assert.deepEqual(copy(h.c.state.players),players);
    assert.deepEqual(selected(h),['navy']);
  }
});

test('all restored solid-color presets replace uploaded or grass backgrounds and remain selected after saving',()=>{
  for(const preset of ['calm','white','train'])for(const image of ['@real','data:image/png;base64,synthetic']){
    const h=setup();addObjects(h);h.c.__applyPitch('custom','#aabbcc');h.c.state.pitchImg=image;
    const objects=copy(h.c.captureSnap());h.select(preset);
    const snap=h.saves.at(-1);
    assert.equal(snap.pitchTheme,preset);assert.equal(snap.pitchImg,null);assert.equal(snap.pitchCustom,null);
    assert.equal(h.css.has('--pitchbg'),false);assert.deepEqual(snap.players,objects.players);
    assert.deepEqual(snap.equipment,objects.equipment);assert.deepEqual(snap.drawings,objects.drawings);
    assert.deepEqual(selected(h),[preset]);
    assert.equal(h.buttons.find(b=>b.dataset.p===preset).getAttribute('aria-pressed'),'true');
  }
});

test('saved grass and navy reload over the first-time navy default without changing board contents',()=>{
  for(const preset of ['real','navy']){
    const first=setup();addObjects(first);first.select(preset);const saved=copy(first.c.captureSnap());
    const next=setup();next.c.loadSnap(saved);next.c.init();next.flushTimers();
    assert.equal(next.document.documentElement.dataset.pitch,saved.pitchTheme);assert.equal(next.c.state.pitchImg,saved.pitchImg);
    assert.deepEqual(copy(next.c.captureSnap()),saved);assert.deepEqual(selected(next),[preset]);
    assert.equal(next.saves.length,0);
  }
});

test('legacy device custom colors cannot overwrite the restored navy board during delayed initialization',()=>{
  const h=setup();h.values.set('cs_pitch_custom','#aabbcc');h.c.loadSnap({pitchTheme:'',pitchImg:null});
  h.c.init();h.flushTimers();
  assert.equal(h.document.documentElement.dataset.pitch,'');assert.equal(h.c.state.pitchImg,null);
  assert.equal(h.css.has('--pitchbg'),false);assert.equal(h.c.__pitchDef.theme,'');
  assert.equal(h.values.get('cs_pitch_custom'),'#aabbcc','initialization need not mutate the legacy stored setting');
  assert.equal(h.saves.length,0);
});

test('saved custom and legacy preset snapshots retain their appearance without migration',()=>{
  for(const [theme,custom,image] of [['custom','#123456',null],['white',null,null],['train',null,null],['calm',null,null],['custom','#abcdef','data:image/png;base64,synthetic']]){
    const h=setup(),saved={players:[{id:4,x:80,y:90}],pitchTheme:theme,pitchCustom:custom,pitchImg:image};
    const before=copy(saved);h.c.loadSnap(saved,{skipPitch:true});
    assert.equal(h.document.documentElement.dataset.pitch,theme);assert.equal(h.c.state.pitchImg,image);
    assert.equal(h.c.captureSnap().pitchCustom,custom);assert.deepEqual(saved,before,'loading must not migrate the saved object');
    if(custom)assert.equal(h.css.get('--pitchbg'),custom);
    assert.equal(h.saves.length,0,'snapshot restoration must not invoke a preset selection save');
  }
});

test('choosing a custom color removes the previous preset highlight and round-trips as custom',()=>{
  for(const preset of ['navy','real','calm','white','train']){
    const h=setup();h.select(preset);h.c.applyCustom('#123456');
    assert.equal(h.document.documentElement.dataset.pitch,'custom');assert.equal(h.c.state.pitchImg,null);
    assert.deepEqual(selected(h),[]);assert.ok(h.buttons.every(b=>b.getAttribute('aria-pressed')==='false'));
    const saved=h.saves.at(-1);assert.equal(saved.pitchCustom,'#123456');
    const next=setup();next.c.loadSnap(saved);
    assert.equal(next.c.captureSnap().pitchCustom,'#123456');assert.deepEqual(selected(next),[]);
  }
});

test('adding a blank page retains navy, grass, and saved custom appearance while clearing page objects',()=>{
  for(const [theme,custom,image] of [['',null,null],['grass',null,'@real'],['custom','#123456',null],['custom','#abcdef','data:image/png;base64,synthetic']]){
    const h=setup();h.c.loadSnap({players:[{id:9,x:70,y:80}],equipment:[{id:10,x:20,y:30}],drawings:[{type:'line',pts:[]}],pitchTheme:theme,pitchCustom:custom,pitchImg:image});
    const original=copy(h.c.captureSnap()),blank=copy(h.c.blankSnap());
    assert.equal(blank.pitchTheme,theme);assert.equal(blank.pitchCustom,custom);assert.equal(blank.pitchImg,image);
    assert.deepEqual(blank.players,[]);assert.deepEqual(blank.equipment,[]);assert.deepEqual(blank.drawings,[]);
    assert.deepEqual(copy(h.c.captureSnap()),original,'creating the new page must not change the source page');
    h.c.loadSnap(blank);
    assert.equal(h.document.documentElement.dataset.pitch,theme);assert.equal(h.c.state.pitchImg,image);assert.equal(h.c.captureSnap().pitchCustom,custom);
  }
});

test('creating a vault board retains the current appearance and clears only board contents',()=>{
  for(const [theme,custom,image] of [['',null,null],['grass',null,'@real'],['calm',null,null],['white',null,null],['train',null,null],['custom','#123456',null],['custom','#abcdef','data:image/png;base64,synthetic']]){
    const h=setup();h.c.loadSnap({players:[{id:9,x:70,y:80}],equipment:[{id:10,x:20,y:30}],drawings:[{type:'line',pts:[]}],pitchTheme:theme,pitchCustom:custom,pitchImg:image});
    const original=copy(h.c.captureSnap());h.c.newBoardItem('board');
    const created=h.c.captureSnap();
    assert.equal(created.pitchTheme,theme);assert.equal(created.pitchCustom,custom);assert.equal(created.pitchImg,image);
    assert.deepEqual(copy(created.players),[]);assert.deepEqual(copy(created.equipment),[]);assert.deepEqual(copy(created.drawings),[]);
    assert.deepEqual(copy(h.c.__createPrev.snap),original,'cancel can still restore the original board');
  }
});

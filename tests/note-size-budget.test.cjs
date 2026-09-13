'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),noteSource=fs.readFileSync(path.join(root,'studio/note.html'),'utf8'),syncSource=fs.readFileSync(path.join(root,'studio/sync.js'),'utf8');
function section(a,b){const i=noteSource.indexOf(a),j=noteSource.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,`actual note ${a}`);return noteSource.slice(i,j);}
const budgetLine=noteSource.match(/const NOTE_SYNC_SAFE=\d+;/),personalLine=syncSource.match(/var PERSONAL_MAXLEN=(\d+);/);
assert.ok(budgetLine&&personalLine,'shipped note and personal limits exist');
const budget=Number(budgetLine[0].match(/\d+/)[0]),personalBudget=Number(personalLine[1]);
const code="const KEY='cs_notes_v1';"+budgetLine[0]+section('function uid(){','/* 1.504')+
  section('var _noteMem=null,','function saveSoon(){')+
  section('async function importPdfBuffer(','var _noteImportQueue=');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function stateWithChars(chars){const state={notes:{existing:{id:'existing',pages:[{strokes:[]}],memo:''}},cur:'existing'};state.notes.existing.memo='x'.repeat(chars-JSON.stringify(state).length);assert.equal(JSON.stringify(state).length,chars);return state;}

// The shipped persistence, blank-note creation, and full import function run in
// a VM. PDF rendering and IDB are synthetic; no real document or account is read.
function harness(options={}){
  const original=options.initial||{notes:{existing:{id:'existing',pages:[{strokes:[]}],memo:'keep this note'}},cur:'existing'};
  const originalRaw=JSON.stringify(original),idb=new Map([['cs_notes_v1',originalRaw]]),mirror=new Map([['cs_notes_v1',originalRaw]]);
  const writes=[],toasts=[],saved=[],failed=[],nodes=new Map();
  const bg='data:image/jpeg;base64,'+'A'.repeat((options.imageChars||2000000)-23);
  assert.equal(bg.length,options.imageChars||2000000);
  let failWrite=false;
  const c={Promise,note:null,pi:0,redoStack:[],
    $:id=>{if(!nodes.has(id))nodes.set(id,{value:''});return nodes.get(id);},
    toast:message=>toasts.push(message),
    localStorage:{getItem:k=>mirror.get(k)||null,setItem:(k,v)=>mirror.set(k,String(v)),removeItem:k=>mirror.delete(k)},
    storage:{async set(k,v){writes.push({key:k,raw:v});if(failWrite)throw new Error('synthetic IDB failure');idb.set(k,v);return true;}},
    PSSaveState:{ok:key=>saved.push(key),fail:(key,error)=>failed.push({key,error})},
    document:{createElement(tag){assert.equal(tag,'canvas');return {width:0,height:0,getContext:()=>({}),toDataURL:()=>bg};}},
    ensurePdfjs:async()=>({getDocument:()=>({promise:Promise.resolve({numPages:1,getPage:async()=>({getViewport:({scale})=>({width:600*scale,height:800*scale}),render:()=>({promise:Promise.resolve()})})})})}),
    refreshTplSel(){},applyOrient(){},fit(){},updateUI(){},closeDocLibrary(){},
  };
  c.window=c;vm.createContext(c);vm.runInContext(code,c,{filename:'note.html actual size and PDF paths'});c._noteMem=original;
  return {c,idb,mirror,writes,toasts,saved,failed,bg,original,originalRaw,
    failWrites(){failWrite=true;},async flush(){await c._noteWrite.catch(()=>{});await settle();},
    import(){return c.importPdfBuffer(new ArrayBuffer(1),'Synthetic PDF.pdf',{});},
  };
}

test('note import budget leaves half a million characters beneath the actual personal upload limit',()=>{
  assert.equal(budget,11500000);assert.equal(personalBudget,12000000);assert.equal(personalBudget-budget,500000);
});

test('a two-million-character note persists exactly without an obsolete size warning',async()=>{
  const h=harness(),next=stateWithChars(2000000),raw=JSON.stringify(next);
  assert.equal(h.c.persist(next),true);await h.flush();
  assert.equal(h.idb.get('cs_notes_v1'),raw);assert.deepEqual(h.toasts,[]);assert.deepEqual(h.saved,['note']);assert.equal(h.failed.length,0);
});

test('the exact note budget persists without warning',async()=>{
  const h=harness(),next=stateWithChars(budget);
  assert.equal(h.c.persist(next),true);await h.flush();
  assert.equal(h.idb.get('cs_notes_v1'),JSON.stringify(next));assert.deepEqual(h.toasts,[]);
});

test('exceeding the note budget warns but preserves the complete local document',async()=>{
  const h=harness(),next=stateWithChars(11500001),raw=JSON.stringify(next);
  assert.equal(h.c.persist(next),true);await h.flush();
  assert.equal(h.idb.get('cs_notes_v1'),raw);assert.equal(h.c._noteMem,next);assert.equal(h.toasts.length,1);assert.match(h.toasts[0],/이 기기에는 저장되지만/);assert.deepEqual(h.saved,['note']);
});

test('a failed IDB write cannot remove the old mirror or signal local success',async()=>{
  const h=harness();h.failWrites();assert.equal(h.c.persist(stateWithChars(2000000)),true);await h.flush();
  assert.equal(h.idb.get('cs_notes_v1'),h.originalRaw);assert.equal(h.mirror.get('cs_notes_v1'),h.originalRaw);assert.deepEqual(h.saved,[]);assert.equal(h.failed.length,1);
});

test('the actual importer accepts one PDF with a two-million-character rendered page',async()=>{
  const h=harness();assert.equal(await h.import(),true);await h.flush();
  const result=JSON.parse(h.idb.get('cs_notes_v1')),added=result.notes[result.cur];
  assert.equal(added.pages.length,1);assert.equal(added.pages[0].bg,h.bg);assert.equal(added.source.originalPages,1);
  assert.equal(result.notes.existing.memo,'keep this note');assert.ok(h.idb.get('cs_notes_v1').length>2000000);assert.ok(h.idb.get('cs_notes_v1').length<budget);
  assert.equal(h.toasts.some(t=>/용량이 찼어요|동기화 용량/.test(t)),false);assert.equal(h.failed.length,0);
});

test('a new PDF exceeding the aggregate note budget is rejected without deleting existing notes',async()=>{
  const h=harness({initial:stateWithChars(budget-1000000)}),before=h.originalRaw;
  assert.equal(await h.import(),false);await h.flush();
  assert.equal(JSON.stringify(h.c.store()),before);assert.equal(h.idb.get('cs_notes_v1'),before);assert.equal(h.writes.length,0);assert.match(h.toasts.at(-1),/문서 보관함 용량이 찼어요/);
});

test('PDF budget serialization failure rejects the new import instead of bypassing the limit',async()=>{
  const h=harness(),existing=h.c.store();existing.self=existing;
  assert.equal(await h.import(),false);await h.flush();
  assert.deepEqual(Object.keys(existing.notes),['existing']);assert.equal(existing.cur,'existing');assert.equal(existing.self,existing);
  assert.equal(h.idb.get('cs_notes_v1'),h.originalRaw);assert.equal(h.writes.length,0);assert.deepEqual(h.saved,[]);assert.match(h.toasts.at(-1),/문서 보관함 용량이 찼어요/);
});

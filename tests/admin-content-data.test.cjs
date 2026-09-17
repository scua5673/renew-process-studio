const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../studio/admin-content-data.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const snap=n=>({players:[{id:'p',x:n,y:20,num:0}],equipment:[],drawings:[],ball:null,orientation:'h'});
const svg=n=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><text>'+n+'</text></svg>';
const frame=(n,extra={})=>({snap:snap(n),thumb:svg(n),dur:1,...extra});
const values=p=>p.descriptionRows.map(r=>r.value);

for(const [label,wrap] of [
  ['item JSON',b=>b],['full SQL row',b=>({lib_id:'saved',folder:'Folder',item:b})],
  ['RPC array',b=>[{lib_id:'saved',item:b}]],['function key',b=>({ps_admin_library_item:{lib_id:'saved',item:b}})],
  ['serialized row and item',b=>JSON.stringify([{lib_id:'saved',item:JSON.stringify(b)}])],
  ['nested RPC wrappers',b=>({result:{data:{ps_admin_library_item:JSON.stringify({lib_id:'saved',item:{value:JSON.stringify(b)}})}}})]
])test('normalizePayload supports '+label,()=>{
  const item={name:'Synthetic saved content',snap:snap(0)},parsed=C.normalizePayload(wrap(item));
  assert.deepEqual(parsed.body,item);
  if(label!=='item JSON')assert.equal(parsed.row.lib_id,'saved');
});
test('normalization has bounded wrappers and does not inspect fields in real content',()=>{
  const item={name:'Content',data:{name:'Not the content'}};
  assert.equal(C.normalizePayload(item).body,item);
  for(const raw of [null,undefined,42,'{broken','[]','null'])assert.deepEqual(C.normalizePayload(raw).body,{});
  const cyclic={};cyclic.data=cyclic;assert.deepEqual(C.normalizePayload(cyclic).body,{});
  let deep={name:'Too deeply wrapped'};for(let n=0;n<40;n++)deep={value:deep};assert.deepEqual(C.normalizePayload(deep).body,{});
});
test('multi-training card removes representative copies and retains every saved training, scene, and frame',()=>{
  const training1={name:'Warmup',minutes:0,sets:0,rpe:0,method:'Keep moving',snap:snap(1),thumb:svg(1),scenes:[frame(2)],frames:[frame(1),frame(3)]};
  const training2={name:'Finish',method:'Shoot quickly',snap:snap(4),scenes:[frame(5)],frames:[frame(6),frame(7)]};
  const item={type:'train',name:'Session',overview:'Overall aim',snap:clone(training1.snap),thumb:training1.thumb,scenes:clone(training1.scenes),frames:clone(training1.frames),trainings:[training1,training2]};
  const before=JSON.stringify(item),m=C.model(item);
  assert.equal(m.pages.length,7);assert.deepEqual(m.summary,{trainings:2,scenes:7,pages:0,frames:4,slides:0,total:7,truncated:false});
  assert.deepEqual(m.pages.map(p=>p.snap.players[0].x),[1,3,2,4,5,6,7]);
  assert.ok(m.pages.every(p=>values(p).includes('Overall aim')));
  assert.ok(m.pages.slice(0,3).every(p=>values(p).includes('Keep moving')));
  assert.ok(m.pages.slice(3).every(p=>values(p).includes('Shoot quickly')));
  assert.equal(m.pages[0].meta.minutes,0);assert.equal(m.pages[0].meta.sets,0);assert.equal(m.pages[0].meta.rpe,0);
  assert.equal(JSON.stringify(item),before);
  assert.equal(new Set(m.pages.map(p=>p.id)).size,m.pages.length);
});
test('legacy card-level animation remains when no child owns it',()=>{
  const m=C.model({type:'train',name:'Legacy',trainings:[{name:'Drill A',snap:snap(1),description:'Description'}],frames:[frame(10),frame(11)]});
  assert.equal(m.pages.length,3);assert.equal(m.summary.trainings,1);assert.equal(m.summary.frames,2);
  assert.deepEqual(m.pages.map(p=>p.snap.players[0].x),[1,10,11]);
  assert.ok(m.pages.every(p=>values(p).includes('Description')));assert.equal(m.pages[2].meta.trainingName,'Drill A');
});
test('distinct root scenes are retained even when a training array exists',()=>{
  const m=C.model({trainings:[{name:'A',snap:snap(1),scenes:[frame(2)]}],scenes:[frame(8)]});
  assert.deepEqual(m.pages.map(p=>p.snap.players[0].x),[1,2,8]);
});
test('board pages carry their own animation and suppress only the representative frame group',()=>{
  const a=[frame(10),frame(11)],b=[frame(20),frame(21)];
  const item={type:'board',name:'Game',snap:snap(10),frames:clone(b),pages:[{name:'Attack',snap:snap(10),anim:{frames:a,active:0},note:'Attack note'},{name:'Defend',snap:snap(20),anim:{frames:b,active:0},note:'Defend note'}]};
  const m=C.model(item);
  assert.deepEqual(m.pages.map(p=>p.snap.players[0].x),[10,11,20,21]);
  assert.equal(m.summary.pages,2);assert.equal(m.summary.frames,4);assert.equal(m.summary.scenes,4);
  assert.ok(m.pages.slice(0,2).every(p=>values(p).includes('Attack note')));
  assert.ok(m.pages.slice(2).every(p=>values(p).includes('Defend note')));
});
test('intentionally equal static pages and animation frames are not globally collapsed',()=>{
  const item={type:'board',pages:[{name:'First',snap:snap(0)},{name:'Second',snap:snap(0)}],frames:[frame(0,{dur:0}),frame(0,{dur:3})]};
  const m=C.model(item);assert.equal(m.pages.length,4);assert.equal(m.summary.pages,2);assert.equal(m.summary.frames,2);
  assert.equal(m.pages[2].meta.duration,0);assert.equal(m.pages[3].meta.duration,3);
});
test('a genuinely different standalone saved snapshot remains alongside frames',()=>{
  const m=C.model({name:'Board',snap:snap(9),frames:[frame(1),frame(2)]});
  assert.deepEqual(m.pages.map(p=>p.snap.players[0].x),[9,1,2]);
});
test('meeting pages preserve title, bullet points, text, and root context',()=>{
  const item={type:'meeting',name:'Meeting',overview:'Team aim',snap:snap(1),slides:[{title:'Build-up',points:['Pass early','Offer support'],snap:snap(1),note:'Coach one'},{title:'Press',points:['Recover together'],snap:snap(2)}]};
  const m=C.model(item);assert.equal(m.pages.length,2);assert.equal(m.summary.slides,2);assert.deepEqual(m.pages.map(p=>p.label),['Build-up','Press']);
  assert.deepEqual(values(m.pages[0]),['Team aim','Coach one','Pass early\nOffer support']);
  assert.ok(values(m.pages[1]).includes('Recover together'));
});
test('known collections can coexist without hiding a whole collection',()=>{
  const m=C.model({trainings:[{name:'T',snap:snap(1)}],pages:[{name:'P',snap:snap(2)}],slides:[{title:'S',snap:snap(3)}],scenes:[frame(4)],frames:[frame(5)]});
  assert.deepEqual(m.pages.map(p=>p.snap.players[0].x),[1,5,2,3,4]);
  assert.equal(m.summary.trainings,1);assert.equal(m.summary.pages,1);assert.equal(m.summary.slides,1);assert.equal(m.summary.frames,1);
});
test('all distinct description fields survive instead of first truthy alias selection',()=>{
  const fields=['overview','func','description','desc','setup','coaching','coachingPoint','prog','progression','note','memo','method','spDesc','memoQuick','success','fourDs','playerTask','sessionCheck','playerReflection','evidence','summaryLine','coachReflection','nextSession','spCall'];
  const item={name:'All fields',snap:snap(1)};fields.forEach(k=>item[k]='Text for '+k);
  const p=C.pages(item)[0];assert.equal(p.descriptionRows.length,fields.length);
  for(const key of fields)assert.ok(p.descriptionRows.some(r=>r.key===key&&r.value==='Text for '+key));
});
test('different ancestor and child values of the same text field stay together',()=>{
  const p=C.pages({overview:'Card overview',coaching:'Same repeated note',trainings:[{overview:'Drill overview',coaching:'Same repeated note',snap:snap(1),scenes:[{description:'Scene description',snap:snap(2)}]}]})[1];
  assert.deepEqual(values(p),['Card overview','Same repeated note','Drill overview','Scene description']);
  assert.equal(p.descriptionRows.find(r=>r.value==='Card overview').scope,'저장된 내용');
});
test('text-only content is navigable but is not reported as a saved image scene',()=>{
  const m=C.model({type:'train',name:'Notes',method:'A complete training without a drawing',minutes:0,sets:'0',rpe:0});
  assert.equal(m.pages.length,1);assert.equal(m.pages[0].snap,null);assert.equal(m.pages[0].thumb,'');
  assert.equal(m.summary.trainings,1);assert.equal(m.summary.scenes,0);assert.equal(m.pages[0].meta.minutes,0);
});
test('numeric zero survives text fields and snapshot numbers',()=>{
  const p=C.pages({snap:snap(0),note:0,points:[0,'']})[0];
  assert.equal(p.snap.players[0].num,0);assert.equal(p.snap.players[0].x,0);assert.deepEqual(values(p),['0','0']);
});
test('raw SVG, image data, serialized snapshots, and snapshot notes are supported',()=>{
  assert.equal(C.pages({thumb:svg(1)})[0].thumb,svg(1));
  assert.equal(C.pages({thumb:'data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E'})[0].thumb,'data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E');
  assert.equal(C.pages({thumb:'data:image/png;base64,AAAA'})[0].thumb,'data:image/png;base64,AAAA');
  const p=C.pages({snapshot:JSON.stringify({...snap(0),matchNote:'Snapshot annotation'})})[0];
  assert.equal(p.snap.players[0].x,0);assert.ok(values(p).includes('Snapshot annotation'));
});
test('unknown nested objects, profiles, executable fields, and remote thumbs are never traversed',()=>{
  const p=C.pages({name:'Safe',profile:{thumb:svg('private'),description:'private'},arbitrary:{snap:snap(8)},thumb:'https://example.invalid/tracker.svg',note:{message:'Do not stringify objects'}})[0];
  assert.equal(p.thumb,'');assert.equal(p.snap,null);assert.deepEqual(p.descriptionRows,[]);
  const hostile={name:'Safe'};Object.defineProperty(hostile,'thumb',{enumerable:true,get(){throw Error('Getter executed');}});
  assert.doesNotThrow(()=>C.pages(hostile));
});
test('empty or malformed content returns a safe empty model',()=>{
  for(const item of [undefined,null,42,'<svg/>',[],{}])assert.deepEqual(C.summarize(item),{trainings:0,scenes:0,pages:0,frames:0,slides:0,total:0,truncated:false});
});
test('cycle and excessive depth stop with an explicit partial-content indication',()=>{
  const cyclic={name:'Cyclic',snap:snap(0)};cyclic.scenes=[cyclic];
  const m=C.model(cyclic);assert.equal(m.pages.length,1);assert.equal(m.summary.truncated,true);
  const deep={name:'Outer'};let at=deep;for(let n=0;n<80;n++){at.pages=[{name:'Next'}];at=at.pages[0];}
  assert.equal(C.model(deep).summary.truncated,true);
});
test('large arrays are bounded and preserve explicit duplicate entries up to the limit',()=>{
  const m=C.model({slides:Array.from({length:2300},(_,i)=>({title:'Slide '+i,snap:snap(i)}))});
  assert.equal(m.pages.length,2000);assert.equal(m.summary.truncated,true);assert.equal(m.pages.truncated,true);
});
test('frozen inputs stay unchanged and same-value reordered snapshot keys deduplicate',()=>{
  const s=snap(1),reordered={orientation:'h',ball:null,drawings:[],equipment:[],players:clone(s.players)};
  const item={name:'Frozen',snap:s,frames:[{snap:reordered,dur:1},{snap:snap(2),dur:1}]};
  function freeze(o){if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
  freeze(item);const before=JSON.stringify(item);assert.equal(C.pages(item).length,2);assert.equal(JSON.stringify(item),before);
});
test('browser global export is available without CommonJS or DOM access',()=>{
  const context=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../studio/admin-content-data.js'),'utf8'),context);
  assert.equal(typeof context.PSAdminContentData.model,'function');assert.equal(context.PSAdminContentData.pages({note:'Browser note'}).length,1);
});

test('saved custom form fields are included without scanning unrelated arbitrary fields',()=>{
  const p=C.pages({name:'Custom',fmf6x3edn2:'Custom drill guidance',privateLabel:'Do not expose arbitrary labels',profile:{fmf6x3edn2:'Private profile'}})[0];
  assert.deepEqual(values(p),['Custom drill guidance']);assert.equal(p.descriptionRows[0].label,'추가 항목');
});

test('saved labels already containing their training prefix are not prefixed twice',()=>{
  const m=C.model({trainings:[{name:'패스 연결',snap:snap(1),scenes:[{title:'패스 연결 · 추가 배치',snap:snap(2)}],frames:[frame(3,{title:'패스 연결 · 프레임 1'}),frame(4,{title:'패스 연결'}),frame(5,{title:'새 제목'})]}]});
  assert.deepEqual(m.pages.map(p=>p.label),['패스 연결','패스 연결 · 추가 배치','패스 연결 · 프레임 1','패스 연결','패스 연결 · 새 제목']);
});

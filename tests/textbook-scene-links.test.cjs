const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const api=require('../studio/textbook-pack.js'),dir=path.join(__dirname,'../studio/textbook/packs/scenes'),keys=JSON.parse(fs.readFileSync(path.join(dir,'catalog.json')));
const source=fs.readFileSync(path.join(__dirname,'../studio/textbook-pack.js'),'utf8');
function pack(key){return JSON.parse(fs.readFileSync(path.join(dir,key+'.json')));}
test('all 71 published scene links open one native editable scene, including 24 match cases and 18 exercises',()=>{
 assert.equal(keys.length,71);assert.equal(keys.filter(k=>k.startsWith('match-')).length,24);assert.equal(keys.filter(k=>/^d\d\d$/.test(k)).length,18);
 for(const k of keys){const request=api.parse('#textbook=scene-'+k);assert.deepEqual(request,{chapter:'scene-'+k,item:'scene-'+k});assert.equal(api.packUrl(request.chapter,{href:'https://app.invalid/studio/app'}),'https://app.invalid/studio/textbook/packs/scenes/'+k+'.json');const rows=api.selection(pack(k),request);assert.equal(rows.length,1);const d=rows[0];assert.ok(d.name);assert.deepEqual(d.snap,d.frames[0].snap);for(const f of d.frames){assert.ok(f.cap,k+' has a caption');assert.ok(f.snap.players.length);assert.ok(f.snap.players.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));assert.ok(f.snap.drawings.every(d=>!['image','html','script','dash'].includes(d.type)));}}
});
test('unknown scenes, URLs, traversal, mixed ids and wrong card types are rejected',()=>{
 for(const k of ['../ch10','__proto__','constructor','https://outside.invalid/','d19','d01?x=1','%64%30%31','d01&url=x'])assert.equal(api.parse('#textbook=scene-'+k),null);
 const request=api.parse('#textbook=scene-d01');
 for(const mutate of [p=>p.textbook.chapter='scene-d02',p=>p.drills[0].textbookItem='scene-d02',p=>p.drills[0].type='image',p=>p.drills[0].frames=[],p=>p.drills.push(p.drills[0])]){const p=pack('d01');mutate(p);assert.throws(()=>api.selection(p,request));}
 assert.throws(()=>api.selection(pack('d01'),{...request,mode:'fail'}));
});
function boardHarness(key,{existing=false}={}){
 const elements=new Map(),buttons=[],opened=[],toasts=[];let workspace='team',writes=0;const original={libId:'edited-copy',savedAt:4,type:'board',name:'내가 수정한 이름',textbook:{itemId:'scene-'+key,revision:1},snap:{players:[{x:901,y:300}]}};let library=existing?[original]:[];
 function el(tag){const node={tag,style:{},children:[],setAttribute(){},appendChild(c){this.children.push(c);if(c.id)elements.set(c.id,c);},querySelectorAll(){return buttons;},addEventListener(){},showModal(){},remove(){elements.delete(this.id);}};if(tag==='button')buttons.push(node);return node;}
 const events={},parent={postMessage(){}},doc={createElement:el,getElementById:id=>elements.get(id),body:{classList:{contains:()=>false},appendChild(d){elements.set(d.id,d);}}};
 const win={parent,document:doc,PSSync:{activeWs:()=>workspace},addEventListener:(e,f)=>events[e]=f,__snapToThumb:()=>'<svg/>'};
 const ctx={window:win,document:doc,location:{origin:'https://app.invalid',pathname:'/studio/board.html',href:'https://app.invalid/studio/board.html'},URL,AbortController,setTimeout,clearTimeout,fetch:async()=>({ok:true,text:async()=>JSON.stringify(pack(key))}),psVaultRequireLogin:()=>true,libGet:async()=>library,libTurn:fn=>fn(),libWrite:async c=>{writes++;library=c;},libTouch(){},canEditItem:()=>true,stampCreator(){},normalizeDrill(){},toast:t=>toasts.push(t),openLibDrawEditor:async id=>opened.push(id),letterPackShow(){},_trainDraftFrom:x=>x,__sanitizeSnap:x=>x,letterPackCard:(p,dep)=>{const raw=p.drills[0].trainings[0];return{libId:dep.id(),snap:structuredClone(raw.snap),frames:structuredClone(raw.frames),trainings:[structuredClone(raw)]};}};
 vm.runInNewContext(source,ctx);
 return {async show(){await events.message({origin:ctx.location.origin,source:parent,data:{source:'app',type:'textbookPack',...api.parse('#textbook=scene-'+key)}});},async click(label){const b=buttons.find(b=>b.textContent===label);assert.ok(b,label);await b.onclick();await new Promise(setImmediate);},switchWorkspace(){workspace='other';},get library(){return library;},get writes(){return writes;},opened,toasts,original,elements};
}
test('first import opens an editable card; reopening retains the existing edited card',async()=>{
 const first=boardHarness('match-breaking-lines');await first.show();await first.click('담고 수정하기');assert.equal(first.writes,1);assert.equal(first.opened[0],first.library[0].libId);assert.equal(first.library[0].type,'board');assert.equal(first.library[0].frames.length,4);
 const again=boardHarness('match-breaking-lines',{existing:true});await again.show();await again.click('수정본 이어 열기');assert.equal(again.writes,0);assert.equal(again.opened[0],'edited-copy');assert.equal(again.library[0],again.original);
 const copy=boardHarness('match-breaking-lines',{existing:true});await copy.show();await copy.click('새 사본으로 담기');assert.equal(copy.library.length,2);assert.equal(copy.library[1],copy.original);
});
test('switching workspace before confirmation writes nothing and keeps the dialog open',async()=>{
 const h=boardHarness('d01');await h.show();h.switchWorkspace();await h.click('담고 수정하기');assert.equal(h.writes,0);assert.equal(h.opened.length,0);assert.ok(h.elements.has('psTextbookDialog'));
});
test('reviewed teaching scenes preserve measured zones and start each comparison at its first pass',()=>{
 const close=(a,b)=>Math.abs(a-b)<1e-7;
 for(const key of keys.filter(k=>/^d\d\d$/.test(k))){
  const d=pack(key).drills[0],bounds=d.snap.drawings[0].pts,scale=(bounds[1].x-bounds[0].x)/d.trainingArea.width;
  assert.equal(d.textbookRevision,2);
  for(const f of d.frames){const pass=f.snap.drawings.find(s=>s.type==='pass');assert.ok(close(f.snap.ball.x,pass.pts[0].x+17)&&close(f.snap.ball.y,pass.pts[0].y+17),key+' ball marks the first pass origin');}
  if(d.snap.players.some(p=>p.pos==='GK'))assert.ok(d.snap.drawings.some(s=>s.type==='rectline'&&close(Math.abs(s.pts[1].x-s.pts[0].x)/scale,6)&&close(Math.abs(s.pts[1].y-s.pts[0].y)/scale,12)),key+' has a 6 by 12 metre keeper area');
 }
 for(const [key,depth]of[['d02',3],['d05',3],['d09',2],['d10',3],['d17',3],['d18',2]]){
  const d=pack(key).drills[0],bounds=d.snap.drawings[0].pts,scale=(bounds[1].x-bounds[0].x)/d.trainingArea.width;
  for(const side of(key==='d18'?['right']:['left','right'])){const x=side==='left'?bounds[0].x+depth*scale:bounds[1].x-depth*scale;assert.ok(d.snap.drawings.some(s=>s.type==='dashline'&&s.pts.every(p=>close(p.x,x))),key+' '+side+' end zone matches its stated depth');}
 }
});
test('a reviewed teaching copy is added without replacing an earlier edited copy',async()=>{
 const h=boardHarness('d01',{existing:true});await h.show();await h.click('보강판 새 사본으로 담기');assert.equal(h.library.length,2);assert.equal(h.library[0].textbook.revision,2);assert.equal(h.library[1],h.original);assert.equal(h.opened[0],h.library[0].libId);
});

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const api=require('../studio/textbook-pack.js');
const src=fs.readFileSync(path.join(__dirname,'../studio/textbook-pack.js'),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
test('textbook links select only registered chapters or a registered single drill',()=>{
 assert.deepEqual(api.parse('#textbook=ch10'),{chapter:'ch10',item:''});
 for(const i of [1,2,3])assert.deepEqual(api.parse('#textbook=ch10-t'+i),{chapter:'ch10',item:'ch10-t'+i});
 for(const x of ['','#textbook=ch11','#textbook=ch10-t4','#textbook=ch10&x=1','#textbook=https://outside.invalid/data','#textbook=__proto__','#textbook=constructor',null])assert.equal(api.parse(x),null);
 assert.equal(api.packUrl('ch10',{href:'https://example.invalid/studio/board.html'}),'https://example.invalid/studio/textbook/packs/ch10.json');
 for(const x of ['__proto__','constructor','../other','https://outside.invalid'])assert.equal(api.packUrl(x,{href:'https://example.invalid/studio/board.html'}),null);
});
function shell({unlocked=false,player=false}={}){
 const data=new Map(),posts=[],events={},timers=new Map();let note=null,id=0;
 const frame={postMessage:(d,o)=>posts.push({d,o})};
 const doc={body:{classList:{contains:k=>k==='ps-player-idp-only'&&player},appendChild:x=>{note=x;}},createElement:()=>({style:{},setAttribute(){},remove(){note=null;}}),getElementById:k=>k==='fBoard'?{contentWindow:frame}:note};
 const loc={hash:'#textbook=ch10-t2',origin:'https://app.invalid',pathname:'/studio/app.html',search:'',href:'https://app.invalid/studio/app.html#textbook=ch10-t2'};
 const win={document:doc,PSSync:{dataUnlocked:()=>unlocked},__psShowApp(){},addEventListener:(t,f)=>events[t]=f};
 vm.runInNewContext(src,{window:win,document:doc,location:loc,history:{replaceState(){loc.hash='';}},sessionStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},setInterval:f=>{timers.set(++id,f);return id;},clearInterval:i=>timers.delete(i),URL});
 return {posts,data,events,frame,note:()=>note?.textContent,unlock(){unlocked=true;for(const fn of timers.values())fn();}};
}
test('a pending drill waits for sign-in; acknowledgements must come from its board',()=>{
 const s=shell();assert.equal(s.posts.length,0);assert.match(s.note(),/로그인/);assert.ok(s.data.has('ps_textbook_pending_v1'));
 s.unlock();assert.deepEqual(plain(s.posts[0]),{d:{source:'app',type:'textbookPack',chapter:'ch10',item:'ch10-t2'},o:'https://app.invalid'});
 for(const [origin,source] of [['https://outside.invalid',s.frame],['https://app.invalid',{}]]){
  s.events.message({origin,source,data:{source:'board',type:'textbookPackAck'}});assert.ok(s.data.has('ps_textbook_pending_v1'));
 }
 s.events.message({origin:'https://app.invalid',source:s.frame,data:{source:'board',type:'textbookPackAck'}});assert.equal(s.data.size,0);
});
test('player accounts receive an explanation and cannot import',()=>{
 const s=shell({unlocked:true,player:true});assert.equal(s.posts.length,0);assert.match(s.note(),/코치 계정/);assert.equal(s.data.size,0);
});
test('the board ignores messages from another site or another window',()=>{
 const parent={},events={};let reads=0;
 const win={parent,document:{},addEventListener:(t,f)=>events[t]=f};
 vm.runInNewContext(src,{window:win,location:{pathname:'/studio/board.html',origin:'https://app.invalid'},psVaultRequireLogin(){reads++;return true;}});
 const data={source:'app',type:'textbookPack',chapter:'ch10',item:''};
 for(const [origin,source] of [['https://outside.invalid',parent],['https://app.invalid',{}]])events.message({origin,source,data});
 events.message({origin:'https://app.invalid',source:parent,data:{...data,chapter:'__proto__'}});
 assert.equal(reads,0);
});
test('all source drills retain their headcounts, dimensions, constraints and provenance',()=>{
 const p=JSON.parse(fs.readFileSync(path.join(__dirname,'../studio/textbook/packs/ch10.json')));
 assert.deepEqual(p.drills.map(d=>d.snap.players.length),[5,10,14]);
 assert.deepEqual(p.drills.map(d=>d.frames.length),[4,5,7]);
 assert.deepEqual(p.drills.map(d=>d.source.pdfPage),[15,28,29]);
 assert.deepEqual(p.drills.map(d=>d.snap.pitchSpec),['grid30','grid40','grid70']);
 for(const [i,d] of p.drills.entries()){
  assert.equal(d.textbookRevision,4);assert.match(d.coaching,/현장 개입:/);assert.match(d.coaching,/다음/);assert.match(d.method,/원문/);assert.match(d.func,/원문/);assert.match(d.func,/진행:/);assert.match(d.func,/운영 보완:/);assert.ok(d.method.length<4000,'the importer does not truncate the instructions');
  assert.equal(d.frames.every(f=>f.snap.players.length===[5,10,14][i]),true);
  assert.equal(d.snap.tokenScale,1.5);
 }
 assert.match(p.drills[1].method,/첫 터치/);assert.match(p.drills[1].method,/중립 한 터치/);
 assert.match(p.drills[2].method,/첫 터치/);assert.match(p.drills[2].method,/세 터치/);
});

test('offside examples distinguish the finishing boundary from the last opponents',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../studio/textbook/ch10/index.html'),'utf8');
 const scenes=JSON.parse(html.match(/<script id="scenes" type="application\/json">(.*?)<\/script>/s)[1]);
 const pos=f=>{const defenders=f.players.filter(p=>p.team==='red').map(p=>p.x).sort((a,b)=>b-a);return {line:defenders[1],runner:f.players.find(p=>p.id===9).x,ball:f.ball[0]};};
 const bad=pos(scenes.drill3_fail.frames[1]);assert.equal(bad.line,26);assert.ok(bad.runner<30&&bad.runner>bad.line&&bad.runner>bad.ball,'outside finishing zone but beyond the opponents');
 const good=pos(scenes.drill3_coach.frames[2]);assert.ok(good.runner<=good.line,'the adjusted run starts onside');
 for(const base of ['drill1','drill2','drill3'])for(const suffix of ['','_fail','_coach']){
  assert.ok(scenes[base+suffix].frames.every(f=>f.players.length==={drill1:5,drill2:10,drill3:14}[base]));
 }
});


test('native chapter scenes and imports share identical editable snapshots',()=>{
 const native=JSON.parse(fs.readFileSync(path.join(__dirname,'../studio/textbook/packs/ch10-scenes.json')));
 const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../studio/textbook/packs/ch10.json')));
 assert.equal(Object.keys(native).length,16);
 for(const [i,drill] of pack.drills.entries()){
  const key='drill'+(i+1);
  assert.deepEqual(native[key].frames,drill.frames);
  for(const mode of ['fail','coach']){
   assert.deepEqual(native[key+'_'+mode].frames,drill.variants[mode]);
   assert.deepEqual(api.parse('#textbook=ch10-t'+(i+1)+'-'+mode),{chapter:'ch10',item:'ch10-t'+(i+1),mode});
  }
 }
 for(const bad of ['#textbook=ch10-coach','#textbook=ch10-t2-other','#textbook=ch10-t4-coach'])assert.equal(api.parse(bad),null);
});

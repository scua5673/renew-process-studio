const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 2.997 — 프로세스 레터의 훈련 세션을 보관함에 담는다(사용자 «훈련들을 보관함에 담으면 3가지 훈련이 보관함에 담아지게»).
   · 레터의 «보관함에 담기»는 «…/studio/app.html#pack=letter-03» 으로 온다. 받는 곳은 레터 사이트 둘뿐이고 번호는 두 자리 숫자.
   · 셸은 로그인·자료 확인을 기다렸다가 작전판에 알리고, 작전판이 받아 확인 창을 띄운 뒤 카드 한 장(훈련 셋)으로 보관함에 넣는다.
   · 팩에서 아는 칸만 골라 새 카드를 짓는다 — 밖에서 온 그림(SVG 글자)·사진·주소·남의 도장은 받지 않는다. */
const board=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','studio','app.html'),'utf8');
function cut(src,from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const plain=o=>JSON.parse(JSON.stringify(o));
const PURE=cut(board,'/* ── 2.997 · 레터 팩 순수 구간 시작','/* ── 2.997 · 레터 팩 순수 구간 끝 ── */');
function pure(){ const c=vm.createContext({URL}); vm.runInContext(PURE+';this.api={LETTER_PACK_ORIGINS,letterPackUrlOk,letterPackRead,letterPackCard};',c); return c.api; }

const snap=k=>({pitchSpec:k?'grid30':'fifa',players:[{id:101,team:'blue',num:'6',x:400+k*10,y:300,img:'https://outside.invalid/p.png',imgBg:'#fff'},{id:102,team:'red',num:'4',x:520,y:330}],
  equipment:[{id:900,team:'cone',x:300,y:300,src:'javascript:void(0)',scale:1}],drawings:[{type:'text',text:'A'.repeat(500),pts:[{x:320,y:260}]},{type:'line',pts:[{x:1,y:1},{x:2,y:2}]}],
  ball:{x:410,y:310,scale:.62},lines:!k,tokenScale:.6,pitchImg:'https://outside.invalid/pitch.jpg',boardLocked:true,matchNote:'밖에서 온 메모'});
const tr=(i,n)=>({type:'train',name:'연습 '+(i+1),minutes:[15,20,25][i],sets:1,rpe:5,focus:'bp',method:'방법 '+(i+1),coaching:'포인트 '+(i+1),createdBy:'someone-else',libId:'Lx',
  thumb:'<svg onload="hit()"><text>밖에서 온 그림</text></svg>',snap:snap(i),animIdx:7,
  frames:Array.from({length:n},(_,s)=>({snap:snap(i),hold:.6,dur:1.2,hl:[101,{bad:1},'a'],cap:s?('움직임 '+s):'',thumb:'<svg onload="hit()"></svg>',extra:'x'}))});
const pack=()=>({type:'process-studio-drillpack',version:1,drills:[{name:'레터 3호 · 가상 세션',type:'train',focus:'bpo',rpe:7,libId:'Lold',savedAt:1,createdBy:'someone-else',createdByName:'남',folder:'팀 공유',fav:true,tpl:1,
  matchRef:{mid:'m1'},thumb:'<svg onload="hit()"></svg>',snap:snap(0),trainings:[tr(0,3),tr(1,1),tr(2,4)],
  letter:{issue:3,title:'가상 호',session:'가상 세션',theme:'가상 주제',url:'https://process-letter.netlify.app/03/',extra:'x'}}]});
const dep=()=>{ const log={thumb:0};
  return {log,draft:d=>({type:d.type,name:d.name,minutes:d.minutes,sets:d.sets,rpe:d.rpe,focus:d.focus,method:d.method,coaching:d.coaching,tags:d.tags,gmPhases:[]}),
    snap:sn=>{ if(!Array.isArray(sn.players))return null; sn.equipment=sn.equipment||[]; sn.drawings=sn.drawings||[]; return sn; },
    thumb:()=>{ log.thumb++; return '<svg data-made="here"></svg>'; },id:()=>'Lnew',now:1234}; };

test('only the two letter sites, a two-digit number and nothing else make a pack address',()=>{
  const g=pure();
  assert.deepEqual(plain(g.LETTER_PACK_ORIGINS),['https://process-letter.netlify.app','https://process-letter-sessions.netlify.app']);
  for(const ok of ['https://process-letter.netlify.app/media/packs/03.json','https://process-letter-sessions.netlify.app/packs/46.json'])assert.equal(g.letterPackUrlOk(ok),true,ok);
  for(const bad of ['http://process-letter.netlify.app/media/packs/03.json','https://process-letter.netlify.app.evil.invalid/packs/03.json','https://evil.invalid/packs/03.json',
    'https://process-letter.netlify.app/media/packs/3.json','https://process-letter.netlify.app/media/packs/03.json?x=1','https://process-letter.netlify.app/media/packs/03.json#a',
    'https://user:pw@process-letter.netlify.app/media/packs/03.json','https://process-letter.netlify.app/packs/../03.json','javascript:alert(1)','',null])assert.equal(g.letterPackUrlOk(bad),false,String(bad));
});

test('the summary the confirm sheet shows comes from the pack, and odd shapes are turned away',()=>{
  const g=pure(),info=plain(g.letterPackRead(pack()));
  assert.deepEqual(info,{issue:3,session:'가상 세션',name:'레터 3호 · 가상 세션',minutes:60,trainings:[{name:'연습 1',minutes:15,scenes:3},{name:'연습 2',minutes:20,scenes:1},{name:'연습 3',minutes:25,scenes:4}]});
  const no=f=>{ const p=pack(); f(p); return g.letterPackRead(p); };
  assert.equal(no(p=>{p.type='other';}),null,'not a drill pack');
  assert.equal(no(p=>{p.drills.push(p.drills[0]);}),null,'one card per session');
  assert.equal(no(p=>{p.drills[0].trainings=[];}),null,'a session has trainings');
  assert.equal(no(p=>{p.drills[0].trainings=Array(7).fill(p.drills[0].trainings[0]);}),null,'at most six trainings');
  assert.equal(no(p=>{delete p.drills[0].trainings[1].snap;}),null,'every training carries its board');
  assert.equal(no(p=>{p.drills[0].trainings[2].snap.players='x';}),null);
  assert.equal(g.letterPackRead(null),null);
  const odd=plain(no(p=>{ p.drills[0].name=7; p.drills[0].letter={issue:'x'}; p.drills[0].trainings[0].name=''; p.drills[0].trainings[0].minutes=-5; }));
  assert.deepEqual([odd.issue,odd.name,odd.session,odd.trainings[0].name,odd.trainings[0].minutes],[0,'프로세스 레터 훈련 세션','', '훈련 1',0],'odd values fall back instead of leaking through');
});

test('the card is built from known fields only — three trainings, each with its own scenes',()=>{
  const g=pure(),d=dep(),c=plain(g.letterPackCard(pack(),d));
  assert.deepEqual([c.libId,c.savedAt,c.name,c.type,c.minutes,c.sets,c.trainings.length],['Lnew',1234,'레터 3호 · 가상 세션','train',60,1,3]);
  assert.deepEqual(c.trainings.map(t=>[t.name,t.minutes,t.method,t.coaching]),[['연습 1',15,'방법 1','포인트 1'],['연습 2',20,'방법 2','포인트 2'],['연습 3',25,'방법 3','포인트 3']]);
  assert.deepEqual(c.trainings.map(t=>(t.frames||[]).length),[3,0,4],'a training with one scene keeps no animation — same as the app');
  assert.deepEqual(c.trainings.map(t=>t.animIdx),[0,undefined,0]);
  assert.equal(c.frames.length,3,'the card shows the first training that has an animation');
  assert.deepEqual(c.tags,['프로세스 레터']);
  assert.deepEqual([c.focus,c.rpe],['bpo',7],'the session keeps its own topic — a defending session is not filed under attack');
  const odd=pack(); odd.drills[0].focus={x:1}; odd.drills[0].rpe=99;
  assert.deepEqual([g.letterPackCard(odd,dep()).focus,g.letterPackCard(odd,dep()).rpe],['bp',5]);
  assert.deepEqual(c.letter,{issue:3,session:'가상 세션',title:'가상 호',theme:'가상 주제',url:'https://process-letter.netlify.app/03/'});
  for(const k of ['createdBy','createdByName','folder','fav','tpl','matchRef'])assert.equal(k in c,false,'the card does not inherit '+k);
  for(const t of c.trainings)for(const k of ['createdBy','libId'])assert.equal(k in t,false,'a training does not inherit '+k);
  assert.deepEqual(Object.keys(c.trainings[0].frames[1]).sort(),['cap','dur','hl','hold','snap'],'scene fields are picked one by one');
  assert.deepEqual(c.trainings[0].frames[1].hl,[101,'a'],'highlight ids are numbers or strings');
});

test('nothing drawn or addressed from outside reaches the card',()=>{
  const g=pure(),d=dep(),c=g.letterPackCard(pack(),d),json=JSON.stringify(c);
  assert.equal(d.log.thumb,3,'one picture per training, made here');
  assert.ok(c.trainings.every(t=>t.thumb==='<svg data-made="here"></svg>')&&c.thumb===c.trainings[0].thumb);
  assert.equal(c.trainings[0].frames[0].thumb,c.trainings[0].thumb,'scene 0 carries the picture made here');
  assert.equal('thumb' in c.trainings[0].frames[1],false);
  for(const bad of ['onload','밖에서 온 그림','outside.invalid','javascript:','밖에서 온 메모'])assert.equal(json.includes(bad),false,'no «'+bad+'» in the card');
  const s=plain(c.trainings[2].snap);
  assert.deepEqual([s.pitchImg,s.boardLocked,s.matchNote,s.equipment[0].src,'img' in s.players[0]],[null,false,'',null,false]);
  assert.equal(s.drawings[0].text.length,200,'long labels are cut');
  assert.equal('text' in s.drawings[1],false);
  assert.equal(s.pitchSpec,'grid30','the board the training was drawn on stays');
  const p=pack(); p.drills[0].letter.url='https://evil.invalid/03/';
  assert.equal(g.letterPackCard(p,dep()).letter.url,'','a link back is kept only when it points at the letter');
  const q=pack(); q.drills[0].trainings[1].snap={players:'x'};
  assert.equal(g.letterPackCard(q,dep()),null,'a broken board stops the whole card');
});

test('the card builder leaves the pack it was given untouched',()=>{
  const g=pure(),p=pack(),before=JSON.stringify(p);
  g.letterPackCard(p,dep());
  assert.equal(JSON.stringify(p),before);
});

/* 셸의 입구 — 주소를 읽어 이 탭에 적어 두고, 자료가 열리면 보관함으로 가서 작전판에 알린다 */
function shell({hash='',unlocked=true,booting=false,player=false,stored=null}={}){
  const blk=cut(app,'/* ══ 2.997 · 프로세스 레터 훈련 세션을 보관함에','</script>');
  const code=blk.slice(blk.indexOf('(function(){'));
  const ss=new Map(stored?[['ps_pack_pending_v1',stored]]:[]),posts=[],shown=[],listeners={},timers=[];let noteEl=null;
  const cls=new Set([...(booting?['ps-booting']:[]),...(player?['ps-player-idp-only']:[])]);
  const board={postMessage:(m,o)=>posts.push([m,o])};
  const el=()=>{ const e={style:{},attrs:{},textContent:'',setAttribute(k,v){this.attrs[k]=v;},remove(){noteEl=null;}}; return e; };
  const win={PSSync:{dataUnlocked:()=>unlocked},__psShowApp:a=>{shown.push(a);doc.body.app=a;},addEventListener:(t,f)=>{(listeners[t]=listeners[t]||[]).push(f);}};
  const doc={readyState:'complete',body:{app:'board',classList:{contains:c=>cls.has(c)},getAttribute:()=>doc.body.app,appendChild:e=>{noteEl=e;}},
    getElementById:id=>id==='fBoard'?{contentWindow:board}:(id==='psPackNote'?noteEl:null),createElement:el,addEventListener(){}};
  const loc={hash,pathname:'/studio/app.html',search:'',origin:'https://app.invalid'};
  const ctx=vm.createContext({window:win,document:doc,location:loc,history:{replaceState:(a,b,u)=>{loc.hash='';loc.replaced=u;}},
    sessionStorage:{getItem:k=>ss.has(k)?ss.get(k):null,setItem:(k,v)=>ss.set(k,String(v)),removeItem:k=>ss.delete(k)},
    setInterval:f=>{timers.push(f);return timers.length;},clearInterval:n=>{timers[n-1]=null;},setTimeout:()=>0,Date,JSON,Object,String,Number});
  vm.runInContext(code,ctx);
  return {win,loc,ss,posts,shown,cls,board,tick:()=>timers.filter(Boolean).forEach(f=>f()),fire:(t,e)=>(listeners[t]||[]).forEach(f=>f(e)),note:()=>noteEl&&noteEl.textContent,setUnlocked:v=>{unlocked=v;},timers:()=>timers.filter(Boolean).length};
}

test('the address names a source from a fixed list and a two-digit number — never a URL',()=>{
  const s=shell(),p=h=>{ const r=s.win.__psPackParse(h); return r&&[r.id,r.no,r.url]; };
  assert.deepEqual(p('#pack=letter-03'),['letter-03',3,'https://process-letter.netlify.app/media/packs/03.json']);
  assert.deepEqual(p('#pack=review-46'),['review-46',46,'https://process-letter-sessions.netlify.app/packs/46.json']);
  for(const bad of ['#pack=evil-03','#pack=review-3','#pack=review-003','#pack=review-03x','#pack=review-03&x=1','#pack=https://evil.invalid/a.json','#pack=constructor-03','#pack=toString-03','#share=abc','#pack=','',null])assert.equal(p(bad),null,String(bad));
  const g=pure();
  for(const id of ['letter-03','review-46'])assert.equal(g.letterPackUrlOk(s.win.__psPackParse('#pack='+id).url),true,'the board accepts what the shell builds: '+id);
});

test('a signed-in coach lands in the vault and the board is told until it answers',()=>{
  const s=shell({hash:'#pack=review-03'});
  assert.equal(s.loc.hash,'','the address is cleaned at once — a reload does not ask twice');
  assert.equal(s.loc.replaced,'/studio/app.html');
  assert.deepEqual(s.shown,['design']);
  assert.deepEqual(plain(s.posts),[[{source:'app',type:'letterPack',id:'review-03',url:'https://process-letter-sessions.netlify.app/packs/03.json'},'https://app.invalid']]);
  s.tick();s.tick();
  assert.equal(s.posts.length,3,'sent again while the board has not answered');
  assert.deepEqual(s.shown,['design'],'the vault is opened once');
  s.fire('message',{origin:'https://evil.invalid',source:s.board,data:{source:'board',type:'letterPackAck'}});
  s.fire('message',{origin:'https://app.invalid',source:{},data:{source:'board',type:'letterPackAck'}});
  assert.equal(s.ss.has('ps_pack_pending_v1'),true,'only the board frame of this app can answer');
  s.fire('message',{origin:'https://app.invalid',source:s.board,data:{source:'board',type:'letterPackAck'}});
  assert.equal(s.ss.has('ps_pack_pending_v1'),false);
  assert.equal(s.timers(),0);
  s.tick();
  assert.equal(s.posts.length,3,'nothing more is sent after the answer');
});

test('before sign-in the request waits in this tab and continues once the data opens',()=>{
  const s=shell({hash:'#pack=letter-12',unlocked:false});
  assert.deepEqual(s.posts,[],'the board is not asked while the vault is closed');
  assert.deepEqual(s.shown,['design'],'the vault shows where to sign in');
  assert.match(s.note(),/로그인하면 프로세스 레터 12호 훈련 세션을 보관함에 담습니다/);
  assert.equal(JSON.parse(s.ss.get('ps_pack_pending_v1')).id,'letter-12');
  s.tick();
  assert.deepEqual(s.shown,['design'],'the vault is not reopened on every tick');
  // 로그인하고 돌아온 새 문서 — 주소에는 아무것도 없고 이 탭의 메모만 남아 있다
  const back=shell({hash:'',stored:s.ss.get('ps_pack_pending_v1')});
  assert.equal(back.posts.length,1);
  assert.equal(back.posts[0][0].id,'letter-12');
  assert.equal(back.note(),null);
  // 같은 문서에서 로그인이 끝난 경우
  s.setUnlocked(true); s.fire('ps-auth-state',{});
  assert.equal(s.posts.length,1);
});

test('the request does not outlive its tab note, a booting app waits, and a player account is told why',()=>{
  const old=shell({stored:JSON.stringify({id:'letter-03',at:Date.now()-31*60*1000})});
  assert.deepEqual([old.posts.length,old.ss.has('ps_pack_pending_v1')],[0,false],'an old note is dropped');
  const forged=shell({stored:JSON.stringify({id:'evil-03',at:Date.now()})});
  assert.deepEqual([forged.posts.length,forged.ss.has('ps_pack_pending_v1')],[0,false],'a note that names another source is dropped');
  const boot=shell({hash:'#pack=review-03',booting:true});
  assert.deepEqual([boot.posts.length,boot.shown.length],[0,0]);
  boot.cls.delete('ps-booting'); boot.tick();
  assert.equal(boot.posts.length,1);
  const pl=shell({hash:'#pack=review-03',player:true});
  assert.deepEqual([pl.posts.length,pl.shown.length,pl.ss.has('ps_pack_pending_v1')],[0,0,false]);
  assert.match(pl.note(),/코칭스태프/);
  const none=shell({hash:'#share=abc'});
  assert.deepEqual([none.posts.length,none.loc.hash,none.timers()],[0,'#share=abc',0],'other addresses are left alone');
});

test('the board asks before saving, stamps the maker, and both sides name the same two sites',()=>{
  const fn=cut(board,'window.__letterPackOpen=function(req){','\n};');
  assert.match(fn,/letterPackAck/,'the board answers the shell first');
  assert.ok(fn.indexOf('letterPackUrlOk(req.url)')<fn.indexOf('fetch(req.url'),'the address is checked before anything is fetched');
  assert.ok(fn.indexOf('psVaultRequireLogin()')<fn.indexOf('fetch(req.url'),'a closed vault fetches nothing');
  assert.match(fn,/credentials:"omit"/);
  assert.match(fn,/redirect:"error"/);
  assert.match(fn,/letterPackSheet\(pack,info,lib\)/,'what arrives goes to the confirm sheet, not straight into the vault');
  const save=cut(board,'async function letterPackSave(pack){','\n}');
  assert.match(save,/stampCreator\(card\)/);
  assert.match(save,/libTurn\(/,'the vault list is read and written in one turn');
  assert.match(save,/window\.__snapToThumb\(sn\)/,'pictures are drawn by this board');
  assert.match(board,/if\(d\.source==='app'&&d\.type==='letterPack'\)\{ try\{ window\.__letterPackOpen\(d\); \}/);
  const blk=cut(app,'/* ══ 2.997 · 프로세스 레터 훈련 세션을 보관함에','</script>');
  for(const o of plain(pure().LETTER_PACK_ORIGINS))assert.ok(blk.includes("'"+o+"/"),'the shell list names '+o);
});

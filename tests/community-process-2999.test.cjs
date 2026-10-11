const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 2.999 — 커뮤니티 안의 «프로세스» 칸(사용자 «만든 훈련들 전부 커뮤니티에 따로 프로세스 페이지 만들어서 올려줘» → 목업 A안: 세션 한 장에 훈련 셋).
   · 서버(ps_community)에 글을 쓰지 않는다. 훈련 세션 사이트의 목록(packs/index.json)을 읽어 그린다 — 새 세션이 실리면 저절로 생긴다.
   · 주소는 목록에서 받지 않는다. 번호로 팩·그림 주소를 스스로 짓는다.
   · «보관함에 담기»는 레터와 같은 길(2.997 «#pack=review-NN») — 그래서 읽는 곳이 셸·작전판의 목록과 같아야 한다. */
const comm=fs.readFileSync(path.join(__dirname,'..','studio','community.html'),'utf8');
const board=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','studio','app.html'),'utf8');
function cut(src,from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const plain=o=>JSON.parse(JSON.stringify(o));
const PURE=cut(comm,'/* ── 2.999 · 프로세스 칸 순수 구간 시작','/* ── 2.999 · 프로세스 칸 순수 구간 끝 ── */');
function pure(){ const c=vm.createContext({}); vm.runInContext(PURE+';this.api={PROC_BASE,PROC_SRC,PROC_GROUPS,procGroupOf,procRead,procUrl,procMatch,procItem};',c); return c.api; }
const LETTER=cut(board,'/* ── 2.997 · 레터 팩 순수 구간 시작','/* ── 2.997 · 레터 팩 순수 구간 끝 ── */');
function letter(){ const c=vm.createContext({URL}); vm.runInContext(LETTER+';this.api={LETTER_PACK_ORIGINS,letterPackUrlOk};',c); return c.api; }

// 훈련 세션 사이트의 pack-index.cjs 가 내는 모양
const row=(n,over)=>Object.assign({n,rev:'92ac33a65a',session:'가상 세션 '+n,letter:'가상 호 '+n,theme:'공격 조직 › 인지',minutes:60,
  trainings:[{name:'연습 1',minutes:15,scenes:6},{name:'연습 2',minutes:20,scenes:5},{name:'연습 3',minutes:25,scenes:5}]},over||{});
const index=rows=>({type:'process-studio-pack-index',version:1,sessions:rows});
const snap=k=>({pitchSpec:'grid30',players:[{id:101,team:'blue',num:'6',x:400+k,y:300,name:'홍길동'},{id:102,team:'img',src:'data:image/png;base64,AAAA',x:5,y:5}],equipment:[],drawings:[],customImages:[{src:'x'}]});
const tr=(i,n)=>({type:'train',name:'연습 '+(i+1),minutes:[15,20,25][i],sets:1,rpe:5,focus:'bp',method:'방법 '+(i+1),coaching:'포인트 '+(i+1),thumb:'<svg onload="hit()"></svg>',snap:snap(i),animIdx:0,
  frames:Array.from({length:n},(_,s)=>({snap:snap(i+s),hold:.6,dur:1.2,cap:'움직임 '+s,thumb:'<svg onload="hit()"></svg>'}))});
const pack=issue=>({type:'process-studio-drillpack',version:1,drills:[{name:'레터 '+issue+'호 · 가상 세션',type:'train',focus:'bpo',rpe:7,minutes:60,sets:1,tags:['프로세스 레터'],libId:'Lold',createdBy:'someone-else',folder:'팀 공유',fav:true,
  thumb:'<svg onload="hit()"></svg>',snap:snap(0),trainings:[tr(0,3),tr(1,1),tr(2,4)],frames:tr(0,3).frames,scenes:[{snap:snap(9)}],
  letter:{issue,title:'가상 호',session:'가상 세션',theme:'공격 조직 › 인지',url:'https://process-letter.netlify.app/0'+issue+'/'}}]});
// 커뮤니티가 글을 올릴 때 쓰는 함수의 모양(stripSnap · stripTrainings · stripFrames)
const stripSnap=sn=>{ if(!sn)return null; const c=plain(sn); c.customImages=[]; c.players=c.players.map(p=>{ if(p.team==='img'){p.team='blue';delete p.src;} if(p.name)p.name=''; return p; }); return c; };
const dep=()=>({fields:['name','focus','minutes','sets','rpe','tags','type','snap','scenes','frames','coaching'],snap:stripSnap,
  trainings:d=>d.trainings.map(t=>{ const c=plain(t); c.snap=stripSnap(c.snap); return c; }),
  frames:fr=>(!Array.isArray(fr)||fr.length<2)?null:fr.map(f=>Object.assign(plain(f),{snap:stripSnap(f.snap),thumb:''}))});

test('the process tab reads the same place the vault flow reads — the shell and the board already trust it',()=>{
  const g=pure(),l=letter();
  const m=/var SRC=\{letter:'([^']+)',review:'([^']+)'\}/.exec(app);
  assert.ok(m,'app.html 의 SRC');
  assert.equal(g.PROC_SRC,'review');
  assert.equal(g.PROC_BASE,m[2],'«보관함에 담기»(#pack=review-NN)가 읽는 팩과 같은 팩');
  assert.ok(plain(l.LETTER_PACK_ORIGINS).includes(new URL(g.PROC_BASE).origin),'작전판이 받는 출처');
  const s=g.procRead(index([row(3)]))[0];
  assert.equal(g.procUrl('pack',s),'https://process-letter-sessions.netlify.app/packs/03.json');
  assert.equal(l.letterPackUrlOk(g.procUrl('pack',s)),true,'작전판의 주소 검사를 지난다');
  assert.equal(g.procUrl('index'),'https://process-letter-sessions.netlify.app/packs/index.json');
  assert.equal(g.procUrl('thumb',s,2),'https://process-letter-sessions.netlify.app/packs/thumbs/03-2.svg?v=92ac33a65a');
  assert.equal(g.procUrl('thumb',s,'9/../x'),'https://process-letter-sessions.netlify.app/packs/thumbs/03-1.svg?v=92ac33a65a','그림 번호는 1~6');
});

test('the list comes from the index — in issue order, and odd rows are skipped instead of leaking through',()=>{
  const g=pure();
  const list=plain(g.procRead(index([row(14,{theme:'수비 조직 › 압박'}),row(3),row(3,{session:'같은 번호 한 번 더'}),null,'x',row(0),row(100),row(4.5),row(5,{session:'  '}),row(6,{trainings:[]}),
    row(7,{trainings:Array(7).fill({name:'a',minutes:1,scenes:1})}),row(8,{rev:'../../x',theme:7,letter:{a:1},trainings:[{name:'',minutes:-5,scenes:999},null,{name:'x'.repeat(200),minutes:'20',scenes:2.9}]})])));
  assert.deepEqual(list.map(s=>s.n),[3,8,14]);
  assert.deepEqual(list[0],{n:3,nn:'03',rev:'92ac33a65a',session:'가상 세션 3',letter:'가상 호 3',theme:'공격 조직 › 인지',head:'공격 조직',tail:'인지',group:'att',minutes:60,scenes:16,
    trainings:[{name:'연습 1',minutes:15,scenes:6},{name:'연습 2',minutes:20,scenes:5},{name:'연습 3',minutes:25,scenes:5}]});
  const odd=list[1];
  assert.deepEqual([odd.rev,odd.theme,odd.letter,odd.group,odd.minutes,odd.scenes],['','','','etc',20,2],'모르는 값은 빈 값·기본값');
  assert.deepEqual(odd.trainings.map(t=>[t.name.length,t.minutes,t.scenes]),[[4,0,0],[4,0,0],[60,20,2]],'이름은 60자 · 빈 이름은 «훈련 N»');
  assert.equal(odd.trainings[0].name,'훈련 1');
  assert.equal(g.procUrl('thumb',odd,1),'https://process-letter-sessions.netlify.app/packs/thumbs/08-1.svg','지문이 이상하면 붙이지 않는다');
  for(const bad of [null,{},{type:'other',sessions:[]},{type:'process-studio-pack-index',sessions:'x'}])assert.equal(g.procRead(bad),null);
  assert.equal(g.procRead(index(Array.from({length:150},(_,i)=>row(i+1)))).length,99,'번호는 팩 주소와 같은 두 자리');
  assert.equal(JSON.stringify(list).includes('http'),false,'목록의 주소는 어디에도 쓰이지 않는다');
});

test('themes fold into the chips, and search looks inside the session — its theme, its letter and its training names',()=>{
  const g=pure();
  assert.deepEqual(['공격 조직 › 인지','수비 조직','공격 → 수비 전환 › 카운터프레스','수비 → 공격 전환','세트피스 › 공격 코너킥','훈련 설계 › 부하','피지컬','경기 준비 › 원정','처음 보는 주제',''].map(g.procGroupOf),
    ['att','def','tr','tr','set','plan','phys','phys','etc','etc']);
  assert.deepEqual(plain(g.PROC_GROUPS).map(x=>x[0]),['att','def','tr','set','plan','phys','etc']);
  const s=g.procRead(index([row(3,{trainings:[{name:'4v2 론도',minutes:15,scenes:4},{name:'빌드업 게임',minutes:25,scenes:6}]})]))[0];
  assert.equal(g.procMatch(s,'all',''),true);
  assert.equal(g.procMatch(s,'att',''),true);
  assert.equal(g.procMatch(s,'def',''),false);
  for(const q of ['론도','빌드업 게임','가상 세션','인지','가상 호'])assert.equal(g.procMatch(s,'all',q),true,q);
  assert.equal(g.procMatch(s,'all','세트피스'),false);
  assert.equal(g.procMatch(s,'def','론도'),false,'주제와 검색은 함께 건다');
});

test('a pack becomes what the read-only viewer takes — the same fields a coach post carries, with no pictures from outside',()=>{
  const g=pure(),s=g.procRead(index([row(3)]))[0],it=plain(g.procItem(pack(3),s,dep()));
  assert.deepEqual([it.type,it.name,it.focus,it.minutes,it.trainings.length],['train','레터 3호 · 가상 세션','bpo',60,3]);
  assert.deepEqual(it.trainings.map(t=>[t.name,t.minutes,t.method,t.coaching,(t.frames||[]).length]),[['연습 1',15,'방법 1','포인트 1',3],['연습 2',20,'방법 2','포인트 2',0],['연습 3',25,'방법 3','포인트 3',4]],'장면이 하나뿐인 훈련은 애니메이션 없이');
  assert.equal(it.frames.length,3,'카드 대표 장면');
  assert.equal('scenes' in it,false);
  const json=JSON.stringify(it);
  for(const bad of ['onload','<svg','홍길동','data:image','Lold','someone-else','팀 공유'])assert.equal(json.includes(bad),false,'글에 «'+bad+'» 가 없다');
  assert.deepEqual([it.libId,it.createdBy,it.folder,it.fav,it.letter,it.thumb],[undefined,undefined,undefined,undefined,undefined,undefined],'올리기가 고르는 칸만');
  assert.ok(it.trainings.every(t=>t.thumb===''&&(t.frames||[]).every(f=>f.thumb==='')),'팩 안의 그림은 넘기지 않는다');
  const no=f=>{ const p=pack(3); f(p); return g.procItem(p,s,dep()); };
  assert.equal(no(p=>{p.type='other';}),null);
  assert.equal(no(p=>{p.drills.push(p.drills[0]);}),null);
  assert.equal(no(p=>{p.drills[0].letter.issue=4;}),null,'목록의 그 호가 아니면 받지 않는다');
  assert.equal(no(p=>{p.drills[0].trainings.pop();}),null,'훈련 수가 목록과 다르면 받지 않는다');
  assert.equal(no(p=>{delete p.drills[0].trainings[1].snap;}),null);
  assert.equal(no(p=>{p.drills[0].trainings[2].snap.players='x';}),null);
  assert.equal(g.procItem(null,s,dep()),null);
});

test('the process tab stays out of the server — no views, no copies, no reports, no uploads for a process session',()=>{
  const body=cut(comm,'/* ── 2.999 · 프로세스 칸 순수 구간 끝 ── */','var q=$(\'commSearch\');if(!q)return;var composing=false;');
  assert.equal(/rest\/v1|base\(\)|hd\(/.test(body),false,'프로세스 칸의 코드는 서버 주소를 부르지 않는다');
  assert.match(body,/credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'/,'쿠키 없이 · 다른 곳으로 넘기지 않고 읽는다');
  assert.match(comm,/function copyToLib\(p,btn\)\{\n  if\(p&&p\.proc\)\{procSave\(p\);return;\}/,'담기는 보관함 확인 창(2.997)으로');
  assert.match(comm,/function copyPreviewPost\(p,btn\)\{\n  if\(p&&p\.proc\)\{procSave\(p\);return;\}/);
  assert.match(comm,/if\(p\.proc\)\{ if\(act==='copy'\)procSave\(p\); return; \}/,'신고·삭제·고치기는 코치 자료만');
  assert.match(comm,/if\(p\.proc\)\{ if\(!p\.item\)\{procOpen\(p,null\);return;\} \}[^\n]*\n  else\{\n  try\{fetch\(base\(\)\+'\/rest\/v1\/rpc\/ps_comm_view'/,'조회수는 서버 글만');
  assert.match(body,/var hash='#pack='\+PROC_SRC\+'-'\+p\.s\.nn;/);
  assert.match(body,/window\.parent\.location\.hash=hash/,'레터의 단추와 같은 주소를 셸에 건넨다');
});

test('the viewer says whose session it is and offers one thing — putting it in the vault',()=>{
  assert.match(board,/post\.proc\?\('<b>프로세스 훈련 세션<\/b> — 훈련 '\+\(post\.procN\|\|/);
  assert.match(board,/\+\(post\.proc\?'':'<button id="commRepBtn"/,'신고 단추 없음');
  assert.match(board,/if\(post\.proc\)\{ try\{parent\.postMessage\(\{source:"board",type:"commAct",act:"copy",id:post\.id\},"\*"\);\}catch\(_\)\{\} return; \}/,'«담겼어요»는 보관함의 확인 창이 말한다');
  assert.match(board,/if\(rb\)rb\.onclick=/);
});

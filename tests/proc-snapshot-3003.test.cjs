const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 3.003 — 커뮤니티 «프로세스» 칸이 훈련 세션 사이트 하나에 기대던 것.
   그 사이트(검토본)가 다시 닫히거나 닿지 않으면 칸 전체가 «불러오지 못했어요»였다. 앱에 사본(studio/packs/)을 싣고,
   사이트에서 먼저 읽되 안 되면 사본을 읽는다. «보관함에 담기»도 사본으로 간다(#pack=app-NN).
   · 사본은 scripts/proc-snapshot.mjs 가 만든다 — 목록 · 팩(그림 칸은 뺀다) · 카드 그림. 그림은 우리 사이트의 파일이 되므로 실행되는 것·바깥 주소가 없어야 한다. */
const root=path.join(__dirname,'..');
const comm=fs.readFileSync(path.join(root,'studio','community.html'),'utf8');
const board=fs.readFileSync(path.join(root,'studio','board.html'),'utf8');
const app=fs.readFileSync(path.join(root,'studio','app.html'),'utf8');
const headers=fs.readFileSync(path.join(root,'_headers'),'utf8');
const dir=path.join(root,'studio','packs');
function cut(src,from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const plain=o=>JSON.parse(JSON.stringify(o));
const PURE=cut(comm,'/* ── 2.999 · 프로세스 칸 순수 구간 시작','/* ── 2.999 · 프로세스 칸 순수 구간 끝 ── */');
function pure(){ const c=vm.createContext({}); vm.runInContext(PURE+';this.api={PROC_BASE,PROC_SRC,PROC_LOCAL,PROC_LOCAL_SRC,procRead,procUrl,procItem};',c); return c.api; }
const LETTER=cut(board,'/* ── 2.997 · 레터 팩 순수 구간 시작','/* ── 2.997 · 레터 팩 순수 구간 끝 ── */');
function letter(location){ const c=vm.createContext(location?{URL,location}:{URL}); vm.runInContext(LETTER+';this.api={letterPackUrlOk,letterPackRead};',c); return c.api; }
const nn=n=>(n<10?'0':'')+n;

test('the copy lives next to the page and is addressed by number — the same way as the site',()=>{
  const g=pure(),s=g.procRead({type:'process-studio-pack-index',version:1,sessions:[{n:3,rev:'92ac33a65a',session:'가상 세션',trainings:[{name:'연습 1',minutes:15,scenes:3}]}]})[0];
  assert.deepEqual([g.PROC_LOCAL,g.PROC_LOCAL_SRC],['packs/','app']);
  assert.equal(g.procUrl('index',null,null,'app'),'packs/index.json');
  assert.equal(g.procUrl('pack',s,null,'app'),'packs/03.json');
  assert.equal(g.procUrl('thumb',s,2,'app'),'packs/thumbs/03-2.svg?v=92ac33a65a');
  assert.equal(g.procUrl('pack',s,null,'review'),g.PROC_BASE+'03.json','이름을 주지 않거나 모르는 이름이면 훈련 세션 사이트');
  assert.equal(g.procUrl('pack',s,null,'constructor'),g.PROC_BASE+'03.json');
});

test('the site is asked first and the copy second — for the list and for a pack — and saving follows where the pack came from',()=>{
  const body=cut(comm,'/* ── 2.999 · 프로세스 칸 순수 구간 끝 ── */','var q=$(\'commSearch\');if(!q)return;var composing=false;');
  const fetchFn=cut(body,'function procFetch(force){','\nfunction procChipsRender');
  assert.match(fetchFn,/var local=get\(PROC_LOCAL_SRC,8000\); local\.catch\(function\(\)\{\}\);\n  get\(PROC_SRC,8000\)\.then\(function\(o\)\{ return local\.then\(function\(c\)\{ return \{l:procMerge\(o\.l,c\.l\),j:o\.j,lj:c\.j,src:o\.src\}; \},function\(\)\{ return o; \}\); \},function\(\)\{ return local; \}\)/,
    '목록: 사이트(3.019 — 사본 목록의 보강 세션을 얹어서) → 안 되면 사본');
  assert.match(fetchFn,/sessionStorage\.setItem\(PROC_CK,JSON\.stringify\(\{at:Date\.now\(\),index:o\.j,local:o\.lj\|\|null,src:o\.src\}\)\)/,'탭에 적어 둔 목록은 어디서 읽었는지도 적는다');
  assert.match(fetchFn,/if\(c\.local\)l0=procMerge\(l0,procRead\(c\.local\)\); procSet\(l0,c\.at,c\.src\)/);
  assert.match(fetchFn,/if\(proc\.ready\)return;/,'둘 다 안 되어도 이미 그린 목록은 그대로');
  const ensure=cut(body,'function procEnsure(p){','\nfunction procOpen');
  assert.match(ensure,/var first=procSrcOf\(p\.s,proc\.src\);[^\n]*\n  p\.__load=get\(first\)\.catch\(function\(e\)\{ if\(first===PROC_LOCAL_SRC\)throw e; return get\(PROC_LOCAL_SRC\); \}\)/,'팩: 목록을 읽은 곳 → 사본');
  assert.match(ensure,/p\.item=o\.it; p\.src=o\.src;/);
  assert.match(body,/procUrl\('thumb',s,k,procSrcOf\(s,proc\.src\)\)/,'그림은 목록을 읽은 곳에서(보강한 세션은 사본에서)');
  assert.match(body,/proc\.src=\(src===PROC_LOCAL_SRC\)\?PROC_LOCAL_SRC:PROC_SRC;/);
});

test('the shell and the board accept the copy — this site, this folder, a two-digit number and nothing else',()=>{
  const blk=cut(app,'/* ══ 2.997 · 프로세스 레터 훈련 세션을 보관함에','</script>');
  const code=cut(blk,'(function(){','\n  var KEY=')+'\n return SRC; })()';
  const SRC=vm.runInContext(code,vm.createContext({location:{origin:'https://app.invalid',pathname:'/studio/app.html'},String}));
  assert.equal(SRC.app,'https://app.invalid/studio/packs/');
  assert.match(blk,/Object\.prototype\.hasOwnProperty\.call\(SRC,m\[1\]\)/);
  const loc={origin:'https://app.invalid',pathname:'/studio/board.html'},g=letter(loc);
  assert.equal(g.letterPackUrlOk(SRC.app+'03.json'),true,'셸이 짓는 주소를 작전판이 받는다');
  assert.equal(letter({origin:'http://127.0.0.1:4173',pathname:'/studio/board.html'}).letterPackUrlOk('http://127.0.0.1:4173/studio/packs/46.json'),true,'로컬 미리보기(http)도 같은 사이트면');
  for(const bad of ['https://app.invalid/studio/packs/3.json','https://app.invalid/studio/packs/03.json?x=1','https://app.invalid/studio/packs/03.json#a','https://app.invalid/studio/packs/x/03.json',
    'https://app.invalid/studio/packs/thumbs/03.json','https://app.invalid/packs/03.json','https://app.invalid/studio/other/packs/03.json','https://app.invalid/studio/packs/../board.html',
    'https://user:pw@app.invalid/studio/packs/03.json','https://evil.invalid/studio/packs/03.json','http://app.invalid/studio/packs/03.json'])assert.equal(g.letterPackUrlOk(bad),false,bad);
  assert.equal(g.letterPackUrlOk('https://process-letter-sessions.netlify.app/packs/46.json'),true,'레터 사이트 둘은 그대로');
  assert.equal(letter().letterPackUrlOk('https://app.invalid/studio/packs/03.json'),false,'자기 주소를 모르면 받지 않는다');
});

test('the copy in the repository is whole: every session has its pack and pictures, both readers accept it, and no picture can run or reach out',async()=>{
  const {svgProblem,stripThumbs}=await import('../scripts/proc-snapshot.mjs');
  const g=pure(),l=letter();
  const index=JSON.parse(fs.readFileSync(path.join(dir,'index.json'),'utf8'));
  const list=g.procRead(index);
  assert.ok(list&&list.length>=45,'세션 수 '+(list&&list.length));
  assert.equal(list.length,index.sessions.length,'목록의 모든 줄이 읽힌다');
  const want=new Set(['index.json','thumbs']);
  const id=x=>x,dep={fields:['name','focus','minutes','sets','rpe','tags','type','snap','scenes','frames'],snap:id,trainings:d=>plain(d.trainings),frames:fr=>(Array.isArray(fr)&&fr.length>1)?fr:null};
  const pics=new Set();
  for(const s of list){
    want.add(s.nn+'.json');
    const txt=fs.readFileSync(path.join(dir,s.nn+'.json'),'utf8'),pack=JSON.parse(txt);
    assert.ok(txt.length<4*1024*1024,s.nn+' 크기');
    assert.equal(/"thumb"\s*:/.test(txt),false,s.nn+': 팩 안의 그림은 싣지 않는다');
    assert.ok(g.procItem(plain(pack),s,dep),s.nn+': 뷰어가 받는 모양');
    const info=l.letterPackRead(pack);
    assert.ok(info&&info.issue===s.n&&info.trainings.length===s.trainings.length,s.nn+': 보관함이 받는 모양');
    for(let k=1;k<=s.trainings.length;k++){ const name=s.nn+'-'+k+'.svg'; pics.add(name);
      assert.equal(svgProblem(fs.readFileSync(path.join(dir,'thumbs',name),'utf8')),'',name); }
  }
  assert.deepEqual(fs.readdirSync(dir).sort(),[...want].sort(),'목록에 없는 파일은 싣지 않는다');
  assert.deepEqual(fs.readdirSync(path.join(dir,'thumbs')).sort(),[...pics].sort());
  for(const bad of ['<svg><script>1</script></svg>','<svg onload="x()"></svg>','<svg><image href="https://x.invalid/a.png"/></svg>','<svg><rect fill="url(https://x.invalid/a)"/></svg>',
    '<svg><a xlink:href="https://x.invalid"><rect/></a></svg>','<svg><foreignObject><b>x</b></foreignObject></svg>','<svg><use href="#a"/></svg>','<svg><style>@import "x"</style></svg>','<p>x</p>',''])assert.notEqual(svgProblem(bad),'',bad);
  assert.equal(svgProblem('<svg xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="a"><rect/></clipPath></defs><g clip-path="url(#a)"><circle r="3"/></g></svg>'),'');
  assert.deepEqual(stripThumbs({thumb:'x',a:[{thumb:'y',b:1,frames:[{thumb:'z',snap:{players:[]}}]}]}),{a:[{b:1,frames:[{snap:{players:[]}}]}]});
});

test('opened directly, a file in the copy is inert — and the copy is not part of the offline shell',()=>{
  const m=/\n\/studio\/packs\/\*\n((?:  .+\n)+)/.exec(headers);
  assert.ok(m,'_headers 에 /studio/packs/* 묶음');
  assert.match(m[1],/Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox\n/);
  assert.match(m[1],/X-Content-Type-Options: nosniff\n/);
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  assert.equal(/studio\/packs\//.test(sw.replace(/\/\/[^\n]*/g,'')),false,'서비스워커가 미리 받는 목록에 넣지 않는다(쓸 때만 받는다)');
});

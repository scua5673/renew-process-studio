const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

/* 3.072 — «FIFA» 칸 애니메이션 시범(사용자 «애니메이션으로 전부 만들고 싶어» → 시범 5개 먼저 · 출처 표기).
   FIFA 훈련의 구성만 참고해 우리 작전판으로 다시 그린 세션: scripts/fifa-scenes/NNN.mjs → node scripts/fifa-scenes.mjs → studio/fifa-packs/NNN.json + index.json.
   카드를 누르면 코치 글과 같은 읽기 전용 뷰어(훈련 고르기 · 재생), «내 보관함에 담기»는 copyToLib — 서버 글이 아니라 조회 · 담김 숫자 · 신고가 없다. */
const root=path.join(__dirname,'..');
const F=require(path.join(root,'studio','community-fifa.js'));
const dir=path.join(root,'studio','fifa-packs');
const comm=fs.readFileSync(path.join(root,'studio','community.html'),'utf8');
const board=fs.readFileSync(path.join(root,'studio','board.html'),'utf8');
const index=JSON.parse(fs.readFileSync(path.join(dir,'index.json'),'utf8'));
const specs=fs.readdirSync(path.join(root,'scripts','fifa-scenes')).filter(f=>/^\d{3}\.mjs$/.test(f)).map(f=>f.slice(0,3)).sort();
const plain=o=>JSON.parse(JSON.stringify(o));
const id=x=>x, dep={fields:['name','focus','minutes','sets','rpe','tags','type','snap','frames','coaching'],snap:id,trainings:d=>plain(d.trainings),frames:fr=>(Array.isArray(fr)&&fr.length>1)?plain(fr):null};
const BAD_EN=/\b(the|and|players?|ball|pass(es|ing)?|coach(ing)?|organisation|explanation)\b/i;

test('every spec is built, the builder is deterministic, and what is committed is what it builds',async()=>{
  const {build}=await import('../scripts/fifa-scenes.mjs');
  assert.ok(specs.length>=1,'시범 세션');
  assert.deepEqual(index.sessions.map(s=>s.id),specs,'목록 = 장면 파일');
  for(const n of specs){
    const r=await build(n,{write:false}),text=fs.readFileSync(path.join(dir,n+'.json'),'utf8');
    assert.equal(r.text,text,'studio/fifa-packs/'+n+'.json = node scripts/fifa-scenes.mjs '+n);
    assert.deepEqual(plain(r.row),index.sessions.find(s=>s.id===n),n+': 목록의 줄');
    assert.ok(text.length<300*1024,n+': 팩 크기 '+Math.round(text.length/1024)+'KB');
  }
});

test('each pack is a FIFA-referenced session that sits on a row of the link table, with our own Korean text',()=>{
  const urls=new Set(F.list().map(e=>e.url));
  for(const s of index.sessions){
    const pk=JSON.parse(fs.readFileSync(path.join(dir,s.id+'.json'),'utf8')),d=pk.drills[0];
    assert.equal(pk.source,'fifa'); assert.ok(urls.has(F.BASE+s.path),s.id+': 링크 표의 세션');
    assert.equal(d.fifa.url,F.BASE+s.path,s.id+': 원문 주소');
    for(const t of d.trainings){
      assert.ok(t.frames.length>=4,s.id+' '+t.name+': 장면');
      for(const txt of [t.name,t.method,t.coaching].concat(t.frames.map(f=>f.cap)))
        assert.ok(!BAD_EN.test(txt),s.id+': 영어 문장을 옮기지 않는다 — '+String(txt).slice(0,60));
      assert.match(t.method,/진행\n1\./,s.id+': 훈련 방법 양식');
      for(const f of t.frames)for(const p of f.snap.players)assert.ok(p.x>=0&&p.x<=1110&&p.y>=0&&p.y<=740,s.id+': 판 밖의 선수');
    }
  }
});

test('the builder refuses a spec that would make a broken pack',async()=>{
  const {packOf}=await import('../scripts/fifa-scenes.mjs');
  const ok={path:'grassroots/4-to-8/shooting.php',name:'시험',focus:'tech',trainings:[{name:'가',minutes:10,pitch:'grid30',method:'진행\n1. 가',coaching:'1. 가',
    players:[{id:101,team:'blue',num:'1',x:300,y:300}],ball:[310,300],scenes:[{},{},{},{}]}]};
  assert.equal(packOf(plain(ok),'t').drills[0].trainings[0].frames.length,4);
  const bad=(f,re)=>{ const s=plain(ok); f(s); assert.throws(()=>packOf(s,'t'),re); };
  bad(s=>{s.trainings[0].pitch='moon';},/pitch/);
  bad(s=>{s.trainings[0].method='';},/method/);
  bad(s=>{s.trainings[0].players[0].x=2000;},/판 안/);
  bad(s=>{s.trainings[0].scenes=[{},{}];},/장면/);
  bad(s=>{s.trainings[0].scenes[1]={pos:{999:[1,1]}};},/판에 없는 선수/);
  bad(s=>{s.trainings[0].players.push({id:101,team:'red',x:1,y:1});},/겹치/);
  bad(s=>{s.focus='nope';},/focus/);
  bad(s=>{s.path='https://evil.example/x.php';},/path/);
});

test('the index reader keeps only known sessions with a three-digit id; animated cards open, link-only cards stay links',()=>{
  const e=F.list()[0];
  assert.equal(F.readIndex({type:'x',sessions:[]}),null);
  const r=F.readIndex({type:'process-studio-fifa-index',version:1,sessions:[
    {id:'001',path:e.url.slice(F.BASE.length),rev:'abcdef0123',trainings:[{name:'가',minutes:10,scenes:9}]},
    {id:'002',path:'not/in/table.php',trainings:[{name:'나'}]},{id:'3',path:F.list()[1].url.slice(F.BASE.length),trainings:[{}]},null]});
  assert.equal(r.n,1); assert.deepEqual(Object.keys(r.m),[e.url]);
  assert.ok(F.setIndex(index)); assert.equal(F.animCount(),index.sessions.length);
  const an=F.list().filter(x=>F.animOf(x));
  assert.equal(an.length,index.sessions.length);
  assert.match(F.packUrl(F.animOf(an[0])),/^fifa-packs\/\d{3}\.json\?v=[0-9a-f]{10}$/);
  assert.ok(F.list().some(x=>F.match(x,'anim',''))&&F.list().filter(x=>F.match(x,'anim','')).length===an.length,'«▶ 애니메이션» 칩');
});

test('a pack becomes a viewer post (not a server post) only for its own row',()=>{
  F.setIndex(index);
  const s=index.sessions[0],e=F.list().find(x=>x.url===F.BASE+s.path),pk=JSON.parse(fs.readFileSync(path.join(dir,s.id+'.json'),'utf8'));
  const it=F.item(plain(pk),e,dep);
  assert.ok(it&&it.trainings.length===s.trainings.length&&it.type==='train');
  assert.ok(it.trainings.every(t=>Array.isArray(t.frames)&&t.frames.length>1&&t.thumb===''));
  const p=F.post(e,it);
  assert.deepEqual([p.id,p.fifa,p.title,p.owner_name],['fifa-'+s.id,true,e.ko,'FIFA Training Centre 참고']);
  const other=F.list().find(x=>!F.animOf(x));
  assert.equal(F.item(plain(pk),other,dep),null,'다른 줄에는 붙지 않는다');
  const wrong=plain(pk); wrong.drills[0].fifa.path='grassroots/4-to-8/perfect-the-pass.php'; assert.equal(F.item(wrong,e,dep),null,'팩이 말하는 원문이 다르면');
  const fewer=plain(pk); fewer.drills[0].trainings.pop(); assert.equal(F.item(fewer,e,dep),null,'훈련 수가 다르면');
});

test('the community page opens an animated card in the coach-post viewer and keeps it off the server',()=>{
  assert.match(comm,/function fifaOpen\(e,card,k\)\{/);
  assert.match(comm,/F\.render\(grid,\{group:fifaG,q:searchF,count:\$\('commCount'\),onOpen:fifaOpen\}\);/);
  assert.match(comm,/else if\(!p\.fifa\)\{   \/\* 3\.072/,'조회수 서버 호출 없음');
  assert.match(comm,/if\(!p\.fifa\)try\{fetch\(base\(\)\+'\/rest\/v1\/rpc\/ps_comm_copied'/,'담김 숫자 서버 호출 없음');
  assert.match(comm,/if\(!p\)p=procFind\(id\)\|\|fifaFind\(id\);/,'뷰어의 담기가 FIFA 글을 찾는다');
  assert.match(comm,/proc:!!p\.proc,fifa:!!p\.fifa\};/);
  assert.match(board,/\+\(post\.fifa\?\('<b>FIFA 훈련 애니메이션<\/b> — FIFA Training Centre 참고/,'뷰어 띠의 출처');
  assert.match(board,/\+\(\(post\.proc\|\|post\.fifa\)\?'':'<button id="commRepBtn"/,'신고 없음');
  const hd=fs.readFileSync(path.join(root,'_headers'),'utf8');
  assert.match(hd,/\/studio\/fifa-packs\/\*\n  Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox/,'팩 파일은 문서로 열리지 않는다');
});

test('3.074 — every animated card has a preview picture per training (built by the board, no scripts) and a 1·2·3 picker',()=>{
  F.setIndex(index);
  for(const s of index.sessions)for(let k=1;k<=s.trainings.length;k++){
    const f=path.join(dir,'thumbs',s.id+'-'+k+'.svg'); assert.ok(fs.existsSync(f),'scripts/fifa-thumbs.mjs '+s.id+' — '+s.id+'-'+k+'.svg');
    const svg=fs.readFileSync(f,'utf8'); assert.match(svg,/^<svg/); assert.ok(!/<script|\son[a-z]+=/i.test(svg),s.id+'-'+k+': 스크립트 없음');
  }
  const a=F.animOf(F.list().find(x=>F.animOf(x)));
  assert.match(F.thumbUrl(a,2),/^fifa-packs\/thumbs\/\d{3}-2\.svg\?v=[0-9a-f]{10}$/);
  assert.match(F.thumbUrl(a,99),new RegExp('-'+a.trainings.length+'\\.svg'),'없는 훈련은 마지막 그림');
  assert.match(comm,/k=\(\(p\.proc\|\|p\.fifa\)&&\+p\.__k>0&&\+p\.__k<n\)\?\+p\.__k:0;/,'카드에서 고른 훈련부터 뷰어');
});

test('the index is rebuilt from the pack files, so parallel builds cannot drop a session',async()=>{
  const {indexOf}=await import('../scripts/fifa-scenes.mjs');
  assert.deepEqual(plain(indexOf()),index);
});

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

/* 3.079 — 세부 국면(사용자 «세부 국면도 선택할 수 있게»). 큰 국면을 고르면 그 아래 세부 국면 칩 — 작전판 편집기의 경기 국면 기본 골격과 같은 id · 이름.
   올릴 때 고르고(cat 에 id), 담으면 gmPhases 로 편집기 칩이 켜진 채로. FIFA 팩 · 목록 · 프로세스 세션에도 표시. */
const root=path.join(__dirname,'..');
const T=require(path.join(root,'studio','community-tax.js'));
const F=require(path.join(root,'studio','community-fifa.js'));
const board=fs.readFileSync(path.join(root,'studio','board.html'),'utf8');
const comm=fs.readFileSync(path.join(root,'studio','community.html'),'utf8');
const index=JSON.parse(fs.readFileSync(path.join(root,'studio','fifa-packs','index.json'),'utf8'));
const keysOf=v=>String(v||'').split(',').map(x=>x.trim()).filter(Boolean);
const reset=()=>T.set({topic:'',sub:'',age:'',n:12,any:true});

test('sub-phases are the board editor\'s standard game-model phases (same ids and names)',async()=>{
  const m=board.match(/const EP_STD_MOMENTS=\[([\s\S]*?)\n\];/); assert.ok(m,'board.html EP_STD_MOMENTS');
  const std={}; for(const row of m[1].split('\n')){ const nm=(row.match(/name:"([^"]+)",(?:cat:"\w+",)?phases/)||[])[1]; if(!nm)continue;
    for(const x of row.matchAll(/\{id:"(std_\w+)",name:"([^"]+)"\}/g))std[x[1]]=nm+' › '+x[2]; }
  for(const [k,v] of Object.entries(T.SUBMAP))assert.equal(v.full,std[k],k+': 편집기와 같은 이름');
  const {SUBS}=await import('../scripts/fifa-scenes.mjs');
  assert.deepEqual(Object.fromEntries(Object.entries(T.SUBMAP).map(([k,v])=>[k,v.full])),SUBS,'FIFA 빌더와 같은 표');
  for(const t of Object.keys(T.SUBS))assert.ok(T.PHASES.includes(t)||t==='set');
});

test('choosing a sub-phase shows only what is marked with it; changing the big phase clears it',()=>{
  reset(); const a={topics:['att'],ages:null,min:0,max:0,subs:['std_ao_3']},b={topics:['att'],ages:null,min:0,max:0};
  T.set({sub:'std_ao_3'}); assert.equal(T.state().topic,'att','세부 국면을 고르면 큰 국면도');
  assert.ok(T.ok(a)); assert.ok(!T.ok(b),'표시가 없으면 안 보인다');
  T.set({topic:'def'}); assert.equal(T.state().sub,'','다른 국면이면 풀린다'); T.set({topic:'att'}); assert.ok(T.ok(b));
  T.set({sub:'nope'}); assert.equal(T.state().sub,''); reset();
});

test('each tab reads sub-phases: coach posts (cat ids or the training\'s phases), process sessions, FIFA rows',()=>{
  assert.deepEqual(T.fromCoach({cat:'bpo,std_do_1'},keysOf).subs,['std_do_1']);
  assert.deepEqual(T.fromCoach({cat:'',item:{focus:'bp',gmPhases:['custom1'],gmPhaseNames:['공격 조직 › 빌드업']}},keysOf).subs,['std_ao_1'],'팀 게임모델의 같은 이름');
  assert.equal(T.fromCoach({cat:'tech'},keysOf).subs,undefined,'없으면 키 없음');
  assert.deepEqual(T.fromCoach({cat:'std_dt_1'},keysOf).topics,['trd'],'세부 국면이 큰 국면을 정한다');
  for(const [n,v] of Object.entries(T.PROC_SUB))for(const k of v)assert.ok(T.SUBMAP['std_'+k],'프로세스 '+n);
  assert.deepEqual(T.fromProc({n:4,theme:'공격 → 수비 전환 › 카운터프레스'}).subs,['std_dt_1']);
  assert.deepEqual(T.subsOfPost({cat:'bpo,std_do_1'}),{ids:['std_do_1'],names:['수비 조직 › 전방 압박']},'담을 때 gmPhaseNames');
  F.setIndex(index); const e=F.list().find(x=>{ const a=F.animOf(x); return a&&a.subs.length; });
  assert.deepEqual(T.fromFifa(e,F.animOf(e)).subs,F.animOf(e).subs);
});

test('FIFA packs carry the sub-phases as gmPhases (saved trainings open with the editor chips on) and the list row repeats them',async()=>{
  const tagged=index.sessions.filter(s=>s.subs); assert.ok(tagged.length>=100,'세부 국면이 붙은 세션 '+tagged.length);
  for(const s of tagged){ assert.ok(s.subs.every(k=>T.SUBMAP[k]),s.id);
    const d=JSON.parse(fs.readFileSync(path.join(root,'studio','fifa-packs',s.id+'.json'),'utf8')).drills[0];
    assert.deepEqual(d.gmPhases,s.subs,s.id); assert.deepEqual(d.gmPhaseNames,s.subs.map(k=>T.SUBMAP[k].full));
    assert.ok(d.trainings.every(t=>JSON.stringify(t.gmPhases)===JSON.stringify(s.subs)),s.id+': 훈련마다'); }
  const {packOf}=await import('../scripts/fifa-scenes.mjs');
  const ok={path:'grassroots/4-to-8/shooting.php',name:'시험',focus:'tech',trainings:[{name:'가',minutes:10,pitch:'grid30',method:'진행\n1. 가',coaching:'1. 가',
    players:[{id:101,team:'blue',num:'1',x:300,y:300}],ball:[310,300],scenes:[{},{},{},{}]}]};
  assert.throws(()=>packOf({...ok,subs:['std_xx_1']},'t'),/subs/); assert.throws(()=>packOf({...ok,subs:['std_ao_1','std_ao_1']},'t'),/subs/);
});

test('the upload form shows the sub-phases of the chosen topics, prefills them from the training, and writes them to cat and gmPhases',()=>{
  const mk=()=>({children:[],dataset:{},style:{p:{},setProperty(k,v){ this.p[k]=v; },removeProperty(k){ delete this.p[k]; }},textContent:'',className:'',
    classList:{s:new Set(),toggle(c,on){ on?this.s.add(c):this.s.delete(c); }},setAttribute(){},appendChild(c){ this.children.push(c); c.parentNode=this; return c; },click(){ this.onclick&&this.onclick(); }});
  const doc={createElement:mk},topics=mk(),subs=mk(),wrap=mk(); wrap.appendChild(subs);
  const up=T.upForm(doc,{topics,subs,ages:mk(),pl:{value:''}});
  const shown=()=>subs.children.filter(b=>b.style.p.display!=='none').map(b=>b.textContent);
  assert.deepEqual(shown(),[]); assert.equal(wrap.style.p.display,'none','주제를 고르기 전엔 숨김');
  up.fill({focus:'bpo',gmPhaseNames:['수비 조직 › 미드 블록'],snap:{players:[{},{}]}});
  assert.deepEqual(shown(),['전방 압박','미드 블록','로우 블록']); assert.deepEqual(up.get().subs,['std_do_2'],'훈련의 경기 국면에서');
  assert.equal(up.get().cat,'bpo,std_do_2'); assert.deepEqual(up.get().subNames,['수비 조직 › 미드 블록']);
  topics.children[3].click(); assert.deepEqual([up.get().subs,shown()],[[],[]],'주제를 빼면 세부 국면도 빠진다');
  assert.match(comm,/<div class="agechips" id="upSubs"><\/div>/);
  assert.match(comm,/if\(uf\.subs&&uf\.subs\.length\)\{item\.gmPhases=uf\.subs;item\.gmPhaseNames=uf\.subNames;\}/);
});

/* 3.368 — 보관함 게임모델 «한 장에서 고르기»의 셈(studio/gamemodel-sheet.js): 원칙은 원래 자리(moments › phases › principles)에 적힌다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const S=require('../studio/gamemodel-sheet.js');
const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const LIB=[{k:'ao',nm:'공격 조직',tag:'IN POSSESSION',ph:['빌드업','전진 · 전개','침투 · 마무리']},{k:'do',nm:'수비 조직',tag:'OUT OF POSSESSION',ph:['전방 압박','미드 블록','로우 블록']},{k:'dt',nm:'공격 → 수비 전환',tag:'TRANSITION −',ph:['즉시 반응 (역압박)','후퇴 · 재정비']},{k:'at',nm:'수비 → 공격 전환',tag:'TRANSITION +',ph:['빠른 역습','점유 안정화']}];
let n=0; const deps={lib:LIB,cat:{ao:'ao',do:'do',dt:'dt',at:'at'},newPh:nm=>({id:'p'+(++n),name:nm,principles:[''],snap:null})};
const blank=()=>({identity:'',open:{},moments:[]});
const texts=m=>S.rows(m).map(r=>r.t);

test('고르면 표준 국면이 서고 답의 문장이 그 답의 단계 첫 줄에 적힌다',()=>{
  const M=blank();
  assert.equal(S.setPick(M,'do','low',deps),true);
  const m=M.moments[0];
  assert.deepEqual([m.key,m.name,m.pick,m.phases.map(p=>p.name)],['do','수비 조직','low',['전방 압박','미드 블록','로우 블록']]);
  assert.deepEqual(m.phases.map(p=>p.principles),[[''],[''],['골문 앞을 먼저 채우고 슈팅 길에 몸을 둡니다']]);
  assert.equal(M.open.do,true);
  assert.equal(S.setPick(M,'do','nope',deps),false); assert.equal(S.setPick(M,'zz','low',deps),false);
});

test('한 문장은 두 칸(가졌을 때 · 잃은 순간)을 고르면 지어지고, 손댄 문장은 건드리지 않는다',()=>{
  const M=blank();
  S.setPick(M,'ao','wide',deps); assert.equal(M.identity,'');
  S.setPick(M,'dt','press',deps); assert.equal(M.identity,'넓게 벌려 나가고, 잃으면 바로 되찾는 팀');
  S.setPick(M,'ao','short',deps); assert.equal(M.identity,'짧게 이어 나가고, 잃으면 바로 되찾는 팀','지어 준 문장은 따라 바뀐다');
  M.identity='우리 말'; S.setPick(M,'dt','drop',deps); assert.equal(M.identity,'우리 말');
});

test('다시 고르면 앞 답이 넣은 문장만 걷힌다 — 직접 쓴 원칙 · 상세가 붙은 원칙은 남는다',()=>{
  const M=blank();
  S.setPick(M,'ao','short',deps);
  const o=S.optOf('ao','short');
  S.addLine(M,'ao',o.more[0],deps);
  const id=S.addLine(M,'ao','풀백은 안으로',deps);
  assert.equal(S.addLine(M,'ao','넷째',deps),null,'칸마다 세 개');
  const ph=M.moments[0].phases[0]; ph.principles[+id.split(':')[2]]={t:'풀백은 안으로',why:'까닭'};
  S.setPick(M,'ao','long',deps);
  assert.deepEqual(texts(M.moments[0]),['앞으로 길게 보내고 떨어지는 공을 따냅니다','풀백은 안으로']);
  assert.deepEqual(ph.principles[1],{t:'풀백은 안으로',why:'까닭'});
});

test('이미 많이 적은 국면 — 고르기는 pick 만 적고 원칙을 늘리지도 지우지도 않는다',()=>{
  const M={identity:'원래',moments:[{key:'ao',name:'공격 조직',phases:[{id:'a',name:'빌드업',principles:['하나','둘']},{id:'b',name:'전개',principles:['셋','넷']}]}]};
  const before=JSON.stringify(M.moments[0].phases);
  S.setPick(M,'ao','short',deps);
  assert.equal(M.moments[0].pick,'short'); assert.equal(JSON.stringify(M.moments[0].phases),before); assert.equal(M.identity,'원래');
  assert.equal(S.addLine(M,'ao','다섯',deps),null);
});

test('지우기 — 그 원칙만 빠지고, 마지막 원칙을 지우면 고른 답도 걷힌다(국면 · 단계는 남는다)',()=>{
  const M=blank(); S.setPick(M,'at','keep',deps);
  const m=M.moments[0], id=S.rows(m)[0].id;
  assert.equal(id,'at:1:0');
  assert.equal(S.removeLine(M,id),true);
  assert.equal(m.pick,undefined); assert.deepEqual(m.phases.map(p=>p.principles),[[''],['']]); assert.equal(M.moments.length,1);
  assert.equal(S.removeLine(M,'at:9:9'),false); assert.equal(S.removeLine(M,'zz:0:0'),false);
});

test('직접 만든 국면 · 단계가 없는 국면에도 적는다 · 빈 줄은 방금 만든 것만 보인다 · 채운 칸 수',()=>{
  const M={identity:'',moments:[{key:'mx',name:'우리 진영',phases:[]}]};
  const id=S.addLine(M,'mx','',deps);
  assert.equal(id,'mx:0:0'); assert.equal(M.moments[0].phases[0].name,'원칙');
  assert.equal(S.rows(M.moments[0]).length,0); assert.equal(S.rows(M.moments[0],id).length,1);
  assert.equal(S.filled(M),0); S.setPick(M,'ao','short',deps); assert.equal(S.filled(M),1);
  assert.equal(S.txt({text:'옛 칸'}),'옛 칸');
});

test('답 목록 — 네 칸 · 답마다 문장 하나와 덧붙일 문장 둘 · 단계 번호는 그 국면의 단계 안',()=>{
  assert.deepEqual(S.Q.map(q=>q.k),['ao','dt','do','at']);
  for(const q of S.Q){ const L=LIB.find(x=>x.k===q.k); assert.ok(q.opts.length>=2&&q.opts.length<=3);
    for(const o of q.opts){ assert.ok(o.s&&o.t&&o.more.length===2&&o.ph<L.ph.length,q.k+':'+o.id); assert.ok(!/않|없/.test(o.s+o.more.join('')),'긍정형 '+o.id); } }
});

test('배선 — 보관함(개인 판)에서만 서고 같은 model · save · render 를 쓴다 · sw CORE · 시험 등록',()=>{
  const gm=R('studio/gamemodel.html'),js=R('studio/gamemodel-sheet.js'),sw=R('sw.js');
  assert.match(gm,/<script src="gamemodel-sheet\.js"><\/script>\n<script>\n\(async function\(\)\{/,'본문 바로 앞');
  assert.match(gm,/window\.__gmSheet=\{personal:GM_PERSONAL,get:function\(\)\{ return model; \},save:save,render:render,edit:gsCanEdit,lib:GM_LIB,cat:GM_CAT,newPh:gmNewPh,/);
  assert.match(gm,/gmSyncPanes\(\); \}catch\(e\)\{[^\n]*\n    if\(window\.PSGmSheet\)PSGmSheet\.draw\(\);/,'render 끝에서 한 장도 다시');
  assert.match(js,/scope=personal\(\?:&\|\$\)\/\.test\(w\.location\.search\|\|''\)\)return;/,'팀 판에는 서지 않는다');
  assert.ok(!/localStorage|psSaveShared|catch\(_\)\{\}/.test(js),'제 저장 길 · 빈 catch 없음');
  assert.ok(sw.includes("'/studio/gamemodel-sheet.js'"));
  assert.ok(R('tests/browser/run-critical.mjs').includes("suites.entry.push('gamemodel-sheet-3368')"));
});

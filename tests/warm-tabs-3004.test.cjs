const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 3.004 — 셸의 탭 미리 띄우기(2.252)는 부팅 6.4초 안에 탭 아홉을 전부 띄우고 내리지 않았다.
   데스크톱은 그대로 두고, 폰·아이패드는 이 기기에서 최근 14일 안에 연 탭만 미리 띄운다(처음이면 팀 허브와 일정).
   미리 띄우지 않은 탭에 건네는 말은 그 탭이 뜬 뒤에 보낸다. */
const app=fs.readFileSync(path.join(__dirname,'..','studio','app.html'),'utf8');
function cut(src,from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const plain=o=>JSON.parse(JSON.stringify(o));
const PURE=cut(app,'/* ── 3.004 · 미리 띄우기 순수 구간 시작','/* ── 3.004 · 미리 띄우기 순수 구간 끝 ── */');
function pure(){ const c=vm.createContext({}); vm.runInContext(PURE+';this.api={PS_WARM_KEY,PS_WARM_MS,PS_WARM_TABS,psWarmParse,psWarmPlan};',c); return c.api; }
const DAY=24*60*60*1000,NOW=Date.UTC(2026,9,11);

test('a desk keeps the team hub and schedule warm plus what it opened lately; a phone or tablet warms only what it opened lately',()=>{
  const g=pure(),all=['scout','process','idp','learning','community','scouting','terms','analysis','gamemodel'];
  assert.deepEqual(plain(g.PS_WARM_TABS.map(t=>t[0])),all);
  assert.deepEqual(plain(g.PS_WARM_TABS.map(t=>t[1])),[1600,2200,2800,3400,4000,4600,5200,5800,6400],'띄우는 시각은 예전 자리 그대로');
  /* 3.008 — 데스크톱은 팀 허브·일정은 늘, 나머지는 쓰던 탭만(전부 띄우면 처음 온 사람도 탭 아홉을 받았다) */
  assert.deepEqual(plain(g.psWarmPlan(false,{})),['scout','process'],'데스크톱 처음: 팀 허브·일정');
  assert.deepEqual(plain(g.psWarmPlan(false,{idp:NOW,community:NOW})),['scout','process','idp','community'],'데스크톱: 팀 허브·일정 + 쓰던 탭, 띄우는 차례는 예전 그대로');
  assert.deepEqual(plain(g.psWarmPlan(true,{})),['scout','process'],'처음 쓰는 기기: 팀 허브와 일정');
  assert.deepEqual(plain(g.psWarmPlan(true,{learning:NOW,idp:NOW})),['idp','learning'],'선수 폰: 쓰는 둘만 — 팀 허브를 깔지 않는다');
  assert.deepEqual(plain(g.psWarmPlan(true,{constructor:NOW,toString:NOW})),['scout','process'],'모르는 이름은 세지 않는다');
});

test('the note on the device is read carefully — fourteen days, known tabs, sane times',()=>{
  const g=pure();
  assert.equal(g.PS_WARM_MS,14*DAY);
  assert.deepEqual(plain(g.psWarmParse(JSON.stringify({idp:NOW-DAY,scout:NOW-13*DAY,community:NOW-15*DAY,terms:NOW+60000,analysis:'x',learning:0,evil:NOW,gamemodel:NOW}),NOW)),{scout:NOW-13*DAY,idp:NOW-DAY,gamemodel:NOW});
  for(const bad of ['','null','[]','"x"','{','7',null,undefined])assert.deepEqual(plain(g.psWarmParse(bad,NOW)),{},String(bad));
});

test('the shell notes a tab when it is shown, warms by the plan, and speaks to a cold tab only after it has loaded',()=>{
  assert.match(app,/try\{ psWarmNote\(app\); \}catch\(_\)\{\}[^\n]*\n      var _skFrame=ensureAppFrame\(app\);/,'showApp 이 적는다');
  assert.match(app,/function psWarmLean\(\)\{ try\{ var dv=document\.documentElement\.getAttribute\('data-ps-device'\); return dv==='phone'\|\|dv==='ipad'; \}/,'폰·아이패드 판정은 부팅이 심어 둔 속성으로');
  assert.match(app,/var plan=psWarmPlan\(psWarmLean\(\),psWarmUsed\(\)\);\n      PS_WARM_TABS\.forEach\(function\(t\)\{ if\(plan\.indexOf\(t\[0\]\)<0\)return;/);
  assert.equal((app.match(/setTimeout\(function\(\)\{try\{ensureAppFrame\(/g)||[]).length,1,'미리 띄우는 곳은 이 한 곳(보관함을 열 때의 노트 2.247 만 따로)');
  const when=cut(app,'function psFrameWhenReady(fr,fn,ms){','\n    }');
  assert.match(when,/if\(psFrameReady\(fr\)\)setTimeout\(fn,ms\|\|0\);\n      else fr\.addEventListener\('load',function\(\)\{ setTimeout\(fn,Math\.max\(ms\|\|0,120\)\); \},\{once:true\}\);/);
  assert.equal((app.match(/psFrameWhenReady\(fTerms,/g)||[]).length,2,'공용어의 «뒤로» 이름 두 곳');
  assert.match(app,/psFrameWhenReady\(fLearning,_sendLa,60\)/);
  assert.match(app,/psFrameWhenReady\(fIdp,_sendAr,60\)/);
  assert.match(app,/if\(d\.app==='idp'&&\(d\.squad\|\|d\.idpKey\|\|d\.idpName\)\)psFrameWhenReady\(fIdp,function\(\)\{/);
});

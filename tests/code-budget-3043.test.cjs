// 3.043 — 피드백 16(TD-1 · TD-3): 큰 페이지는 더 키우지 않는다 · 시험이 구현 글자에 묶이는 것을 더 늘리지 않는다.
// 둘 다 «래칫»이다 — 지금 값이 상한이고, 넘으면 실패한다. 줄였으면 상한도 같이 내린다(아래 표를 고치면 diff 에 남는다).
// 새 기능은 studio/<기능>.js 모듈(UMD — autosave-*.js · team-files.js 모양)로 쓰고 시험은 require 로 행동을 본다.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

/* 바이트 상한 — 3.043 의 크기 + 16KB(작은 고침 몫). 기능을 더하려면 모듈로 떼어 내고, 이 표는 올리지 않는다 */
const PAGE_BUDGET={
  'studio/board.html':2500*1024,
  'studio/scout.html':1900*1024,
  'studio/idp.html':1504*1024,
  'studio/process.html':820*1024,
  'studio/app.html':960*1024,
  'studio/sync.js':832*1024,
  'studio/community.html':192*1024
};
test('큰 페이지 크기 예산 — 넘으면 새 코드를 studio/<기능>.js 모듈로',()=>{
  for(const [f,max] of Object.entries(PAGE_BUDGET)){
    const n=fs.statSync(path.join(root,f)).size;
    assert.ok(n<=max,`${f} ${Math.ceil(n/1024)}KB > 예산 ${max/1024}KB — 새 코드는 모듈로(tests/code-budget-3043.test.cjs)`);
  }
});

/* 시험이 구현 글자에 묶인 곳(TD-3) — 늘리지 않는다. 판 번호는 syntax/release 시험의 «PS_BUILD = CACHE» 한 곳이면 된다 */
const RATCHET={
  commentAnchor:{max:50,re:/['"]\/\* ?\d\.\d{3}/g,why:"주석('/* 2.138 …')을 잘라내기 기준점으로 쓰지 않는다 — 함수 이름(fnSrc) · 모듈 require 로"},
  indexOfComment:{max:35,re:/indexOf\(['"]\/\*/g,why:"indexOf('/* …') 로 자르지 않는다"},
  versionPin:{max:16,re:/PS_BUILD='3\.\d{3}'|process-3\.\d{3}|\?v=3\.\d{3}/g,why:'판 번호를 시험에 박지 않는다 — sw.js CACHE · app.html PS_BUILD 에서 읽는다'}
};
test('시험 규칙 래칫 — 주석 기준점 · 판 번호 고정이 늘지 않는다',()=>{
  const dir=path.join(root,'tests'),files=fs.readdirSync(dir).filter(f=>f.endsWith('.test.cjs')&&f!=='code-budget-3043.test.cjs');
  for(const [name,r] of Object.entries(RATCHET)){
    const hits=[];
    for(const f of files){ const n=(fs.readFileSync(path.join(dir,f),'utf8').match(r.re)||[]).length; if(n)hits.push(f+'×'+n); }
    const total=hits.reduce((a,h)=>a+(+h.split('×')[1]),0);
    assert.ok(total<=r.max,`${name}: ${total} > ${r.max} — ${r.why}\n${hits.join(' ')}`);
  }
});

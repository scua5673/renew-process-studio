const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

/* 3.008 — 늘지만 않게 묶는 숫자(래칫). 줄이는 것은 언제나 환영이고, 줄였으면 아래 숫자도 같이 낮춘다.
   · !important — 덧대기 CSS 의 우선순위 싸움(figma-premium.css 선언의 약 83%). 새 화면 규칙은 선택자 하나로 이긴다
   · 빈 catch(){} — 실패를 아무도 모르게 삼킨다. 저장·동기화 경로의 «저장됨인데 사라짐»이 여기서 시작됐다(storage.js 머리 주석).
     새 catch 는 최소한 PSStorageDiagnostic·console.warn 으로 단계 이름을 남긴다
   · :not(#_) — 우선순위를 억지로 올리는 꼼수
   숫자가 늘면 이 시험이 실패한다. 꼭 필요하면 늘린 까닭을 커밋에 적고 숫자를 올린다. */
const root=path.join(__dirname,'..');
const files=fs.readdirSync(path.join(root,'studio')).filter(f=>/\.(html|css|js)$/.test(f)).map(f=>'studio/'+f).concat(['admin.html','sw.js']);
const count=re=>files.reduce((n,f)=>n+(fs.readFileSync(path.join(root,f),'utf8').match(re)||[]).length,0);
const CEIL={important:13355,emptyCatch:5420,notIdHack:1130};

test('!important does not grow',()=>{
  const n=count(/!important/g);
  assert.ok(n<=CEIL.important,'!important '+n+' > '+CEIL.important+' — 새 규칙은 선택자로 이긴다');
});
test('empty catch blocks do not grow',()=>{
  const n=count(/catch\s*\(\s*[\w$]*\s*\)\s*\{\s*\}/g);
  assert.ok(n<=CEIL.emptyCatch,'빈 catch '+n+' > '+CEIL.emptyCatch+' — 실패에 단계 이름을 남긴다');
});
test(':not(#_) specificity hacks do not grow',()=>{
  const n=count(/:not\(#_\)/g);
  assert.ok(n<=CEIL.notIdHack,':not(#_) '+n+' > '+CEIL.notIdHack);
});

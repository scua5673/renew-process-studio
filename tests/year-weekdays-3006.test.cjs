const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

/* 3.006 — 일정 › 년간: 달 카드마다 맨 위에 요일 줄(사용자 «팀 운영 월간 일정에 월마다 요일써줘 맨위에»).
   년간 보기의 달 카드는 날짜 칸만 있고 요일이 없어 어느 칸이 무슨 요일인지 알 수 없었다(월간 보기에는 원래 있다). */
const proc=fs.readFileSync(path.join(__dirname,'..','studio','process.html'),'utf8');
function cut(src,from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }

test('every month card starts with the seven weekdays, in the same Monday-first order the cells are laid out in',()=>{
  const fn=cut(proc,'function renderYear(){','\n  grid.innerHTML=h;');
  assert.match(proc,/const WDAYS=\['월','화','수','목','금','토','일'\];/);
  assert.match(fn,/var wdRow=WDAYS\.map\(function\(w\)\{ return '<i class="wd" aria-hidden="true">'\+w\+'<\/i>'; \}\)\.join\(''\);/,'요일 일곱 — 카드 이름(단추의 읽는 이름)에는 섞지 않는다');
  assert.match(fn,/var lead=\(first\.getDay\(\)\+6\)%7;/,'칸도 월요일 시작');
  assert.match(fn,/\+'<div class="ycal">'\+wdRow\+cells\+'<\/div><\/button>';/,'달력 칸보다 먼저');
  assert.equal(/data-iso/.test(cut(fn,'var wdRow=','.join')),false,'요일 칸은 날짜 칸이 아니다 — 누르면 카드처럼 그 달로 간다');
});

test('the weekday row reads as a label, not as a day cell — and keeps to the type scale',()=>{
  const m=/\n  \.ycal i\.wd\{([^}]+)\}/.exec(proc);
  assert.ok(m,'.ycal i.wd 규칙');
  const css=m[1];
  assert.ok(proc.indexOf('.ycal i.wd{')>proc.indexOf('.ycal i{display:block;aspect-ratio:1;'),'원래 규칙 뒤에 둔다(같은 특이도면 뒤가 이긴다)');
  for(const need of ['aspect-ratio:auto','background:transparent','font-style:normal','font-size:12px','font-weight:500','text-align:center'])assert.ok(css.includes(need),need);
});

test('the change is announced once, in plain positive words',()=>{
  const first=require('../studio/release-notes.js').entries()[0];
  assert.equal(first.id,'2026-10-12-v3-006-year-weekdays');
  assert.match(first.title,/^v3\.006 · /);
  assert.equal(first.changes.length,1);
  assert.equal(/않|없|못/.test(first.changes.join(' ')),false,'하는 일을 긍정형으로 적는다');
});

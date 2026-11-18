'use strict';
/* 3.307 — 가용인원 › 날짜별 명단의 선수 이름은 선수 프로필(선수 편집 창)을 연다(사용자 11/17 «선수이름 누르면 프로필 수정할 수 있게 해줘»).
   선수별 누적 표의 이름(avPlayerLink · data-av-player-total)은 그대로 누적 선택이다 — 두 링크가 섞이지 않는지 코드 모양으로 지킨다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const SC=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
function fn(name){const a=SC.indexOf('function '+name+'(');assert.ok(a>=0,name);const b=SC.indexOf('\nfunction ',a+10);return SC.slice(a,b);}

test('avProfileLink: a button that names the player, carries data-av-player-edit, and escapes the name',()=>{
  const c=vm.createContext({esc:s=>String(s).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]))});
  vm.runInContext(fn('avProfileLink'),c);
  const h=c.avProfileLink({id:'p1',name:'가상 <강민>'});
  assert.equal(h,'<button type="button" class="av-player-link" data-av-player-edit="p1" aria-label="가상 &lt;강민&gt; 프로필 수정">가상 &lt;강민&gt;</button>');
  assert.ok(c.avProfileLink({id:'p2'}).includes('>이름 없음</button>'));
  assert.ok(!h.includes('data-av-player-total'),'명단 이름은 누적 선택이 아니다');
});

test('daily roster rows use the profile link; the totals table keeps the cumulative link',()=>{
  const daily=fn('renderAvailDaily'),players=fn('renderAvailPlayers'),AT=fs.readFileSync(path.join(__dirname,'../studio/avail-table.js'),'utf8');   /* 3.308 — 행은 표 모듈 */
  assert.ok(AT.includes('name=avProfileLink(p)+avYearTag(p)'),'날짜별 명단 행 = 프로필 링크');
  assert.ok(!daily.includes('avPlayerLink(p)')&&!AT.includes('avPlayerLink(p)'),'날짜별 명단에는 누적 링크가 없다');
  assert.ok(players.includes('avPlayerLink(p)')&&!players.includes('avProfileLink('),'선수별 누적 표의 이름 = 누적 선택 그대로');
  assert.ok(daily.includes('상태를 눌러 기록 · 이름을 눌러 프로필 수정'),'바닥 안내가 새 동작을 말한다');
});

test('the name opens openPlayer, and closing the profile redraws the roster only while it is on screen',()=>{
  const bind=SC.slice(SC.indexOf("root.querySelectorAll('[data-av-player-edit]')"),SC.indexOf('\n',SC.indexOf("root.querySelectorAll('[data-av-player-edit]')")));
  assert.ok(/openPlayer\(b\.dataset\.avPlayerEdit\)/.test(bind),'프로필 창을 연다');
  assert.ok(/avClosePicker\(\);/.test(bind),'열려 있던 상태 선택 창은 닫는다');
  const close=fn('closePlayer');
  assert.ok(/\$\("availView"\);if\(_av&&_av\.classList\.contains\("on"\)&&typeof renderAvail==="function"\)renderAvail\(\)/.test(close),'가용인원 화면이 켜져 있을 때만 다시 그린다');
});

test('3.307 version pins and release note',()=>{
  const app=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8'),sw=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
  /* 판 번호는 글자로 박지 않는다(code-budget-3043 래칫) — app.html 에서 읽어 sw.js 와 맞춘다. 뒤 판도 지나간다 */
  const build=app.match(/window\.PS_BUILD='([0-9.]+)'/)[1];assert.ok(Number(build)>=3.307,'3.307 이 판을 올렸다');
  assert.match(sw,new RegExp("const CACHE = 'process-"+build.replace(/\./g,'\\.')+"';"));
  const notes=require('../studio/release-notes.js');
  const e=notes.entries().find(x=>x.id==='2026-11-17-v3-307-avail-profile');assert.ok(e);
  assert.match(e.title,/v3\.307/);assert.equal(e.changes.length,1);assert.match(e.changes[0],/프로필/);
});

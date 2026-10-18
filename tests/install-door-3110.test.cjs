// 3.110 — 홈 화면 설치의 문(사용자 «홈화면에 설치도 만들고 싶은데 앱안에 어디다 넣으면 좋을까?» → 목업 → «아이패드와 컴퓨터 사용자도 볼 수 있게»).
// 폰 더보기 «앱» 줄 · 아이패드 · 컴퓨터 왼쪽 메뉴 한 칸 · 다른 날 세 번째로 열 때 한 번 뜨는 안내. 판정은 studio/install-door.js 를 require 해서 돌려 본다.
// 화면에서 실제로 보이고 눌리는지는 tests/browser/install-door.mjs.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const D=require('../studio/install-door.js');
const root=path.join(__dirname,'..');
const R=f=>fs.readFileSync(path.join(root,f),'utf8');

const UA={
  iphone:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  iphoneChrome:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1',
  ipadDesktopMode:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  android:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
  samsung:'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36',
  winChrome:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  winEdge:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0',
  macSafari:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  firefox:'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
};

test('기기 · 브라우저를 셸의 안내 시트와 같은 갈래로 나눈다 — 아이패드(데스크톱 모드)도 iOS',()=>{
  assert.equal(D.kindOf(UA.iphone,'iPhone',5),'ios-safari');
  assert.equal(D.kindOf(UA.iphoneChrome,'iPhone',5),'ios-chrome');
  assert.equal(D.kindOf(UA.ipadDesktopMode,'MacIntel',5),'ios-safari','터치 맥 = 아이패드');
  assert.equal(D.kindOf(UA.macSafari,'MacIntel',0),'desk-safari');
  assert.equal(D.kindOf(UA.android,'Linux armv8l',5),'and-chrome');
  assert.equal(D.kindOf(UA.samsung,'Linux armv8l',5),'and-samsung');
  assert.equal(D.kindOf(UA.winChrome,'Win32',0),'desk-chrome');
  assert.equal(D.kindOf(UA.winEdge,'Win32',0),'desk-edge');
  assert.equal(D.kindOf(UA.firefox,'Win32',0),'desk-firefox');
  /* 셸의 안내 시트가 같은 이름을 쓴다 — 갈래가 어긋나면 문 이름과 시트의 길이 서로 다른 기기를 말한다 */
  const app=R('studio/app.html');
  for(const k of ['ios-chrome','ios-edge','ios-firefox','ios-safari','and-samsung','and-firefox','and-chrome','desk-edge','desk-firefox','desk-safari','desk-chrome'])
    assert.ok(app.includes("'"+k+"'"),'셸 browserKind 에 '+k);
});

test('문 이름 — 폰 · 아이패드는 «홈 화면에 추가», 컴퓨터는 «앱 설치»',()=>{
  assert.equal(D.label('ios-safari'),'홈 화면에 추가');
  assert.equal(D.label('and-samsung'),'홈 화면에 추가');
  assert.equal(D.label('desk-chrome'),'앱 설치');
  assert.equal(D.label('desk-safari'),'앱 설치');
  assert.match(D.copy('ios-safari').title,/홈 화면에 추가/);
  assert.match(D.copy('desk-edge').title,/앱으로 설치/);
  assert.doesNotMatch(D.copy('desk-edge').body,/홈 화면/,'컴퓨터에는 홈 화면이 없다');
});

test('문은 설치 전에만 — 설치된 기기 · 설치를 못 하는 데스크톱 파이어폭스에는 없다',()=>{
  assert.equal(D.showDoors({installed:false,kind:'ios-safari'}),true);
  assert.equal(D.showDoors({installed:false,kind:'desk-chrome'}),true);
  assert.equal(D.showDoors({installed:true,kind:'ios-safari'}),false);
  assert.equal(D.showDoors({installed:false,kind:'desk-firefox'}),false);
  assert.equal(D.showDoors({installed:false,kind:'and-firefox'}),true,'안드로이드 파이어폭스는 홈 화면에 추가가 된다');
});

test('안내는 다른 날 세 번째로 열 때 — 같은 날 여러 번 · 새로고침은 하루',()=>{
  const day=n=>new Date(2026,9,10+n,9,0,0).getTime();
  const c={installed:false,kind:'and-chrome'};
  let s=D.readState(null);
  s=D.noteOpen(s,day(0)); s=D.noteOpen(s,day(0)+3600e3); s=D.noteOpen(s,day(0)+7200e3);
  assert.deepEqual(s.days,['2026-10-10']); assert.equal(D.shouldNudge(s,c),false);
  s=D.noteOpen(s,day(1)); assert.equal(D.shouldNudge(s,c),false,'이틀째');
  s=D.noteOpen(s,day(3)); assert.equal(D.shouldNudge(s,c),true,'다른 날 세 번째');
  assert.equal(D.shouldNudge(s,{installed:true,kind:'and-chrome'}),false,'설치했으면 안 뜬다');
  assert.equal(D.shouldNudge(s,{installed:false,kind:'desk-firefox'}),false);
  /* 한 번 띄우면 끝 — 저장했다 다시 읽어도 */
  const shown=D.readState(JSON.stringify({...s,shown:D.dayOf(day(3))}));
  assert.equal(D.shouldNudge(D.noteOpen(shown,day(9)),c),false);
  assert.ok(D.noteOpen(shown,day(9)).days.length<=D.DAYS_BEFORE,'쓴 날은 필요한 만큼만 남긴다');
});

test('저장된 값이 깨져 있어도 처음부터 센다',()=>{
  for(const raw of ['{','null','[]','"x"','{"days":"2026-10-10","shown":3}','{"days":["어제",1,"2026-10-10"]}']){
    const s=D.readState(raw);
    assert.ok(Array.isArray(s.days)&&s.days.every(d=>/^\d{4}-\d\d-\d\d$/.test(d)),raw);
    assert.equal(typeof s.shown,'string',raw);
  }
});

test('«괜찮아요» 뒤 한 줄은 지금 보이는 문을 가리킨다',()=>{
  assert.equal(D.laterText('more','ios-safari'),'언제든 더보기 › 홈 화면에 추가에서 다시 볼 수 있어요');
  assert.equal(D.laterText('rail','desk-chrome'),'언제든 왼쪽 아래 «앱 설치»에서 다시 볼 수 있어요');
  assert.equal(D.laterText('rail','ios-safari'),'언제든 왼쪽 아래 «홈 화면에 추가»에서 다시 볼 수 있어요');
  assert.match(D.laterText('settings','and-chrome'),/앱 설정 › 기기/);
});

test('셸에 문이 세 곳 — 처음엔 숨김, 누르면 같은 안내 시트(psInstallGo), 서비스워커가 파일을 담는다',()=>{
  const app=R('studio/app.html'),sw=R('sw.js');
  const doors=[...app.matchAll(/<button [^>]*data-install-door[^>]*>/g)].map(m=>m[0]);
  assert.equal(doors.length,2,'앱 더보기 · 팀 더보기');
  for(const d of doors)assert.match(d,/\shidden[\s>]/,'설치 여부를 보기 전엔 숨긴다');
  assert.match(app,/<div class="ps-instwrap" id="psInstWrap" hidden><button type="button" class="gearbtn" id="psInstRail"/,'왼쪽 메뉴 칸은 앱 설정 타일과 같은 옷');
  assert.ok(app.indexOf('id="psInstWrap"')<app.indexOf('id="psUpdWrap"')&&app.indexOf('id="psUpdWrap"')<app.indexOf('id="gearWrap"'),'설치 · 업데이트 · 앱 설정 순서 — 업데이트는 앱 설정 바로 위 그대로');
  assert.match(app,/if\(k==='install'\)\{ if\(window\.psInstallGo\)window\.psInstallGo\(\); return; \}/);
  assert.match(app,/if\(b\.hasAttribute\('data-tb-install'\)\)\{ sheet\.hidden=true; if\(window\.psInstallGo\)window\.psInstallGo\(\); return; \}/);
  assert.match(app,/<script src="install-door\.js"><\/script>/);
  assert.ok(sw.includes("'/studio/install-door.js'"),'오프라인에서도 문이 열린다');
});

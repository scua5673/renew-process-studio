// 3.039 — 안내 문구가 가리키는 «앱 설정 › …» 길이 실제로 있는지(피드백 CP-8 ~ CP-12 · CP-16 ~ CP-20 — 없는 메뉴 다섯 곳 · 내부 용어).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const R=f=>fs.readFileSync(path.join(root,f),'utf8');
const app=R('studio/app.html');
const files=fs.readdirSync(path.join(root,'studio')).filter(f=>/\.(html|js)$/.test(f)).map(f=>'studio/'+f);
const TABS=['기기','일반','데이터','사용법'];
// 앱 설정 탭 이름은 셸의 탭 단추와 같아야 한다
test('앱 설정 탭은 기기 · 일반 · 데이터 · 사용법',()=>{
  assert.match(app,/var names=\{device:'기기',general:'일반',data:'데이터',help:'사용법'\},btns=\{\};/,'탭이 바뀌면 TABS 와 문구를 같이 고친다');
});
test('«앱 설정 › X» 는 있는 탭을, «앱 설정 › 데이터 › «Y»» 의 Y 는 있는 단추를 가리킨다',()=>{
  const bad=[];
  for(const f of files){ const s=R(f);
    for(const m of s.matchAll(/앱 설정 › ([가-힣·A-Za-z]+)(?: › (?:([가-힣 ]+?) › )?«([^»]+)»)?/g)){
      if(!TABS.includes(m[1])){ bad.push(f+': '+m[0]); continue; }
      if(m[3]&&!new RegExp('>'+m[3].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'<').test(app))bad.push(f+': 단추 없음 '+m[0]);
      if(m[2]&&!new RegExp('gp-lb">'+m[2]+'<').test(app))bad.push(f+': 줄 없음 '+m[0]);
    } }
  assert.deepEqual(bad,[]);
});
test('사라진 메뉴 · 운영자용 말 · 내부 역할 키 · 영어 경고창이 화면 문구에 없다',()=>{
  const all=files.map(f=>R(f)).join('\n');
  for(const re of [/설정의 “지금 동기화”/,/앱 설정 › 계정 › 지금 받기/,/앱 설정 › 기기 › 동기화 진단/,/데이터 › 자료 확인에서/,/고급 복구에서 확인/,/Manual Linking 을 켜/,/alert\('Backup stopped/,/내 권한 <b>'\+role/,/이 기기의 원문은 보존됩니다/,/로그인과 보드 연결을 확인한 뒤/])assert.doesNotMatch(all,re,String(re));
  assert.doesNotMatch(app,/관리자에게 (알려|삭제를 요청)/,'«관리자» 대신 «오류 제보»');
  assert.doesNotMatch(app,/alert\('[^']*'\+String\(e&&e\.message/,'경고창 본문에 오류 원문을 붙이지 않는다(psFailAlert)');
});
test('psFailAlert — 원문은 오류 기록으로, 우리 한국어 이유만 화면에',()=>{
  const a=app.indexOf('window.psUserReason=function(e)'), s=app.slice(a,app.indexOf('</script>',a));
  const fn=new Function('window',s+';return window;')({});
  assert.equal(fn.psUserReason(new Error('이 파일은 다른 팀의 백업이에요')),'이 파일은 다른 팀의 백업이에요');
  assert.equal(fn.psUserReason(new Error('IndexedDB 키 목록을 읽지 못했습니다')),'','내부 말이 섞이면 숨긴다');
  assert.equal(fn.psUserReason(new Error('QuotaExceededError: The quota has been exceeded.')),'');
  assert.match(s,/PSSync\.event\('app_error',\{status:'error',feature:'app',error_code:'alert_fail'/);
  assert.match(s,/앱 설정 › 일반 › «오류 제보»로 알려 주세요/);
});

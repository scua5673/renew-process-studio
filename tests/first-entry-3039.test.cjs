// 3.039 — 첫 사용 입구(피드백 UX-2 · UX-3 · DS-11). 실제 화면은 tests/browser/coach-idp-entry.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const app=R('studio/app.html'), idp=R('studio/idp.html'), board=R('studio/board.html');

test('UX-2 — 팀 코치(임원 · 코칭스태프)의 사이드바 «IDP»는 팀 IDP 로, 선수 · 개인 공간 · 손님은 그대로',()=>{
  assert.match(app,/function psCoachTeamIdp\(\)\{ try\{ var r=window\.PSPerms&&PSPerms\.role&&PSPerms\.role\(\); return r==='staff'\|\|r==='executive'; \}catch\(_\)\{ return false; \} \}/);
  assert.match(app,/if\(b\.dataset\.app==='idp'&&b\.dataset\.scope==='global'&&!b\.dataset\.train&&psCoachTeamIdp\(\)\)\{ var _ti=teamKeyBtn\('idp'\); if\(_ti\)\{ openTeamButton\(_ti\); return; \} \}\n      currentTeamKey='';\n      showApp\(b\.dataset\.train\?'design':b\.dataset\.app\);/);
  assert.match(app,/<button data-team-key="idp" data-app="idp" data-idp-squad="1">IDP<\/button>/,'팀 IDP 단추(선수단 보기)');
  assert.match(idp,/var opts='<option value="'\+esc\(mine\)\+'">내 IDP<\/option>';/,'코치 본인 일지는 팀 IDP 의 보기 선택에 남는다');
});

test('UX-3 — 연결된 선수 0명인 «오늘»은 안내 + 초대(만들 수 있는 사람만) + 평가 시작',()=>{
  assert.doesNotMatch(idp,/if\(!linked\.length\)return '';/,'빈 문자열로 돌아가지 않는다');
  const a=idp.indexOf('if(!linked.length){'), s=idp.slice(a,a+1400);
  assert.ok(a>0);
  assert.match(s,/_ia\.idpLink\.can\(\)/); assert.match(s,/<b>아직 IDP를 쓰는 선수가 없어요<\/b>/);
  assert.match(s,/\(_inv\?'<button type="button" class="btn" data-sq-invite>선수 초대하기<\/button>':''\)/);
  assert.match(s,/\(can\?'<button type="button" class="btn primary" data-sqe-mode="eval">선수 평가 시작<\/button>':''\)/);
  assert.match(s,/sqUnlinkedNote\(rws\)/,'연결 안 된 선수 수는 그대로 알린다');
  assert.match(idp,/wrap\.querySelectorAll\('\[data-sq-invite\]'\),function\(b\)\{ b\.onclick=function\(\)\{ try\{ var a=idpSaveApi\(\); if\(a&&a\.idpLink&&a\.idpLink\.invite\)a\.idpLink\.invite\(\); \}catch\(_\)\{\} \}; \}\);/);
});

test('DS-11 — 폰의 빈 작전판 안내: 폰 · 빈 판에서만, 닫으면 이 기기에서 끝, 보관함 열기는 셸이 같은 출처 · 작전판 프레임에서만 받는다',()=>{
  const a=board.indexOf('<style id="ps-3039-phone-hint">'), s=board.slice(a,board.indexOf('</script>',a));
  assert.ok(a>0);
  assert.match(s,/b\.classList\.contains\("ps-phone-work"\)&&!off\(\)&&!window\.__vaultBook&&!window\.__vaultEdit&&!window\.__vaultViewMode&&!b\.classList\.contains\("meet-mode"\)&&empty\(\)/);
  assert.match(s,/var KEY="ps_phone_board_hint_v1"/); assert.match(s,/localStorage\.setItem\(KEY,"1"\)/);
  assert.match(s,/parent\.postMessage\(\{source:"board",type:"openVault"\},location\.origin\)/);
  assert.match(s,/if\(document\.body\.classList\.contains\("ps-phone-work"\)\|\|document\.getElementById\("psPhoneHint"\)\)kick\(\);/,'폰이 아니면 아무것도 하지 않는다');
  assert.match(app,/if\(d\.source==='board' && d\.type==='openVault'\)\{ var _fb=document\.getElementById\('fBoard'\); if\(e\.origin!==location\.origin\|\|!_fb\|\|e\.source!==_fb\.contentWindow\)return; var _vb=document\.getElementById\('psTrainBtn'\);/);
  assert.match(R('tests/browser/run-critical.mjs'),/'coach-idp-entry'\]/,'CI 브라우저 묶음에');
});

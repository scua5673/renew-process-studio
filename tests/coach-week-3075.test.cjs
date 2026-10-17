'use strict';
/* 3.075 — 코치 점검(10/16): 폰 첫 화면이 보기만 하는 작전판이었다 · 경기 준비를 열기만 해도 «상대 분석»이 끝난 것으로 넘어갔다 · «세션 채우기 →»가 시트까지 열지 않았다 · 상대팀 이름이 잘렸다 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'../studio',f),'utf8');
const SC=read('scout.html'),P=read('process.html'),APP=read('app.html');

test('an empty opponent-analysis scaffold does not count as analysis done',()=>{
  const ctx={};vm.createContext(ctx);
  vm.runInContext(/function mmBoardHas\(b\)\{[^\n]*\}/.exec(SC)[0]+'\n'+/function obHasContent\(m\)\{[\s\S]*?\n\}/.exec(SC)[0]+'\n'+/function obEnsure\(m\)\{[\s\S]*?\n\}/.exec(SC)[0]+'\nvar MB2_STD_PHASES=[["atk","공격 시"],["def","수비 시"]];',ctx);
  const m={};ctx.obEnsure(m);
  assert.equal(ctx.obHasContent(m),false,'obEnsure 가 깐 빈 뼈대는 내용이 아니다');
  m.oppPB.boards.def.frames.push({opp:[{x:1,y:2}],us:[]});
  assert.equal(ctx.obHasContent(m),true,'상대 선수를 놓은 프레임이 있으면 내용이다');
  assert.equal(ctx.obHasContent({}),false);
  assert.ok(SC.includes('.some(function(k){return has(m[k]);})||obHasContent(m);'),'완료 판정이 빈 뼈대를 세지 않는다');
  assert.ok(!SC.includes('||has(m.oppPB)'));
});

test('today «세션 채우기 →» opens that session\'s fill sheet once',()=>{
  assert.ok(SC.includes('class="ck-fill" data-ck="fill">세션 채우기 →</button>'));
  assert.ok(/else if\(k==="fill"\)\{[\s\S]{0,400}type:"openSchedule",date:[\s\S]{0,200}fill:\{slot:_fs\.slot\|\|"",at:Date\.now\(\)\}/.test(SC));
  assert.ok(/slot:String\(\(training&&training\.slot\)\|\|""\)/.test(SC),'ckSession 이 세션 slot 을 알려 준다');
  assert.ok(APP.includes("postMessage({type:'gotoDate',date:_gd,fill:_gf},'*')"),'셸이 fill 을 일정 화면에 넘긴다');
  assert.ok(/if\(d\.fill&&d\.fill\.at&&d\.fill\.at!==window\.__gotoFillAt\)\{ window\.__gotoFillAt=d\.fill\.at; try\{ wksFill\(_col,String\(d\.fill\.slot\|\|''\),'train'\)/.test(P),'두 번 와도 한 번만 연다');
});

test('the opponent name takes its own line in the weekly match card',()=>{
  assert.ok(P.includes('.wks-kind.m .wks-krow:has(>.wks-opp){flex-wrap:wrap}'));
  assert.ok(P.includes('.wks-kind.m .wks-krow>.wks-opp{flex:1 0 100%;white-space:normal;overflow-wrap:anywhere}'));
});

test('phone opens on team today (team workspace) or community (otherwise); desktop keeps the board',()=>{
  const m=/function psPhoneStart\(\)\{[\s\S]*?\n    \}\n/.exec(APP);assert.ok(m,'psPhoneStart');
  const src=m[0];
  assert.ok(src.includes("getAttribute('data-ps-device')!=='phone')return false"),'폰만');
  assert.ok(/localStorage\.getItem\('ps_sync_session'\)&&Array\.isArray\(list\)&&list\.some\(function\(w\)\{ return w&&w\.id===wid&&w\.kind==='team'; \}\)/.test(src),'로그인한 팀 공간');
  assert.ok(src.includes("#appSeg button[data-team-hub]")&&src.includes('#teamBottom [data-tb="today"]'),'팀 → 오늘');
  assert.ok(/PSSync\.dataUnlocked&&PSSync\.dataUnlocked\(\)\)\{\s*var hub=/.test(src),'팀 운영은 자료 잠금이 풀린 뒤에 연다');
  assert.ok(src.includes("showApp('community')"),'그 밖 → 커뮤니티');
  assert.ok(/if\(q==='player'\)\{ showApp\('idp'\); \}\n      else if\(psPhoneStart\(\)\)return;\n      else pingApp\('board'\);/.test(APP),'선수 딥링크가 먼저, 데스크톱은 작전판');
});

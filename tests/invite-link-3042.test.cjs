// 3.044 — 피드백 15: 선수별 초대 링크 · 팀 전체 내보내기. 브라우저 흐름은 tests/browser/invite-link-export(코치 쪽).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const sync=R('studio/sync.js'),idp=R('studio/idp.html'),scout=R('studio/scout.html'),files=R('studio/team-files.js');
const fnSrc=(src,name)=>{ const a=src.indexOf('function '+name+'('); assert.ok(a>=0,name); let i=src.indexOf('{',a),d=0; for(;i<src.length;i++){ if(src[i]==='{')d++; else if(src[i]==='}'&&!--d)break; } return src.slice(a,i+1); };
function mem(init){ const m=new Map(Object.entries(init||{})); return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),_m:m}; }

test('링크를 열면 주소에서 코드 · 선수 · 토큰을 걷어 이 기기에 둔다(토큰이 이상하면 코드 합류만)',()=>{
  const run=(href)=>{ const ls=mem(),u=new URL(href); let replaced='';
    const ctx={window:{},location:{search:u.search,pathname:u.pathname,hash:u.hash},history:{replaceState:(a,b,c)=>{replaced=c;}},URLSearchParams,localStorage:ls,Date,JSON,String};
    ctx.window.top=ctx.window; vm.createContext(ctx);
    vm.runInContext("var INV_PENDING='ps_invite_pending_v1';"+fnSrc(sync,'invWrite')+fnSrc(sync,'consumeInviteLink')+';window.top=window;consumeInviteLink();',Object.assign(ctx,{window:ctx}));
    return {pend:JSON.parse(ls.getItem('ps_invite_pending_v1')||'null'),replaced}; };
  const a=run('https://x.test/studio/app.html?join=fixjoin1&pid=vp07&tk='+'a'.repeat(24)+'&s=1#h');
  assert.equal(a.pend.code,'FIXJOIN1'); assert.equal(a.pend.pid,'vp07'); assert.equal(a.pend.tk,'a'.repeat(24));
  assert.equal(a.replaced,'/studio/app.html?s=1#h','코드 · 토큰은 주소창 · 기록에 남기지 않는다');
  const b=run('https://x.test/studio/app.html?join=FIXJOIN1&pid=vp07&tk=nope');
  assert.equal(b.pend.tk,''); assert.equal(b.pend.pid,'','토큰이 없으면 선수 연결 없이 코드 합류만');
  assert.equal(run('https://x.test/studio/app.html?join=bad!code').pend,null,'코드 모양이 아니면 버린다');
  assert.match(sync,/consumeHash\(\);\n  consumeAccountAction\(\);\n  consumeInviteLink\(\);/,'부팅 때 한 번');
});

test('선수 IDP — 링크로 합류했으면(이 팀 · 이 계정) 고르지 않고 그 선수로 claim(토큰 함께), 다른 사람이 이미 이어진 선수면 평소처럼',()=>{
  const run=(pending,st)=>{ const ls=mem({ps_invite_pending_v1:JSON.stringify(pending)});
    const ctx={localStorage:ls,JSON,String,Date,teamWsObj:()=>({id:'W1',kind:'team'})}; vm.createContext(ctx);
    const out=vm.runInContext(fnSrc(idp,'ilcFromLink')+';ilcFromLink(st)',Object.assign(ctx,{st}));
    return {out,left:ls.getItem('ps_invite_pending_v1')}; };
  const st={uid:'U1',roster:[{id:'vp07',num:'7',name:'가상 선수 7'}],taken:{}};
  const ok=run({code:'X',pid:'vp07',tk:'t'.repeat(24),wid:'W1',uid:'U1'},st);
  assert.equal(ok.out.pid,'vp07'); assert.equal(ok.out.tk,'t'.repeat(24)); assert.equal(ok.out.via,'link'); assert.equal(ok.out.num,'7'); assert.equal(ok.left,null,'한 번 쓰고 지운다');
  assert.equal(run({pid:'vp07',tk:'t'.repeat(24),wid:'W2',uid:'U1'},st).out,null,'다른 팀');
  assert.equal(run({pid:'vp07',tk:'t'.repeat(24),wid:'W1',uid:'U9'},st).out,null,'다른 계정');
  assert.equal(run({pid:'vp07',tk:'t'.repeat(24),wid:'W1',uid:'U1'},{...st,taken:{vp07:1}}).out,null,'이미 다른 계정에 이어진 선수');
  assert.equal(run({pid:'vp07',wid:'W1'},st).out,null,'토큰 없는 링크는 claim 을 만들지 않는다');
  assert.match(idp,/if\(!c&&!st\.mine\)\{ var lc=ilcFromLink\(st\); if\(lc\)\{ doc\.claim=c=lc;/);
});

test('코치 쪽 — 링크를 만든 기기만 토큰으로 바로 잇고, 다른 기기 · 다른 토큰은 확인 카드(«초대 링크로 합류»)',()=>{
  const s=fnSrc(scout,'ilAutoLinkByToken');
  assert.match(s,/if\(!c\.tk\|\|!t\|\|String\(t\.tk\)!==String\(c\.tk\)\|\|holders\[pid\]\)return;/);
  assert.match(s,/delete mine\[pid\]/,'토큰은 한 번만');
  assert.match(scout,/try\{ if\(ilAutoLinkByToken\(\)\)return ""; \}catch\(_\)\{\}/);
  assert.match(scout,/\(c\.via==="link"\?' 초대 링크로 합류':' 고름'\)/);
  // 토큰은 동기화하지 않는 키(ps_*)에만 — 공유 문서에 쓰지 않는다
  assert.match(sync,/var INV_TOKENS='ps_idp_invite_tokens_v1', INV_PENDING='ps_invite_pending_v1'/);
  assert.doesNotMatch(sync.slice(sync.indexOf('var KEYS=['),sync.indexOf('var PERSONAL=')),/ps_idp_invite_tokens_v1|ps_invite_pending_v1/);
  assert.match(fnSrc(sync,'uiPlayerInvite'),/if\(!idpLinkCan\(\)\)/,'임원만 만든다');
});

test('팀 전체 내보내기 — 임원만, 명단 CSV 에는 연락처 · 생년월일 칸이 없다, 엑셀용 BOM',()=>{
  const win={};const ctx={window:win,document:{},navigator:{userAgent:''},localStorage:mem(),JSON,String,Object,Array,Promise,Date,Error,Math,setTimeout};
  vm.createContext(ctx); vm.runInContext(files,ctx);
  const C=win.PSTeamFiles._csv;
  const scout={attrs:[{id:'a1',name:'첫 터치'}],positions:[{id:'pos_CB',name:'CB'}],players:[
    {id:'p1',num:'4',name:'김 "철수"',grp:'A팀',posId:'pos_CB',status:'injured',statusUntil:'2026-10-30',phone:'010-1234',birth:'2012-01-01',levels:{a1:3}},
    {id:'t1',type:'target',name:'후보',levels:{a1:5}}]};
  const roster=C.csv(C.rosterRows(scout));
  assert.ok(roster.startsWith('﻿번호,이름,조,포지션,상태,상태 끝나는 날\r\n'));
  assert.match(roster,/4,"김 ""철수""",A팀,CB,injured,2026-10-30/,'따옴표는 CSV 규칙대로');
  assert.doesNotMatch(roster,/010-1234|2012-01-01|후보/,'연락처 · 생년월일 · 스카우팅 후보는 넣지 않는다');
  const ev=C.csv(C.evalRows(scout));
  assert.match(ev,/번호,이름,항목,단계\r\n4,"김 ""철수""",첫 터치,3\r\n$/);
  assert.match(fnSrc(files,'exportAll'),/if\(!can\)return Promise\.reject\(new Error\('팀 전체 내보내기는 팀 임원만 할 수 있어요'\)\);/);
  assert.match(R('studio/app.html'),/<button id="bkAll" [^>]*style="display:none">팀 전체 내보내기<\/button>/,'기본은 숨김 — 팀 · 임원에게만 보인다');
  assert.match(R('tests/browser/run-critical.mjs'),/'invite-link-export'/,'CI 브라우저 묶음에');
});

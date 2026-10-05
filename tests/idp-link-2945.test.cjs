'use strict';
/* 2.945 — IDP 연결 쉽게(사용자 «추천대로» — 설계 목업 ②명단 칩에서 바로 · ③선수가 «나는 누구» · ④코치 확인 한 번).
   ⓐ 쓰는 곳은 권한 관리와 같은 한 칸(cs_perms_v1.members[uid].playerId) — 그 칸만 바꾸고 다른 팀원·역할은 그대로.
   ⓑ 한 선수에 두 계정을 붙이지 않는다.
   ⓒ 선수는 권한 문서를 못 쓰므로 «나는 누구»는 자기 IDP 문서의 doc.claim — 코치 기기가 받아 둔 문서에서 읽는다.
   ⓓ 공개 미러에는 고를 수 있는 최소(번호·이름·자리·조)만. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const J=x=>JSON.parse(JSON.stringify(x));
const read=f=>fs.readFileSync(path.join(__dirname,'../studio/'+f),'utf8');
const sync=read('sync.js'),scout=read('scout.html'),idp=read('idp.html');
function cut(src,from,to){const a=src.indexOf(from),b=src.indexOf(to,a+1);assert.ok(a>=0&&b>a,'block '+from);return src.slice(a,b);}
function fakeLS(init){
  const m=new Map(Object.entries(init||{}));
  return {get length(){return m.size;},key(i){return [...m.keys()][i]??null;},getItem(k){return m.has(k)?m.get(k):null;},
    setItem(k,v){m.set(k,String(v));},removeItem(k){m.delete(k);},_m:m};
}

function syncCtx(perms,role){
  let stored=perms,synced=0;
  const c=vm.createContext({JSON,Object,String,Array,Error,Date,Promise,
    activeWsObj:()=>({id:'w1',kind:'team',role:'member'}),isTeamWs:()=>true,activeWs:()=>'w1',
    forceSync:()=>{synced++;},actTrack:()=>{},membersOf:()=>Promise.resolve([]),uiInvite:()=>{},
    window:{PSPerms:{role:()=>role,get:()=>stored&&JSON.parse(JSON.stringify(stored)),set:p=>{stored=p;}}}});
  vm.runInContext(cut(sync,'function permsEditApply(','function uiPerms(')+cut(sync,'var _ilMembers=null','function uiLeave('),c);
  return {c,get stored(){return stored;},get synced(){return synced;}};
}

test('임원이 연결하면 그 계정의 playerId 한 칸만 바뀐다 — 역할·구역·다른 팀원은 그대로',()=>{
  const base={v:1,defaultRole:'player',staffEdit:'view',members:{u1:{role:'player'},u2:{role:'staff',scopes:['board'],playerId:'p9'}}};
  const t=syncCtx(base,'executive');
  assert.equal(t.c.idpLinkSet('u1','p1'),true);
  assert.deepEqual(J(t.stored.members.u1),{role:'player',playerId:'p1'});
  assert.deepEqual(J(t.stored.members.u2),{role:'staff',scopes:['board'],playerId:'p9'});
  assert.equal(t.stored.staffEdit,'view');assert.equal(t.synced,1);
  /* 아직 항목이 없는 새 계정도 연결된다(합류만 하고 권한 화면에서 손대지 않은 선수) */
  assert.equal(t.c.idpLinkSet('u3','p3'),true);
  assert.deepEqual(J(t.stored.members.u3),{playerId:'p3'});
  /* 같은 값이면 쓰지 않는다 */
  assert.equal(t.c.idpLinkSet('u3','p3'),false);
});
test('한 선수에 두 계정은 안 된다 · 선수·코치는 연결할 수 없다 · 풀면 칸이 지워진다',()=>{
  const t=syncCtx({v:1,members:{u2:{playerId:'p9'},u5:{playerId:'p5'}}},'executive');
  assert.throws(()=>t.c.idpLinkSet('u1','p9'),/이미 다른 계정/);
  assert.equal(t.c.idpLinkSet('u5',''),true);
  assert.equal('playerId' in t.stored.members.u5,false);
  const s=syncCtx({v:1,members:{}},'staff');
  assert.throws(()=>s.c.idpLinkSet('u1','p1'),/임원만/);
  const p=syncCtx({v:1,members:{}},'player');
  assert.equal(p.c.idpLinkCan(),false);
});
test('PSSync 에 idpLink 로 내보낸다',()=>{
  assert.match(sync,/idpLink:\{can:idpLinkCan,members:idpLinkMembers,set:idpLinkSet,invite:/);
});

function scoutCtx(opts){
  const ls=fakeLS(opts.ls),toasts=[];
  const c=vm.createContext({JSON,Object,String,Array,Math,Date,parseInt,isNaN,console,localStorage:ls,
    data:opts.data,store:{get:k=>JSON.parse(ls.getItem(k)||'null'),set:(k,v)=>{ls.setItem(k,JSON.stringify(v));return true;}},
    scoutAutomaticWriteAllowed:()=>opts.canWrite!==false,
    matchPerms:()=>JSON.parse(ls.getItem('cs_perms_v1')||'null')||{},matchSession:()=>({uid:'coach'}),
    posAbbr:n=>({'센터백':'CB','공격수':'FW'})[n]||n,tmAbbrOf:p=>({pa:'CB',pb:'FW'})[p.posId]||'',
    esc:s=>String(s==null?'':s).replace(/[&<>"']/g,ch=>'&#'+ch.charCodeAt(0)+';'),
    toast:m=>toasts.push(m),$:()=>null,renderTeam(){},renderCkHome(){},psConfirm(){},
    document:{getElementById:()=>null,createElement:()=>({}),body:{appendChild(){}}},
    window:{}});
  c.window.parent=c.window;c.window.PSSync={idpLink:{can:()=>opts.can!==false,set:()=>true,members:()=>Promise.resolve([])}};
  vm.runInContext(cut(scout,'function idpRosterMirror(','function rosterSaveMirrors(')+cut(scout,'var _ilRosterSig','/* 선수 문서(claim)·권한 문서가'),c);
  return {c,ls,toasts};
}
const team=()=>({positions:[{id:'pa',name:'센터백'},{id:'pb',name:'공격수'}],players:[
  {id:'p1',num:'4',name:'강하늘',posId:'pa',grp:'A팀',levels:{x:5},status:'injury',memo:'비밀'},
  {id:'p2',num:'11',name:'정우진',posId:'pb',grp:'B팀'},
  {id:'t1',num:'9',name:'후보',type:'target'},{id:'p3',name:'  '}],meta:{}});

test('공개 미러의 명단은 번호·이름·자리·조만 — 후보·이름 없는 줄은 빠진다',()=>{
  const {c}=scoutCtx({data:team(),ls:{}});
  assert.deepEqual(JSON.parse(JSON.stringify(c.idpRosterMirror(c.data))),[
    {id:'p1',num:'4',name:'강하늘',pos:'CB',grp:'A팀'},{id:'p2',num:'11',name:'정우진',pos:'FW',grp:'B팀'}]);
  assert.match(scout,/roster:idpRosterMirror\(main\)/,'선수단 저장이 미러에 명단을 싣는다');
});
test('미러 명단은 바뀐 경우에만, 편집권 있는 기기만 맞춘다',()=>{
  const t=scoutCtx({data:team(),ls:{cs_team_attrs_v1:JSON.stringify({attrs:[{id:'a'}],grpBy:{}})}});
  t.c.idpRosterMirrorRefresh();
  const m=JSON.parse(t.ls.getItem('cs_team_attrs_v1'));
  assert.equal(m.roster.length,2);assert.deepEqual(m.attrs,[{id:'a'}],'다른 칸은 그대로');
  const v=scoutCtx({data:team(),canWrite:false,ls:{cs_team_attrs_v1:JSON.stringify({attrs:[{id:'a'}]})}});
  v.c.idpRosterMirrorRefresh();
  assert.equal(JSON.parse(v.ls.getItem('cs_team_attrs_v1')).roster,undefined,'보기 전용 기기는 쓰지 않는다');
});

const claimLS=()=>({
  cs_perms_v1:JSON.stringify({members:{uL:{playerId:'p2'},uA:{role:'player'}}}),
  ps_member_names_v1:JSON.stringify({uA:'강하늘',uB:'박선수'}),
  'cs_idp_v1_uA':JSON.stringify({v:1,claim:{pid:'p1',num:'4',name:'강하늘',at:200}}),
  'cs_idp_v1_uB':JSON.stringify({v:1,profile:{name:'박지성'},claim:{none:1,at:300}}),
  'cs_idp_v1_uL':JSON.stringify({v:1,claim:{pid:'p2',at:100}}),        /* 이미 연결 — 확인 목록에 없다 */
  'cs_idp_v1_uC':JSON.stringify({v:1,log:{}}),                          /* claim 없음 */
  'cs_idp_v1_coach':JSON.stringify({v:1,claim:{pid:'p1',at:400}}),      /* 내 문서 */
  'cs_idp_v1_local':JSON.stringify({v:1,claim:{pid:'p1',at:500}})});

test('확인할 claim: 연결 안 된 남의 문서만, 최근 고른 순, 본 것은 빠진다',()=>{
  const t=scoutCtx({data:team(),ls:claimLS()});
  const L=t.c.idpClaims(false);
  assert.deepEqual(J(L.map(x=>x.uid)),['uB','uA']);
  assert.equal(L[0].name,'박지성','IDP 프로필 이름이 먼저');assert.equal(L[1].name,'강하늘');
  t.c.ilSeenSet('uA',200);
  assert.deepEqual(J(t.c.idpClaims(false).map(x=>x.uid)),['uB']);
  assert.deepEqual(J(t.c.idpClaims(true).map(x=>x.uid)),['uB','uA'],'명단 칩·시트는 본 것도 안다');
  /* 선수가 다시 고르면(at 이 바뀌면) 다시 뜬다 */
  t.ls.setItem('cs_idp_v1_uA',JSON.stringify({v:1,claim:{pid:'p1',at:250}}));
  assert.deepEqual(J(t.c.idpClaims(false).map(x=>x.uid)),['uB','uA']);
});
test('«오늘» 확인 카드: 맞으면 연결 · 명단에 없다고 하면 고르기 · 이미 다른 계정 선수면 다른 선수 고르기 · 임원 아니면 안 그린다',()=>{
  const ls=claimLS();ls['cs_idp_v1_uD']=JSON.stringify({v:1,claim:{pid:'p2',num:'11',name:'정우진',at:150}});
  const t=scoutCtx({data:team(),ls});
  const h=t.c.ilClaimCard();
  assert.match(h,/IDP 연결 확인 3/);
  assert.match(h,/→ <b>#4 강하늘<\/b> · CB · A팀/);
  assert.match(h,/data-il-yes="uA" data-pid="p1"/);
  assert.match(h,/명단에 내 이름이 없다고 했어요[\s\S]*data-il-pick="uB"/);
  assert.match(h,/#11 정우진은 이미[\s\S]*data-il-pick="uD">다른 선수 고르기/);
  assert.doesNotMatch(h,/data-il-yes="uD"/,'이미 연결된 선수로는 바로 연결하지 않는다');
  const n=scoutCtx({data:team(),ls:claimLS(),can:false});
  assert.equal(n.c.ilClaimCard(),'');
});
test('명단 IDP 칩: 임원은 칩에서 바로 계정 시트, 선수가 고른 선수는 칩이 알린다',()=>{
  assert.match(scout,/if\(ilCan\(\)\)\{ilPickAccount\(P\);return;\}/);
  assert.match(scout,/idpB\.classList\.add\("claimed"\)/);
  assert.match(scout,/h=ilClaimCard\(\)\+h;/,'«오늘» 맨 위');
  assert.doesNotMatch(scout,/선수 행의 IDP 배지로 계정을 연결하세요/,'막다른 안내는 걷었다');
});

function idpCtx(o){
  const ls=fakeLS(o.ls),saved=[],toasts=[];
  const doc=o.doc||{v:1};
  const c=vm.createContext({JSON,Object,String,Array,parseInt,isNaN,Date,localStorage:ls,doc,
    ro:()=>false,personalOnly:false,squadView:false,
    sess:()=>({uid:'me'}),teamWsObj:()=>({id:'w1',kind:'team',role:o.wsRole||'member'}),myTeamRole:()=>o.role||'player',
    esc:s=>String(s==null?'':s),save:()=>saved.push(JSON.stringify(doc)),gToast:m=>toasts.push(m),render(){},
    setTimeout:f=>f(),document:{addEventListener(){}}});
  const a=idp.indexOf('var ilcSel=');const b=idp.lastIndexOf('document.addEventListener',idp.indexOf("'[data-ilc-pick],[data-ilc-go]"));
  assert.ok(a>0&&b>a);
  vm.runInContext(idp.slice(a,b),c);
  return {c,doc,saved,toasts};
}
const rosterLS=perms=>({cs_perms_v1:JSON.stringify(perms),cs_team_attrs_v1:JSON.stringify({attrs:[],roster:[
  {id:'p2',num:'11',name:'정우진',pos:'FW',grp:'A팀'},{id:'p1',num:'4',name:'강하늘',pos:'CB',grp:'A팀'},{id:'p3',num:'15',name:'정민재',pos:'RB',grp:'B팀'}]})});

test('선수 IDP: 연결 안 된 선수에게 명단 고르기 — 이미 연결된 선수는 ✓ 이미 연결됨(고를 수 없음), 번호 순',()=>{
  const t=idpCtx({ls:rosterLS({members:{other:{playerId:'p3'}}})});
  const h=t.c.rIdpClaim();
  assert.match(h,/명단에서 나를 골라 주세요/);
  assert.ok(h.indexOf('data-ilc-pick="p1"')<h.indexOf('data-ilc-pick="p2"'),'#4 가 #11 앞');
  assert.doesNotMatch(h,/data-ilc-pick="p3"/);assert.match(h,/#15 정민재[\s\S]*이미 연결됨/);
  assert.match(h,/data-ilc-go disabled/,'고르기 전엔 보내기 버튼이 잠긴다');
  assert.match(h,/코치에게 알리고 건너뛰기/);
});
test('선수 IDP: 골라 둔 뒤엔 기다림 한 줄 · 코치·소유자·명단 없음엔 안 그린다',()=>{
  const w=idpCtx({ls:rosterLS({members:{}}),doc:{v:1,claim:{pid:'p2',num:'11',name:'정우진',at:1}}});
  assert.match(w.c.rIdpClaim(),/#11 정우진으로 골랐어요[\s\S]*다시 고르기/);
  assert.equal(idpCtx({ls:rosterLS({members:{}}),role:'staff'}).c.rIdpClaim(),'');
  assert.equal(idpCtx({ls:rosterLS({members:{}}),wsRole:'owner'}).c.rIdpClaim(),'');
  assert.equal(idpCtx({ls:{cs_perms_v1:'{}',cs_team_attrs_v1:JSON.stringify({attrs:[]})}}).c.rIdpClaim(),'','미러에 명단이 아직 없으면 조용히');
});
test('선수 IDP: 코치가 연결하면 claim 을 지우고 결과만 말한다(다른 선수로 연결돼도 거절했다고 하지 않는다)',()=>{
  const same=idpCtx({ls:rosterLS({members:{me:{playerId:'p2'}}}),doc:{v:1,claim:{pid:'p2',at:1}}});
  assert.equal(same.c.rIdpClaim(),'');assert.equal(same.doc.claim,undefined);assert.equal(same.saved.length,1);
  assert.match(same.toasts[0],/코치가 확인했어요/);
  const other=idpCtx({ls:rosterLS({members:{me:{playerId:'p1'}}}),doc:{v:1,claim:{pid:'p2',at:1}}});
  assert.equal(other.c.rIdpClaim(),'');assert.equal(other.doc.claim,undefined);
  assert.equal(other.toasts[0],'코치가 #4 강하늘로 연결했어요');
  assert.match(idp,/h\+=rIdpClaim\(\)/,'일지 오늘 맨 위');
});

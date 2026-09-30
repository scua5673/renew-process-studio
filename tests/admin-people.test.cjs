'use strict';
// 2.919 — 관리자 «사람 알아보기»: ps_admin_people 응답 → 이름표·팀 줄·검색.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../admin.html'),'utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a,start);return html.slice(a,b);}
const people=section('/* ===== 2.919 사람 알아보기 =====','function errUserName(uid){');
const errUser=section('function errUserName(uid){','function errUserCell(');
const users=section('function userLabel(u){','/* ===== IDP 열람');
const A='aaaaaaaa-1111-4000-8000-000000000001',K='bbbbbbbb-2222-4000-8000-000000000002',B='cccccccc-3333-4000-8000-000000000003';
const rows=[
  {user_id:K,email:null,provider:'kakao',account_name:'카카오닉',member_name:null,made_count:0,created_at:'2026-09-01',
   teams:[{workspace_id:'w1',name:'프로세스FC',kind:'team',owner:false,role:'player',member_role:'member',player:{name:'이선수',num:'7',pos:'CB'}},
          {workspace_id:'w9',name:'내 워크스페이스',kind:'personal',owner:true,role:null,member_role:'owner',player:null}]},
  {user_id:A,email:'coach@example.invalid',provider:'google',account_name:'Google Name',member_name:'김코치',made_count:2,
   teams:[{workspace_id:'w1',name:'프로세스FC',kind:'team',owner:true,role:null,member_role:'owner',player:null},
          {workspace_id:'w2',name:'둘째팀',kind:'team',owner:false,role:'executive',member_role:'member',player:null}]},
  {user_id:B,email:null,provider:'kakao',account_name:null,member_name:null,made_count:0,
   teams:[{workspace_id:'w1',name:'프로세스FC',kind:'team',owner:false,role:'player',member_role:'member',player:{name:'박선수',num:null,pos:null}}]},
];
function harness(){
  const nodes={uSearch:{value:''},usersTable:{innerHTML:'',querySelector(){return {set innerHTML(v){}};}}};
  const c=vm.createContext({USERS:[],esc:s=>String(s==null?'':s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])),
    $:id=>nodes[id],fmtDate:v=>v?String(v).slice(0,10):'—',fmtDateT:v=>v?String(v):'—'});
  vm.runInContext(people+errUser+users,c);
  c.USERS=c.peopleToUsers(rows);
  return {c,nodes};
}
test('people rows become user rows with team roles and linked players; personal spaces are not teams',()=>{
  const {c}=harness(),by=Object.fromEntries(c.USERS.map(u=>[u.user_id,u]));
  assert.equal(by[K].name,'카카오닉');
  assert.equal(by[K].teams.length,1);
  assert.deepEqual(JSON.parse(JSON.stringify(by[K].teams[0])),{wid:'w1',name:'프로세스FC',role:'선수',player:'이선수 #7 CB'});
  assert.equal(by[K].ws_count,2);
  assert.equal(by[A].name,'김코치','name written in the team wins over the login account name');
  assert.equal(by[A].teams.map(t=>t.role).join(','),'소유자,임원');
  assert.equal(by[A].team_names,'프로세스FC (소유자), 둘째팀 (임원)');
});
test('a Kakao account without name or email is recognised by its linked player',()=>{
  const {c}=harness();
  assert.equal(c.adminPersonName(B),'선수 박선수');
  assert.equal(c.userLabel(c.adminUserRow(B)),'선수 박선수');
  assert.equal(c.errUserName(B),'선수 박선수');
  assert.equal(c.adminPersonName('dddddddd-0000'),'(이름 없음 · dddddddd)','unknown accounts still show a short id');
  assert.equal(c.adminPersonName(null),'—');
});
test('the recognition line names team, role, player, login method and short UID',()=>{
  const {c}=harness();
  assert.equal(c.adminPersonSub(K,'카카오닉'),'프로세스FC 선수 · 이선수 #7 CB · 카카오 로그인 · UID bbbbbbbb');
  assert.equal(c.adminPersonSub(A,'김코치'),'프로세스FC 소유자 외 1팀 · coach@example.invalid · 구글 로그인 · UID aaaaaaaa');
  assert.equal(c.userSubLine(c.adminUserRow(K)),'이메일 없음 · 카카오 로그인 · UID bbbbbbbb');
  assert.equal(c.userSubLine(c.adminUserRow(A)),'coach@example.invalid · 구글 로그인 · 계정 이름 Google Name · UID aaaaaaaa');
});
test('team cell lists each team with role and player, and escapes names',()=>{
  const {c}=harness();
  const k=c.userTeamsCell(c.adminUserRow(K));
  assert.match(k,/<b>프로세스FC<\/b> <span class="ut-role">선수<\/span> <span class="muted">· 이선수 #7 CB<\/span>/);
  assert.equal(c.userTeamsCell({teams:[]}),'<span class="muted">팀 없음 · 개인 공간만</span>');
  assert.equal(c.userTeamsCell({team_names:'옛<팀>'}),'<span class="muted">옛&lt;팀&gt;</span>','v1 rows keep the old text');
  assert.ok(!c.userTeamsCell({teams:[{name:'<img>',role:'',player:''}]}).includes('<img>'));
});
test('search finds people by player name, login method, account name and team',()=>{
  const {c,nodes}=harness();
  let out='';nodes.usersTable={querySelector(){return {set innerHTML(v){}};},set innerHTML(v){out=v;},get innerHTML(){return out;}};
  const count=q=>{nodes.uSearch.value=q;c.renderUsers();return (out.match(/data-admin-user=/g)||[]).length;};
  assert.equal(count('박선수'),1);
  assert.equal(count('카카오'),2);
  assert.equal(count('google name'),1);
  assert.equal(count('둘째팀'),1);
  assert.equal(count(''),3);
  nodes.uSearch.value='';c.renderUsers();
  assert.match(out,/<th>만든 수<\/th>/);
  assert.match(out,/선수 박선수/);
});
test('the loader prefers ps_admin_people and falls back to the v1 list',()=>{
  const load=section('function reloadAll(){','function renderStats(){');
  assert.match(load,/safe\(rpc\('ps_admin_people'\)\)/);
  assert.match(load,/if\(res\[4\]\.ok&&Array\.isArray\(res\[4\]\.v\)&&res\[4\]\.v\.length\)\{ try\{ USERS=peopleToUsers\(res\[4\]\.v\); \}catch\(_\)\{\} \}/);
});

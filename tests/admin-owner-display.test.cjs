'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../admin.html'),'utf8');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',W='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,'source section '+start);return html.slice(a,b);}
function harness({users=[],workspaces=[],library=[]}={}){
  function node(){let markup='';return{value:'',checked:false,textContent:'',children:[],get innerHTML(){return markup;},set innerHTML(v){markup=String(v);this.children=[];},appendChild(n){this.children.push(n);}};}
  const nodes={};for(const id of ['alSearch','alType','alSort','alShowDel','alCount','alBody','wsSearch','wsSort','wsKind','wsList','wsDetail'])nodes[id]=node();
  nodes.wsKind.value='all';
  const c=vm.createContext({USERS:users,WS:workspaces,ALL_LIB:library,curWid:null,_showDeleted:false,_wsDetailTab:'members',
    $:id=>nodes[id],document:{createElement:node},typeName:v=>v||'train',fmtDate:()=>'',fmtDateT:()=>'',
    selectWs(){},membersTable:()=>'',wsActivityPane:()=>'',wsIdpPane:()=>'',libTable:()=>'',bindWsDetailTabs(){}});
  vm.runInContext(section('function esc(s){','function $(id){'),c);
  vm.runInContext(section('function adminOwnerInfo(','function wsInfo('),c);
  vm.runInContext(section('function wsInfo(','/* ===== 워크스페이스 리스트 ===== */'),c);
  vm.runInContext(section('function renderWsList(){','/* ===== 워크스페이스 상세 ===== */'),c);
  vm.runInContext(section('function renderWsDetail(','function bindWsDetailTabs('),c);
  vm.runInContext(section('function wsSettingsPane(','function membersTable('),c);
  return{c,nodes,info:(record,fallback)=>JSON.parse(JSON.stringify(c.adminOwnerInfo(record,fallback)))};
}
function workspace(patch={}){return{id:W,name:'가상 팀',kind:'team',owner_id:A,owner_email:null,...patch};}
function content(patch={}){return{workspace_id:W,lib_id:'synthetic-content',name:'가상 훈련',owner_id:A,made_at:'2026-09-17T01:00:00Z',...patch};}

test('email-less owner resolves by exact user ID to the existing account name',()=>{
  const h=harness({users:[{user_id:A,name:'가상 코치',email:null}]});const o=h.info(workspace());
  assert.equal(o.uid,A);assert.equal(o.email,'');assert.equal(o.name,'가상 코치');assert.equal(o.label,'가상 코치');
});
test('email remains the owner label and name and full ID remain searchable',()=>{
  const h=harness({users:[{user_id:A,name:'가상 코치',email:'Coach@Example.TEST'}]});const o=h.info(workspace());
  assert.equal(o.label,'Coach@Example.TEST');assert.ok(o.search.includes('coach@example.test'));assert.ok(o.search.includes('가상 코치'));assert.ok(o.search.includes(A));
});
test('direct owner fields take precedence over cached account fields',()=>{
  const h=harness({users:[{user_id:A,name:'옛 이름',email:'old@example.test'}]});const o=h.info(workspace({owner_name:'최신 이름',owner_email:'new@example.test'}));
  assert.equal(o.email,'new@example.test');assert.equal(o.name,'최신 이름');assert.equal(o.label,'new@example.test');
});
test('content with a distinct owner cannot borrow workspace owner email or name',()=>{
  const h=harness({users:[{user_id:A,name:'팀 소유자',email:'workspace@example.test'},{user_id:B,name:'자료 소유자',email:null}]});
  const o=h.info({owner_id:B},workspace({owner_email:'workspace@example.test',owner_name:'팀 소유자'}));
  assert.equal(o.uid,B);assert.equal(o.email,'');assert.equal(o.name,'자료 소유자');assert.equal(o.label,'자료 소유자');assert.doesNotMatch(o.search,/workspace@example|팀 소유자/);
});
test('unknown distinct content owner gets its own ID instead of a workspace identity',()=>{
  const h=harness({users:[{user_id:A,name:'팀 소유자',email:'workspace@example.test'}]});
  const o=h.info({owner_id:B},workspace({owner_email:'workspace@example.test',owner_name:'팀 소유자'}));
  assert.equal(o.label,'사용자 '+B.slice(0,8));assert.equal(o.email,'');assert.equal(o.name,'');assert.equal(o.uid,B);
});
test('matching explicit owner IDs allow a workspace identity fallback',()=>{
  const o=harness().info({owner_id:A},workspace({owner_email:'owner@example.test',owner_name:'가상 이름'}));
  assert.equal(o.uid,A);assert.equal(o.email,'owner@example.test');assert.equal(o.name,'가상 이름');
});
test('legacy content without an owner ID never invents its author from workspace ownership',()=>{
  const h=harness({users:[{user_id:A,name:'가상 소유자',email:null}]});const o=h.info({},workspace());
  assert.equal(o.uid,'');assert.equal(o.label,'소유자 확인 필요');
});
test('whitespace-only identity fields are missing rather than blank visible labels',()=>{
  const h=harness({users:[{user_id:A,name:'  가상 소유자  ',email:'  '}]});const o=h.info({owner_id:'  ',owner_email:' \n ',owner_name:'  '},workspace());
  assert.equal(o.uid,'');assert.equal(o.label,'소유자 확인 필요');assert.equal(o.email,'');
});
test('missing identity is explicit and never inferred from matching team names or memberships',()=>{
  const h=harness({users:[{user_id:A,name:'다른 사용자',email:'other@example.test',team_names:'가상 팀',workspace_ids:[W]}]});
  const o=h.info({name:'가상 팀',id:W});assert.equal(o.label,'소유자 확인 필요');assert.equal(o.uid,'');assert.equal(o.email,'');assert.equal(o.name,'');
});
test('partial IDs do not match a different account',()=>{
  const short=A.slice(0,8),h=harness({users:[{user_id:A,name:'다른 사용자',email:'other@example.test'}]});const o=h.info({owner_id:short});
  assert.equal(o.label,'사용자 '+short);assert.equal(o.email,'');assert.equal(o.name,'');
});
test('content renderer escapes a name fallback and keeps owner name and UID search working',()=>{
  const name='<img src=x onerror=alert(1)> 가상 코치',h=harness({users:[{user_id:A,name,email:null}],workspaces:[workspace()],library:[content()]});
  h.c.renderAllLib();assert.match(h.nodes.alBody.innerHTML,/&lt;img src=x onerror=alert\(1\)&gt; 가상 코치/);assert.doesNotMatch(h.nodes.alBody.innerHTML,/<img\b/);
  for(const q of ['가상 코치',A,'AAAA']){h.nodes.alSearch.value=q;h.c.renderAllLib();assert.match(h.nodes.alBody.innerHTML,/가상 훈련/);}
  h.nodes.alSearch.value='존재하지 않는 소유자';h.c.renderAllLib();assert.match(h.nodes.alBody.innerHTML,/항목이 없습니다/);
});
test('content search does not match the workspace owner when the content explicitly has another owner',()=>{
  const h=harness({users:[{user_id:A,name:'팀주인',email:'team@example.test'},{user_id:B,name:'자료주인',email:null}],workspaces:[workspace({owner_email:'team@example.test'})],library:[content({owner_id:B})]});
  h.nodes.alSearch.value='팀주인';h.c.renderAllLib();assert.match(h.nodes.alBody.innerHTML,/항목이 없습니다/);
  h.nodes.alSearch.value='자료주인';h.c.renderAllLib();assert.match(h.nodes.alBody.innerHTML,/가상 훈련/);assert.doesNotMatch(h.nodes.alBody.innerHTML,/team@example.test/);
});
test('workspace list renders and searches the same escaped owner identity',()=>{
  const h=harness({users:[{user_id:A,name:'<b>가상 코치</b>',email:null}],workspaces:[workspace()]});
  for(const q of ['', '가상 코치',A]){h.nodes.wsSearch.value=q;h.c.renderWsList();assert.equal(h.nodes.wsList.children.length,1);assert.match(h.nodes.wsList.children[0].innerHTML,/&lt;b&gt;가상 코치&lt;\/b&gt;/);assert.doesNotMatch(h.nodes.wsList.children[0].innerHTML,/<b>가상 코치/);}
  h.nodes.wsSearch.value='일치하지 않음';h.c.renderWsList();assert.equal(h.nodes.wsList.children.length,0);assert.match(h.nodes.wsList.innerHTML,/워크스페이스가 없습니다/);
});
test('workspace header and settings show the same escaped owner name fallback',()=>{
  const h=harness({users:[{user_id:A,name:'<svg onload=alert(1)>',email:null}]});const w=workspace();
  h.c.renderWsDetail(w,[],[],[]);assert.match(h.nodes.wsDetail.innerHTML,/소유자 &lt;svg onload=alert\(1\)&gt;/);assert.doesNotMatch(h.nodes.wsDetail.innerHTML,/<svg\b/);
  const settings=h.c.wsSettingsPane(w);assert.match(settings,/&lt;svg onload=alert\(1\)&gt;/);assert.doesNotMatch(settings,/<svg\b/);
});

test('legacy content author email cannot acquire a workspace owner name or UID',()=>{
  const h=harness({users:[{user_id:A,name:'팀 소유자',email:'team@example.test'}]});
  const o=h.info({owner_email:'author@example.test'},workspace({owner_name:'팀 소유자',owner_email:'team@example.test'}));
  assert.equal(o.label,'author@example.test');assert.equal(o.uid,'');assert.equal(o.name,'');assert.doesNotMatch(o.search,/팀 소유자|team@example/);
});

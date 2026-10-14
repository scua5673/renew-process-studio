'use strict';
/* 관리자 화면 보안 — 사용자가 정하거나 앱이 직접 올리는 값(팀 이름·사람 이름·오류 코드·앱 버전·IDP 문서·자료 ID)이
   관리자 브라우저에서 HTML·JS 로 실행되지 않아야 한다. 관리자 토큰은 앱과 같은 localStorage 에 있다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../admin.html'),'utf8');
function section(a,b){const i=html.indexOf(a);assert.ok(i>=0,'missing '+a);const j=html.indexOf(b,i+a.length);assert.ok(j>i,'missing '+b);return html.slice(i,j);}
const ESC=section('function esc(s){','function $(id){');
const XSS='<img src=x onerror="window.pwned=1">';
const QUOTE="x');window.pwned=1;('";
const tick=()=>new Promise(r=>setImmediate(r));
function node(){return {innerHTML:'',textContent:'',value:'',checked:false};}
function noMarkup(out,label){
  assert.doesNotMatch(out,/<img|<script|onerror="/i,label+' renders user values as text');
  assert.match(out,/&lt;img src=x onerror=&quot;window\.pwned=1&quot;&gt;/,label+' keeps the value visible, escaped');
}

test('backend health escapes team names, people, error codes, versions and keys',async()=>{
  const nodes={backBody:node()};
  const c=vm.createContext({String,Math,Number,Date,JSON,Object,Array,Promise,$:id=>nodes[id],loadIncidents(){},loadAdminActions(){},adminPersonName:()=>XSS,
    rpc:()=>Promise.resolve({db_bytes:1,tables:{},blob:{},policy:{min_build:XSS,block_unversioned:true},at:'2026-10-14T00:00:00Z',
      fails24:[{code:XSS,n:1,users:1}],stuck:[{name:XSS,fails:3,last_code:XSS,app_version:XSS,last_fail:'2026-10-14T00:00:00Z'},{user_id:'u1',fails:1}],
      versions:[{ver:XSS,users:1,events:1}],bigdocs:[{ws:XSS,k:XSS,len:10}],denied7:[{reason:XSS,k:XSS,n:1}],cron:[{job:XSS,schedule:XSS,active:true}]})});
  vm.runInContext(ESC,c);
  vm.runInContext(section('function loadBack(){','/* ===== 오류 분석 ===== */'),c);
  c.loadBack();await tick();await tick();
  const out=nodes.backBody.innerHTML;
  noMarkup(out,'backend health');
  assert.equal((out.match(/&lt;img/g)||[]).length,13,'every user value in the tables and policy line is escaped');
  assert.match(out,/<td>&lt;img/,'the stuck-device fallback name goes through the same escaping');
});

test('backend health failure message is escaped too',async()=>{
  const nodes={backBody:node()};
  const c=vm.createContext({String,$:id=>nodes[id],loadIncidents(){},loadAdminActions(){},rpc:()=>Promise.reject(new Error(XSS))});
  vm.runInContext(ESC,c);
  vm.runInContext(section('function loadBack(){','/* ===== 오류 분석 ===== */'),c);
  c.loadBack();await tick();await tick();
  noMarkup(nodes.backBody.innerHTML,'backend error');
});

test('IDP summary escapes every value a player writes, and tolerates odd shapes',()=>{
  const nodes={idpBody:node(),idpList:node(),idpOverview:node(),idpWho:node()};
  const c=vm.createContext({String,Math,Number,Date,JSON,Object,Array,$:id=>nodes[id],fmtAgo:()=>'방금',isFresh:()=>false,rpc(){}});
  vm.runInContext(ESC,c);
  vm.runInContext(section('var IDP_USERS=null','/* ===== 액션 ===== */'),c);
  const doc={profile:{name:XSS,pos:XSS,subs:XSS,club:XSS},
    selfEval:{levels:{d_pos:XSS,d_scan:4,d_dec:3,d_run:2},strengths:XSS},
    goal:{cur:{start:XSS,weeks:XSS,per:XSS,focus:XSS,note:XSS}},
    trainings:[{name:XSS,days:[XSS]},{name:'b',days:XSS},null],
    log:{[XSS]:{t:XSS,rpe:XSS,wt:XSS,memo:XSS},'2026-10-13':{t:'constructor'}},
    imgNotes:[{date:XSS,opp:XSS}]};
  c.renderIdpDoc({v:JSON.stringify(doc),updated_at:'2026-10-14T00:00:00Z'});
  const out=nodes.idpBody.innerHTML;
  noMarkup(out,'IDP summary');
  assert.doesNotMatch(out,/&amp;lt;/,'labels are escaped once, not twice');
  assert.doesNotMatch(out,/function|native code/,'an unknown log type is shown as written, not as an object property');
});

test('IDP list rows carry the person in data attributes, not in an inline script',()=>{
  const nodes={idpBody:node(),idpList:node(),idpOverview:node(),idpWho:node()};
  const c=vm.createContext({String,Math,Number,Date,JSON,Object,Array,$:id=>nodes[id],fmtAgo:()=>'',isFresh:()=>false,rpc(){}});
  vm.runInContext(ESC,c);
  vm.runInContext(section('var IDP_USERS=null','/* ===== 액션 ===== */'),c);
  const row=c._idpRowHtml({user_id:'u-1',email:QUOTE});
  assert.doesNotMatch(row,/onclick/);
  assert.match(row,/data-admin-act="idp" data-uid="u-1" data-email="x&#39;\);window\.pwned=1;\(&#39;"/);
});

test('content row buttons pass IDs as data, and the one click handler hands them back unchanged',()=>{
  const calls=[];
  const c=vm.createContext({String,encodeURIComponent,decodeURIComponent,WS:[],
    setTab:t=>calls.push(['tab',t]),selectWs:w=>calls.push(['ws',w]),
    preview:(w,l)=>calls.push(['preview',w,decodeURIComponent(l)]),restoreLib:(w,l)=>calls.push(['restore',w,decodeURIComponent(l)]),
    softDelLib:(w,l)=>calls.push(['del',w,decodeURIComponent(l)]),delWorkspace:w=>calls.push(['delws',w]),
    removeMember:(w,u)=>calls.push(['remove',w,u]),openIdp:(u,e)=>calls.push(['idp',u,e])});
  vm.runInContext(ESC,c);
  vm.runInContext(section('function wsInfo(','function resetContentFilters('),c);
  vm.runInContext(section('function adminAction(el){',"document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-admin-act]')"),c);
  const live=c.libActions({workspace_id:'w-1',lib_id:QUOTE}),gone=c.libActions({workspace_id:'w-1',lib_id:QUOTE,deleted_at:'2026-10-01'});
  for(const markup of [live,gone]){
    assert.doesNotMatch(markup,/onclick/);
    assert.match(markup,/data-lid="x&#39;\);window\.pwned=1;\(&#39;"/);
  }
  assert.match(live,/data-admin-act="soft-del"/);assert.doesNotMatch(live,/data-admin-act="restore"/);
  assert.match(gone,/data-admin-act="restore"/);assert.doesNotMatch(gone,/data-admin-act="soft-del"/);
  /* 브라우저는 data-* 엔티티를 풀어 dataset 에 원래 값을 준다 */
  const el=dataset=>({dataset});
  c.adminAction(el({adminAct:'preview',wid:'w-1',lid:QUOTE}));
  c.adminAction(el({adminAct:'restore',wid:'w-1',lid:QUOTE}));
  c.adminAction(el({adminAct:'soft-del',wid:'w-1',lid:QUOTE}));
  c.adminAction(el({adminAct:'team',wid:'w-2'}));
  c.adminAction(el({adminAct:'del-ws',wid:'w-3'}));
  c.adminAction(el({adminAct:'remove-member',wid:'w-4',uid:'u-4'}));
  c.adminAction(el({adminAct:'idp',uid:'u-5',email:QUOTE}));
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['preview','w-1',QUOTE],['restore','w-1',QUOTE],['del','w-1',QUOTE],['tab','ws'],['ws','w-2'],
    ['delws','w-3'],['remove','w-4','u-4'],['idp','u-5',QUOTE]]);
});

test('no inline handler in admin.html builds JavaScript from a runtime value',()=>{
  /* 남는 인라인 onclick 은 고정 문자열뿐이다(홈 KPI 의 setTab('users') 같은 것) */
  const dynamic=html.split('\n').filter(l=>/onclick="[^"]*\\'\s*\+/.test(l));
  assert.deepEqual(dynamic,[]);
  /* 예전 모양: onclick="preview(\''+id+'\')" — 함수에 따옴표 문자열 인자를 이어 붙이던 것 */
  for(const fn of ['preview','restoreLib','softDelLib','delWorkspace','removeMember','openIdp','selectWs'])
    assert.doesNotMatch(html,new RegExp(String.raw`onclick="[^"\n]*`+fn+String.raw`\(\\'`),fn+' takes IDs through data-admin-act');
});

test('workspace delete asks on separate lines, and a team without a name needs its ID',()=>{
  const calls=[];let asked='',answer='';
  const c=vm.createContext({String,toast:m=>calls.push(['toast',m]),prompt:m=>{asked=m;return answer;},
    rpc:(n,b)=>{calls.push([n,b.p_wid]);return {then(){return {catch(){}};}};},
    WS:[{id:'w-blank',name:'  ',member_count:2,lib_count:3},{id:'w-named',name:'수원 FC',member_count:1,lib_count:0}]});
  vm.runInContext(section('function delWorkspace(','function reloadCounts('),c);
  answer='';c.delWorkspace('w-blank');
  assert.match(asked,/줍니다\.\n계속하려면 워크스페이스 ID/);assert.doesNotMatch(asked,/\\n/);
  assert.match(asked,/\n\nw-blank$/);
  answer='  ';c.delWorkspace('w-blank');
  answer='수원';c.delWorkspace('w-named');
  assert.deepEqual(calls.map(x=>x[0]),['toast','toast','toast'],'an empty or wrong answer deletes nothing');
  answer='w-blank';c.delWorkspace('w-blank');
  answer=' 수원 FC ';c.delWorkspace('w-named');
  assert.deepEqual(calls.filter(x=>x[0]==='ps_admin_delete_workspace').map(x=>x[1]),['w-blank','w-named']);
  answer=null;c.delWorkspace('w-named');
  assert.equal(calls.length,5,'cancel does nothing');
});

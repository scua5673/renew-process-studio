'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const content=require('../studio/admin-content.js');
const html=fs.readFileSync(path.join(__dirname,'../admin.html'),'utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a);return html.slice(a,b);}
const normalize=section('function normalizeLibRows(rows){','/* ===== 부팅 ===== */');
const refresh=section('function reloadAll(){','function renderStats(){');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const plain=value=>JSON.parse(JSON.stringify(value));
const W='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function harness(){
  const requests=[],rendered=[],notices=[],nodes={wsList:{innerHTML:''},alBody:{innerHTML:''},usersTable:{innerHTML:''}};
  const c=vm.createContext({
    window:{PSAdminContent:content},PSAdminContent:content,
    WS:[{id:'initial-space'}],USERS:[{user_id:'initial-user'}],ALL_LIB:[{lib_id:'initial-content'}],
    ADMIN_CONTENT_OWNERS:[],adminOwnersReady:false,adminLibraryTicket:0,adminReloadTicket:0,
    adminAuthEpoch:1,adminSessionLocked:false,curTab:'all',curWid:null,HOME:{initial:true},
    adminContent:{deactivate(){}},$(id){assert.ok(nodes[id],'Unknown DOM target '+id);return nodes[id];},
    rpc(name,args){const q=deferred();requests.push({name,args,...q});return q.promise;},
    renderStats(){rendered.push({kind:'stats',ws:plain(c.WS),users:plain(c.USERS)});},
    renderWsList(){rendered.push({kind:'workspaces',data:plain(c.WS)});nodes.wsList.innerHTML='workspaces rendered';},
    renderUsers(){rendered.push({kind:'users',data:plain(c.USERS)});nodes.usersTable.innerHTML='users rendered';},
    renderAllLib(){rendered.push({kind:'content',data:plain(c.ALL_LIB),owners:plain(c.ADMIN_CONTENT_OWNERS)});nodes.alBody.innerHTML='content rendered';},
    loadAdminOps(){rendered.push({kind:'operations',users:plain(c.USERS)});},
    loadActivity(){},loadWhoLog(){},loadAdminSupport(){},selectWs(){},setTab(tab){c.curTab=tab;},toast(s){notices.push(s);}
  });
  vm.runInContext(normalize+refresh,c);
  function full(){const at=requests.length;c.reloadAll();return requests.slice(at);}
  function library(){const at=requests.length,promise=c.reloadAllLib();return {requests:requests.slice(at),promise};}
  function answer(group,tag,{ownersFail=false,libraryFail=false}={}){
    group.forEach(q=>{
      if(q.name==='ps_admin_workspaces')q.resolve([{id:tag+'-space'}]);
      else if(q.name==='ps_admin_users_v2'||q.name==='ps_admin_users')q.resolve([{user_id:tag+'-user'}]);
      else if(q.name==='ps_admin_library'){
        if(libraryFail)q.reject(new Error('library failed'));
        else q.resolve([{workspace_id:W,lib_id:tag+'-content',name:tag,saved_at:1,owner_email:'wrong-workspace@example.invalid'}]);
      }else if(q.name==='ps_admin_content_owners'){
        if(ownersFail)q.reject(new Error('owners failed'));
        else q.resolve([{workspace_id:W,lib_id:tag+'-content',owner_id:OWNER,owner_name:tag+' author',owner_email:null}]);
      }else throw Error('Unexpected RPC '+q.name);
    });
  }
  return {c,requests,rendered,notices,nodes,full,library,answer};
}

test('later content-only refresh preserves independently refreshed workspace and user results',async()=>{
  const h=harness(),full=h.full(),library=h.library();
  h.answer(library.requests,'content-new');await library.promise;
  h.answer(full,'global-refresh');await tick();
  assert.equal(h.c.WS[0].id,'global-refresh-space');
  assert.equal(h.c.USERS[0].user_id,'global-refresh-user');
  assert.equal(h.c.ALL_LIB[0].lib_id,'content-new-content');
  assert.equal(h.c.ALL_LIB[0].owner_name,'content-new author');
  assert.equal(h.c.ADMIN_CONTENT_OWNERS[0].lib_id,'content-new-content');
  assert.ok(h.rendered.some(r=>r.kind==='users'&&r.data[0].user_id==='global-refresh-user'));
  assert.ok(h.rendered.some(r=>r.kind==='operations'&&r.users[0].user_id==='global-refresh-user'));
  assert.equal(h.nodes.wsList.innerHTML,'workspaces rendered');
});

test('a full refresh can finish while the later content-only request is still pending',async()=>{
  const h=harness(),full=h.full(),library=h.library();
  h.answer(full,'global');await tick();
  assert.equal(h.c.WS[0].id,'global-space');assert.equal(h.c.USERS[0].user_id,'global-user');
  assert.equal(h.c.ALL_LIB[0].lib_id,'initial-content','Obsolete full-refresh library response must not win while the new content read is pending');
  h.answer(library.requests,'latest-content');await library.promise;
  assert.equal(h.c.ALL_LIB[0].lib_id,'latest-content-content');
});

test('an older full refresh cannot replace a newer full refresh in any section',async()=>{
  const h=harness(),older=h.full(),newer=h.full();
  h.answer(newer,'newer');await tick();const rendered=h.rendered.length;
  h.answer(older,'older');await tick();
  assert.equal(h.c.WS[0].id,'newer-space');assert.equal(h.c.USERS[0].user_id,'newer-user');
  assert.equal(h.c.ALL_LIB[0].lib_id,'newer-content');assert.equal(h.c.ADMIN_CONTENT_OWNERS[0].lib_id,'newer-content');
  assert.equal(h.rendered.length,rendered,'Ignored stale refresh cannot repaint any section');
});

test('an older content-only refresh cannot overwrite the later full refresh author pairing',async()=>{
  const h=harness(),older=h.library(),newer=h.full();
  h.answer(newer,'newer');await tick();
  h.answer(older.requests,'older');await older.promise;
  assert.equal(h.c.ALL_LIB[0].lib_id,'newer-content');assert.equal(h.c.ALL_LIB[0].owner_name,'newer author');
  assert.equal(h.c.ADMIN_CONTENT_OWNERS[0].lib_id,'newer-content');
});

for(const kind of ['full','content'])for(const boundary of ['epoch','lock'])test(kind+' refresh cannot repopulate metadata across an account '+boundary+' boundary',async()=>{
  const h=harness(),run=kind==='full'?{requests:h.full(),promise:null}:h.library();
  if(boundary==='epoch')h.c.adminAuthEpoch++;else h.c.adminSessionLocked=true;
  h.c.WS=[];h.c.USERS=[];h.c.ALL_LIB=[];h.c.ADMIN_CONTENT_OWNERS=[];
  h.answer(run.requests,'old-account');if(run.promise)await run.promise;await tick();
  for(const field of ['WS','USERS','ALL_LIB','ADMIN_CONTENT_OWNERS'])assert.equal(h.c[field].length,0,field+' remains cleared');
  assert.equal(h.rendered.length,0);
});

test('owner metadata failure keeps the refreshed content without guessing a workspace author',async()=>{
  const h=harness(),run=h.library();h.answer(run.requests,'partial',{ownersFail:true});await run.promise;
  assert.equal(h.c.ALL_LIB[0].lib_id,'partial-content');assert.equal(h.c.adminOwnersReady,false);
  assert.equal(h.c.ALL_LIB[0].owner_id,'');assert.equal(h.c.ALL_LIB[0].owner_name,'');assert.equal(h.c.ALL_LIB[0].owner_email,'');
  assert.equal(h.c.ADMIN_CONTENT_OWNERS.length,0);
});

test('a stale global library failure cannot hide a successful newer content refresh',async()=>{
  const h=harness(),full=h.full(),library=h.library();h.answer(library.requests,'fresh');await library.promise;
  h.answer(full,'global',{libraryFail:true});await tick();
  assert.equal(h.c.ALL_LIB[0].lib_id,'fresh-content');assert.equal(h.c.WS[0].id,'global-space');
  assert.equal(h.nodes.alBody.innerHTML,'content rendered');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const content = require('../studio/admin-content.js');
const model = require('../studio/admin-content-data.js');

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UID = '11111111-1111-4111-8111-111111111111';
const ADMIN = '99999999-9999-4999-8999-999999999999';
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
const tick = () => new Promise(resolve => setImmediate(resolve));
const row = (workspace_id, lib_id, name, extra = {}) => ({workspace_id, lib_id, name, type:'train', ws_name:workspace_id === A ? '가상 청팀' : '가상 홍팀', made_at:'2026-09-17T10:00:00+09:00', owner_id:UID, owner_name:'가상 작성자', ...extra});
const owner = r => ({label:r.owner_name || r.owner_email || '소유자 확인 필요', name:r.owner_name || '', email:r.owner_email || '', search:[r.owner_name,r.owner_email,r.owner_id].filter(Boolean).join(' ').toLowerCase()});
const workspace = id => ({id,name:id === A ? '가상 청팀' : '가상 홍팀',owner_name:'별도 팀소유자'});
const payload = (r, text, extra = {}) => ({workspace_id:r.workspace_id,lib_id:r.lib_id,item:{name:r.name,description:text,thumb:svg,...extra}});

// Only the DOM surface the controller consumes is simulated. All request
// completion, selection and session lifetimes use the real controller.
class Host {
  constructor() { this.innerHTML=''; this.listeners={}; }
  querySelector() { return null; }
  addEventListener(event, fn) { this.listeners[event]=fn; }
  removeEventListener(event, fn) { if(this.listeners[event]===fn)delete this.listeners[event]; }
  contains() { return true; }
  emit(event, target) { this.listeners[event]?.({target}); }
  clickAction(action) {
    const button={dataset:{acAction:action},disabled:false};
    this.emit('click',{closest:selector=>selector==='[data-ac-action]'?button:null});
  }
  clickRow(index) {
    const button={dataset:{acIndex:String(index)}};
    this.emit('click',{closest:selector=>selector==='[data-ac-index]'?button:null});
  }
}
function setup(rows, options = {}) {
  const host=new Host(),calls=[],pending=[],controls={};
  for(const name of ['search','type','sort','workspace','author','folder','from','to','deleted','count','ownerNotice'])controls[name]={value:'',innerHTML:'',textContent:'',checked:false};
  let context={uid:ADMIN,epoch:1,ready:true};
  const controller=content.create({window:{document:{}},host,controls,model,context:()=>context,owner,workspace,typeName:v=>v,date:v=>v,snapPreview:options.snapPreview,
    rpc:(name,args)=>{
      calls.push({name,args});
      if(options.rpc)return options.rpc(name,args);
      return new Promise((resolve,reject)=>pending.push({name,args,resolve,reject}));
    }});
  controller.update(rows,true);
  return {controller,host,calls,pending,controls,setContext:next=>{context=next;}};
}

test('content identity and author attribution include the workspace, never the space owner',()=>{
  const first=row(A,'shared','One',{owner_email:'wrong-space-owner@example.test'}),second=row(B,'shared','Two');
  assert.notEqual(content.key(first),content.key(second));
  const result=content.joinOwners([first,second],[{workspace_id:B,lib_id:'shared',owner_id:UID,owner_name:'Actual Author',owner_email:'actual@example.test'}]);
  assert.equal(result[0].owner_id,'');
  assert.equal(result[0].owner_email,'');
  assert.equal(result[1].owner_name,'Actual Author');
  assert.equal(result[1].owner_email,'actual@example.test');
  assert.equal(first.owner_email,'wrong-space-owner@example.test','Attribution does not mutate the input collection');
});

test('filters combine exact author, team, folder, type and inclusive local calendar dates',()=>{
  const matching=row(A,'yes','분석 훈련',{folder:'공격',made_at:new Date(2026,8,17,23,59,59,999).toISOString()});
  const rows=[matching,row(A,'tomorrow','분석 훈련',{folder:'공격',made_at:new Date(2026,8,18).toISOString()}),row(B,'wrong-team','분석 훈련',{folder:'공격'}),row(A,'wrong-author','분석 훈련',{folder:'공격',owner_id:'another'}),row(A,'wrong-folder','분석 훈련',{folder:'수비'}),row(A,'deleted','분석 훈련',{folder:'공격',deleted_at:'2026-09-17'})];
  const f={search:'작성자',workspace:A,author:'id:'+UID,folder:'공격',type:'train',from:'2026-09-17',to:'2026-09-17'};
  assert.deepEqual(content.filtered(rows,f,owner,workspace).map(r=>r.lib_id),['yes']);
});

test('unknown authors and unfiled content can be selected without using workspace ownership',()=>{
  const unknown=row(A,'unknown','Unknown',{owner_id:'',owner_name:'',folder:''});
  assert.equal(content.authorKey(unknown),'unknown');
  assert.deepEqual(content.filtered([unknown,row(A,'known','Known')],{author:'unknown',folder:'__none__'},owner,workspace),[unknown]);
  assert.deepEqual(content.filtered([unknown],{search:'별도 팀소유자'},owner,workspace),[]);
});

test('recent sorting uses saved time before database update time and is deterministic on ties',()=>{
  const old=row(A,'old','Old',{made_at:'2026-09-01T00:00:00Z',updated_at:'2026-09-18T00:00:00Z'}),a=row(A,'a','A'),b=row(A,'b','B');
  assert.deepEqual(content.filtered([old,b,a],{sort:'upd'},owner,workspace).map(r=>r.lib_id),['a','b','old']);
});

test('images stay embedded and unsupported URLs never become document requests',()=>{
  assert.match(content.imageSource(svg),/^data:image\/svg\+xml;charset=utf-8,/);
  assert.match(decodeURIComponent(content.imageSource('<svg><use xlink:href="#pitch"/></svg>')),/xmlns:xlink=/);
  assert.equal(content.imageSource('data:image/png;base64,YQ=='),'data:image/png;base64,YQ==');
  assert.equal(content.imageSource('data:image/jpg;base64,YQ=='),'data:image/jpg;base64,YQ==');
  const encoded='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg),base64='data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
  assert.equal(content.imageSource(encoded),encoded);assert.equal(content.imageSource(base64),base64);
  assert.equal(content.imageSource('<svg>\ud800</svg>'),'','Malformed UTF-16 in a saved image cannot abort rendering');
  for(const value of ['https://example.test/tracker.svg','javascript:alert(1)','data:text/html;base64,YQ==','data:image/svg+xml;unsupported,YQ==',{},null])assert.equal(content.imageSource(value),'');
});

test('listing, filtering, sorting and expanding the list never fetch document bodies',async()=>{
  const rows=Array.from({length:45},(_,i)=>row(A,'item-'+i,'Record '+i));
  const f=setup(rows);
  f.host.clickAction('more');
  f.controls.search.value='Record';f.controller.update(rows,true);
  f.controls.sort.value='name';f.controller.update(rows,true);
  await tick();assert.deepEqual(f.calls,[]);
  assert.match(f.host.innerHTML,/콘텐츠를 골라/);
  f.controller.destroy();
});

test('only an explicit list selection loads a body with the exact workspace and content ID',async()=>{
  const r=row(A,'chosen','Chosen'),f=setup([r]);
  f.host.clickRow(0);await tick();
  assert.deepEqual(f.calls,[{name:'ps_admin_library_item',args:{p_wid:A,p_lib_id:'chosen'}}]);
  f.pending[0].resolve(payload(r,'SELECTED_BODY'));await tick();
  assert.match(f.host.innerHTML,/SELECTED_BODY/);
  assert.match(f.host.innerHTML,/data:image\/svg\+xml/,'The saved image is shown together with the description');
  f.controller.destroy();
});

test('a late response from the previous selection cannot replace the next content',async()=>{
  const a=row(A,'a','Alpha'),b=row(A,'b','Beta'),f=setup([a,b]);
  const first=f.controller.open(A,'a');await tick();
  const second=f.controller.open(A,'b');await tick();
  f.pending[1].resolve(payload(b,'BETA_BODY'));await second;
  f.pending[0].resolve(payload(a,'STALE_ALPHA_BODY'));await first;
  assert.match(f.host.innerHTML,/BETA_BODY/);
  assert.doesNotMatch(f.host.innerHTML,/STALE_ALPHA_BODY/);
  f.controller.destroy();
});

test('the same content ID in two workspaces fetches and renders separate documents',async()=>{
  const a=row(A,'shared','Team A item'),b=row(B,'shared','Team B item'),f=setup([a,b]);
  const first=f.controller.open(A,'shared');await tick();f.pending[0].resolve(payload(a,'A_BODY'));await first;
  const second=f.controller.open(B,'shared');await tick();f.pending[1].resolve(payload(b,'B_BODY'));await second;
  assert.equal(f.calls[0].args.p_wid,A);assert.equal(f.calls[1].args.p_wid,B);
  assert.match(f.host.innerHTML,/B_BODY/);assert.doesNotMatch(f.host.innerHTML,/A_BODY/);
  f.controller.destroy();
});

test('filtering the selected item out invalidates its pending body response',async()=>{
  const a=row(A,'a','Alpha'),b=row(A,'b','Beta'),rows=[a,b],f=setup(rows);
  const request=f.controller.open(A,'a');await tick();
  f.controls.search.value='Beta';f.controller.update(rows,true);
  f.pending[0].resolve(payload(a,'FILTERED_PRIVATE_BODY'));await request;
  assert.doesNotMatch(f.host.innerHTML,/FILTERED_PRIVATE_BODY|콘텐츠를 불러오는 중/);
  assert.match(f.host.innerHTML,/콘텐츠를 골라/);
  assert.equal(f.calls.length,1);
  f.controller.destroy();
});

test('filter changes before the request microtask do not issue an obsolete body read',async()=>{
  const a=row(A,'a','Alpha'),rows=[a],f=setup(rows);
  const request=f.controller.open(A,'a');f.controls.search.value='no match';f.controller.update(rows,true);await request;
  assert.deepEqual(f.calls,[]);assert.match(f.host.innerHTML,/조건에 맞는 항목이 없습니다/);
  f.controller.destroy();
});

test('leaving the content screen clears detail and ignores all pending responses',async()=>{
  const a=row(A,'a','Alpha'),f=setup([a]),request=f.controller.open(A,'a');await tick();
  f.controller.deactivate();assert.equal(f.host.innerHTML,'');
  f.pending[0].resolve(payload(a,'AFTER_DEACTIVATE'));await request;
  assert.equal(f.host.innerHTML,'');
  await f.controller.open(A,'a');assert.equal(f.calls.length,1,'Inactive view cannot start a new body read');
  f.controller.destroy();
});

test('destroying an account session removes detail, handlers and late responses',async()=>{
  const a=row(A,'a','Alpha'),f=setup([a]),request=f.controller.open(A,'a');await tick();
  f.setContext({uid:UID,epoch:2,ready:true});f.controller.destroy();
  f.pending[0].resolve(payload(a,'OLD_ACCOUNT_BODY'));await request;
  assert.equal(f.host.innerHTML,'');assert.deepEqual(f.host.listeners,{});
  await f.controller.open(A,'a');assert.equal(f.calls.length,1);
});

test('a changed account cannot accept an earlier response after a new metadata update',async()=>{
  const a=row(A,'a','Alpha'),b=row(B,'b','Beta'),f=setup([a]);
  const request=f.controller.open(A,'a');await tick();
  f.setContext({uid:UID,epoch:2,ready:true});f.controller.update([b],true);
  f.pending[0].resolve(payload(a,'OLD_ACCOUNT_BODY'));await request;
  assert.match(f.host.innerHTML,/Beta/);assert.doesNotMatch(f.host.innerHTML,/OLD_ACCOUNT_BODY|Alpha/);
  f.controller.destroy();
});

test('changing the result collection cannot leave a selected item with a blank detail panel',async()=>{
  const a=row(A,'a','Alpha'),f=setup([a]);
  const request=f.controller.open(A,'a');await tick();f.pending[0].resolve(payload(a,'KNOWN_BODY'));await request;
  f.controller.update([{...a,owner_name:'Updated Author'}],true);
  assert.ok(/콘텐츠를 골라|KNOWN_BODY|콘텐츠를 불러오는 중/.test(f.host.innerHTML),'A refresh must clear selection, preserve its body, or visibly load it');
  f.controller.destroy();
});

test('a failed body fetch can be retried without fetching any other content',async()=>{
  const a=row(A,'a','Alpha'),f=setup([a]);
  const request=f.controller.open(A,'a');await tick();f.pending[0].reject(new Error('temporary failure'));await request;
  assert.match(f.host.innerHTML,/다시 불러오기/);
  f.host.clickAction('retry');await tick();f.pending[1].resolve(payload(a,'RETRY_SUCCESS'));await tick();
  assert.match(f.host.innerHTML,/RETRY_SUCCESS/);assert.equal(f.calls.length,2);
  assert.deepEqual(f.calls[0].args,f.calls[1].args);
  f.controller.destroy();
});

test('a mismatched server item is rejected rather than displayed under the selected title',async()=>{
  const a=row(A,'a','Alpha'),wrong=row(B,'a','Wrong Workspace'),f=setup([a]);
  const request=f.controller.open(A,'a');await tick();f.pending[0].resolve(payload(wrong,'MISMATCHED_BODY'));await request;
  assert.doesNotMatch(f.host.innerHTML,/MISMATCHED_BODY/);assert.match(f.host.innerHTML,/다시 불러오기/);
  f.controller.destroy();
});

test('untrusted titles and description text are escaped while zero load values remain visible',async()=>{
  const a=row(A,'a','<script>unsafe title</script>'),f=setup([a]);
  const request=f.controller.open(A,'a');await tick();
  f.pending[0].resolve(payload(a,'<img src=x onerror=alert(1)>',{minutes:0,sets:1,rpe:0}));await request;
  assert.doesNotMatch(f.host.innerHTML,/<script>|<img src=x/);
  assert.match(f.host.innerHTML,/&lt;script&gt;unsafe title&lt;\/script&gt;/);
  assert.match(f.host.innerHTML,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(f.host.innerHTML,/RPE 0/);
  f.controller.destroy();
});

test('page navigation uses the loaded document and does not fetch another body',async()=>{
  const a=row(A,'a','Meeting'),f=setup([a]);
  const request=f.controller.open(A,'a');await tick();
  f.pending[0].resolve(payload(a,'',{slides:[{title:'First slide',points:['FIRST_POINT'],thumb:svg},{title:'Second slide',points:['SECOND_POINT']}]}));await request;
  assert.match(f.host.innerHTML,/FIRST_POINT/);
  f.host.clickAction('page-next');assert.match(f.host.innerHTML,/SECOND_POINT/);assert.doesNotMatch(f.host.innerHTML,/FIRST_POINT/);
  f.host.emit('change',{id:'acPage',value:'0'});assert.match(f.host.innerHTML,/FIRST_POINT/);
  assert.equal(f.calls.length,1);f.controller.destroy();
});

test('filter and sort changes retaining a selection preserve its loaded page without a new read',async()=>{
  const a=row(A,'a','Meeting'),rows=[a],f=setup(rows);
  const request=f.controller.open(A,'a');await tick();
  f.pending[0].resolve(payload(a,'',{slides:[{title:'First slide',points:['FIRST_POINT']},{title:'Second slide',points:['SECOND_POINT']}]}));await request;
  f.host.clickAction('page-next');assert.match(f.host.innerHTML,/SECOND_POINT/);
  f.controls.search.value='Meeting';f.controls.sort.value='name';f.controller.update(rows,true);
  assert.match(f.host.innerHTML,/SECOND_POINT/);assert.doesNotMatch(f.host.innerHTML,/FIRST_POINT/);
  assert.equal(f.calls.length,1);f.controller.destroy();
});

test('an embedded SVG data URL is placed only in an escaped image attribute',async()=>{
  const a=row(A,'a','Encoded SVG'),f=setup([a]);
  const request=f.controller.open(A,'a');await tick();
  const data='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>" onerror="alert(2)';
  f.pending[0].resolve(payload(a,'SVG_TEXT',{thumb:data}));await request;
  assert.match(f.host.innerHTML,/src="data:image\/svg\+xml,&lt;svg/);
  assert.doesNotMatch(f.host.innerHTML,/<svg|<script|" onerror="/);
  assert.match(f.host.innerHTML,/SVG_TEXT/);f.controller.destroy();
});

test('a malformed saved snapshot cannot hide its description or reject the completed selection',async()=>{
  let attempts=0;
  const a=row(A,'a','Malformed snapshot'),f=setup([a],{snapPreview:snapshot=>{
    attempts++;
    return snapshot.players.map(player=>player.x).join(',');
  }});
  const request=f.controller.open(A,'a');await tick();
  f.pending[0].resolve(payload(a,'DESCRIPTION_SURVIVES_BROKEN_SNAPSHOT',{thumb:'',snap:{players:[null]}}));
  await assert.doesNotReject(request);
  assert.equal(attempts,1,'The real fallback path attempted to render the saved placement');
  assert.match(f.host.innerHTML,/배치 데이터가 있지만 표시할 수 있는 그림이 없습니다/);
  assert.match(f.host.innerHTML,/DESCRIPTION_SURVIVES_BROKEN_SNAPSHOT/);
  assert.doesNotMatch(f.host.innerHTML,/콘텐츠를 불러오는 중|다시 불러오기/);
  f.controller.destroy();
});

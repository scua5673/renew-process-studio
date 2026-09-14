'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8'),perms=fs.readFileSync(path.join(__dirname,'../studio/perms.js'),'utf8');
const raw=JSON.stringify,clone=x=>JSON.parse(raw(x));
function section(a,b){const start=source.indexOf(a),end=source.indexOf(b,start+a.length);assert.ok(start>=0&&end>start,a);return source.slice(start,end);}
const code=section('function permsEditChanges(','function uiLeave(');
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.style={};this.attributes={};this.classList={contains:()=>false};this.textContent='';this.innerHTML='';this.value='';}
 appendChild(node){node.parent=this;this.children.push(node);return node;}
 append(...nodes){nodes.forEach(n=>this.appendChild(n));}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(){}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
}
function all(node){return [node,...node.children.flatMap(all)];}
function fixture(initial){
 const values=new Map([['cs_perms_v1',raw(initial)],['ps_sync_session',raw({uid:'owner'})],['ps_active_ws','team'],['ps_ws_list',raw([{id:'team',kind:'team',role:'owner'}])],['scout_tool_v1',raw({players:[{id:'legacy-player',name:'Same name'},{id:'kept-player',name:'Same name'}]})],['cs_idp_v1_a','PRIVATE A'],['cs_idp_v1_b','PRIVATE B']]),writes=[],syncs=[];
 const body=new Element('body');let current=true,resolveMembers=null;
 const rows=[{user_id:'owner',role:'owner',name:'Owner'},...['a','b','staff','exec'].map(user_id=>({user_id,role:'member',name:user_id}))];
 const c={Promise,JSON,Set,Object,Date,permsOnlyUnlinked:false,document:{body,createElement:t=>new Element(t),createTextNode:t=>Object.assign(new Element('#text'),{textContent:t}),getElementById:id=>all(body).find(n=>n.id===id)||null},
 localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)},
 psSaveShared(k,v){writes.push({k,v});values.set(k,v);return true;},psModal:()=>({close(){}}),memberLabel:r=>r.name,esc:String,
 holdConflictContext:()=>({wid:'team',uid:'owner'}),holdConflictCurrent:()=>current,workspaceSwitchGuardRead:()=>null,activeWsObj:()=>({id:current?'team':'other',role:'owner'}),
 membersOf:()=>new Promise(r=>resolveMembers=r),setStatus(){},forceSync:r=>syncs.push(r)};c.window=c;
 vm.createContext(c);vm.runInContext(perms,c);vm.runInContext(code,c);
 function member(uid){return all(body).find(n=>n.innerHTML===uid&&n.children.some(x=>x.tagName==='select'))?.parent;}
 return {c,body,values,writes,syncs,rows,get:()=>JSON.parse(values.get('cs_perms_v1')),external:p=>values.set('cs_perms_v1',raw(p)),switch(){current=false;},
 async open(){c.uiPerms({id:'team'});resolveMembers(rows);await Promise.resolve();},
 link(uid,id){const select=member(uid).children[1].children.find(x=>x.tagName==='select');select.value=id;select.onchange();},
 role(uid,role){const select=member(uid).children[0].children.find(x=>x.tagName==='select');select.value=role;select.onchange();},
 scope(uid,id,on){const idx=c.PSPerms.SECTIONS.findIndex(x=>x.id===id),box=member(uid).children[2].children[idx].children[0];box.checked=on;box.onchange();},
 toggle(){all(body).find(n=>n.tagName==='button'&&['켜기','끄기'].includes(n.textContent)).onclick();},
 save(){all(body).find(n=>n.tagName==='button'&&n.textContent==='저장').onclick();},
 error:()=>all(body).find(n=>n.attributes.role==='alert')?.textContent||''};
}
function base(){return {v:7,defaultRole:'player',staffEdit:'view',rosterEdit:'executive',schedEdit:'staff',custom:{untouched:[3,2,1]},members:{
 a:{role:'player',playerId:'legacy-player',custom:{preserve:'A'}},b:{role:'player',scopes:[],playerId:'legacy-player',extra:'B'},
 staff:{role:'staff',custom:{inherited:true}},exec:{role:'executive',scopes:['future-scope'],playerId:'kept-player',extra:99},
 absent:{role:'staff',scopes:['team'],custom:'not listed'}}};}
test('actual permissions UI removes exactly two playerId fields and writes only permissions',async()=>{
 const initial=base(),h=fixture(initial),privateBefore=[h.values.get('cs_idp_v1_a'),h.values.get('cs_idp_v1_b')];await h.open();h.link('a','');h.link('b','');h.save();
 const expected=clone(initial);delete expected.members.a.playerId;delete expected.members.b.playerId;
 assert.deepEqual(h.get(),expected);assert.equal(h.writes.length,1);assert.equal(h.writes[0].k,'cs_perms_v1');assert.deepEqual(h.syncs,['perms']);assert.deepEqual([h.values.get('cs_idp_v1_a'),h.values.get('cs_idp_v1_b')],privateBefore);
});
test('opening and saving without edits does not materialize scopes or staffEdit and makes no write',async()=>{
 const initial=base();delete initial.staffEdit;const h=fixture(initial),before=h.values.get('cs_perms_v1');await h.open();h.save();assert.equal(h.values.get('cs_perms_v1'),before);assert.deepEqual(h.writes,[]);assert.deepEqual(h.syncs,[]);
});
test('link-only edits preserve newer roles, scopes, settings and unrelated member fields',async()=>{
 const h=fixture(base());await h.open();h.link('a','');const newer=h.get();newer.members.a.role='staff';newer.members.a.scopes=['future-scope','team'];newer.members.a.custom.latest=1;newer.members.staff.role='executive';newer.staffEdit='edit';newer.custom.next=true;h.external(newer);h.save();delete newer.members.a.playerId;assert.deepEqual(h.get(),newer);assert.equal(h.error(),'');
});
for(const field of ['playerId','role','scopes','staffEdit'])test(`concurrent modification to edited ${field} aborts every pending change`,async()=>{
 const h=fixture(base());await h.open();h.link('b','');
 if(field==='playerId')h.link('a','');if(field==='role')h.role('a','staff');if(field==='scopes')h.scope('a','team',true);if(field==='staffEdit')h.toggle();
 const changed=h.get();if(field==='staffEdit')changed.staffEdit='edit';else changed.members.a[field]=field==='playerId'?'remote-player':field==='role'?'executive':['board'];h.external(changed);const before=h.values.get('cs_perms_v1');h.save();assert.equal(h.values.get('cs_perms_v1'),before);assert.deepEqual(h.writes,[]);assert.deepEqual(h.syncs,[]);assert.match(h.error(),/같은 설정/);
});
test('a member removed while the dialog is open is not recreated',async()=>{
 const h=fixture(base());await h.open();h.link('a','');const changed=h.get();delete changed.members.a;h.external(changed);h.save();assert.deepEqual(h.get(),changed);assert.deepEqual(h.writes,[]);assert.match(h.error(),/팀원 설정/);
});
test('a role edit retains the existing role-default scope behavior and preserves unknown member fields',async()=>{
 const initial=base(),h=fixture(initial);await h.open();h.role('a','staff');h.save();const expected=clone(initial);expected.members.a.role='staff';expected.members.a.scopes=['board','schedule','team','gamemodel','terms'];assert.deepEqual(h.get(),expected);
});
test('a checkbox-only edit preserves unknown scopes and every other permission field',async()=>{
 const initial=base();initial.members.a.scopes=['future-scope','team'];const h=fixture(initial);await h.open();h.scope('a','board',true);h.save();const expected=clone(initial);expected.members.a.scopes=['future-scope','board','team'];assert.deepEqual(h.get(),expected);
});
test('a global staff switch does not pin inherited member scopes',async()=>{
 const initial=base(),h=fixture(initial);await h.open();assert.deepEqual(Array.from(h.c.PSPerms.memberScopes('staff')),[]);h.toggle();h.save();const expected=clone(initial);expected.staffEdit='edit';assert.deepEqual(h.get(),expected);assert.deepEqual(Array.from(h.c.PSPerms.memberScopes('staff')),['board','schedule','team','gamemodel','terms']);
});
test('reverting a field to its opening value is a no-op',async()=>{
 const h=fixture(base());await h.open();h.link('a','');h.link('a','legacy-player');h.scope('a','team',true);h.scope('a','team',false);h.toggle();h.toggle();h.save();assert.deepEqual(h.writes,[]);
});
test('an owner/workspace change blocks an already-open permissions save',async()=>{
 const h=fixture(base());await h.open();h.link('a','');h.switch();h.save();assert.deepEqual(h.writes,[]);assert.deepEqual(h.syncs,[]);assert.match(h.error(),/계정이나 팀 권한/);
});
test('a first explicit link can initialize a previously absent permissions document',async()=>{
 const h=fixture(null);await h.open();h.link('a','legacy-player');h.save();assert.deepEqual(h.get(),{v:1,defaultRole:'player',members:{a:{playerId:'legacy-player'}}});assert.equal(h.writes.length,1);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const admin=fs.readFileSync(path.join(__dirname,'../admin.html'),'utf8'),sync=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function section(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return s.slice(i,j);}
const logoutCode=section(admin,'function signOut(){','function consumeHash(){');
const menuCode=section(sync,'var _popOpen=false','/* ── 부팅 ── */');
const session={uid:'synthetic-A',at:'synthetic-at',rt:'synthetic-rt',email:'synthetic@example.invalid',exp:Date.now()+3600000};
function adminHarness(opener=null){
 const raw=JSON.stringify(session),local=new Map([['ps_sync_session',raw],['cs_notes_v1','synthetic unacknowledged draft']]);
 const calls={locks:[],writes:0,network:0},location={origin:'https://synthetic.invalid',href:'https://synthetic.invalid/admin.html'};
 const c=vm.createContext({window:{opener},location,getSess:()=>JSON.parse(local.get('ps_sync_session')||'null'),adminLockSession:m=>calls.locks.push(m),
  setSess(){calls.writes++;throw Error('shared session must remain');},fetch(){calls.network++;throw Error('no logout request permitted');}});
 vm.runInContext(logoutCode,c);return{c,local,location,calls,raw};
}
for(const mode of ['missing','closed','different-origin','wrong-account','old-app','unready-app','opener-throws'])test('admin logout hands off without deleting session or draft: '+mode,()=>{
 let opener=null;
 if(mode!=='missing')opener={closed:false,location:{origin:'https://synthetic.invalid'},PSSync:{session:()=>session},__psOpenAccountLogout:()=>true,focus(){}};
 if(mode==='closed')opener.closed=true;
 if(mode==='different-origin')opener.location.origin='https://elsewhere.invalid';
 if(mode==='wrong-account')opener.PSSync.session=()=>({uid:'synthetic-B'});
 if(mode==='old-app')delete opener.__psOpenAccountLogout;
 if(mode==='unready-app')opener.__psOpenAccountLogout=()=>false;
 if(mode==='opener-throws')Object.defineProperty(opener,'location',{get(){throw Error('cross origin');}});
 const h=adminHarness(opener);assert.equal(h.c.signOut(),false);assert.equal(h.location.href,'/studio/app.html?account=logout');
 assert.equal(h.local.get('ps_sync_session'),h.raw);assert.equal(h.local.get('cs_notes_v1'),'synthetic unacknowledged draft');assert.equal(h.calls.network,0);assert.equal(h.calls.writes,0);
});
test('admin reuses the original app without replacing its live editor',()=>{
 let opened=0,focused=0;const opener={closed:false,location:{origin:'https://synthetic.invalid'},PSSync:{session:()=>session},__psOpenAccountLogout(){opened++;return true;},focus(){focused++;}};
 const h=adminHarness(opener);h.c.signOut();assert.equal(opened,1);assert.equal(focused,1);assert.equal(h.location.href,'https://synthetic.invalid/admin.html');assert.equal(h.calls.locks.length,1);assert.match(h.calls.locks[0],/아직 로그아웃되지/);assert.equal(h.local.get('ps_sync_session'),h.raw);assert.equal(h.calls.network,0);
});
function appHarness(ready=false,search='?account=logout&layout=mobile'){
 const nodes=[],calls={logout:0,history:[]};
 function node(tag='div'){const n={tag,children:[],style:{},className:'',classList:{remove(){},toggle(){}},setAttribute(){},appendChild(x){this.children.push(x);return x;},contains(){return false;},querySelector(){return null;},set innerHTML(v){this.children=[];},get innerHTML(){return '';}};nodes.push(n);return n;}
 const wrap=node(),location={origin:'https://synthetic.invalid',pathname:'/studio/app.html',search,hash:'#safe'};const win={location};win.top=win;
 const c=vm.createContext({window:win,document:{getElementById:id=>id==='psAcctWrap'?wrap:null,createElement:node,addEventListener(){}},location,URLSearchParams,history:{replaceState(...args){calls.history.push(args);}},externalSwitchFrozen:false,
  getSess:()=>session,dataUnlocked:()=>ready,ensureCSS(){},setTimeout(){},ensureDisplayName(){},activeWsObj:()=>null,getDisplayName:()=>'',meta:()=>({last:0}),pendingInfo:()=>({count:0}),activeWs:()=>'',wsList:()=>[],navigator:{onLine:true},isAdminEmail:()=>false,esc:String,div(){},signOut(){calls.logout++;}});
 vm.runInContext(menuCode,c);return{c,win,wrap,nodes,calls,setReady:v=>ready=v,buttons:()=>wrap.children.flatMap(x=>x.children).filter(n=>n.tag==='button'),logout:()=>nodes.filter(n=>n.tag==='button'&&n.textContent==='로그아웃').at(-1)};
}
test('handoff query opens the existing menu, consumes only its parameter, and never signs out automatically',()=>{
 const h=appHarness();h.c.consumeAccountAction();h.c.renderUI();assert.equal(h.c._popOpen,true);assert.equal(h.c._accountLogoutHint,true);assert.equal(h.calls.history[0][2],'/studio/app.html?layout=mobile#safe');assert.equal(h.calls.logout,0);assert.equal(h.logout().disabled,true);
 assert.ok(h.nodes.some(n=>/로그아웃을 위해 자료/.test(n.textContent||'')));
});
test('handoff cannot use the unready signOut escape, but uses existing safe signOut once ready',()=>{
 const h=appHarness();h.c.consumeAccountAction();h.c.renderUI();h.logout().onclick({stopPropagation(){}});assert.equal(h.calls.logout,0);
 h.setReady(true);h.c.renderUI();assert.ok(!h.logout().disabled);assert.ok(h.nodes.some(n=>/아직 로그아웃되지 않았습니다/.test(n.textContent||'')));h.logout().onclick({stopPropagation(){}});assert.equal(h.calls.logout,1);
});
test('a handoff to the existing app opens the account menu without reloading or logging out',()=>{
 const h=appHarness(true,'');assert.equal(h.c.openAccountLogout(),true);assert.equal(h.c._popOpen,true);assert.equal(h.calls.logout,0);assert.equal(h.calls.history.length,0);
});
test('unrelated query and child frame do not consume or open a logout handoff',()=>{
 const a=appHarness(false,'?account=other');a.c.consumeAccountAction();assert.equal(a.c._popOpen,false);assert.equal(a.calls.history.length,0);
 const b=appHarness();b.win.top={};b.c.consumeAccountAction();assert.equal(b.c._popOpen,false);assert.equal(b.calls.history.length,0);
});
test('a frozen app cannot claim the administrator handoff',()=>{
 const h=appHarness(true);h.c.externalSwitchFrozen=true;assert.equal(h.c.openAccountLogout(),false);assert.equal(h.c._popOpen,false);
});
test('administrator controls describe a handoff rather than completed logout',()=>{
 const controls=admin.match(/<button[^>]+onclick="signOut\(\)"[^>]*>[\s\S]*?<\/button>/g)||[];assert.equal(controls.length,2);for(const button of controls)assert.match(button,/>앱에서 로그아웃<\/button>/);
 assert.match(sync,/function boot\(\)\{\s*consumeHash\(\);\s*consumeAccountAction\(\);/);
});

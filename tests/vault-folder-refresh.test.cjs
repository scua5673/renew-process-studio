'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const code=source.slice(source.indexOf('  var vaultFolders=[],'),source.indexOf('  var FTAG_KEY=',source.indexOf('  var vaultFolders=[],')));
function deferred(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};}
function fixture(){
 const data=new Map([['ps_cache_owner_v1','owner-a']]),hooks={},saved=[],failures=[];let uid='A',wid='team-a',renders=0;
 const c={Promise,JSON,localStorage:{getItem:k=>data.get(k)||null},VFOLD_KEY:'cs_vault_folders_v1',psVaultUnlocked:()=>true,psMyUid:()=>uid,psActiveWs:()=>({id:wid}),
 store:{get:async()=>hooks.read?hooks.read():['A','B']},psSaveSharedAsync:(k,raw)=>{saved.push({k,raw});data.set(k,raw);return hooks.write?hooks.write():Promise.resolve(true);},
 storeFailure:(k,e)=>failures.push(e.message),renderDrillFiles:()=>renders++,toggleSave(){}};c.window=c;vm.createContext(c);vm.runInContext(code,c);c.vaultFolders=['A'];
 return{c,data,hooks,saved,failures,get renders(){return renders;},switch(){uid='B';wid='team-b';data.set('ps_cache_owner_v1','owner-b');}};
}
test('a confirmed folder update refreshes the visible list once',async()=>{const f=fixture();assert.equal(await f.c.reloadVaultFolders(),true);assert.equal(JSON.stringify(f.c.vaultFolders),'["A","B"]');assert.equal(f.renders,1);assert.equal(await f.c.reloadVaultFolders(),false);assert.equal(f.renders,1);});
for(const type of ['account','new edit','guard','newer read'])test('late folder read cannot replace '+type,async()=>{
 const f=fixture(),g=deferred();f.hooks.read=()=>g.promise;const p=f.c.reloadVaultFolders();
 if(type==='account')f.switch();if(type==='new edit')f.c.vaultFolders.push('Mine');if(type==='guard')f.data.set('ps_ws_switch_guard_v1','switch');
 if(type==='newer read'){f.hooks.read=async()=>['A','Newer'];await f.c.reloadVaultFolders();}
 g.resolve(['A','Old read']);assert.equal(await p,false);assert.equal(f.c.vaultFolders.includes('Old read'),false);
});
test('folder writes use the shared durable queue and block refresh until complete',async()=>{const f=fixture(),g=deferred();f.hooks.write=()=>g.promise;f.c.vaultFolders.push('Mine');const p=f.c.saveVaultFolders();assert.deepEqual(f.saved,[{k:'cs_vault_folders_v1',raw:'["A","Mine"]'}]);assert.equal(await f.c.reloadVaultFolders(),false);g.resolve(true);assert.equal(await p,true);assert.equal(f.c.vaultFolderWrites,0);});
test('superseded or other-account write failures do not report failure for newer work',async()=>{for(const change of ['edit','account']){const f=fixture(),g=deferred();f.hooks.write=()=>g.promise;const p=f.c.saveVaultFolders();if(change==='edit')f.c.vaultFolders.push('Newer');else f.switch();g.reject(Error('old owner'));assert.equal(await p,false);assert.deepEqual(f.failures,[]);}});
test('a failure of the latest folder write remains visible',async()=>{const f=fixture();f.hooks.write=()=>Promise.reject(Error('quota'));assert.equal(await f.c.saveVaultFolders(),false);assert.deepEqual(f.failures,['quota']);});
test('locked or invalid folder reads never erase the list',async()=>{const f=fixture();f.hooks.read=async()=>null;assert.equal(await f.c.reloadVaultFolders(),false);f.data.set('ps_ws_switch_guard_v1','switch');assert.equal(await f.c.saveVaultFolders(),false);assert.deepEqual(f.saved,[]);assert.equal(JSON.stringify(f.c.vaultFolders),'["A"]');});

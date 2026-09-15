'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../studio/storage.js'),'utf8');
const start=source.indexOf('    var _si=localStorage.setItem.bind(localStorage);'),end=source.indexOf('  }catch(_){}',start);
test('private-board fallback receives quota failure without a premature lost-data banner',()=>{
 const warnings=[],error=Object.assign(new Error('quota'),{name:'QuotaExceededError'});
 const c={AUX_RECOVERY:{},isQuotaErr:()=>true,warnFull:k=>warnings.push(k),localStorage:{setItem(){throw error;}}};vm.createContext(c);vm.runInContext(source.slice(start,end),c);
 for(const key of ['ps_private_board_draft_v1:user-a','ps_private_board_draft_v1:user-a:kept:one'])assert.throws(()=>c.localStorage.setItem(key,'draft'),e=>e===error);
 assert.deepEqual(warnings,[]);assert.throws(()=>c.localStorage.setItem('scout_tool_v1','data'),e=>e===error);assert.deepEqual(warnings,['scout_tool_v1']);
});

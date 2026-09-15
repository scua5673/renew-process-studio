'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../studio/app.html'),'utf8');
const a=html.indexOf('  var BACKUP_TEAM_KEYS='),b=html.indexOf('  function collectBackupImages(',a);
const ctx={};vm.createContext(ctx);vm.runInContext(html.slice(a,b),ctx);
test('backup includes current-account personal draft and migrated recovery keys only',()=>{
 const uid='user-a',prefix='ps_private_board_draft_v1:';
 for(const k of [prefix+uid,prefix+uid+':kept:old',prefix+uid+':kept:branch'])assert.equal(ctx.backupKeyAllowed(k,uid),true);
 for(const k of [prefix+'user-b',prefix+'user-b:kept:old',prefix+uid+'-other:kept:old',prefix+uid+':metadata','ps_sync_session'])assert.equal(ctx.backupKeyAllowed(k,uid),false);
 assert.equal(ctx.backupKeyAllowed(prefix+uid,''),false);
});

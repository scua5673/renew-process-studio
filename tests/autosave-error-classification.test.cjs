'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../studio/sync.js'),'utf8');
const view=require('../studio/autosave-status.js').view;
function extract(name){const a=source.indexOf('function '+name+'('),b=source.indexOf('\nfunction ',a+1);assert.ok(a>=0&&b>a);return source.slice(a,b);}
function fixture(){const c=vm.createContext({navigator:{onLine:true}});vm.runInContext(extract('classifySyncError')+'\n'+extract('syncReasonText'),c);return c;}
test('journal baseline mismatch is a confirmation issue, never an internet diagnosis or saved state',()=>{
  const c=fixture(),e=Object.assign(new Error('AutosaveJournalVersionError'),{name:'AutosaveJournalVersionError'}),info=c.classifySyncError(e);
  assert.equal(info.code,'sync_confirm_missing');assert.equal(info.stage,'autosave_baseline');
  const shown=view({kind:'bad',reason:info.code,n:1,at:100});
  assert.equal(shown.complete,false);assert.equal(shown.action,'retry');
  assert.doesNotMatch(shown.text+shown.detail+c.syncReasonText(info.code),/인터넷|연결|저장됨/);
});
for(const type of ['Corrupt','Input','Random','Verification','Collision'])test('journal '+type+' failure stays a device-storage error',()=>{
  const c=fixture(),name='AutosaveJournal'+type+'Error',info=c.classifySyncError(Object.assign(new Error(name),{name}));
  assert.equal(info.code,'sync_storage');assert.equal(info.stage,'autosave_journal');
  assert.equal(view({kind:'bad',reason:info.code}).complete,false);
});
test('offline and explicit transport errors keep their original classifications',()=>{
  const c=fixture(),e=Object.assign(new Error('journal version'),{name:'AutosaveJournalVersionError'});
  c.navigator.onLine=false;assert.equal(c.classifySyncError(e).code,'sync_offline');c.navigator.onLine=true;
  e.psCode='sync_permission';e.psStage='server';assert.equal(c.classifySyncError(e).code,'sync_permission');
});
test('unknown errors do not blame connectivity without evidence',()=>{
  const c=fixture(),info=c.classifySyncError(new Error('unrecognized failure'));
  assert.equal(info.code,'sync_unexpected');
  assert.doesNotMatch(view({kind:'bad',reason:info.code}).detail+c.syncReasonText(info.code),/인터넷|연결/);
});
for(const [name,msg,code] of [
 ['StorageOwnerChangedError','storage read owner changed','sync_local_changed'],
 ['StorageConflictError','legacy and IndexedDB values differ','sync_conflict'],
 ['Error','An internal error was encountered in the Indexed Database server','sync_storage'],
 ['Error','HTTP 503','sync_server']
])test('classifies observed error without blaming unrelated causes: '+msg,()=>{const c=fixture(),info=c.classifySyncError(Object.assign(new Error(msg),{name}));assert.equal(info.code,code);assert.doesNotMatch(c.syncReasonText(code),/인터넷/);});
for(const code of ['sync_workspace_changed','sync_local_changed','match_not_ready','sync_timeout','sync_server','sync_rate_limit'])test(code+' gets its own reason instead of an internet diagnosis',()=>{assert.doesNotMatch(fixture().syncReasonText(code),/인터넷/);});

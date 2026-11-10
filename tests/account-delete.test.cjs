'use strict';
/* 계정 삭제 거절 안내(studio/account-delete.js) — 서버 20261110_privacy_limits 의 ps_delete_my_data 가 409 로 멈출 때 앱이 «인터넷 연결을 확인»이라고 말하지 않게.
   서버 쪽 동작(무엇을 지우고 언제 멈추는가)은 migrations/20261110_privacy_limits.local-test.cjs 가 PGlite 에서 본다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const D=require('../studio/account-delete.js');
const body=(message,details)=>JSON.stringify({code:'PT409',message,details:details===undefined?null:details,hint:null});

test('an owner whose team still has members is told what to do, with the team names',()=>{
  const t=D.failText(409,body('ps_delete_owner_blocked','프로세스FC U15, 프로세스FC U12'));
  assert.match(t,/팀을 넘기거나 삭제한 뒤 탈퇴/);
  assert.match(t,/\(프로세스FC U15, 프로세스FC U12\)/);
  assert.match(t,/아무것도 지우지 않았어요/);
  assert.doesNotMatch(t,/인터넷 연결/,'not a connection problem');
  assert.match(D.failText(409,body('ps_delete_owner_blocked')),/내가 소유한 팀에 다른 팀원이/,'no names → no empty brackets');
});

test('team names from the server are shown as plain, bounded text',()=>{
  const t=D.failText(409,body('ps_delete_owner_blocked','<img src=x onerror=alert(1)>\n\u0000팀'+'가'.repeat(400)));
  assert.doesNotMatch(t,/[<>\u0000]/);
  assert.ok(t.length<400,'bounded');
  assert.match(D.failText(409,body('ps_delete_owner_blocked',{a:1})),/팀을 넘기거나 삭제한 뒤 탈퇴/,'a non-string detail does not break the message');
});

test('an admin account gets its own reason; everything else keeps the old wording',()=>{
  assert.match(D.failText(409,body('ps_delete_admin_blocked','service admin account')),/관리자 권한을 먼저/);
  for(const [status,text] of [[500,'upstream'],[0,''],[401,'{"message":"JWT expired"}'],[409,'null'],[409,'[1]'],[409,undefined],[400,body('ps_delete_incomplete')]])
    assert.equal(D.failText(status,text),D.GENERIC,String(status)+' '+text);
  const e=D.fail(409,body('ps_delete_owner_blocked','팀'));
  assert.ok(e instanceof Error);assert.equal(e.message,'server 409');assert.match(e.psText,/\(팀\)/);
});

test('the shell uses it: loaded, precached, and the erase flow shows the server reason',()=>{
  const app=read('studio/app.html');
  assert.match(app,/<script src="account-delete\.js"><\/script>/);
  assert.ok(read('sw.js').includes("'/studio/account-delete.js'"),'precached with the shell');
  const a=app.indexOf("/rest/v1/rpc/ps_delete_my_data'"),b=app.indexOf("'data_delete')",a);
  assert.ok(a>0&&b>a);
  const flow=app.slice(a,b);
  assert.match(flow,/PSAccountDelete\.fail\(r\.status,t\)/,'a failed response is read and turned into a reason');
  assert.match(flow,/psFailAlert\(\(e&&e\.psText\)\|\|/,'the reason is what the user sees');
  assert.ok(flow.indexOf('PSAccountDelete.fail')<flow.indexOf('window.storage.del'),'the device is only wiped after the server said yes');
  // 브라우저에서처럼 전역으로 읽혔을 때
  const ctx={window:{}};vm.runInNewContext(read('studio/account-delete.js'),ctx);
  assert.equal(typeof ctx.window.PSAccountDelete.failText,'function');
});

test('the reasons the app knows are the ones the server raises',()=>{
  const sql=read('migrations/20261110_privacy_limits.sql'),src=read('studio/account-delete.js');
  const raised=[...sql.matchAll(/raise exception '(ps_delete_[a-z_]+)' using errcode = 'PT409'/g)].map(m=>m[1]).sort();
  assert.deepEqual(raised,['ps_delete_admin_blocked','ps_delete_owner_blocked']);
  for(const r of raised)assert.ok(src.includes("'"+r+"'"),r);
});

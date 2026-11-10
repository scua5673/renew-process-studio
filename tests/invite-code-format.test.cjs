'use strict';
/* 새 초대 코드(20261110_invite_hardening — 12자 · Crockford 32글자)가 앱의 코드 검사와 입력 칸을 그대로 지나는지.
   앱은 코드를 세 곳에서 본다(studio/sync.js): 초대 링크 ?join= 과 기기에 둔 링크의 /^[A-Z0-9]{6,12}$/, 손으로 치는 칸의 maxlength 12 · 대문자 바꾸기.
   서버 함수의 실제 출력은 migrations/20261110_invite_hardening.local-test.cjs 가 PGlite 에서 같은 무늬로 본다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const sync=read('studio/sync.js'),sql=read('migrations/20261110_invite_hardening.sql');
const alphabet=(sql.match(/alphabet constant text := '([0-9A-Z]+)'/)||[])[1];
const length=+(sql.match(/gen_random_bytes\((\d+)\)/)||[])[1];
const typed=s=>String(s||'').trim().toUpperCase();                 // 손 입력 · 링크 모두 이렇게 다듬어 보낸다
const server=s=>typed(s).replace(/O/g,'0').replace(/[IL]/g,'1');   // ps_join 의 translate(upper(btrim(p_code)),'OIL','011')

test('the server alphabet is Crockford base32 and a code is 12 characters (60 bits)',()=>{
  assert.equal(alphabet,'0123456789ABCDEFGHJKMNPQRSTVWXYZ');
  assert.equal(new Set(alphabet).size,32);
  assert.equal(length,12);
  assert.match(sql,/for i in 0\.\.11 loop c := c \|\| substr\(alphabet, \(get_byte\(b, i\) & 31\) \+ 1, 1\)/,'5 bits per character, no modulo bias');
  assert.doesNotMatch(alphabet,/[ILOU]/,'no look-alike letters');
});

test('every pattern the app applies to a code accepts new 12-character codes and the old 8-character ones',()=>{
  const patterns=[...sync.matchAll(/\/(\^\[A-Z0-9\]\{(\d+),(\d+)\}\$)\/\.test\(/g)];
  assert.equal(patterns.length,2,'invite link (stored + ?join=)');
  const samples=[alphabet.slice(0,12),alphabet.slice(12,24),alphabet.slice(20,32),'ZZZZZZZZZZZZ','000000000000','A1B2C3D4','99141025'];
  for(const m of patterns){
    const re=new RegExp(m[1]);
    for(const code of samples)assert.ok(re.test(code),m[1]+' rejects '+code);
    assert.ok(+m[3]>=length,'upper bound fits the new length');
  }
  const box=sync.match(/placeholder:'예: A1B2C3D4',maxlength:(\d+),upper:true/);
  assert.ok(box,'hand-typed code box');
  assert.ok(+box[1]>=length,'the box takes 12 characters');
});

test('what a person types reaches the server as the code that was issued',()=>{
  const issued='A0B1C2D3E4F1';
  for(const t of ['a0b1c2d3e4f1',' A0B1C2D3E4F1 ','aObIc2d3e4fL','AOB1C2D3E4Fl'])assert.equal(server(t),issued,t);
  assert.equal(server('a1b2c3d4'),'A1B2C3D4','old hex codes have no O/I/L — unchanged');
  assert.match(sql,/translate\(upper\(btrim\(coalesce\(p_code,''\)\)\), 'OIL', '011'\)/,'the server folds the same letters');
  for(const ch of alphabet)assert.equal(server(ch),ch,'folding never changes an issued character: '+ch);
});

test('the app never reads the invite table — codes come from the RPCs',()=>{
  for(const f of ['studio/sync.js','studio/app.html','admin.html'])assert.doesNotMatch(read(f),/rest\/v1\/ps_invites/,f);
  for(const rpc of ['ps_join','ps_get_or_create_role_invite','ps_regenerate_role_invite','ps_get_or_create_invite','ps_create_invite'])assert.ok(sync.includes("rpc('"+rpc+"'"),rpc);
  assert.match(sync,/if\(!r\.ok\)throw new Error\('rpc '\+name\+' '\+r\.status/,'a 400 (wrong or expired code) and a 429 (locked) both reject — «합류 실패»');
});

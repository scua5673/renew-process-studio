'use strict';
/* 3.280 — «프로필» 앱(studio/profile-app.js)의 순수 규칙: 저장본 정리 · 종이 · 안전 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('../studio/profile-app.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('norm: 모르는 종류 · 칸 · 깨진 값은 버리고, 칸 길이를 자른다',()=>{
  const raw=JSON.stringify({v:1,list:[{id:'a',kind:'player',photo:'data:image/jpeg;base64,AAAA',f:{name:'김',evil:'x',strengths:'가\n나',number:5},updated:3},{id:'b',kind:'admin',f:{}},{kind:'coach'},null,{id:'c',kind:'coach',photo:'https://x.invalid/a.png',f:{name:'이'.repeat(500)}}]});
  const list=P.norm(raw);assert.equal(list.length,2);
  assert.deepEqual(list[0],{id:'a',kind:'player',photo:'data:image/jpeg;base64,AAAA',f:{name:'김',strengths:'가\n나'},updated:3});
  assert.equal(list[1].photo,'');assert.equal(list[1].f.name.length,160);
  assert.deepEqual(P.norm('{'),[]);assert.deepEqual(P.norm(null),[]);assert.deepEqual(P.norm('{"list":7}'),[]);
  assert.deepEqual(P.norm(P.pack(list)),list,'다시 읽어도 같다');
});
test('okPhoto · okUrl: 그림 data URL 과 http(s) 주소만',()=>{
  assert.equal(P.okPhoto('data:image/png;base64,AA=='),'data:image/png;base64,AA==');
  for(const bad of ['data:image/svg+xml;base64,AAAA','javascript:alert(1)','data:text/html;base64,AAAA','data:image/png;base64,AA" onerror="x',7,null])assert.equal(P.okPhoto(bad),'');
  assert.equal(P.okUrl(' https://youtu.be/abc '),'https://youtu.be/abc');
  for(const bad of ['javascript:alert(1)','youtu.be/abc','https://a.b/"><script>','data:text/html,x'])assert.equal(P.okUrl(bad),'');
});
test('sheet: 빈 칸은 싣지 않고, 글은 모두 esc 를 지난다',()=>{
  const p=P.blank('player');p.f={name:'<img src=x onerror=alert(1)>',position:'RB',strengths:'1. 빠름\n- <b>강함</b>',video:'javascript:alert(1)',number:'7"><script>'};
  const h=P.sheet(p);
  assert.doesNotMatch(h,/<img src=x|<script>|<b>강함/);assert.match(h,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.match(h,/<li>빠름<\/li><li>&lt;b&gt;강함&lt;\/b&gt;<\/li>/);
  assert.doesNotMatch(h,/javascript:/,'http(s) 아닌 영상 주소는 싣지 않는다');assert.doesNotMatch(h,/보완할 점|경력/,'빈 칸의 제목도 없다');
  assert.match(h,/class="a4 pf-a4"/);
  const c=P.blank('coach');c.f={name:'이가상',role:'감독',license:'AFC B'};const hc=P.sheet(c);
  assert.match(hc,/코치 프로필/);assert.match(hc,/자격증/);assert.match(hc,/<div class="pf-s">감독<\/div>/);
  assert.match(P.docHTML(c),/@page\{size:A4;margin:0\}/);
});
test('progress · lines',()=>{
  const p=P.blank('player');assert.deepEqual(P.progress(p),{done:0,total:P.FIELDS.player.length});   /* 연락처 빼고 + 사진 */
  p.f={name:'가',contact:'010'};p.photo='data:image/jpeg;base64,AAAA';assert.equal(P.progress(p).done,2,'연락처는 세지 않는다');
  assert.deepEqual(P.lines('1. 가\n2) 나\n- 다\n\n• 라'),['가','나','다','라']);
});
test('실린 곳: 왼쪽 메뉴 커뮤니티 뒤 · 틀 · 설치 묶음 · 폰 더보기 · 기기 전용 키',()=>{
  const app=read('studio/app.html'),sw=read('sw.js'),keys=read('studio/storage-keys.js'),page=read('studio/profile.html'),src=read('studio/profile-app.js');
  assert.ok(app.indexOf('data-app="community"><svg')<app.indexOf('data-app="profile"><svg')&&app.indexOf('data-app="profile"><svg')<app.indexOf('data-app="learning"><svg'),'커뮤니티 바로 뒤');
  assert.match(app,/<iframe id="fProfile" title="프로필"/);assert.match(app,/profile:\[fProfile,'profile\.html\?v='\+PS_BUILD\]/);assert.match(app,/data-am-app="profile">프로필</);
  assert.match(sw,/'\/studio\/profile\.html', '\/studio\/profile-app\.js'/);assert.match(keys,/\['ps_profiles_v1:','device','idb'/);
  assert.match(page,/storage\.js[\s\S]*photo-crop\.js[\s\S]*pdf-export\.js[\s\S]*profile-app\.js/);
  assert.doesNotMatch(src,/PSSync\.|rest\/v1|fetch\(/,'서버 · 동기화에 닿지 않는다');assert.doesNotMatch(src,/scout_tool_v1|cs_scout/,'팀 명단과 별개');
});

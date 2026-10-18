'use strict';
/* 3.091 — 사용자 «핸드폰으로 웹앱으로 설치하면 자꾸 안돼». 설치 안내가 모든 기기에 «새로 로그인할 필요도 없어요»라고 했는데,
   아이폰 · 아이패드 · 맥 사파리의 설치 앱은 사파리와 저장 공간을 따로 쓴다 — 로그인(localStorage ps_sync_session)도 기기 사본도 넘어가지 않는다.
   그 기기에서는 «처음 한 번 로그인»을 말하고, 크롬 · 엣지 · 안드로이드(같은 저장 공간)는 그대로. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'..','studio','app.html'),'utf8');
test('the install guide asks Safari-family installs to log in once, and keeps the old promise elsewhere',()=>{
  const i=app.indexOf("+'<div class=\"psi-note\">'"),note=app.slice(i,app.indexOf("+'</div>'",i));
  assert.ok(i>0,'설치 안내의 «걱정되는 것» 칸');
  assert.match(note,/\(m!=='prompt'&&\(isiOS\(\)\|\|b==='desk-safari'\)\)\s*\?'<b>처음 한 번 로그인해 주세요\.<\/b>/,'아이폰 · 아이패드 · 맥 사파리');
  assert.match(note,/사파리와 저장 공간을 따로 써요/);
  assert.match(note,/:'<b>자료는 그대로입니다\.<\/b>[^']*새로 로그인할 필요도 없어요/,'같은 저장 공간을 쓰는 브라우저는 그대로');
});

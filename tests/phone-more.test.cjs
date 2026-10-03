'use strict';
// 2.938 — 폰 하단 메뉴 «더보기»: 버튼·시트·연결된 문이 실제로 있고, 폰에서만 보이며, 화면을 바꾸지 않고 시트만 연다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(require.resolve('../studio/app.html'),'utf8');

test('more button is the last item of the app bottom bar and has no app of its own',()=>{
  const seg=html.slice(html.indexOf('<div class="seg" id="appSeg">'),html.indexOf('<div class="hintbar" id="hintbar">'));
  const buttons=[...seg.matchAll(/<button\b[^>]*>/g)].map(m=>m[0]);
  const last=buttons[buttons.length-1];
  assert.match(last,/id="psMoreBtn"/);
  assert.doesNotMatch(last,/data-app=|data-team-hub=/,'the more button must not switch apps by itself');
  assert.match(last,/aria-controls="appMoreSheet"/);assert.match(last,/aria-expanded="false"/);
});

test('more is phone-only and beats the sidebar button rule',()=>{
  const css=html.slice(html.indexOf('<style id="ps-2938-more">'),html.indexOf('</style>',html.indexOf('<style id="ps-2938-more">')));
  assert.match(css,/html body #appSeg#appSeg #psMoreBtn\{display:none!important\}/);
  assert.match(css,/@media \(max-width:767px\)\{\s*html body #appSeg#appSeg #psMoreBtn\{display:flex!important\}/);
  assert.match(css,/body\.ps-team-open \.app-more/,'team screens keep their own more sheet');
  assert.match(css,/min-height:40px/,'touch target');
});

test('every sheet entry points at a door that exists',()=>{
  const sheet=html.slice(html.indexOf('<div class="app-more" id="appMoreSheet"'),html.indexOf('</div>\n  <style id="ps-2938-more">'));
  assert.match(sheet,/data-am-app="design">보관함</);
  for(const k of ['settings','support','guide','close'])assert.match(sheet,new RegExp('data-am="'+k+'"'));
  for(const id of ['gearBtn','gearPop','psSupportSettingsOpen','guideOpen'])assert.ok(html.includes('id="'+id+'"'),'missing #'+id);
});

test('bar click opens the sheet before any app switch, and other bar items close it',()=>{
  const i=html.indexOf("seg.addEventListener('click',function(e){");
  const body=html.slice(i,html.indexOf('showApp(b.dataset.train',i));
  assert.ok(body.indexOf("b.id==='psMoreBtn'")>=0&&body.indexOf("b.id==='psMoreBtn'")<body.indexOf('dataset.teamHub'),'more is handled first');
  assert.match(body,/__psAppMoreClose\(\)/);
});

test('opening the archive from the sheet lights the more button',()=>{
  assert.match(html,/if\(x\.id==='psMoreBtn'\)on=!currentTeamKey&&\(navApp==='design'/);
});

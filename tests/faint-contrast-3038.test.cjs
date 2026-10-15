'use strict';
/* 3.038 — 보조 회색(--faint · --text-3 · --ghost)은 WCAG AA(본문 4.5:1)를 넘어야 한다(피드백 DS-1·DS-14).
   전엔 #8A9099(흰 바탕 3.2:1)가 앱 전체의 기본 보조색이었고 랜딩·시작 페이지는 #9A9DA3(2.7:1)였다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function lum(hex){const h=hex.replace('#','');const c=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];}
function ratio(a,b){const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05);}
/* 3.046 — ui-grammar 의 별칭은 vendor/tokens.css 의 정본(--c-*)을 가리킨다(피드백 17 · DS-4). var(--c-x[,폴백]) 은 tokens.css 의 같은 모드 값으로 푼다 */
const tokensCss=read('vendor/tokens.css'),tokLight=tokensCss.slice(0,tokensCss.indexOf('body.fmdark{')),tokDark=tokensCss.slice(tokensCss.indexOf('body.fmdark{'));
function token(block,name,label){const m=new RegExp('(?:^|[\\s;{])'+name+':(#[0-9A-Fa-f]{6}|var\\((--c-[a-z0-9-]+)[^)]*\\))').exec(block);assert.ok(m,name+' in '+label);
  if(m[1][0]==='#')return m[1];const src=label==='dark'?tokDark:tokLight;const t=new RegExp('(?:^|[\\s;{])'+m[2]+':\\s*(#[0-9A-Fa-f]{6})').exec(src);assert.ok(t,m[2]+' in tokens.css '+label);return t[1];}

test('ui-grammar light greys read on white and on the page background',()=>{
  const css=read('studio/ui-grammar.css');
  const light=css.slice(0,css.indexOf(':is(#ps-grammar,html) body.fmdark{'));   /* 머리 주석에도 body.fmdark 가 나온다 — 규칙 시작으로 가른다 */
  const bg=token(light,'--bg','light');
  for(const n of ['--faint','--text-3','--ghost']){const v=token(light,n,'light');for(const back of ['#FFFFFF',bg])assert.ok(ratio(v,back)>=4.5,n+' '+v+' on '+back+' = '+ratio(v,back).toFixed(2));}
});
test('ui-grammar dark greys read on the dark page background',()=>{
  const css=read('studio/ui-grammar.css');
  const dark=css.slice(css.indexOf(':is(#ps-grammar,html) body.fmdark{'));
  const bg=token(dark,'--bg','dark');
  for(const n of ['--faint','--text-3','--ghost']){const v=token(dark,n,'dark');assert.ok(ratio(v,bg)>=4.5,n+' '+v+' on '+bg+' = '+ratio(v,bg).toFixed(2));}
  const ck=/body\.fmdark \.ck\{[^}]*--faint:(#[0-9A-Fa-f]{6})/.exec(css);assert.ok(ck,'.ck dark faint');assert.ok(ratio(ck[1],bg)>=4.5,'.ck --faint '+ck[1]);
});
test('landing and start pages use a readable kicker/footer grey',()=>{
  for(const f of ['landing.html','start/index.html','start/how.html']){
    const html=read(f);const m=/--faint:(#[0-9A-Fa-f]{6})/.exec(html);assert.ok(m,f);
    for(const back of ['#FFFFFF','#F7F8F9'])assert.ok(ratio(m[1],back)>=4.5,f+' --faint '+m[1]+' on '+back+' = '+ratio(m[1],back).toFixed(2));
  }
});
test('the old failing greys are no longer the token values',()=>{
  const css=read('studio/ui-grammar.css');
  assert.doesNotMatch(css,/--faint:#8A9099|--text-3:#8A9099|--ghost:#8A9099|--faint:#7C838D|--text-3:#7C838D/i);
  for(const f of ['landing.html','start/index.html','start/how.html'])assert.doesNotMatch(read(f),/--faint:#9a9da3/i,f);
});

test('pages that pin their own grey tokens use readable values too (3.038 review)',()=>{
  const ck=/\.ck\{[^}]*--faint:(#[0-9A-Fa-f]{6})/.exec(read('studio/scout.html'));assert.ok(ck,'scout .ck');
  for(const back of ['#FFFFFF','#F1F3F5'])assert.ok(ratio(ck[1],back)>=4.5,'scout .ck --faint '+ck[1]+' on '+back);
  for(const f of ['studio/process.html','studio/gamemodel.html']){const m=/body\.fmdark\{[^}]*--text-3:(#[0-9A-Fa-f]{6})!important/.exec(read(f));assert.ok(m,f);assert.ok(ratio(m[1],'#1B1E23')>=4.5,f+' dark --text-3 '+m[1]);}
  const idp=read('start/idp.html'),l=/--text-3:(#[0-9A-Fa-f]{6})/.exec(idp);assert.ok(l);
  for(const back of ['#FFFFFF','#ECEDF0'])assert.ok(ratio(l[1],back)>=4.5,'start/idp.html --text-3 '+l[1]+' on '+back);
});

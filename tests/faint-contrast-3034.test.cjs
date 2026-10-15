'use strict';
/* 3.034 — 보조 회색(--faint · --text-3 · --ghost)은 WCAG AA(본문 4.5:1)를 넘어야 한다(피드백 DS-1·DS-14).
   전엔 #8A9099(흰 바탕 3.2:1)가 앱 전체의 기본 보조색이었고 랜딩·시작 페이지는 #9A9DA3(2.7:1)였다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function lum(hex){const h=hex.replace('#','');const c=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];}
function ratio(a,b){const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05);}
function token(block,name,label){const m=new RegExp('(?:^|[\\s;{])'+name+':(#[0-9A-Fa-f]{6})').exec(block);assert.ok(m,name+' in '+label);return m[1];}

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

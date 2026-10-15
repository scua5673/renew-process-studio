const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 3.041 — 커뮤니티 올리기 «용량이 커서 올릴 수 없어요»(엘미하 계정 · 사용자 «용량이 커도 올릴 수 있게»).
   · 한 글의 한도가 500KB 였다 — 페이지 여럿 × 장면 여럿 작전판은 사진 없이도 넘었다. 한도 5MB(바이트로 잰다).
   · 얼굴 사진 토큰(2.975 · p.img 256px PNG)은 2.668 의 사진 정리(team 'img' 의 src)에서 빠져 장면마다 사진이 실렸다 — «사진은 자동으로 빠져요»라는
     약속과도 달랐다. 판 어디에 있든 data:image · data:video(CSS url(data:…) 포함)는 올리지 않는다(보관함 팀 공유본 libShareCopy 와 같은 규칙).
   · 카드 그림(SVG)의 사진도 뺀다 — 사진이 든 그림은 200KB 를 넘어 sanSvg 가 그림을 통째로 버렸다.
   브라우저 흐름(얼굴 사진 토큰 · 825KB 작전판 올리기)은 tests/browser/community-board.mjs 가 본다. */
const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const comm=R('studio/community.html');
function cut(src,from,to){ const a=src.indexOf(from); assert.ok(a>=0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const plain=o=>JSON.parse(JSON.stringify(o));
const STRIP=cut(comm,'var __pubNames=[];','function openUpload(){');
function api(){ const c=vm.createContext({Blob}); vm.runInContext(STRIP+';this.api={stripSnap,stripFrames,stripPages,dropMedia,stripThumbPhotos,commBytes,commMB,COMM_MAX_BYTES,names:function(){return __pubNames;}};',c); return c.api; }

const FACE='data:image/png;base64,'+'A'.repeat(40000);
const snap=()=>({pitchSpec:'fifa',pitchTheme:'',pitchImg:FACE,pitchCustom:'url("'+FACE+'")',
  players:[{id:1,team:'blue',num:'7',name:'김가상',img:FACE,imgBg:'#223344',x:1,y:2},{id:2,team:'img',src:FACE,x:3,y:4},{id:3,team:'red',num:'4',x:5,y:6}],
  equipment:[{id:'e1',k:'cone',src:FACE,x:9,y:9}],drawings:[{t:'arrow',c:'#fff',pts:[[1,2],[3,4]]}],customImages:[{src:FACE}],ball:{x:5,y:5}});

test('3.041 a face-photo token goes up as a number token — no photo anywhere on the board',()=>{
  const g=api(),out=plain(g.stripSnap(snap())),json=JSON.stringify(out);
  assert.equal(/data:(image|video)/.test(json),false,'사진 원본이 하나도 없다');
  assert.deepEqual(out.players.map(p=>[p.team,p.num||'',p.name||'','img' in p,'imgBg' in p,'src' in p]),[['blue','7','',false,false,false],['blue','','',false,false,false],['red','4','',false,false,false]]);
  assert.deepEqual([out.pitchTheme,'pitchImg' in out,'pitchCustom' in out,out.equipment[0].k,'src' in out.equipment[0],out.customImages.length,out.drawings.length],['',false,false,'cone',false,0,1],'운동장 사진 · 장비 그림도 · 판의 나머지는 그대로');
  assert.ok(json.length<1000,'사진이 빠지면 판 하나는 1KB 남짓 '+json.length);
  assert.deepEqual(plain(g.names()),['김가상']);
});

test('3.041 every page and scene of a board loses photos too',()=>{
  const g=api(),frames=[0,1,2].map(s=>({snap:snap(),hold:.6,dur:1,cap:'움직임 '+s,thumb:'<svg/>'}));
  const pages=plain(g.stripPages({type:'board',pages:[{name:'공격',snap:snap(),anim:{frames}},{name:'',snap:snap()}]}));
  assert.equal(/data:(image|video)/.test(JSON.stringify(pages)),false);
  assert.equal(pages[0].anim.frames.length,3,'장면 수는 그대로');
});

test('3.041 dropMedia only removes media strings — numbers, colours, links, keywords stay',()=>{
  const g=api(),o=plain(g.dropMedia({a:'data:image/jpeg;base64,xx',b:' url(\'data:video/mp4;base64,yy\')',c:'#1e8c4c',d:'@real',e:'https://x/y.png',f:['data:image/png;base64,zz','keep'],g:{h:{i:'data:image/webp;base64,ww',j:3}}}));
  assert.deepEqual(o,{c:'#1e8c4c',d:'@real',e:'https://x/y.png',f:['','keep'],g:{h:{j:3}}},'배열 칸은 비우고(자리 유지) · 객체 칸은 지운다');
});

test('3.041 the card picture keeps its tokens but not their photos',()=>{
  const g=api();
  const svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><pattern id="psRealGrass2" width="9"><image href="data:image/avif;base64,AAAA" width="9"/></pattern></defs>'
    +'<rect fill="url(#psRealGrass2)" width="80"/><g class="token" data-id="1" transform="translate(5,5)"><circle r="21"/><image x="-20" xlink:href="data:image/png;base64,BBBB" width="40"></image><text>7</text></g>'
    +'<image href=\'data:image/jpeg;base64,CCCC\' /><image href="https://example.invalid/a.png"/></svg>';
  assert.equal(g.stripThumbPhotos(svg),'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs></defs><rect fill="#1e8c4c" width="80"/><g class="token" data-id="1" transform="translate(5,5)"><circle r="21"/><text>7</text></g><image href="https://example.invalid/a.png"/></svg>');
  assert.equal(g.stripThumbPhotos(''),'');
  assert.match(comm,/thumb:stripThumbNames\(sanSvg\(stripThumbPhotos\(sel\.thumb\)\)\)\|\|''/,'올리기는 사진을 먼저 빼고 그림을 정리한다(200KB 넘는 그림은 sanSvg 가 버린다)');
  assert.match(comm,/patch\.thumb=sanSvg\(stripThumbPhotos\(extra\.thumb\)\)\|\|'';/,'글 고치기도');
});

test('3.041 the size limit is 5MB, measured in bytes, and the message says how big',()=>{
  const g=api();
  assert.equal(g.COMM_MAX_BYTES,5*1024*1024);
  assert.equal(g.commBytes('가나다'),9,'한글은 글자보다 크다(UTF-8 바이트)');
  assert.deepEqual([g.commMB(g.COMM_MAX_BYTES),g.commMB(1300000),g.commMB(825600)],['5MB','1.2MB','0.8MB']);
  assert.doesNotMatch(comm,/500000/,'옛 한도는 남지 않는다');
  const up=cut(comm,"$('upGo').onclick=function(){","$('upGo').disabled=true;");
  assert.match(up,/var _bUp=commBytes\(payload\);[^\n]*\n      if\(_bUp>COMM_MAX_BYTES\)\{toast\('용량이 커서 올릴 수 없어요\('\+commMB\(_bUp\)\+' · 최대 '\+commMB\(COMM_MAX_BYTES\)\+'\) — '/);
  assert.match(comm,/var _bU=commBytes\(payloadU\); if\(_bU>COMM_MAX_BYTES\)\{toast\('용량이 커서 저장할 수 없어요\('/,'글 고치기도 같은 한도');
});

test('3.041 release note and cache',()=>{
  const notes=require('../studio/release-notes.js');
  const e=notes.entries().find(x=>x.id==='2026-10-15-v3-041-community-size');assert.ok(e,'3.041 안내');
  assert.match(e.title,/v3\.041/);assert.match(e.changes.join(' '),/5MB/);assert.match(e.changes.join(' '),/사진/);
  const cache=(R('sw.js').match(/^const CACHE = 'process-(3\.\d{3})';/m)||[])[1],build=(R('studio/app.html').match(/window\.PS_BUILD='(3\.\d{3})'/)||[])[1];
  assert.equal(cache,build,'sw.js CACHE = app.html PS_BUILD');
  assert.ok(Number(build)>=3.041,'3.041 이 판을 올렸다 — 뒤 판도 지나간다');
});

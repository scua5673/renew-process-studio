'use strict';
/* 3.120 — 유니폼 토큰(studio/board-jersey.js). 사용자 «토큰 유니폼도 이렇게»(FmStadio 배지 — 원 안에 유니폼 앞모습)
   → «원형과 유니폼 전부 적용» → «유니폼을 완전 디테일하게».
   좌표는 원(r 21) · 셔츠(SHIRT_D) 안에 맞춰 미리 계산했다: 래글런 소매선 · 소매 줄은 소매선을 밀어낸 곡선(Tiller-Hanson)을
   원 · 셔츠 안쪽(테두리 선 밑)까지만 잘랐고, 무늬 사이 가는 선은 kitSVGDef 의 무늬 경계(objectBoundingBox)를 같은 방법으로 잘랐다.
   잘라내기(clip) · 그라디언트를 쓰지 않는다 — 끌기 중 사파리가 칩마다 다시 그려도 가볍게(board-token-depth 의 같은 이유).
   실제 판 · 3D 칩 · 입체 칩 · 내보내기는 tests/browser/board-jersey.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const J=require('../studio/board-jersey.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const nums=d=>(String(d).match(/-?\d*\.?\d+/g)||[]).map(Number);

// 아주 작은 SVG DOM(시험용)
function el(tag,doc){
  const n={nodeType:1,tagName:tag,attrs:{},children:[],parentNode:null,ownerDocument:doc,
    setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return k in this.attrs?this.attrs[k]:null;},
    appendChild(c){return this.insertBefore(c,null);},
    insertBefore(c,ref){if(c.parentNode)c.parentNode.removeChild(c);const i=ref?this.children.indexOf(ref):-1;if(i<0)this.children.push(c);else this.children.splice(i,0,c);c.parentNode=this;return c;},
    removeChild(c){const i=this.children.indexOf(c);if(i>=0)this.children.splice(i,1);c.parentNode=null;return c;},
    get firstChild(){return this.children[0]||null;},
    get nextSibling(){if(!this.parentNode)return null;const s=this.parentNode.children;return s[s.indexOf(this)+1]||null;},
    all(){const out=[];(function walk(x){x.children.forEach(c=>{out.push(c);walk(c);});})(this);return out;},
    querySelector(sel){const cls=sel.replace(/^\./,'');return this.all().find(c=>(' '+(c.attrs.class||'')+' ').includes(' '+cls+' '))||null;},
    querySelectorAll(sel){const cls=sel.replace(/^\./,'');return this.all().filter(c=>(' '+(c.attrs.class||'')+' ').includes(' '+cls+' '));}};
  return n;
}
function makeDoc(){const doc={createElementNS:(ns,t)=>el(t,doc)};return doc;}
function token(shape,{label='7'}={}){
  const doc=makeDoc(),g=el('g',doc);
  const c=el(shape==='shirt'?'path':'circle',doc);c.setAttribute('class','tok-c');c.setAttribute('fill','url(#psp_red)');c.setAttribute('stroke','#ffffff');g.appendChild(c);
  if(shape==='shirt'){const acc=el('path',doc);acc.setAttribute('d','M -7.5 -19.6 Q 0 -12.6 7.5 -19.6');acc.setAttribute('fill','none');g.appendChild(acc);}
  const t=el('text',doc);t.setAttribute('y',shape==='shirt'?'2.5':'0');t.textContent=label;g.appendChild(t);
  return g;
}
const WIN={teamMain:t=>({red:'#c8102e',blue:'#ffffff'})[t],teamAccent:t=>({red:'#1a1a1a',blue:'#6cc4ee'})[t],teamPat:t=>({red:'v',blue:'solid'})[t],
  gkColFor:()=>'#ffd400',gkAccent:()=>'#1e5bc6',gkPat:()=>'solid'};

test('every jersey shape stays inside its token: circle r 21, shirt 46 × 41 — no clip-path needed',()=>{
  for(const [k,d] of Object.entries(J.GEO.c)){ for(const v of nums(d)) assert.ok(Math.abs(v)<=21.05,'원 '+k+' '+v); }
  for(const [k,d] of Object.entries(J.PINS.c)){ for(const v of nums(d)) assert.ok(Math.abs(v)<=20.3,'원 무늬 선 '+k+' '+v); }
  for(const [k,d] of Object.entries(J.GEO.s)){ for(const v of nums(d)) assert.ok(Math.abs(v)<=23.05,'셔츠 '+k+' '+v); }
  for(const [k,d] of Object.entries(J.PINS.s)){ const v=nums(d); for(let i=0;i<v.length;i+=2){ assert.ok(Math.abs(v[i])<=22,'셔츠 무늬 선 x '+k); assert.ok(v[i+1]>=-20&&v[i+1]<=19.6,'셔츠 무늬 선 y '+k+' '+v[i+1]); } }
  const src=read('studio/board-jersey.js');
  assert.doesNotMatch(src,/clip-path|clipPath|Gradient/,'잘라내기 · 그라디언트 없음(사파리 끌기)');
});

test('details: collar · neck · sleeves with three stripes · side panels · crest · rim; the shirt adds cuffs, back of the neck and a hem stitch',()=>{
  const c=J.spec('circle',{main:'#d71920',acc:'#ffffff',pat:'solid'}),s=J.spec('shirt',{main:'#d71920',acc:'#ffffff',pat:'solid'});
  const has=(list,d)=>list.some(n=>n[1].d===d);
  for(const k of ['collar','neck','sleeve','stripes','panel','piping','seam','crest','brand','tag','shade1']) assert.ok(has(c,J.GEO.c[k]),'원 '+k);
  for(const k of ['collar','back','sleeve','stripes','cuff','panel','piping','seam','crest','brand','tag','hem']) assert.ok(has(s,J.GEO.s[k]),'셔츠 '+k);
  assert.equal((J.GEO.c.stripes.match(/M/g)||[]).length,6,'원: 소매 줄 셋씩 양쪽');
  assert.equal((J.GEO.s.stripes.match(/M/g)||[]).length,6,'셔츠: 소매 줄 셋씩 양쪽');
  assert.deepEqual(c[c.length-1],['circle',{r:'21',fill:'none',stroke:'#ffffff','stroke-width':'2.6'}],'원 테두리를 맨 위에 다시');
  assert.equal(s[s.length-1][1].d,J.SHIRT_D,'셔츠 외곽선을 맨 위에 다시');
  assert.ok(c.length<=20&&s.length<=22,'토큰 하나에 요소 스물 남짓(양쪽은 한 path)');
});

test('colours follow the team kit: accent = collar · stripes · cuffs · crest; a same-colour accent turns into a darker or lighter trim',()=>{
  const red=J.spec('shirt',{main:'#d71920',acc:'#ffffff',pat:'solid'});
  const fillOf=d=>red.find(n=>n[1].d===d)[1];
  assert.equal(fillOf(J.GEO.s.collar).fill,'#ffffff');assert.equal(fillOf(J.GEO.s.cuff).fill,'#ffffff');assert.equal(fillOf(J.GEO.s.stripes).stroke,'#ffffff');
  assert.equal(fillOf(J.GEO.s.sleeve).fill,'#d71920','소매 바탕은 주색');
  const white=J.palette({main:'#ffffff',acc:'#ffffff'}),black=J.palette({main:'#1a1a1a',acc:'#1a1a1a'});
  assert.ok(J.lum(white.trim)<.7,'흰 유니폼 + 흰 보조색 → 회색 줄 '+white.trim);
  assert.ok(J.lum(black.trim)>.4,'검정 + 검정 → 밝은 줄 '+black.trim);
  assert.equal(J.palette({main:'#fff',acc:'#000'}).main,'#ffffff','세 자리 색');
});

test('stripe patterns get thin lines between the colours, solid kits do not',()=>{
  for(const p of ['v','thinv','h','hoop','band','half','quarters','sash','diag']){
    assert.ok(J.PINS.c[p]&&J.PINS.s[p],'무늬 '+p);
    assert.ok(J.spec('circle',{main:'#c8102e',acc:'#1a1a1a',pat:p}).some(n=>n[1].d===J.PINS.c[p]),'원 '+p);
  }
  assert.equal((J.PINS.c.v.match(/M/g)||[]).length,4,'세로 줄무늬 경계 넷');
  assert.ok(!J.spec('circle',{main:'#c8102e',acc:'#1a1a1a',pat:'solid'}).some(n=>Object.values(J.PINS.c).includes(n[1].d)));
  assert.ok(!J.spec('circle',{main:'#c8102e',acc:'#1a1a1a',pat:'zigzag'}).some(n=>Object.values(J.PINS.c).includes(n[1].d)),'모르는 무늬 = 단색');
});

test('shared or community colours never become markup: only #rrggbb is read, values go through setAttribute',()=>{
  const k=J.palette({main:'"><script>alert(1)</script>',acc:'red;}'});
  assert.equal(k.main,'#3a6df0');assert.match(k.trim,/^#[0-9a-f]{6}$/);
  const svg=J.svgText('circle',{main:'#123456',acc:'#ffffff',stroke:'"/><script>x</script>'});
  assert.doesNotMatch(svg,/<script/);
  const src=read('studio/board-jersey.js');
  assert.doesNotMatch(src,/innerHTML|insertAdjacentHTML|outerHTML/,'토큰에는 setAttribute 로만');
});

test('decorate: circle and shirt players get the jersey right after the token face; number moves to the chest; the old shirt lines go',()=>{
  const g=token('circle');assert.equal(J.decorate(WIN,g,{team:'red',num:'7'}),true);
  const kids=g.children.map(c=>c.attrs.class||c.tagName);
  assert.deepEqual(kids,['tok-c','ps-jersey','text']);
  assert.equal(g.children[2].getAttribute('y'),'1','번호를 목깃 아래로');
  assert.equal(g.children[1].getAttribute('pointer-events'),'none','누르기는 토큰이 받는다');
  const sleeve=g.children[1].children.find(n=>n.attrs.d===J.GEO.c.sleeve);assert.equal(sleeve.attrs.fill,'#c8102e','팀 주색');
  assert.equal(J.decorate(WIN,g,{team:'red',num:'7'}),false,'두 번 얹지 않는다');
  const s=token('shirt');J.decorate(WIN,s,{team:'blue',num:'4'});
  assert.deepEqual(s.children.map(c=>c.attrs.class||c.tagName),['tok-c','ps-jersey','text'],'옛 SHIRT_ACC 선은 빠진다');
  assert.equal(s.children[2].getAttribute('y'),'2.5','셔츠 번호 자리는 그대로');
  const gk=token('circle');J.decorate(WIN,gk,{team:'red',num:'1'});
  assert.equal(gk.children[1].children.find(n=>n.attrs.d===J.GEO.c.sleeve).attrs.fill,'#ffd400','골키퍼는 GK 유니폼');
  const own=token('circle');J.decorate(WIN,own,{team:'red',num:'5',color:'#2f6df0'});
  assert.equal(own.children[1].children.find(n=>n.attrs.d===J.GEO.c.sleeve).attrs.fill,'#2f6df0','토큰 하나만 고른 색');
});

test('decorate leaves coaches, photo tokens and shapers alone',()=>{
  for(const p of [{team:'red',coach:true},{team:'red',img:'data:x'},{team:'red',shaper:true}]){
    const g=token('circle');assert.equal(J.decorate(WIN,g,p),false,JSON.stringify(p));assert.equal(g.querySelector('.ps-jersey'),null);
  }
});

test('3D chip gloss (.ps-c3) is lifted above the jersey so the chip still shines',()=>{
  const g=token('circle');J.decorate(WIN,g,{team:'red',num:'7'});
  const gl=el('circle',g.ownerDocument);gl.setAttribute('class','ps-c3');g.insertBefore(gl,g.children[1]);   // _setChip3d 가 넣는 자리(.tok-c 바로 뒤)
  const root=el('g',g.ownerDocument);root.appendChild(g);
  J.liftGloss(root);
  assert.deepEqual(g.children.map(c=>c.attrs.class||c.tagName),['tok-c','ps-jersey','ps-c3','text']);
});

test('wired into the board: script after the board modules, service worker core, 3D chip lid copies the jersey, board.html budget',()=>{
  const b=read('studio/board.html'),sw=read('sw.js'),dep=read('studio/board-token-depth.js');
  assert.match(b,/<script src="board-jersey\.js"><\/script>/);
  assert.ok(sw.includes("'/studio/board-jersey.js'"),'sw.js CORE');
  assert.match(dep,/original\.querySelector\('\.ps-jersey'\)/,'칩 윗면에도 같은 그림');
  assert.match(dep,/if \(jersey\) lid\.appendChild\(jersey\.cloneNode\(true\)\);/);
  assert.ok(Buffer.byteLength(b)<=2560000,'board.html budget '+Buffer.byteLength(b));
  const src=read('studio/board-jersey.js');
  // 켜질 때 판을 다시 그리지 않는다 — renderTokens 는 끝에서 boardSaveLive 를 불러 부팅 중 저장본 불러오기(restoreLiveBoard)를 멈춘다
  assert.doesNotMatch(src.replace(/\/\/[^\n]*/g,''),/renderTokens\(\)/,'install 에서 renderTokens 를 부르지 않는다');
  assert.match(src,/win\.makeToken = function/);assert.match(src,/D\.apply = function/,'3D 칩은 apply 앞에서 얹는다');assert.match(src,/win\._setChip3d = function/);
});

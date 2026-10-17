const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

/* 3.081 — 커뮤니티를 폰에서 보기 좋게(사용자 «핸드폰으로 보기도 당연히 좋게»). 390px 에서 고르개가 430~520px 를 먹어 카드가 첫 화면 밖으로 밀렸다.
   폰에서는 국면 타일 2×2 를 낮게(설명 줄 숨김) · 주제 · 세부 국면 · 연령/인원은 한 줄씩 옆으로 밀어 보기, 칩을 눌러 다시 그려도 민 자리를 지킨다. */
const root=path.join(__dirname,'..');
const T=require(path.join(root,'studio','community-tax.js'));
const css=fs.readFileSync(path.join(root,'studio','community-tax.css'),'utf8');
const fcss=fs.readFileSync(path.join(root,'studio','community-fifa.css'),'utf8');

test('on phones the picker rows scroll sideways instead of wrapping, and the phase tiles drop their hint line',()=>{
  const m=css.match(/@media \(max-width:560px\)\{([\s\S]*?)\n\}/); assert.ok(m,'폰 블록');
  const b=m[1];
  assert.match(b,/\.tx-tile-hint\{display:none\}/);
  assert.match(b,/\.tx-bar>\.tx-row,\.tx-who\{flex-wrap:nowrap;overflow-x:auto/);
  assert.match(b,/\.tx-bar \.tx-chip,[^{]*\{flex:0 0 auto\}/,'칩은 줄어들지 않는다');
  assert.match(fcss,/\.fi-hero-tx span\{display:-webkit-box;-webkit-line-clamp:2/,'FIFA 안내는 두 줄까지');
});

test('redrawing the picker keeps each row where it was scrolled',()=>{
  const mk=(tag)=>{ const n={tag,children:[],attrs:{},style:{},className:'',textContent:'',scrollLeft:0,
    setAttribute(k,v){ this.attrs[k]=String(v); },getAttribute(k){ return this.attrs[k]; },appendChild(c){ this.children.push(c); c.parentNode=this; return c; },
    querySelectorAll(sel){ const out=[]; const walk=x=>{ (x.children||[]).forEach(c=>{ if(sel==='[data-sx]'&&c.attrs&&c.attrs['data-sx']!=null)out.push(c); walk(c); }); }; walk(this); return out; }};
    Object.defineProperty(n,'textContent',{get(){ return ''; },set(v){ if(v==='')n.children=[]; }}); return n; };
  const doc={createElement:mk,createTextNode:t=>({t})},host=mk('div'); host.ownerDocument=doc;
  T.set({topic:'att',sub:'',age:'',any:true});
  T.draw(host,[],()=>{});
  const rows=()=>Object.fromEntries(host.querySelectorAll('[data-sx]').map(r=>[r.attrs['data-sx'],r]));
  assert.deepEqual(Object.keys(rows()).sort(),['ex','sub:att','who']);
  rows().who.scrollLeft=240; rows()['sub:att'].scrollLeft=80;
  T.draw(host,[],()=>{});
  assert.equal(rows().who.scrollLeft,240,'연령 · 인원 줄'); assert.equal(rows()['sub:att'].scrollLeft,80,'세부 국면 줄');
  T.set({topic:'',sub:''});
});

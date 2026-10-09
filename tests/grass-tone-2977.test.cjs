const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 2.977 — 실사 잔디 톤(사용자 «실사 잔디 색상이 여러가지 — 더 밝거나 더 연하거나», 10월 8일 미팅 21번).
   잔디 사진은 그대로, 밝기 4 × 연하기 4 를 색 행렬 하나로 입힌다. 보드마다(LOOK) 저장된다. */
const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');

function tone(){
  const a=src.indexOf('var GRASS_TONE_B=');
  const b=src.indexOf('function grassToneRender(){',a);
  assert.ok(a>0&&b>a,'tone table + matrix block');
  const c=vm.createContext({window:{__grassTone:'0|0'}});
  vm.runInContext(src.slice(a,b)+';this.grassToneKey=grassToneKey;this.grassToneMatrix=grassToneMatrix;this.grassToneHex=grassToneHex;',c);
  return c;
}
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const lum=h=>{const v=rgb(h);return .299*v[0]+.587*v[1]+.114*v[2];};
const sat=h=>{const v=rgb(h),mx=Math.max(...v);return mx?(mx-Math.min(...v))/mx:0;};   /* 밝기 대비 짙음(HSV 채도) */

test('the default tone leaves the grass photo untouched (identity matrix)',()=>{
  const c=tone();
  assert.deepEqual(Array.from(c.grassToneMatrix('0|0')),[1,0,0,0,0, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0]);
  assert.equal(c.grassToneHex('#1e8c4c','0|0'),'#1e8c4c','thumbnails of default boards keep their colour');
});

test('only the sixteen known tones are accepted — anything else falls back to the default',()=>{
  const c=tone();
  for(const b of ['d','0','l','ll'])for(const p of ['v','0','p','pp'])assert.equal(c.grassToneKey(b+'|'+p),b+'|'+p);
  for(const bad of ['', 'x|0', '0', 'l|p|q', null, 5, undefined])assert.equal(c.grassToneKey(bad===undefined?'zz':bad),'0|0');
});

test('brightness steps get lighter in order, paleness steps get lighter and softer',()=>{
  const c=tone(),base='#5a7a32';
  const L=['d','0','l','ll'].map(b=>lum(c.grassToneHex(base,b+'|0')));
  assert.ok(L[0]<L[1]&&L[1]<L[2]&&L[2]<L[3],'진하게 < 기본 < 밝게 < 아주 밝게 '+L.join(','));
  const P=['0','p','pp'].map(p=>c.grassToneHex(base,'0|'+p));
  assert.ok(lum(P[0])<lum(P[1])&&lum(P[1])<lum(P[2]),'연하게는 더 밝아진다');
  assert.ok(sat(P[0])>sat(P[2]),'아주 연하게는 덜 짙다');
  assert.ok(sat(c.grassToneHex(base,'0|v'))>sat(base),'선명하게는 더 짙다');
});

test('pale grass stays green — the green channel leads (it must not wash out to grey)',()=>{
  const c=tone();
  for(const p of ['p','pp'])for(const b of ['d','0','l','ll']){
    const v=rgb(c.grassToneHex('#50662a',b+'|'+p));   /* 사진 평균 80·102·42 */
    assert.ok(v[1]>v[0]&&v[1]>v[2]&&v[1]-v[2]>=25,b+'|'+p+' → '+v.join(','));
  }
});

test('the tone is a per-board look setting, saved in board defaults, with the two rows under the pitch row',()=>{
  assert.match(src,/function lookKeys\(\)\{return \[[^\]]*"grassTone"\]/,'LOOK key');
  assert.match(src,/case "grassTone":return "0\|0";/,'code default');
  assert.match(src,/grassTone:src\.grassTone\};/,'기본 세팅 snapshot carries it');
  assert.match(src,/id="grassToneBSeg"[\s\S]{0,400}data-gb="ll">아주 밝게/,'brightness row');
  assert.match(src,/id="grassTonePSeg"[\s\S]{0,400}data-gp="pp">아주 연하게/,'paleness row');
  assert.match(src,/"밝기":1,"연하기":1\}/,'rows belong to the pitch tab');
  assert.match(src,/grassBright:"#grassToneBSeg",grassPale:"#grassTonePSeg"/,'shortcut cycles');
  assert.match(src,/var _pid=_gp\.id, _gfc=grassToneHex\("#1e8c4c"\)/,'thumbnail flat grass follows the tone');
});

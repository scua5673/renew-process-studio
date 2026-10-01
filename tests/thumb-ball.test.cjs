'use strict';
/* 2.926 — 썸네일의 공. 실사 공(balls.js AVIF data:)이 2.601 썸네일 다이어트(data: 그림 전부 제거)에 함께 지워져
   보관함 카드·미리보기 재생·PDF 에서 공이 사라졌다(빈 <svg/> 만 남음). 새 썸네일은 벡터 공으로 바꿔 넣고,
   이미 저장된 썸네일은 보여 줄 때(thumbView) 빈 공 자리를 채운다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
function load(){
  const a=src.indexOf('function isBallImgHref(h){'),b=src.indexOf('function thumbView(d){');assert.ok(a>0&&b>a);
  const ctx=vm.createContext({window:{BALL_IMG:{'1970':'data:image/avif;base64,AAA','white':'data:image/avif;base64,BBB'}},
    BALL_SVG_INNER:{'1970':'<defs><radialGradient id="b70spc"/></defs><circle r="1" fill="url(#b70spc)"/>','white':'<defs><linearGradient id="bw"/></defs><use href="#bw"/>'},curBallStyle:'1970'});
  vm.runInContext(src.slice(a,b)+';this.api={isBallImgHref,ballVecInner,thumbBallRepair};',ctx);
  return ctx.api;
}
const EMPTY='<g class="token" data-id="ball" data-kind="ball" transform="translate(621.38,290.57) scale(1.25)"><svg x="-14" y="-14" width="28" height="28" viewBox="0 0 240 240" style="overflow:visible"/></g>';
test('공 사진인지 가린다 — 잔디·선수 사진은 공이 아니다',()=>{
  const api=load();
  assert.equal(api.isBallImgHref('data:image/avif;base64,AAA'),true);
  assert.equal(api.isBallImgHref('data:image/avif;base64,GRASS'),false);
  assert.equal(api.isBallImgHref(''),false);
});
test('같은 무늬의 벡터 공 · id 와 참조에 접미사',()=>{
  const api=load();
  const v=api.ballVecInner('data:image/avif;base64,BBB','_x1');
  assert.match(v,/id="bw_x1"/);assert.match(v,/href="#bw_x1"/);
  const d=api.ballVecInner('data:image/avif;base64,ZZZ','_x2');
  assert.match(d,/id="b70spc_x2"/);assert.match(d,/url\(#b70spc_x2\)/,'모르는 사진이면 지금 고른 공');
});
test('이미 저장된 썸네일의 빈 공을 채운다 — 공마다 다른 id, 회전 유지, 다른 svg 는 그대로',()=>{
  const api=load();
  const f=api.thumbBallRepair(EMPTY+EMPTY);
  assert.equal((f.match(/<defs>/g)||[]).length,2);
  const ids=f.match(/\sid="[^"]+"/g);assert.equal(new Set(ids).size,ids.length);
  assert.doesNotMatch(f,/style="overflow:visible"\/>/);
  const rot=api.thumbBallRepair('<svg x="-14" y="-14" width="28" height="28" viewBox="0 0 240 240" style="overflow:visible"><g transform="rotate(30.0 120 120)"/></svg>');
  assert.match(rot,/<g transform="rotate\(30\.0 120 120\)"><defs>/);
  const other='<svg viewBox="0 0 240 240"><circle r="3"/></svg>';
  assert.equal(api.thumbBallRepair(other),other);
  const filled='<svg x="-14" y="-14" width="28" height="28" viewBox="0 0 240 240" style="overflow:visible"><defs/><circle/></svg>';
  assert.equal(api.thumbBallRepair(filled),filled,'이미 그려진 공은 건드리지 않는다');
});
test('썸네일을 만들 때 공 사진은 벡터로 바꾸고, 다른 data: 그림만 뗀다 · thumbView 가 옛 썸네일을 고친다',()=>{
  assert.match(src,/if\(isBallImgHref\(h\)\)\{ try\{ var _vec=ballVecInner\(h,suf\+'b'\+\(\+\+_bi\)\)/);
  assert.match(src,/n\.parentNode&&n\.parentNode\.removeChild\(n\); \}\); \}catch\(_\)\{\}\n  var _out=new XMLSerializer\(\)/);
  assert.match(src,/function thumbView\(d\)\{\n  var t=d&&d\.thumb; if\(!t\|\|typeof t!=='string'\)return t\|\|""; t=thumbBallRepair\(t\);/);
});

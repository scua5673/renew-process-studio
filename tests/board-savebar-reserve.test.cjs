'use strict';
/* 2.936 — 폰 저장 띠(2.903)의 운동장 아래 자리(psSelBarLayout 68px)를 2.607 데스크톱 감시자가 12px 로 되돌리지 않는다.
   예전엔 감시자 조건이 «ps-dock 아님» 뿐이라 폰에서도 도크가 붙기 전까지 다퉜고, Linux WebKit 에서 운동장이 띠 밑으로 들어갔다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const at=src.indexOf('/* 2.607 — 아래 띠 자리 예약');
const block=src.slice(at,src.indexOf('</script>',at));
test('the 2.607 desktop observer leaves the phone save-bar reserve alone',()=>{
  assert.ok(at>0,'2.607 감시자 블록');
  assert.match(block,/function phoneSaveBar\(\)\{[^}]*ps-savebar[^}]*\(max-width:639px\)/);
  assert.match(block,/if\(!document\.body\.classList\.contains\('ps-dock'\)&&!phoneSaveBar\(\)\)\{/);
});
test('the save-bar condition matches the one _animFitPad uses to restore the reserve',()=>{
  const fit=src.slice(src.indexOf('function _animFitPad'),src.indexOf('window.__animFitPad=_animFitPad'));
  assert.match(fit,/ps-savebar[\s\S]*\(max-width:639px\)[\s\S]*psSelBarLayout/);
});

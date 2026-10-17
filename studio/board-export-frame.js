/* 작전판 영상 내보내기 — 화면(viewBox) 셈 · 여러 페이지 영상의 페이지 이름 자막 설정. DOM 없이 셈만 한다(tests/board-export-frame.test.cjs).
   «화면: 운동장 전체»는 운동장(규격 · 범위 · 개수 · 방향)만 보고 정한다 — 선수 · 그림 · 창 크기는 셈에 들어가지 않는다.
   예전엔 판 밖으로 나간 토큰 · 그림만큼 화면을 넓혀 영상마다 · 페이지마다 운동장 크기와 자리가 조금씩 달랐다(오류 제보 8e143f85). */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSExportFrame=api;
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  /* 운동장 상자 pb=[x0,y0,x1,y1] 둘레에 잔디 m — 짧은 쪽에 m, 긴 쪽은 16:9 가 되도록 양쪽에 똑같이. 가운데 = 운동장 가운데.
     more=[x,y,w,h] 는 운동장 층(멀티피치 카드 · 판 기본 틀)만 — 넘치면 가운데를 지킨 채 넓힌다 */
  function frame169(pb,m,more){
    var cx=(pb[0]+pb[2])/2,cy=(pb[1]+pb[3])/2,pw=pb[2]-pb[0],ph=pb[3]-pb[1],h=ph+2*m,w=h*16/9;
    if(w<pw+2*m){ w=pw+2*m; h=w*9/16; }
    if(more){ var nw=2*Math.max(cx-more[0],more[0]+more[2]-cx),nh=2*Math.max(cy-more[1],more[1]+more[3]-cy);
      if(nw>w+0.5){ w=nw; h=w*9/16; } if(nh>h+0.5){ h=nh; w=h*16/9; } }
    return [cx-w/2,cy-h/2,w,h]; }
  /* 상자 v=[x,y,w,h] 를 가운데 그대로 화면비 ar(가로 ÷ 세로)로 넓힌다(릴스 9:16) */
  function toAr(v,ar){ var x=v[0],y=v[1],w=v[2],h=v[3];
    if(w/h<ar){ var nw=h*ar; x-=(nw-w)/2; w=nw; } else { var nh=w/ar; y-=(nh-h)/2; h=nh; }
    return [x,y,w,h]; }
  /* 오류 제보 178c465c — 여러 페이지 영상에 페이지 이름을 아래 자막으로 넣을지. 처음엔 넣는다(예전 그대로) · 고른 쪽은 이 기기에 기억 */
  var CAP_KEY='ps_anim_export_pgcap_v1';
  function capOn(ls){ try{ return (ls||localStorage).getItem(CAP_KEY)!=='0'; }catch(_){ return true; } }
  function capSave(on,ls){ try{ (ls||localStorage).setItem(CAP_KEY,on?'1':'0'); }catch(_){} }
  return {frame169:frame169,toAr:toAr,capOn:capOn,capSave:capSave,CAP_KEY:CAP_KEY};
});

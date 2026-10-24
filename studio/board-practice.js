/* 공식 훈련의 골문 치수와 읽기 전용 설명. 기존 사용자 보드는 anchor가 없으면 원래 규칙을 따른다. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root){root.PSPracticeBoard=api;api.install(root);}})(typeof window==='undefined'?null:window,function(){
 'use strict';
 function goalTransform(p){
  if(!p)return null;
  if(p.anchor==="mouth"&&/^(goal|goalH|goalV|minigoal|minigoalV)$/.test(p.team)&&+p.mouthWidth>0){
    const mini=/^minigoal/.test(p.team),vertical=/V$/.test(p.team),d=mini?8:13,span=mini?26:44,k=+p.scale||1;
    const width=+p.mouthWidth/span*k,depth=(+p.mouthDepth>0?+p.mouthDepth/(2*d):+p.mouthWidth/span)*k;
    const sx=vertical?depth:width,sy=vertical?width:depth,rot=+p.rot||0,a=rot*Math.PI/180;
    const mx=vertical?-d*sx:0,my=vertical?0:d*sy;
    return `translate(${p.x-(mx*Math.cos(a)-my*Math.sin(a))},${p.y-(mx*Math.sin(a)+my*Math.cos(a))})`+(rot?` rotate(${rot})`:"")+` scale(${sx},${sy})`;
  }
  return null;
 }
 function install(win){
  var doc=win.document;
  var style=doc.createElement('style');style.textContent='body.comm-viewing #cmd-dock-fold{display:none!important}';doc.head.appendChild(style);
  function boot(){
   var view=win.__commView;if(typeof view!=='function')return;
   win.__commView=function(post){var result=view.apply(this,arguments);
    if(post&&post.proc)doc.querySelectorAll('.ep-ro-text').forEach(function(t){
     var text=t.textContent;if(!/^(목적|관찰 단서)\n/.test(text))return;
     var heads=["목적", "준비", "진행·득점", "재시작·교대 · 운영 보완", "난이도 조절", "관찰 단서", "핵심 지도", "현장 개입 · 운영 보완", "다시 확인"];t.textContent='';text.split('\n').forEach(function(line,i){if(i)t.appendChild(doc.createTextNode('\n'));if(heads.indexOf(line)>=0){var h=doc.createElement('strong');h.textContent=line;t.appendChild(h);}else t.appendChild(doc.createTextNode(line));});
    });return result;
   };
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot);else boot();
 }
 return {goalTransform:goalTransform,install:install};
});

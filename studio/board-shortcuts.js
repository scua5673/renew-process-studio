/* 3.143 — 보드 단축키 표에 등록한다. 저장·키 충돌·입력 중 보호는 기존 편집기가 맡는다. 3.311 — 그리기 단축키 여섯(drawAct). */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSBoardShortcuts=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  /* 3.311 — 그리기 단축키 여섯(제보 5588062b «점선 연결선 · 점선 다각형 · 로빙 패스 단축키» · a2f004f9 «선수 놓기 · 선 스타일 · 저장 팀 불러오기 단축키» · e4b723a1 «도형만 모두 지우기»).
     기본 키는 비워 둔다(3.168 과 같이) — 보드 설정 › 단축키 › 보드에서 고른다. 점선 · 로빙은 새로 그릴 기본값을 바꾸고(«선 스타일» 창과 같은 규칙) 고른 그림에도 바로 먹는다. */
  var actions={pitchPhoto:'운동장 사진 고르기',pageAdd:'새 페이지 추가',pagePrev:'이전 페이지',pageNext:'다음 페이지',resetLaterSelection:'이후 장면 리셋 — 선택한 토큰·도구',
    lineStyleOpen:'선 스타일 열기·닫기',lineDashToggle:'선 모양 — 점선 ↔ 실선',passLobToggle:'패스 — 로빙 ↔ 땅볼',playersOpen:'선수 놓기 열기·닫기',teamLoadOpen:'저장 팀 불러오기',drawingsClear:'이 장면의 그림 모두 지우기'};
  var DRAW={lineStyleOpen:1,lineDashToggle:1,passLobToggle:1,playersOpen:1,teamLoadOpen:1,drawingsClear:1};
  function press(d,id){var b=d&&d.getElementById(id);if(!b||b.disabled)return false;try{b.click();}catch(_){return false;}return true;}
  function call(w,name){try{if(typeof w[name]==='function')return w[name].apply(w,[].slice.call(arguments,2));}catch(_){}}
  function say(w,m){call(w,'toast',m);}
  function stateOf(w){ if(w&&w.state&&typeof w.state==='object')return w.state; try{ return (typeof state!=='undefined'&&state&&typeof state==='object')?state:null; }catch(_){ return null; } }
  // 고른 그림(둘 이상이면 묶음 · 아니면 하나) — «선 스타일» 창의 selDraws 와 같은 규칙. 본문의 sel · multiSel 은 let 이라 이름으로 읽는다.
  function selDrawings(w,S){ var out=[],ds=(S&&S.drawings)||[],m=null,s=null;
    try{ m=(w&&w.multiSel!==undefined)?w.multiSel:(typeof multiSel!=='undefined'?multiSel:null); }catch(_){}
    try{ s=(w&&w.sel!==undefined)?w.sel:(typeof sel!=='undefined'?sel:null); }catch(_){}
    if(m&&m.length)m.forEach(function(o){ if(o&&o.type!=='text'&&ds.indexOf(o)>=0)out.push(o); });
    if(!out.length&&s&&s.type==='drawing'&&s.ref&&s.ref.type!=='text'&&ds.indexOf(s.ref)>=0)out.push(s.ref);
    return out; }
  function drawAct(w,d,id){
    if(id==='lineStyleOpen'){ press(d,'lineStyleBtn'); return; }
    if(id==='playersOpen'){ if(!press(d,'ps-df-team'))press(d,'benchTog'); return; }
    if(id==='teamLoadOpen'){ call(w,'openAnalysisTeamLibrary'); return; }
    if(id==='drawingsClear'){ if(press(d,'clearDrawBtn'))say(w,'이 장면의 그림을 모두 지웠어요 — 되돌리기는 ⌘Z'); return; }
    var S=stateOf(w); if(!S)return; var sd=selDrawings(w,S),SM=w.PSShapeMenu;
    if(id==='lineDashToggle'){
      var nv=(S.drawLineStyle==='dash')?'solid':'dash'; S.drawLineStyle=nv;
      if(sd.length&&SM&&SM.setLineStyle){ call(w,'pushUndo'); sd.forEach(function(o){ SM.setLineStyle(o,nv); }); call(w,'renderDrawings'); call(w,'autoSaveAnimFrame'); call(w,'boardSaveLive'); }
      say(w,nv==='dash'?(sd.length?'점선으로 그립니다 · 고른 그림도 점선':'점선으로 그립니다'):(sd.length?'실선으로 그립니다 · 고른 그림도 실선':'실선으로 그립니다'));
    }else if(id==='passLobToggle'){
      var on=!S.drawLob; S.drawLob=on; var ps=sd.filter(function(o){return o.type==='pass';});
      if(ps.length){ call(w,'pushUndo'); ps.forEach(function(o){ if(on)o.lob=true; else delete o.lob; }); call(w,'renderDrawings'); call(w,'autoSaveAnimFrame'); call(w,'boardSaveLive'); }
      say(w,on?(ps.length?'로빙 패스로 그립니다 · 고른 패스도 로빙':'로빙 패스로 그립니다'):(ps.length?'땅볼 패스로 그립니다 · 고른 패스도 땅볼':'땅볼 패스로 그립니다'));
    }else return;
    if(d&&d.getElementById('lsPop')){ press(d,'lineStyleBtn'); press(d,'lineStyleBtn'); }   // 열려 있던 «선 스타일» 창은 닫았다 열어 표시를 맞춘다
  }
  function run(w,id){
    if(!Object.prototype.hasOwnProperty.call(actions,id))return false;
    var d=w.document,b=d.body,p=w.__psPages,view=w.__csView||'board';
    if(!b||w.__animExport||w.__psThumbCapturing||w.__vaultReadOnly||b.classList.contains('comm-viewing')||b.classList.contains('ps-capturing'))return true;
    if(id==='resetLaterSelection'){
      var active=d.activeElement;
      if(active&&(active.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)))return true;
      if((view==='board'||view==='session')&&w.__psShapeMenu)w.__psShapeMenu.resetSelection();
      return true;
    }
    if(DRAW[id]){
      if(view!=='board'&&view!=='session')return true;
      var ae=d.activeElement; if(ae&&(ae.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)))return true;
      drawAct(w,d,id); return true;
    }
    if(id==='pitchPhoto'){
      if((view==='board'||view==='session')&&w.PSPitchPhoto)w.PSPitchPhoto.pick();
      return true;
    }
    // 미팅·훈련 편집·패턴북은 각자 페이지를 소유한다. 작업 보드 묶음에 닿지 않는다.
    if(view!=='board'||b.classList.contains('meet-mode')||b.classList.contains('editing')||w.__vaultBook||!p||(p.lent&&p.lent()))return true;
    if(id==='pageAdd'){
      var add=d.getElementById('bpAddPage');
      if(add&&!add.disabled&&add.getClientRects().length)add.click();
    }else if(p.pageNav)p.pageNav(id==='pagePrev'?-1:1);
    return true;
  }
  var animActions={animFirst:'맨 처음 장면',animLast:'맨 마지막 장면'};
  if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',function(){
    var previous=runAnimAct;runAnimAct=function(id){
      if(id!=='animFirst'&&id!=='animLast')return previous.apply(this,arguments);
      if(!anim.frames.length)return; if(animPlaying)stopAnim();
      selectAnimFrame(id==='animFirst'?0:anim.frames.length-1,true);
    };
  });
  return {actions:actions,animActions:animActions,defaults:{animFirst:'home',animLast:'end',resetLaterSelection:'',lineStyleOpen:'',lineDashToggle:'',passLobToggle:'',playersOpen:'',teamLoadOpen:'',drawingsClear:''},run:run};
});

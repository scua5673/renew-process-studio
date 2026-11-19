/* PROCESS STUDIO — 작전판 애니메이션 «일시 정지»(3.335 · 제보 a076fa6e «재생 중 일시정지했을 때 그 화면에서 멈췄으면»)
   예전: 재생 중 단추의 이름표는 «일시 정지»인데 누르면 playAnim() → stopAnim() 이 불려 재생 전 화면으로 돌아갔다.
   커뮤니티 보기 · 보관함 카드 · 훈련 보기는 2.x 부터 «일시정지 = 그 자리 · 정지 = 처음으로»를 나눴고, 작전판 편집 화면만 빠져 있었다.

   이제: 재생 중 ⏸ → 그 순간의 화면에서 멈춤 · ▶ → 멈춘 곳부터 이어서 · ■(재생하는 동안만 보임) → 재생 전 화면으로.

   ⚠ 멈춘 동안에도 animPlaying 은 true 로 둔다. 재생 중의 중간 위치는 보드 상태(state)에 실제로 들어가 있고,
     자동 저장(autoSaveAnimFrame) · 작업 보드 초안(boardDraftBusy) · 보관함 자동 저장 · 키트 전파 · 뷰 스냅이 모두
     «animPlaying 이면 손대지 않는다»로 지켜진다. 멈춤을 animPlaying=false 로 만들면 중간 위치가 지금 장면에 저장된다(2.525 와 같은 꼴).
     그래서 멈춤 = 그림 그리기(requestAnimationFrame)만 쉬는 것이다. 장면 넘기기 · 장면 추가 · 내보내기 · 화면 바꾸기처럼
     원래 재생을 끝내던 동작은 지금처럼 stopAnim() 으로 재생 전 화면을 되살린다.
   ⚠ 멈춘 화면에서 운동장을 누르면 먼저 재생 전 장면으로 돌아가고, 그 누름은 쓰지 않는다(중간 위치를 끌어 고치면 되살릴 때 사라진다).
     다른 단추 · 키는 재생 전 장면으로 돌린 뒤 하던 일을 그대로 한다.
   ⚠ 이어 재생은 재생 전 화면을 먼저 되돌린 뒤 playAnim 의 이어 가기(animPaused)를 쓴다 — playAnim 첫 줄의 autoSaveAnimFrame() 이
     중간 위치가 아니라 원래 장면을 적게 하려는 것.
   board.html 은 크기 예산 때문에 스크립트 줄 하나만 갖고, 전역(animPlaying · animRaf · animPauseState · animPaused · loadSnap · toast)은
   같은 문서의 다른 스크립트라 이름으로 읽는다(board-broadcast.js 와 같은 방식). 시험은 rt 를 넘겨 가짜로 돌린다. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PSAnimPause=api;
})(typeof self!=='undefined'?self:this,function(){
  var PLAY_SVG='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  var STOP_SVG='<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>';
  var RESUME='이어서 재생',STOP='정지 · 재생 전 화면으로';
  /* 멈춘 화면에서 눌러도 재생 상태를 건드리지 않는 것 — 재생 단추 셋 · 속도 · 유지 시간 */
  var KEEP='#animPlay,#animStop,#animLoopBtn,#animSpeedSel,#animHoldSel';
  /* 멈춘 동안 판을 고치는 키 — 먼저 재생 전 장면으로. 다른 키(재생 단축키 «p» · 도구 · 장면 추가 …)는 제 처리기에 맡긴다
     (장면을 바꾸는 단추들은 원래 stopAnim 을 먼저 부른다). Esc 는 «정지». */
  var EDIT_KEYS={Delete:1,Backspace:1,ArrowUp:1,ArrowDown:1,ArrowLeft:1,ArrowRight:1,Escape:1};

  /* 재생 단추를 눌렀을 때 할 일 — 순수 판정 */
  function decide(s){
    if(s&&s.held)return 'resume';
    if(s&&s.playing)return s.canHold?'hold':'stop';
    return 'play';
  }

  /* 실제 작전판 전역을 읽고 쓰는 길 */
  /* global animPlaying, animRaf, animPauseState, animPaused, loadSnap, toast */
  function globalsRt(w){
    return {
      playing:function(){ return typeof animPlaying!=='undefined'&&!!animPlaying; },
      pauseState:function(){ return typeof animPauseState!=='undefined'?animPauseState:null; },
      freeze:function(){
        if(typeof animRaf!=='undefined'&&animRaf){ if(typeof w.cancelAnimationFrame==='function')w.cancelAnimationFrame(animRaf); animRaf=null; }
      },
      prepResume:function(h){
        if(h.restore&&typeof loadSnap==='function')loadSnap(h.restore);
        animPlaying=false; animRaf=null;
        animPaused={s:h.s,phase:h.phase,elapsed:h.elapsed,restore:h.restore};
      },
      toast:function(t){ if(typeof toast==='function')toast(t); }
    };
  }

  function install(w,rt){
    if(!w)return null;
    if(w.__psAnimPause)return w.__psAnimPause;
    var orig={play:w.playAnim,stop:w.stopAnim,ui:w.updatePlayUI};
    if(typeof orig.play!=='function'||typeof orig.stop!=='function')return null;
    rt=rt||globalsRt(w);
    var held=null;

    function doc(){ return w.document||null; }
    function stopButton(d,play){
      var s=d.getElementById('animStop');
      if(s||!play||!play.parentNode)return s||null;
      s=d.createElement('button');s.type='button';s.className='btn anim-ico';s.id='animStop';
      s.title=STOP;s.setAttribute('aria-label',STOP);s.innerHTML=STOP_SVG;
      s.onclick=function(e){ if(e&&e.preventDefault)e.preventDefault(); w.stopAnim(); };
      play.parentNode.insertBefore(s,play.nextSibling);
      return s;
    }
    function paint(){
      var d=doc();if(!d||!d.getElementById)return;
      var b=d.getElementById('animPlay');if(!b)return;
      if(held){ b.innerHTML=PLAY_SVG;b.title=RESUME;b.setAttribute('aria-label',RESUME);b.setAttribute('aria-pressed','false'); }
      var s=stopButton(d,b),on=rt.playing();
      if(s){
        s.hidden=!on;
        /* 떠 있는 도크의 장면 줄 규칙이 단추 display 를 !important 로 박는다 — 숨김도 important 로 */
        if(s.style&&s.style.setProperty){ if(on)s.style.removeProperty('display'); else s.style.setProperty('display','none','important'); }
      }
      if(d.body&&d.body.classList)d.body.classList.toggle('anim-held',!!held);
    }
    function hold(){
      if(held||!rt.playing())return false;
      var st=rt.pauseState();if(!st)return false;   /* 첫 그림 전이면 멈출 자리가 없다 — 예전처럼 정지 */
      held={s:st.s,phase:st.phase,elapsed:st.elapsed,restore:st.restore};
      rt.freeze();paint();
      return true;
    }
    function resume(){
      if(!held)return false;
      var h=held;held=null;
      rt.prepResume(h);
      orig.play.call(w);
      paint();
      return true;
    }
    function playWrapped(){
      var a=decide({playing:rt.playing(),held:!!held,canHold:!!rt.pauseState()});
      if(a==='resume')return resume();
      if(a==='hold'&&hold())return;
      return orig.play.apply(this,arguments);
    }
    function stopWrapped(){
      held=null;
      var r=orig.stop.apply(this,arguments);
      paint();
      return r;
    }
    w.playAnim=playWrapped;
    w.stopAnim=stopWrapped;
    if(typeof orig.ui==='function')w.updatePlayUI=function(){ var r=orig.ui.apply(this,arguments);paint();return r; };

    var d=doc();
    if(d&&d.addEventListener){
      d.addEventListener('pointerdown',function(e){
        if(!held)return;
        var t=e&&e.target;
        if(t&&t.closest&&t.closest(KEEP))return;
        var pitch=!!(t&&t.closest&&t.closest('svg.board'));
        w.stopAnim();
        if(pitch){
          if(e.preventDefault)e.preventDefault();
          if(e.stopImmediatePropagation)e.stopImmediatePropagation();
          if(e.stopPropagation)e.stopPropagation();
          rt.toast('재생 전 장면으로 돌아왔어요');
        }
      },true);
      d.addEventListener('keydown',function(e){
        if(!held||!e||!EDIT_KEYS[e.key])return;
        w.stopAnim();
      },true);
    }
    paint();
    var api={held:function(){ return !!held; },hold:hold,resume:resume,paint:paint};
    w.__psAnimPause=api;
    return api;
  }

  /* 작전판에서 건다 — 이 파일은 본문 스크립트(playAnim · stopAnim · updatePlayUI) 앞에서 읽히므로 DOMContentLoaded 에.
     본문 함수가 이미 있으면(다시 읽힌 경우) 바로. 작전판이 아닌 문서는 playAnim 이 없어 아무것도 안 한다. */
  if(typeof window!=='undefined'&&window.document){
    var go=function(){
      if(typeof window.playAnim!=='function')return;
      try{ install(window); }catch(e){ if(window.console)window.console.warn('[anim-pause]',e); }
    };
    if(typeof window.playAnim==='function'||window.document.readyState!=='loading')go();
    else window.document.addEventListener('DOMContentLoaded',go);
  }
  return {decide:decide,install:install,globalsRt:globalsRt};
});

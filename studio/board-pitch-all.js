/* PROCESS STUDIO — 피치는 작업물 하나에 하나(3.088). 오류 제보 934aaa3e «보드 설정에서 운동장 스타일을 수정하면, 해당 페이지 뿐만 아니라
   모든 페이지가 적용돼야 편리할 것 같습니다» · 83a6a38b «미팅 운동장 디자인을 … 일일이 하나하나 다 변경하는게 불편».
   보드 설정의 겉모습(토큰 크기 · 잔디 줄무늬 · 라인 · 전술 구역 …)은 3.017 부터 작업물 하나에 하나(_lookStampPages)인데, 피치(잔디 · 딥그린 · 네이비 ·
   화이트 · 훈련 · 사용자 색 · 실사 바탕 — pitchTheme · pitchCustom · pitchImg)만 페이지(스냅)마다 따로 남았다. 2.982 는 사람이 고른 피치를
   «이 애니메이션의 모든 장면»에만 넣었다(_viewScenesMatch("pitch")).
   - 사람이 피치를 고를 때만 넓힌다 — 보드의 _viewScenesMatch("pitch") 는 피치 단추 · 색 고르개를 사람이 눌렀을 때만 불린다(부팅 · 복원 · 페이지 넘기기는 아니다).
     «내 스타일» 적용(lookPresetApply)도 피치를 바꾸므로 같은 길로 넓힌다.
   - 작전판: 지금 페이지 밖 모든 페이지의 판과 장면(__psPages.eachOther — 썸네일을 한 박자 뒤 다시 그리고 저장한다).
   - 미팅(운동장 편집): 지금 슬라이드 밖 모든 슬라이드의 판과 장면(__meet) — 슬라이드 그림도 다시 그린다.
   - 규격 · 범위 · 방향은 페이지마다 다르게 쓰는 값이라 그대로 둔다. 보기 전용(커뮤니티 · 보관함 보기) · 재생 · 내보내기 중에는 하지 않는다.
   보드의 함수 선언(window 속성)을 감싼다 — 보드 안의 호출도 전역 이름으로 찾으므로 감싼 것을 지난다. let 전역(anim · animPlaying)은 이름으로 읽는다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSPitchAll = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var KEYS = ['pitchTheme', 'pitchCustom', 'pitchImg'];

  // 견줄 때의 값 — 보드의 _viewVal 과 같은 규칙(네이비 = '' · 없음 = null). 사용자 색(객체)은 글로 견준다
  function norm(k, v) {
    if (k === 'pitchTheme') return (v === undefined || v === null) ? null : (v === 'navy' ? '' : String(v));
    if (v === undefined || v === null || v === '') return null;
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  }
  function clone(v) { return (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v; }
  // 스냅 하나에 지금 피치를 넣는다. 바뀌었으면 true
  function stamp(sn, cur) {
    if (!sn || typeof sn !== 'object' || !cur) return false;
    var ch = false;
    KEYS.forEach(function (k) { if (norm(k, sn[k]) !== norm(k, cur[k])) { sn[k] = clone(cur[k] === undefined ? null : cur[k]); ch = true; } });
    return ch;
  }
  // 판 하나와 그 장면들 — 바뀐 장면은 그림을 비운다(장면 줄이 볼 때 다시 그린다)
  function stampWithFrames(sn, frames, cur) {
    var ch = stamp(sn, cur);
    (Array.isArray(frames) ? frames : []).forEach(function (f) { if (f && stamp(f.snap, cur)) { delete f.thumb; ch = true; } });
    return ch;
  }
  // 알림 — «피치를 페이지 9개 · 장면 6개에 모두 적용했어요»
  function note(what, r) {
    var p = [];
    if (r && r.pages) p.push('페이지 ' + r.pagesTotal + '개');
    if (r && r.slides) p.push('슬라이드 ' + r.slidesTotal + '장');
    if (r && r.n) p.push('장면 ' + r.total + '개');
    return p.length ? what + ' ' + p.join(' · ') + '에 모두 적용했어요' : '';
  }

  function playing() { try { return typeof animPlaying !== 'undefined' && !!animPlaying; } catch (_) { return false; } }   /* global animPlaying */
  function quiet(win) {
    var b = win.document && win.document.body;
    return !!(win.__vaultReadOnly || win.__animExport || playing() || (b && b.classList.contains('comm-viewing')));
  }
  // 지금 판의 피치를 다른 페이지 · 슬라이드에. { pages, pagesTotal, slides, slidesTotal }
  function spread(win) {
    var out = { pages: 0, pagesTotal: 0, slides: 0, slidesTotal: 0 };
    if (quiet(win) || typeof win.captureSnap !== 'function') return out;
    var cur; try { cur = win.captureSnap(); } catch (_) { return out; }
    var P = win.__psPages;
    try {
      if (P && typeof P.eachOther === 'function') {
        out.pages = P.eachOther(function (sn, frames) { return stampWithFrames(sn, frames, cur) ? 1 : 0; }) || 0;
        if (out.pages) { try { out.pagesTotal = (P.book && P.book.count) ? P.book.count() : out.pages + 1; } catch (_) { out.pagesTotal = out.pages + 1; } }
      }
    } catch (_) {}
    try {
      var b = win.document.body, M = win.__meet;
      if (M && b.classList.contains('meet-mode') && typeof M.frames === 'function') {
        var sl = M.frames() || [], mi = M.idx(), dirty = [];
        sl.forEach(function (s, i) { if (s && i !== mi && stampWithFrames(s.snap, s.frames, cur)) dirty.push(i); });
        if (dirty.length) {
          out.slides = dirty.length; out.slidesTotal = sl.length;
          // 슬라이드 그림은 판을 잠깐 바꿔 그린다 — 하던 일(이 클릭) 한가운데서 하지 않고 한 박자 뒤에
          win.setTimeout(function () {
            dirty.forEach(function (i) { var s = sl[i]; try { if (s && s.snap && typeof win.__snapToThumb === 'function') { var t = win.__snapToThumb(s.snap); if (t) s.thumb = t; } } catch (_) {} try { if (win.__ksThumb) win.__ksThumb(i); } catch (_) {} });
            try { if (win.__vaultAutoSaveSchedule) win.__vaultAutoSaveSchedule(); } catch (_) {}
            try { if (typeof win.boardSaveLive === 'function') win.boardSaveLive(); } catch (_) {}
          }, 0);
        }
      }
    } catch (_) {}
    return out;
  }

  function install(win) {
    if (!win || win.__psPitchAll) return false;
    var match = win._viewScenesMatch, toast = win._viewScenesToast, preset = win.lookPresetApply;
    if (typeof match !== 'function' || typeof toast !== 'function') return false;
    win.__psPitchAll = true;
    win._viewScenesMatch = function (kind) {
      var r = match.apply(this, arguments);
      if (kind !== 'pitch') return r;
      var s = spread(win), o = {}; for (var k in (r || {})) o[k] = r[k];
      o.pages = s.pages; o.pagesTotal = s.pagesTotal; o.slides = s.slides; o.slidesTotal = s.slidesTotal;
      return o;
    };
    win._viewScenesToast = function (r, what) {
      if (r && (r.pages || r.slides)) { try { if (typeof win.toast === 'function') win.toast(note(what, r)); } catch (_) {} return r; }
      return toast.apply(this, arguments);
    };
    // «내 스타일» 적용 — 피치도 바꾸므로 장면 · 페이지 · 슬라이드에(사람이 고른 것이다)
    if (typeof preset === 'function') {
      win.lookPresetApply = function () {
        var ok = preset.apply(this, arguments);
        if (ok) { try { var r = win._viewScenesMatch('pitch'); if (r && (r.pages || r.slides || r.n) && typeof win.toast === 'function') win.toast(note('설정의 피치를', r)); } catch (_) {} }
        return ok;
      };
    }
    return true;
  }
  function boot(win) {
    var n = 0;
    (function tryIt() { if (install(win)) return; if (++n < 40) win.setTimeout(tryIt, 250); })();
  }
  if (typeof window !== 'undefined' && window.document && /\/studio\/board\.html/.test(String(window.location && window.location.pathname))) {
    if (window.document.readyState === 'loading') window.document.addEventListener('DOMContentLoaded', function () { boot(window); }); else boot(window);
  }
  return { KEYS: KEYS, norm: norm, stamp: stamp, stampWithFrames: stampWithFrames, note: note, spread: spread, install: install };
});

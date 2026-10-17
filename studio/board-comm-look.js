/* PROCESS STUDIO — 커뮤니티 뷰어 «보기» 고르개(3.087). 사용자 «커뮤니티에 있는 것들 볼 때 … 원하는 형태로 볼 수 있게 해줘 ·
   3d나 평면이나 사람모향이나 원형이나 이런 것들 선택할수 있게». 3.067 의 «3D» 단추(판 오른쪽 위) 자리를 넓혔다.
   - 화면: 평면 · 3D. 폰은 3D 가 없다(3.069 — 3D 를 그리다 강제 종료).
   - 선수 모양: 올린 그대로 · 원형 · 유니폼 · 사람 · 쉐이퍼. «사람»은 3D 에서 서 있는 선수라(평면은 유니폼) 평면에서 고르면 3D 도 켠다. 폰에는 «사람»이 없다.
   - 보기만 바꾼다 — 글 · 보드 설정 값(ps_board_tilt3d · 기기 기본 모양 cs_board_lookdef_v1)은 그대로. 3D 는 __setTilt(…,{transient}), 모양은 tokShape 만.
   - 고른 것은 이 기기에 남아(ps_comm_look_v1) 다음 글도 그렇게 열린다(커뮤니티는 글마다 이 판을 새로 띄운다).
     터치 기기(아이패드)의 3D 는 남기지 않는다 — 3D 로 열다 멈추는 기기는 글을 열 때마다 같은 자리에서 멈춘다(3.033: 곁 보드는 터치 기기에서 평면으로 연다).
   보드 쪽은 세 군데만: 글을 싣기 전 prime(모양을 window.__commWantShape 에 — loadSnap 이 장면마다 지킨다), 글을 다 실은 뒤 mount, 닫을 때 고르개를 걷는다(__commTiltOff).
   보드의 함수 선언(window 속성)은 win 으로, let 전역(tokShape)은 이름으로 읽고 쓴다(eval 없이 — CSP). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSCommLook = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var KEY = 'ps_comm_look_v1';
  var SHAPES = ['circle', 'shirt', 'person', 'shaper'];
  var NAME = { circle: '원형', shirt: '유니폼', person: '사람', shaper: '쉐이퍼' };

  // ── 기기에 남긴 보기 ── { shape: '' | 원형 … , tilt: '' | '3d' | 'flat' } — '' 는 «올린 그대로»(모양) · «정하지 않음»(화면)
  function read(ls) {
    var o = null; try { o = JSON.parse(ls.getItem(KEY) || 'null'); } catch (_) { o = null; }
    o = o && typeof o === 'object' ? o : {};
    return { shape: SHAPES.indexOf(o.shape) >= 0 ? o.shape : '', tilt: o.tilt === '3d' || o.tilt === 'flat' ? o.tilt : '' };
  }
  function write(ls, o) { try { ls.setItem(KEY, JSON.stringify({ shape: o.shape || '', tilt: o.tilt || '' })); } catch (_) {} }

  // ── 기기 ── phone: 3D · «사람» 없음. touch: 3D 를 기기에 남기지 않는다(폰도 터치)
  function device(win) {
    var top = ''; try { top = win.top.document.documentElement.getAttribute('data-ps-device') || ''; } catch (_) { top = ''; }
    var phone = top === 'phone';
    if (!phone) { try { phone = typeof win.psBoardDevice === 'function' && win.psBoardDevice() === 'phone'; } catch (_) {} }
    var touch = top ? top !== 'desktop' : (((win.navigator && win.navigator.maxTouchPoints) || 0) > 0);
    return { phone: phone, touch: touch || phone };
  }
  function can3d(dev, win) { return !dev.phone && !!(win && win.__setTilt && win.PSBoardDepth); }
  function shapesFor(dev) { return SHAPES.filter(function (s) { return !(dev.phone && s === 'person'); }); }
  // 폰의 «사람»은 유니폼으로 그린다(평면에선 같은 그림) — 고른 값(기기에 남은 것)은 그대로 둔다
  function shown(shape, dev) { return dev.phone && shape === 'person' ? 'shirt' : (shape || ''); }

  // ── 누르면 무엇이 바뀌나 ── pick: { tilt: '3d' | 'flat' } 또는 { shape: '' | 원형 … }
  //   돌려주는 것: on(3D 를 켜고/끈다, null = 그대로) · shape(바꿀 모양, null = 그대로, '' = 올린 그대로) · pref(기기에 남길 것)
  function choose(cur, pick, dev, threeD) {
    var pref = { shape: (cur.pref && cur.pref.shape) || '', tilt: (cur.pref && cur.pref.tilt) || '' }, on = null, shape = null;
    if (pick.tilt) {
      if (!threeD) return { on: null, shape: null, pref: pref };
      on = pick.tilt === '3d'; if (!dev.touch) pref.tilt = pick.tilt;
    } else if (pick.shape != null) {
      shape = SHAPES.indexOf(pick.shape) >= 0 ? pick.shape : ''; pref.shape = shape;
      if (shape === 'person' && threeD && !cur.is3d) { on = true; if (!dev.touch) pref.tilt = '3d'; }   // 사람은 3D 에서 선다
    }
    return { on: on, shape: shape, pref: pref };
  }
  // 단추 글: «3D · 사람» · 폰은 모양만
  function summary(dev, threeD, is3d, shape) { var s = shown(shape, dev); return (threeD ? (is3d ? '3D' : '평면') + ' · ' : '') + (s ? NAME[s] : '올린 그대로'); }
  function hint(dev, is3d, drawn) {
    var h = (!dev.phone && !is3d && drawn === 'person') ? '사람은 3D 에서 서 있는 선수로 보여요 — 평면에서는 유니폼이에요. ' : '';
    h += dev.phone ? '고른 모양은 다음 글에도 그대로 열려요.' : (dev.touch ? '고른 모양은 다음 글에도 그대로예요 · 3D 는 글마다 켜요.' : '고른 보기는 다음 글에도 그대로 열려요.');
    return h + ' 글은 바뀌지 않아요.';
  }

  // ── 모양 ── 판 위 어두운 유리(재생 단추 #commPlayControls 와 같은 결). 값은 tokens.css(--t-* · --sp-* · --r-* · --sh-*)
  function css() {
    var R = '#commLook';
    return [
      R + '{position:absolute;top:10px;right:max(10px,env(safe-area-inset-right));z-index:7;font-family:inherit}',
      R + ' #commLookBtn{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 13px 0 11px;border:0;border-radius:var(--r-pill,999px);background:rgba(10,16,28,.62);color:rgba(255,255,255,.98);font-family:inherit;font-weight:var(--fw-head,800);font-size:var(--t-5,14px);white-space:nowrap;cursor:pointer;box-shadow:0 6px 16px rgba(0,0,0,.28);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}',
      R + ' #commLookBtn svg{width:16px;height:16px;flex:none}',
      R + ' #commLookBtn .cl-now{font-size:var(--t-3,12px);font-weight:600;opacity:.78}',
      R + ' #commLookBtn[aria-expanded="true"]{background:var(--blue,var(--ps-navy,rgba(20,33,61,1)))}',
      R + ' #commLookPop{position:absolute;top:44px;right:0;width:min(300px,calc(100vw - 20px));box-sizing:border-box;padding:var(--sp-3,12px);border-radius:var(--r-card,12px);color:rgba(255,255,255,.98);background:rgba(14,20,32,.92);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:var(--sh-3,0 24px 48px rgba(16,24,40,.22)),0 0 0 1px rgba(255,255,255,.06)}',
      R + ' #commLookPop[hidden]{display:none}',
      R + ' .cl-h{margin:0 2px 6px;font-size:var(--t-2,11px);font-weight:700;color:rgba(255,255,255,.62)}',
      R + ' .cl-seg{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--sp-1,4px);padding:3px;border-radius:var(--r-2,10px);background:rgba(255,255,255,.08)}',
      R + ' .cl-seg+.cl-h{margin-top:var(--sp-3,12px)}',
      R + ' .cl-o{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--sp-1,4px);min-width:0;min-height:54px;padding:6px 4px;border:0;border-radius:var(--r-1,6px);background:transparent;color:rgba(255,255,255,.86);font-family:inherit;font-size:var(--t-3,12px);font-weight:700;line-height:1.1;cursor:pointer}',
      R + ' .cl-tilt .cl-o,' + R + ' .cl-o.cl-orig{flex-direction:row;gap:6px;min-height:40px}',
      R + ' .cl-o.cl-orig{grid-column:1/-1}',
      R + ' .cl-o.cl-orig small{font-size:var(--t-2,11px);font-weight:600;opacity:.66}',
      R + ' .cl-o svg{width:20px;height:20px;flex:none}',
      R + ' .cl-o:hover{background:rgba(255,255,255,.1)}',
      R + ' .cl-o[aria-pressed="true"]{background:rgba(255,255,255,.95);color:rgba(14,20,32,.96)}',
      R + ' .cl-o:focus-visible{outline:2px solid rgba(255,255,255,.9);outline-offset:1px}',
      R + ' .cl-hint{margin:10px 2px 0;font-size:var(--t-2,11px);line-height:1.45;color:rgba(255,255,255,.62)}'
    ].join('\n');
  }
  var IC = {
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/></svg>',
    flat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="M12 5.5v13" stroke-width="1.6"/></svg>',
    tilt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 6.5h11l3.5 12H3z"/><path d="M12 6.5v12" stroke-width="1.6"/></svg>',
    circle: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    shirt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 3.5 3.8 6.2l1.9 4 2.3-1.1V20.5h8V9.1l2.3 1.1 1.9-4-4.7-2.7c-.6 1.6-1.9 2.6-3.5 2.6s-2.9-1-3.5-2.6z" fill="currentColor"/></svg>',
    person: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4.4" r="2.6" fill="currentColor"/><path d="M8.7 8.2h6.6c.9 0 1.7.8 1.7 1.7v4.8h-2.1V21h-2.1v-5.6h-1.6V21H9.1v-6.3H7V9.9c0-.9.8-1.7 1.7-1.7z" fill="currentColor"/></svg>',
    shaper: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 13.5 6.2 3.6a11 11 0 0 1 11.6 0z" fill="currentColor" opacity=".45"/><circle cx="12" cy="14.5" r="6.5" fill="currentColor"/></svg>'
  };

  // ── 보드에 붙이기 ──
  function getShape() { try { return typeof tokShape !== 'undefined' ? tokShape : ''; } catch (_) { return ''; } }   /* global tokShape */
  function setShape(s) { try { tokShape = s; } catch (_) {} }   // eslint-disable-line no-global-assign
  function call(win, fn) { try { if (typeof win[fn] === 'function') win[fn](); } catch (_) {} }
  function is3d(win) { return win.document.body.classList.contains('bc-tilt3d'); }
  function tilt(win, on) {
    if (!win.__setTilt) return;
    win.__commTilt = true; win.__setTilt(!!on, { transient: true, quiet: true });   // 설정 값(ps_board_tilt3d)은 그대로 · 닫으면 __commTiltOff 가 끈다
    call(win, 'applyView'); call(win, 'renderTokens');
    win.setTimeout(function () { try { if (win.__tiltFit) win.__tiltFit(); } catch (_) {} }, 60);
  }
  function applyShape(win, s) { win.__commWantShape = s || null; setShape(s || win.__commPostShape || getShape()); call(win, 'renderTokens'); }
  // 글을 싣기 전에 — 고른 모양을 loadSnap 이 장면마다 지키게. 올린 사람의 모양은 글을 싣는 첫 loadSnap 이 한 번만 적는다(__commPostShape) —
  //   뒤의 loadSnap 은 보드가 지금 화면을 찍어 둔 것을 되살리기도 해(재생을 멈출 때 등) 고른 모양이 «올린 그대로» 자리에 앉았다
  function prime(win) { win.__commPostShape = null; try { win.__commWantShape = shown(read(win.localStorage).shape, device(win)) || null; } catch (_) { win.__commWantShape = null; } }

  function mount(win) {
    var doc = win.document, wrap = doc.getElementById('editorBoardWrap'); if (!wrap) return null;
    if (!doc.getElementById('ps-comm-look-css')) { var st = doc.createElement('style'); st.id = 'ps-comm-look-css'; st.textContent = css(); doc.head.appendChild(st); }
    var old = doc.getElementById('commLook'); if (old) old.remove();
    var dev = device(win), threeD = can3d(dev, win), ls = win.localStorage;
    // 데스크톱은 고른 화면을 다시 세운다(이 판 안에서 이미 켜거나 끈 것이 먼저). 보드 설정이 3D 면 판이 3D 로 뜨므로 «평면»도 되돌린다
    try { var pr = read(ls); if (threeD && !dev.touch && !win.__commTilt && pr.tilt && (pr.tilt === '3d') !== is3d(win)) tilt(win, pr.tilt === '3d'); } catch (_) {}
    var shapes = shapesFor(dev), box = doc.createElement('div'); box.id = 'commLook';
    var h = '<button type="button" id="commLookBtn" aria-haspopup="dialog" aria-expanded="false" aria-controls="commLookPop" title="보기 방식 — ' + (threeD ? '평면 · 3D · ' : '') + '선수 모양">' + IC.eye + '<span>보기</span><span class="cl-now"></span></button>' +
      '<div id="commLookPop" role="dialog" aria-label="보기 방식" hidden>';
    if (threeD) h += '<div class="cl-h">화면</div><div class="cl-seg cl-tilt" role="group" aria-label="화면">' +
      '<button type="button" class="cl-o" data-cl-tilt="flat">' + IC.flat + '평면</button><button type="button" class="cl-o" data-cl-tilt="3d">' + IC.tilt + '3D</button></div>';
    h += '<div class="cl-h">선수 모양</div><div class="cl-seg cl-shapes" role="group" aria-label="선수 모양" style="grid-template-columns:repeat(' + shapes.length + ',1fr)">' +
      '<button type="button" class="cl-o cl-orig" data-cl-shape="">올린 그대로<small></small></button>' +
      shapes.map(function (s) { return '<button type="button" class="cl-o" data-cl-shape="' + s + '">' + IC[s] + NAME[s] + '</button>'; }).join('') +
      '</div><p class="cl-hint"></p></div>';
    box.innerHTML = h; wrap.appendChild(box);
    var btn = box.querySelector('#commLookBtn'), pop = box.querySelector('#commLookPop');
    function paint() {
      var t = is3d(win), want = win.__commWantShape || '', post = win.__commPostShape || 'circle', on = shown(want, dev);
      [].forEach.call(box.querySelectorAll('[data-cl-tilt]'), function (b) { b.setAttribute('aria-pressed', (b.getAttribute('data-cl-tilt') === '3d') === t ? 'true' : 'false'); });
      [].forEach.call(box.querySelectorAll('[data-cl-shape]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-cl-shape') === on ? 'true' : 'false'); });
      box.querySelector('.cl-orig small').textContent = ' · ' + (NAME[shown(post, dev)] || '원형');
      box.querySelector('.cl-now').textContent = summary(dev, threeD, t, want);
      box.querySelector('.cl-hint').textContent = hint(dev, t, getShape());
    }
    function open(on) { pop.hidden = !on; btn.setAttribute('aria-expanded', on ? 'true' : 'false'); if (on) paint(); }
    btn.addEventListener('click', function (e) { e.stopPropagation(); open(pop.hidden); });
    pop.addEventListener('click', function (e) {
      var tb = e.target.closest('[data-cl-tilt]'), sb = e.target.closest('[data-cl-shape]'); if (!tb && !sb) return;
      var r = choose({ is3d: is3d(win), pref: read(ls) }, tb ? { tilt: tb.getAttribute('data-cl-tilt') } : { shape: sb.getAttribute('data-cl-shape') }, dev, threeD);
      if (r.shape !== null) applyShape(win, shown(r.shape, dev));
      if (r.on !== null && r.on !== is3d(win)) tilt(win, r.on);
      write(ls, r.pref); paint();
    });
    box.__open = open;
    // 바깥을 누르면 닫는다. 보기 전용 막이(board.html communityBoardReadOnly 의 guard)가 판을 누른 pointerdown · click 을 맨 앞에서 멈추므로 손을 뗄 때(pointerup) 본다.
    //   같은 판에서 페이지를 바꾸면 고르개를 다시 세우므로 문서 듣기는 한 번만(지금 고르개를 id 로 찾는다)
    if (!win.__commLookDoc) {
      win.__commLookDoc = true;
      win.addEventListener('pointerup', function (e) { var b = doc.getElementById('commLook'); if (b && b.__open && !b.contains(e.target)) b.__open(false); }, true);
      doc.addEventListener('keydown', function (e) { var b = doc.getElementById('commLook'); if (e.key === 'Escape' && b && b.__open) b.__open(false); });
    }
    paint();
    return box;
  }
  return { KEY: KEY, SHAPES: SHAPES, NAME: NAME, read: read, write: write, device: device, can3d: can3d, shapesFor: shapesFor, shown: shown, choose: choose, summary: summary, hint: hint, css: css, prime: prime, mount: mount };
});

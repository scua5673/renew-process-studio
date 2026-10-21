/* PROCESS STUDIO — 오류 제보 고침 묶음(3.085). 사용자 «오류제보 확인하고 배포까지 해줘» → «응 전부 확인하고 답변달아줘».
   2026-10-17 제보(관리자 답변에 «다음 업데이트»로 약속한 것):
   - 애니메이션 속도를 모든 장면에 한 번에(0d7c9cca): 속도 옆 «전체» — 켜 두면 속도를 바꿀 때 모든 장면에, 끄면 고른 장면만(예전처럼).
   - 여러 페이지 영상의 아래 자막(178c465c): 내보내기 창 «자막» — 페이지 이름 넣기 · 빼기. 장면에 직접 쓴 자막은 그대로.
   - 영상마다 운동장 자리가 다름(8e143f85): 16:9 는 운동장 기준 화면 두 단계(기본 · 넓게)만 — 놓인 것에 따라 조금씩 커지지 않게.
     세로(릴스)는 놓인 것 전체가 아니라 운동장을 가운데에.
   - 저장하고 나가기 뒤 보관함(2d392249): 편집하던 항목을 연 폴더로 돌아간다(«내 자료» · «전체 자료»로 되돌리지 않음).
   - 보드 설정 아이콘(사용자 «보드설정 아이콘은 저게 최선이야?» → «조절 막대»): 위쪽 톱니 · 도크 끝 상자를 같은 조절 막대로.
   보드의 함수 선언(window 속성)은 감싸고, let/const 전역은 이름으로 읽는다(eval 없이 — CSP). 장면 유지 0.1초는 board.html 에 직접. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSBoardTweaks = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var SPEED_ALL = 'ps_anim_speed_all_v1', CAP = 'ps_anim_export_cap_v1';

  // ── 영상 화면: 운동장 상자 → 16:9 화면 ──
  // pb=[x0,y0,x1,y1] 운동장, m=라인 밖 여유. 놓인 것(uvb)이 기본 화면을 넘으면 «넓게»(여유 ×3), 그것도 넘을 때만 놓인 것에 맞춘다.
  // 어느 쪽이든 운동장 가운데가 화면 가운데다.
  function frame169(pb, m, uvb, full) {
    var cx = (pb[0] + pb[2]) / 2, cy = (pb[1] + pb[3]) / 2, pw = pb[2] - pb[0], ph = pb[3] - pb[1];
    function size(mm) { var Hh = ph + 2 * mm, Ww = Hh * 16 / 9; if (Ww < pw + 2 * mm) { Ww = pw + 2 * mm; Hh = Ww * 9 / 16; } return [Ww, Hh]; }
    var s = size(m);
    if (uvb && full) {
      var needW = 2 * Math.max(cx - uvb[0], uvb[0] + uvb[2] - cx), needH = 2 * Math.max(cy - uvb[1], uvb[1] + uvb[3] - cy);
      if (needW > s[0] + 0.5 || needH > s[1] + 0.5) {
        s = size(m * 3);
        if (needW > s[0] + 0.5) { s = [needW, needW * 9 / 16]; }
        if (needH > s[1] + 0.5) { s = [needH * 16 / 9, needH]; }
      }
    }
    return [cx - s[0] / 2, cy - s[1] / 2, s[0], s[1]];
  }
  // 릴스(9:16): 운동장 상자(+여유)를 가운데에 둔 상자 — 보드가 이 상자를 9:16 으로 늘린다(가운데 그대로)
  function reelBox(pb, m, uvb) {
    var cx = (pb[0] + pb[2]) / 2, cy = (pb[1] + pb[3]) / 2, hw = (pb[2] - pb[0]) / 2 + m, hh = (pb[3] - pb[1]) / 2 + m;
    if (uvb) { hw = Math.max(hw, cx - uvb[0], uvb[0] + uvb[2] - cx); hh = Math.max(hh, cy - uvb[1], uvb[1] + uvb[3] - cy); }
    return [cx - hw, cy - hh, hw * 2, hh * 2];
  }
  // 여러 페이지 장면 목록에서 «페이지 이름» 자막만 뺀다(장면에 직접 쓴 자막은 둔다). on = 내보낼 페이지들, seq = 보드가 만든 목록
  function stripPageCaps(on, seq) {
    var k = 0;
    (on || []).forEach(function (pg) {
      (pg.frames || []).forEach(function (f) {
        var s = seq[k++]; if (!s) return;
        var own = String((f && f.cap) || '').trim();
        if (!own) s.cap = '';
      });
    });
    return seq;
  }

  // ── 피치는 판 전체(제보 934aaa3e «운동장 스타일을 바꾸면 모든 페이지가») ──
  // 사람이 피치(잔디 · 딥그린 · 네이비 · 화이트 · 훈련 · 실사 · 직접 고른 색)를 바꾸면 이 작전판의 모든 페이지와 그 장면, 미팅이면 모든 슬라이드와 그 장면에.
  // CLAUDE.md «전체에 적용» 단추를 더하지 않고 기본을 판 전체로 — 대신 알림의 «이 페이지만»으로 다른 페이지를 되돌릴 수 있다.
  // 운동장 사진(@photo:)은 페이지마다의 내용이라 퍼뜨리지 않고, 사진을 깐 페이지도 덮지 않는다.
  var PITCH_KEYS = ['pitchTheme', 'pitchCustom', 'pitchImg'];
  function isPhoto(v) { return typeof v === 'string' && v.indexOf('@photo:') === 0; }
  function pitchVal(sn, k) {
    var v = sn ? sn[k] : undefined;
    if (k === 'pitchTheme') return (v === undefined || v === null) ? null : (v === 'navy' ? '' : String(v));
    return (v === undefined || v === null || v === '') ? null : v;
  }
  // 한 스냅에 지금 피치를 넣는다. 바꿨으면 되돌릴 값({칸: 옛 값})을, 아니면 null 을 준다
  function putPitch(sn, cur) {
    if (!sn || typeof sn !== 'object' || !cur || isPhoto(cur.pitchImg) || isPhoto(sn.pitchImg)) return null;
    var was = null;
    PITCH_KEYS.forEach(function (k) {
      if (pitchVal(sn, k) === pitchVal(cur, k)) return;
      if (!was) was = {};
      was[k] = Object.prototype.hasOwnProperty.call(sn, k) ? sn[k] : undefined;
      if (cur[k] === undefined) delete sn[k]; else sn[k] = cur[k];
    });
    return was;
  }
  function backPitch(sn, was) { if (!sn || !was) return; for (var k in was) { if (was[k] === undefined) delete sn[k]; else sn[k] = was[k]; } }
  // 페이지(작전판) · 슬라이드(미팅) 목록에 퍼뜨린다. skip = 지금 페이지 번호(이미 판에 있다). 돌려주는 rec 마다 그 항목과 바꾼 스냅들
  function spreadPitch(items, cur, skip) {
    var recs = [];
    (items || []).forEach(function (it, i) {
      if (!it || i === skip) return;
      var r = { it: it, snap: putPitch(it.snap, cur), frames: [] };
      var fr = (it.anim && Array.isArray(it.anim.frames)) ? it.anim.frames : (Array.isArray(it.frames) ? it.frames : []);
      fr.forEach(function (f, k) { var w = f && putPitch(f.snap, cur); if (w) r.frames.push([f, w]); });
      if (r.snap || r.frames.length) recs.push(r);
    });
    return recs;
  }
  // ── 유니폼(팀 · GK 색 · 무늬 · 테두리 · 글자색)도 같은 모양으로 — 미팅의 다른 슬라이드에(3.122). 되돌리기는 undoPitch(옛 값 그대로 돌려놓기)
  var KIT_KEYS = ['teamColors', 'teamColor2', 'teamPattern', 'teamStrokeC', 'teamTxtC', 'teamKit', 'gkColors', 'gkColor2', 'gkPattern', 'gkStrokeC', 'gkTxtC'];
  function putKit(sn, kit, keys) {
    if (!sn || typeof sn !== 'object' || !kit) return null;
    var was = null;
    (keys || KIT_KEYS).forEach(function (k) {
      var v = JSON.stringify(kit[k] || {}); if (JSON.stringify(sn[k] || {}) === v) return;
      if (!was) was = {};
      was[k] = Object.prototype.hasOwnProperty.call(sn, k) ? sn[k] : undefined;
      sn[k] = JSON.parse(v);
    });
    return was;
  }
  function spreadKit(items, kit, skip, keys) {
    var recs = [];
    (items || []).forEach(function (it, i) {
      if (!it || i === skip) return;
      var r = { it: it, snap: putKit(it.snap, kit, keys), frames: [] };
      (Array.isArray(it.frames) ? it.frames : []).forEach(function (f) { var w = f && putKit(f.snap, kit, keys); if (w) r.frames.push([f, w]); });
      if (r.snap || r.frames.length) recs.push(r);
    });
    return recs;
  }
  // 3.136 — 미팅 중(meetOn)엔 작업 보드 페이지 묶음(window.__psPages)이 지금 판(슬라이드)을 담지도, 다른 페이지를 고치지도 않게 감싼다(아래 mount 9)
  function guardPages(P, meetOn) {
    if (!P || typeof P.eachOther !== 'function') return false; if (P.eachOther.__psMeetSafe) return true;
    var eo = P.eachOther, an = P.applyNames, th = P.thumbs;
    P.eachOther = function () { return meetOn() ? 0 : eo.apply(this, arguments); };
    P.eachOther.__psMeetSafe = 1;
    if (typeof an === 'function') P.applyNames = function () { return meetOn() ? null : an.apply(this, arguments); };
    if (typeof th === 'function') P.thumbs = function () {   // 미팅 중엔 담지 않고 있는 그림만(경기 화면이 읽는다)
      if (!meetOn()) return th.apply(this, arguments);
      var m = {}; ((P.pg && P.pg()) || []).forEach(function (p) { if (p && p.name && p.thumb) m[p.name] = p.thumb; }); return m;
    };
    return true;
  }
  function undoPitch(recs) { (recs || []).forEach(function (r) { backPitch(r.it.snap, r.snap); r.frames.forEach(function (fw) { backPitch(fw[0].snap, fw[1]); }); }); }

  function mount(win) {
    var doc = win.document, body = doc.body;
    if (!body || win.__psTweaks) return; win.__psTweaks = true;
    var ls = function (k, v) { try { if (v === undefined) return win.localStorage.getItem(k); win.localStorage.setItem(k, v); } catch (_) {} return null; };
    function toast(m) { try { if (typeof win.toast === 'function') win.toast(m); } catch (_) {} }
    /* global anim, animActive, libFilter, M */
    function A() { try { return typeof anim !== 'undefined' ? anim : null; } catch (_) { return null; } }
    function act() { try { return typeof animActive !== 'undefined' ? animActive : -1; } catch (_) { return -1; } }
    function LF() { try { return typeof libFilter !== 'undefined' ? libFilter : null; } catch (_) { return null; } }
    function margin() { try { return typeof M !== 'undefined' ? M : 30; } catch (_) { return 30; } }

    // ── 1. 속도 «전체» ──
    var speedAll = ls(SPEED_ALL) !== '0';
    var X = 'html body #animSpeedAll' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(function (i) { return ':not(#tw' + i + ')'; }).join('');
    var css = doc.createElement('style'); css.id = 'ps-tweaks-css';
    css.textContent = [
      // 도크 단추 규칙(:not(#id) 여럿)보다 세게 — 켜짐은 강조색, 꺼짐은 옆 칸(속도 · 유지)과 같은 오목한 칸
      X + '{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:auto!important;min-width:0!important;max-width:none!important;height:28px!important;min-height:28px!important;max-height:28px!important;flex:0 0 auto!important;padding:0 9px!important;border-radius:9px!important;border:0!important;font:800 11.5px/1 Pretendard,-apple-system,sans-serif!important;white-space:nowrap!important;cursor:pointer!important;box-shadow:none!important}',
      X + '[aria-pressed="true"]{background:var(--df-accent,#14213D)!important;color:var(--df-on-ink,#fff)!important}',
      X + '[aria-pressed="false"]{background:var(--df-well,rgba(20,33,61,.06))!important;color:var(--df-dim,#5E6675)!important}',
      // 영상 내보내기 창의 «자막» 줄은 «여러 페이지»일 때만
      '#evSheet .ev-cap-row[hidden]{display:none!important}'
    ].join('\n');
    doc.head.appendChild(css);
    function speedBtn() {
      var s = doc.getElementById('animSpeedSel'); if (!s) return null;
      var b = doc.getElementById('animSpeedAll');
      if (!b) {
        b = doc.createElement('button'); b.type = 'button'; b.id = 'animSpeedAll'; b.className = 'btn';
        b.textContent = '모든 장면';
        b.addEventListener('click', function (e) { e.stopPropagation(); speedAll = !speedAll; ls(SPEED_ALL, speedAll ? '1' : '0'); paintSpeed(); toast(speedAll ? '속도를 바꾸면 모든 장면에 같이 적용돼요' : '속도를 바꾸면 고른 장면에만 적용돼요'); });
      }
      if (b.previousElementSibling !== s) s.parentNode.insertBefore(b, s.nextSibling);   // 보드가 속도 칸을 다른 묶음으로 옮겨도 바로 옆에
      return b;
    }
    function paintSpeed() { var b = speedBtn(); if (!b) return; b.setAttribute('aria-pressed', speedAll ? 'true' : 'false'); b.title = speedAll ? '속도를 모든 장면에 같이 적용(켜짐) — 누르면 고른 장면만' : '속도를 고른 장면에만 적용(꺼짐) — 누르면 모든 장면에 같이'; }
    function hookSpeed() {
      var s = doc.getElementById('animSpeedSel'); if (!s || s.__psAll) return !!s; s.__psAll = true;
      // 보드의 onchange(고른 장면에 적용) 다음에 돈다 — 켜져 있으면 모든 장면에
      s.addEventListener('change', function () {
        if (!speedAll) return; var a = A(), v = +s.value; if (!a || !a.frames || a.frames.length < 2 || !(v > 0)) return;
        a.frames.forEach(function (f) { if (f) f.moveSpeed = v; });
        try { if (typeof win.boardSaveLive === 'function') win.boardSaveLive(); } catch (_) {}
        try { if (typeof win.renderAnimFrames === 'function') win.renderAnimFrames(); } catch (_) {}
        toast('모든 장면 속도 ' + s.options[s.selectedIndex].text);
      });
      paintSpeed(); return true;
    }

    // ── 2. 여러 페이지 영상 — 페이지 이름 자막 넣기 · 빼기 ──
    var capOn = ls(CAP) !== '0';
    if (typeof win.animPagesSequence === 'function' && !win.animPagesSequence.__psCap) {
      var origSeq = win.animPagesSequence;
      win.animPagesSequence = function (on) { var seq = origSeq.apply(this, arguments); try { if (!capOn && Array.isArray(seq)) stripPageCaps(on, seq); } catch (_) {} return seq; };
      win.animPagesSequence.__psCap = true;
    }
    function capRow(sheet) {
      if (!sheet || sheet.querySelector('.ev-cap-row')) return;
      var scope = sheet.querySelector('.ev-seg[data-key="scope"]'); if (!scope) return;   // «여러 페이지»를 고를 수 있을 때만
      var row = doc.createElement('div'); row.className = 'ev-cap-row'; row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:13px';
      var lb = doc.createElement('span'); lb.textContent = '자막'; lb.style.cssText = 'flex:0 0 52px;font-size:13px;font-weight:600;color:var(--txt-dim,#646A73)';
      var sg = doc.createElement('div'); sg.style.cssText = 'display:flex;gap:6px;flex:1 1 auto';
      var book = !!win.__vaultBook;
      [[book ? '이름 넣기' : '페이지 이름', 1], ['빼기', 0]].forEach(function (r) {
        var b = doc.createElement('button'); b.type = 'button'; b.setAttribute('data-cap', String(r[1])); b.textContent = r[0];
        b.style.cssText = 'flex:1 1 auto;padding:9px 6px;border:1px solid var(--line,#E3E6EA);border-radius:10px;background:var(--panel2,#F1F2F4);color:var(--txt,#14161A);font-family:inherit;font-weight:600;font-size:13px;cursor:pointer';
        b.title = r[1] ? '장면 자막이 없는 장면에 ' + (book ? '시퀀스 · 단계' : '페이지') + ' 이름을 아래 자막으로' : '장면에 직접 쓴 자막만 — 이름은 넣지 않아요';
        b.addEventListener('click', function () { capOn = !!r[1]; ls(CAP, capOn ? '1' : '0'); paintCap(); });
        sg.appendChild(b);
      });
      row.appendChild(lb); row.appendChild(sg);
      var pages = sheet.querySelector('#evPages'); var after = pages || scope.parentNode;
      after.parentNode.insertBefore(row, after.nextSibling);
      function paintCap() {
        [].forEach.call(sg.querySelectorAll('button'), function (b) { var o = (+b.getAttribute('data-cap') === 1) === capOn;
          b.style.background = o ? 'var(--blue,#14213D)' : 'var(--panel2,#F1F2F4)'; b.style.color = o ? '#fff' : 'var(--txt,#14161A)'; b.style.borderColor = o ? 'var(--blue,#14213D)' : 'var(--line,#E3E6EA)'; b.setAttribute('aria-pressed', o ? 'true' : 'false'); });
        var many = !!sheet.querySelector('.ev-seg[data-key="scope"] .ev-b.on[data-v="1"]'); row.hidden = !many;
        // 설명 글도 고른 것에 맞춘다(보드는 «이름이 아래 자막으로 들어갑니다»로만 쓴다)
        var d = sheet.querySelector('#evDesc'); if (d && many) { var t = d.textContent, off = '아래 자막은 장면에 직접 쓴 것만 들어갑니다.';
          var on1 = '장면 자막이 없으면 페이지 이름이 아래 자막으로 들어갑니다.', on2 = '아래 자막에 시퀀스와 단계 이름이 들어갑니다.';
          if (!capOn) { t = t.replace(on1, off).replace(on2, off); } else if (t.indexOf(off) >= 0) { t = t.replace(off, book ? on2 : on1); }
          if (t !== d.textContent) d.textContent = t; }
      }
      sheet.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.ev-seg')) win.setTimeout(paintCap, 0); });   // 범위 · 형식 · 화면을 바꾸면 보드가 설명을 다시 쓴다
      paintCap();
    }

    // ── 3. 영상 화면: 운동장 기준 ──
    if (typeof win._export169 === 'function' && !win._export169.__psPitch) {
      var orig169 = win._export169;
      win._export169 = function (uvb) {
        try { var pb = typeof win._exportPitchBox === 'function' ? win._exportPitchBox() : null; if (!pb) return orig169.apply(this, arguments);
          var full = typeof win.pitchViewKey === 'function' ? win.pitchViewKey() === 'full' : true;
          return frame169(pb, margin(), uvb, full);
        } catch (_) { return orig169.apply(this, arguments); }
      };
      win._export169.__psPitch = true; win.__export169 = win._export169;
    }
    win.__psReelVB = function (uvb) { try { var pb = typeof win._exportPitchBox === 'function' ? win._exportPitchBox() : null; return pb ? reelBox(pb, margin(), uvb) : uvb; } catch (_) { return uvb; } };

    // ── 4. 저장하고 나가기 뒤 보관함 — 연 폴더로 ──
    var listFolder = null, back = null;   // back = {folder, t}
    function editing() { var c = body.classList; return c.contains('vcreating') || c.contains('editing'); }
    if (typeof win.renderDrillFiles === 'function' && !win.renderDrillFiles.__psBack) {
      var origR = win.renderDrillFiles;
      win.renderDrillFiles = function () { var r = origR.apply(this, arguments); try { var lf = LF(); if (lf && !editing() && (win.__csView || 'session') === 'session') listFolder = lf.folder; } catch (_) {} return r; };
      win.renderDrillFiles.__psBack = true;
    }
    var wasEd = editing();
    try { new win.MutationObserver(function () { var e = editing(); if (e === wasEd) return; wasEd = e; if (!e && listFolder != null) back = { folder: listFolder, t: Date.now() }; }).observe(body, { attributes: true, attributeFilter: ['class'] }); } catch (_) {}
    function backNow() { return back && Date.now() - back.t < 6000 ? back : null; }
    if (typeof win.__vaultEnterReset === 'function' && !win.__vaultEnterReset.__psBack) {
      var origE = win.__vaultEnterReset;
      win.__vaultEnterReset = function () { if (backNow()) return; return origE.apply(this, arguments); };   // 편집에서 막 돌아오는 길이면 «내 자료»로 되돌리지 않는다
      win.__vaultEnterReset.__psBack = true;
    }
    if (typeof win.setView === 'function' && !win.setView.__psBack) {
      var origV = win.setView;
      win.setView = function (v) {
        var r = origV.apply(this, arguments);
        try { var b = backNow(); if (v === 'session' && b) { back = null; var lf = LF(); if (lf && lf.folder !== b.folder) { lf.folder = b.folder; if (typeof win.renderDrillFiles === 'function') win.renderDrillFiles(); } } else if (v !== 'session' && v !== 'board') back = null; } catch (_) {}
        return r;
      };
      win.setView.__psBack = true;
    }

    // ── 5. 보드 설정 아이콘 = 조절 막대(사용자 «조절 막대가 괜찮은거 같아») — 위쪽 단추(톱니)와 도크 끝 단추(상자 안 줄)를 같은 모양으로 ──
    function sliders(size, cls) {
      return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' viewBox="0 0 24 24"' + (size ? ' width="' + size + '" height="' + size + '"' : '') + ' fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-ps-sliders="1"><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/></svg>';
    }
    function setIcon(id, size, cls) {
      var b = doc.getElementById(id); if (!b) return; var o = b.querySelector('svg'); if (!o || o.getAttribute('data-ps-sliders')) return;
      var w = doc.createElement('span'); w.innerHTML = sliders(size, cls); o.parentNode.replaceChild(w.firstChild, o);
    }
    function icons() { setIcon('bpBoardSettings', 15, ''); setIcon('viewBtn', 0, 'ic'); }
    icons();
    // 위쪽 단추는 페이지 띠를 다시 그릴 때마다 새로 생긴다 — 띠만 지켜본다
    (function watchStrip() { var st = doc.getElementById('boardPageStrip'); if (!st) { win.setTimeout(watchStrip, 500); return; }
      try { new win.MutationObserver(function () { var b = doc.getElementById('bpBoardSettings'); if (b) { var o = b.querySelector('svg'); if (o && !o.getAttribute('data-ps-sliders')) icons(); } }).observe(st, { childList: true, subtree: true }); } catch (_) {} })();

    // ── 6. 피치는 판 전체(제보 934aaa3e) — 보드의 _viewScenesMatch("pitch")(사람이 바꾼 때만 불린다: 피치 단추 · 색 고르개 · 잔디 톤)를 감싼다 ──
    function slidesOf() { try { var a = A(); return (doc.body.classList.contains('meet-mode') && a && Array.isArray(a.slides) && a.slides.length > 1) ? a.slides : null; } catch (_) { return null; } }
    function playing() { try { return typeof animPlaying !== 'undefined' && !!animPlaying; } catch (_) { return false; } }   /* global animPlaying */
    function thumbsOf(r, meet) {
      var th = win.__snapToThumb, it = r.it, fr = meet ? it.frames : (it.anim && it.anim.frames);
      try { if (it.thumb !== undefined || meet) { var t = typeof th === 'function' ? th(it.snap) : ''; if (t) it.thumb = t; else delete it.thumb; } } catch (_) { delete it.thumb; }
      if (Array.isArray(fr)) fr.forEach(function (f, k) { if (!f) return; if (meet && k === 0 && it.thumb) f.thumb = it.thumb; else delete f.thumb; });
    }
    /* 다른 페이지 · 슬라이드의 그림은 하나씩 나눠 그린다 — 한 번에 그리면(그림 하나에 판을 두 번 갈아 끼운다) 슬라이드 9장에 화면이 멈추고 알림도 늦었다.
       재생 · 끌기 · 내보내기 · 슬라이드 넘김 · 훈련 편집 중이면 끝날 때까지 기다린다(그 사이 판을 갈아 끼우면 안 된다) */
    var thumbQ = [], thumbT = 0;
    function thumbBusy() {
      try { return playing() || doc.body.classList.contains('editing') || !!win.__animExport || !!win.__meetVideoBusy || !!win.__ksNav || (typeof win.psDragging === 'function' && !!win.psDragging()); } catch (_) { return false; }
    }
    function queueThumbs(recs, meet) {
      recs.forEach(function (r) { for (var i = 0; i < thumbQ.length; i++) if (thumbQ[i].r.it === r.it) { thumbQ[i].r = r; return; } thumbQ.push({ r: r, meet: meet, tries: 0 }); });
      if (!thumbT && thumbQ.length) thumbT = win.setTimeout(thumbPump, 40);
    }
    function thumbPump() {
      thumbT = 0; var q = thumbQ[0]; if (!q) return;
      if (thumbBusy()) { if (++q.tries < 600) { thumbT = win.setTimeout(thumbPump, 500); return; } thumbQ.shift(); q = null; }   // 5분을 넘게 바쁘면 그 그림은 그대로 둔다
      else thumbQ.shift();
      if (q) try {
        var list = q.meet ? ((A() || {}).slides || []) : ((win.__psPages && win.__psPages.pg && win.__psPages.pg()) || []), i = list.indexOf(q.r.it);
        if (i >= 0) { thumbsOf(q.r, q.meet); if (q.meet && win.__ksThumb) win.__ksThumb(i); }   // 지운 페이지 · 슬라이드는 건너뛴다
      } catch (_) {}
      if (thumbQ.length) { thumbT = win.setTimeout(thumbPump, 30); return; }
      try { if (doc.body.classList.contains('meet-mode') && win.__ksRender) win.__ksRender(); } catch (_) {}
      try { win.boardSaveLive(); } catch (_) {}
    }
    function spreadNow() {
      if (playing() || doc.body.classList.contains('editing')) return null;
      var cur; try { cur = win.captureSnap(); } catch (_) { return null; }
      var slides = slidesOf(), meet = !!slides, items = null, skip = -1;
      if (meet) { try { if (win.__meetSyncCur) win.__meetSyncCur({ thumb: true }); } catch (_) {} items = slides; }   // 지금 슬라이드도 담고 그림(썸네일)도 새로
      else { var P = win.__psPages; try { items = P && P.pg ? P.pg() : null; skip = (P && P.book && P.book.idx) ? P.book.idx() : -1; } catch (_) { items = null; } }
      if (!items || items.length < 2) return null;
      var recs = spreadPitch(items, cur, skip);
      if (!recs.length) return null;
      try { win.boardSaveLive(); } catch (_) {}
      queueThumbs(recs, meet);
      var word = meet ? '슬라이드' : '페이지', n = recs.length;
      win.setTimeout(function () {   // 보드의 «장면 N개에 모두» 알림 뒤에 — 이 알림이 남는다
        toast('피치를 모든 ' + word + '에 적용했어요 (다른 ' + word + ' ' + n + '개)');
        try {
          var t = doc.getElementById('cs-ftoast'); if (!t) return;
          var b = doc.createElement('button'); b.type = 'button'; b.className = 'ftoast-act'; b.textContent = '이 ' + word + '만';
          b.addEventListener('click', function (ev) {
            ev.stopPropagation(); try { b.remove(); } catch (_) {}
            undoPitch(recs);
            try { win.boardSaveLive(); } catch (_) {}
            queueThumbs(recs, meet);
            toast('이 ' + word + '만 바꾸고 다른 ' + word + '는 되돌렸어요');
          });
          b.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
          t.appendChild(b); t.style.pointerEvents = 'auto';
          clearTimeout(t._ft); t._ft = win.setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(10px)'; t.style.pointerEvents = 'none'; win.setTimeout(function () { t.textContent = ''; t.setAttribute('aria-hidden', 'true'); }, 220); }, 6000);
        } catch (_) {}
      }, 0);
      return recs;
    }
    function hookPitch() {
      var f = win._viewScenesMatch; if (typeof f !== 'function') return false; if (f.__psPitchAll) return true;
      var g = function (kind) { var r = f.apply(this, arguments); if (kind === 'pitch') { try { spreadNow(); } catch (_) {} } return r; };
      g.__psPitchAll = 1; win._viewScenesMatch = g; return true;
    }
    win.__psPitchAllNow = spreadNow;   // 시험 · 진단용
    win.__psPitchThumbsLeft = function () { return thumbQ.length; };

    // ── 7. 미팅의 유니폼은 모든 슬라이드에(3.122 사용자 «미팅에서 우리팀 상대 팀 유니폼 바꾸면 모든 페이지에 적용되게») ──
    // 보드는 유니폼을 바꾸면 지금 슬라이드의 장면에만 넣었다(kitPropagateIfChanged — 2.975 작전판 «모든 장면 · 모든 페이지»).
    // 미팅이면 다른 슬라이드(와 그 장면)에도 넣는다. 색 고르개를 끄는 동안 여러 번 불려도 «이 슬라이드만»은 처음 값으로 되돌린다(8초 안의 한 묶음).
    var kitRun = null, kitT = 0;
    function kitKeys() { var k = win.KIT_KEYS; return Array.isArray(k) && k.length ? k : KIT_KEYS; }
    function kitNow() {   /* global state */
      var st; try { st = typeof state !== 'undefined' ? state : null; } catch (_) { st = null; } if (!st) return null;
      var o = {}; kitKeys().forEach(function (k) { o[k] = JSON.parse(JSON.stringify(st[k] || {})); }); return o;
    }
    function kitMerge(run, recs) {
      recs.forEach(function (r) {
        var o = null; for (var i = 0; i < run.length; i++) if (run[i].it === r.it) { o = run[i]; break; }
        if (!o) { run.push(r); return; }
        if (r.snap) { if (!o.snap) o.snap = r.snap; else for (var k in r.snap) if (!(k in o.snap)) o.snap[k] = r.snap[k]; }
        r.frames.forEach(function (fw) { var hit = null; o.frames.forEach(function (x) { if (x[0] === fw[0]) hit = x; }); if (!hit) o.frames.push(fw); else for (var k2 in fw[1]) if (!(k2 in hit[1])) hit[1][k2] = fw[1][k2]; });
      });
    }
    function kitSpreadNow() {
      if (!doc.body.classList.contains('meet-mode') || playing() || win.__ksNav || win.__meetVideoBusy || win.__animExport) return null;
      var slides = slidesOf(), kit = kitNow(); if (!slides || !kit) return null;
      var skip = -1; try { skip = win.__meet && win.__meet.idx ? win.__meet.idx() : -1; } catch (_) {}
      var recs = spreadKit(slides, kit, skip, kitKeys()); if (!recs.length) return null;
      var now = Date.now(); if (!kitRun || now - kitRun.t > 8000) kitRun = { recs: [], t: now }; kitRun.t = now;
      kitMerge(kitRun.recs, recs);
      queueThumbs(recs, true);
      var run = kitRun;
      clearTimeout(kitT); kitT = win.setTimeout(function () {   // 고르는 동안은 알리지 않고, 멈추면 한 번
        try { if (win.__meetSyncCur) win.__meetSyncCur({ thumb: true }); } catch (_) {}
        var n = run.recs.length;
        toast('유니폼을 모든 슬라이드에 적용했어요 (다른 슬라이드 ' + n + '장)');
        try {
          var t = doc.getElementById('cs-ftoast'); if (!t) return;
          var b = doc.createElement('button'); b.type = 'button'; b.className = 'ftoast-act'; b.textContent = '이 슬라이드만';
          b.addEventListener('click', function (ev) {
            ev.stopPropagation(); try { b.remove(); } catch (_) {}
            undoPitch(run.recs); if (kitRun === run) kitRun = null;
            queueThumbs(run.recs, true);
            toast('이 슬라이드만 바꾸고 다른 슬라이드는 되돌렸어요');
          });
          b.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
          t.appendChild(b); t.style.pointerEvents = 'auto';
          clearTimeout(t._ft); t._ft = win.setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(10px)'; t.style.pointerEvents = 'none'; win.setTimeout(function () { t.textContent = ''; t.setAttribute('aria-hidden', 'true'); }, 220); }, 6000);
        } catch (_) {}
      }, 450);
      return recs;
    }
    function hookKit() {
      var f = win.kitPropagateIfChanged; if (typeof f !== 'function') return false; if (f.__psKitAll) return true;
      var g = function () {
        var before = win._kitBase, r = f.apply(this, arguments);
        try { if (before != null && win._kitBase !== before) kitSpreadNow(); } catch (_) {}   // 보드가 «바뀌었다»고 본 때만(불러오기 · 넘기기는 기준만 바꾼다)
        return r;
      };
      g.__psKitAll = 1; win.kitPropagateIfChanged = g; return true;
    }
    win.__psKitAllNow = kitSpreadNow;   // 시험 · 진단용
    // 미팅의 «모든 장»은 슬라이드다 — 미팅을 고치는 동안 뒤에 둔 작업 보드의 다른 페이지는 건드리지 않는다.
    // 예전엔 미팅에서 유니폼 · 선수 이름을 바꾸면 psEachSnapAll 이 작업 보드의 페이지(__psPages)까지 바꿔 저장했다(2.975 부터).
    function hookEach() {
      var f = win.psEachSnapAll; if (typeof f !== 'function') return false; if (f.__psMeetOnly) return true;
      var g = function () {
        var P = win.__psPages, eo = P && P.eachOther;
        if (typeof eo !== 'function' || !doc.body.classList.contains('meet-mode')) return f.apply(this, arguments);
        P.eachOther = function () { return 0; };
        try { return f.apply(this, arguments); } finally { P.eachOther = eo; }
      };
      g.__psMeetOnly = 1; win.psEachSnapAll = g; return true;
    }

    // ── 8. 저장 팀은 판 전체(3.137, 오류 제보 738f37d1 «팀 불러오기 시, 모든 장면에 적용») ──
    // 보드 설정 › «저장 팀 불러오기»(board.html openAnalysisTeamLibrary)는 지금 장면 토큰에 이름 · 번호 · 사진을 입히고(PSTeamLoad.dress),
    // 지금 페이지의 다른 장면은 같은 id 만 따라갔다(PSTeamLoad.frames) — 포메이션을 다시 놓은 장면(새 id)엔 이름이 안 들어갔고,
    // 다른 페이지 · 미팅의 다른 슬라이드는 그대로였다. 이제 기본은 판 전체: 같은 선수(team-load.js who — id, 아니면 불러오기 전 번호 · 미팅은 번호 먼저)를
    // 지금 페이지의 모든 장면 · 다른 페이지(작업 보드) 또는 다른 슬라이드(미팅 — 작업 보드 페이지는 건드리지 않는다, 3.122)에 입힌다.
    // 알림의 «이 장면만»(다른 장면을 바꾼 때) · «이 페이지만» · «이 슬라이드만»이 지금 장면만 남기고 되돌린다(그 사이 고친 곳은 둔다).
    // 대기 줄에 새로 놓은 선수(fresh)는 예전처럼 지금 페이지의 장면에만. eachOther 는 쓰지 않는다(미팅 중 capture() 가 작업 보드 페이지를 덮는다).
    var teamSrc = null;
    function teamSpread(list, active, src, freshIds, before) {
      var L = win.PSTeamLoad;
      if (!src.length || !L || playing() || doc.body.classList.contains('editing') || win.__animExport) return null;
      var find = L.who(src, freshIds), meet = doc.body.classList.contains('meet-mode'), undo = [], seen = [], scenes = 0;
      // ① 지금 페이지 · 슬라이드의 다른 장면 — 같은 묶음은 id 가 이어진다(id 먼저), id 가 다르면 불러오기 전 번호로
      (list || []).forEach(function (f, k) {
        if (!f || !f.snap || k === active) return;
        var w = L.wear(f.snap, find, false); if (w) f.snap = Object.assign({}, f.snap, { players: w.players });
        if (f.snap !== before[k]) { scenes++; delete f.thumb; undo.push([f, 'snap', before[k], f.snap]); }
      });
      // ② 다른 페이지(작업 보드) · 다른 슬라이드(미팅)
      var items = null, skip = -1, recs = [];
      if (meet) { var a = A(); items = (a && Array.isArray(a.slides) && a.slides.length > 1) ? a.slides : null; try { skip = win.__meet.idx(); } catch (_) {} }
      else { var P = win.__psPages; try { items = P && P.pg ? P.pg() : null; skip = (P && P.book && P.book.idx) ? P.book.idx() : -1; } catch (_) { items = null; } }
      (items || []).forEach(function (it, i) {
        if (!it || i === skip) return;
        var r = { it: it, snap: null, frames: [] }, fr = meet ? it.frames : (it.anim && it.anim.frames);
        [it.snap].concat((Array.isArray(fr) ? fr : []).map(function (f) { return f && f.snap; })).forEach(function (sn) {
          if (!sn || seen.indexOf(sn) >= 0) return; seen.push(sn);   // 같은 묶음을 두 번 입히지 않는다(번호가 바뀐 뒤 다시 찾으면 다른 선수가 된다)
          var w = L.wear(sn, find, meet); if (!w) return;
          undo.push([sn, 'players', w.was, w.players]); sn.players = w.players; r.snap = 1;
        });
        if (r.snap) recs.push(r);
      });
      if (!scenes && !recs.length) return null;
      queueThumbs(recs, meet);
      var word = meet ? '슬라이드' : '페이지', label = scenes ? '이 장면만' : ('이 ' + word + '만');
      var msg = [scenes ? ('장면 ' + (scenes + 1) + '개 모두') : '', recs.length ? ('다른 ' + word + ' ' + recs.length + (meet ? '장' : '개')) : ''].filter(Boolean).join(' · ');
      var listRef = list, at = skip, t0 = Date.now();
      win.setTimeout(function () {   // 보드의 «N명 불러옴» 알림 · 미팅 유니폼 알림(7, 450ms) 뒤에 — 이어 쓴다
        var base = ((doc.getElementById('cs-ftoast') || {}).textContent || '').trim();
        if (!/명 불러옴/.test(base)) base = '';   // 보드의 «N명 불러옴»만 이어 쓴다(미팅 유니폼 알림 등 다른 알림은 덮는다)
        toast((base ? base + ' · ' : '') + msg + '에도 넣었어요');
        try {
          var t = doc.getElementById('cs-ftoast'); if (!t) return;
          var b = doc.createElement('button'); b.type = 'button'; b.className = 'ftoast-act'; b.textContent = label;
          b.addEventListener('click', function (ev) {
            ev.stopPropagation(); try { b.remove(); } catch (_) {}
            var a2 = A(), now = -1;
            try { now = meet ? win.__meet.idx() : win.__psPages.book.idx(); } catch (_) {}
            if ((scenes && a2 && a2.frames !== listRef) || now !== at) { toast('다른 ' + word + '로 옮겨 되돌리지 않았어요 — 되돌리기(⌘Z)를 쓰세요'); return; }
            undo.forEach(function (u) { if (u[0][u[1]] === u[3]) { u[0][u[1]] = u[2]; if (u[1] === 'snap') delete u[0].thumb; } });   // 그 사이 다시 고친 곳은 둔다
            var run = meet ? kitRun : null;   // 이 불러오기가 바꾼 유니폼(보드가 곧이어 저장하며 7 이 다른 슬라이드에 넣는다) — 이 알림이 그 알림의 «이 슬라이드만»을 덮었다
            if (run && run.t >= t0 && run.t - t0 < 2000) { undoPitch(run.recs); queueThumbs(run.recs, true); kitRun = null; }
            try { if (typeof win.renderAnimFrames === 'function') win.renderAnimFrames(); } catch (_) {}
            queueThumbs(recs, meet);
            try { win.boardSaveLive(); } catch (_) {}
            toast(scenes ? '이 장면만 바꾸고 다른 곳은 되돌렸어요' : ('이 ' + word + '만 바꾸고 다른 ' + word + '는 되돌렸어요'));
          });
          b.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
          t.appendChild(b); t.style.pointerEvents = 'auto';
          clearTimeout(t._ft); t._ft = win.setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(10px)'; t.style.pointerEvents = 'none'; win.setTimeout(function () { t.textContent = ''; t.setAttribute('aria-hidden', 'true'); }, 220); }, 6000);
        } catch (_) {}
      }, 600);
      return { scenes: scenes, recs: recs.length, label: label };
    }
    function hookTeam() {
      var L = win.PSTeamLoad; if (!L || typeof L.who !== 'function' || typeof L.frames !== 'function') return false; if (L.frames.__psTeamAll) return true;
      var dress = L.dress, frames = L.frames;
      // 판 위 토큰에 입히기 전 번호를 적어 둔다(dress 가 번호를 바꾼다) — 같은 차례(동기) 안의 frames 가 쓴다
      L.dress = function (t) {
        try {
          var st = typeof state !== 'undefined' ? state : null;   /* global state */
          if (t && st && Array.isArray(st.players) && st.players.indexOf(t) >= 0) { if (!teamSrc) { teamSrc = []; win.setTimeout(function () { teamSrc = null; }, 0); } teamSrc.push({ t: t, team: t.team, key: t.num }); }
        } catch (_) {}
        return dress.apply(this, arguments);
      };
      var g = function (list, active, toks, fresh) {
        var src = teamSrc || []; teamSrc = null;
        var before = (list || []).map(function (f) { return f && f.snap; });
        var n = frames.apply(this, arguments);
        try { win.__psTeamAllLast = teamSpread(list, active, src, (fresh || []).map(function (t) { return t && t.id; }), before); } catch (_) {}
        return n;
      };
      g.__psTeamAll = 1; L.frames = g; return true;
    }

    // ── 9. 미팅 중엔 작업 보드의 페이지를 건드리지 않는다(3.136 — 738f37d1 을 고치다 찾음) ──
    // __psPages 의 eachOther(«다른 페이지 전부») · applyNames · thumbs 는 먼저 capture() 로 지금 판을 지금 페이지에 담고, 미팅 설정을 모든 페이지에 적는다(_lookStampPages).
    // 미팅 중의 지금 판은 슬라이드라 작업 페이지에 슬라이드 배치 · 토큰 크기 · 이름표 글꼴이 들어갔고, psEachSnapAll(8)을 거치지 않는
    // 선수단 불러오기 · 맨 앞/뒤 · 잔상 · 시선 · 이름표 글꼴(글자 미리 받기)이 다른 페이지의 선수까지 고쳤다.
    // 미팅의 «모든 장»은 슬라이드다 — 이름(2.970 __meetSyncNames) · 유니폼(7) · 피치(6)는 슬라이드 규칙으로 따로 간다.
    // 슬라이드 사이엔 id 가 겹친다(경기의 «선발 11» 장) — id 로 찾는 페이지 규칙을 슬라이드에 그대로 돌리지 않는다.
    function hookPages() { return guardPages(win.__psPages, function () { return doc.body.classList.contains('meet-mode'); }); }

    // ── 시작 · 다시 그릴 때 ──
    var tries = 0;
    (function boot() { var ok = hookSpeed(), ok2 = hookPitch(), ok3 = hookKit() && hookEach() && hookPages(), ok4 = hookTeam(); if ((!ok || !ok2 || !ok3 || !ok4) && ++tries < 40) win.setTimeout(boot, 250); })();
    try {
      new win.MutationObserver(function (list) {
        for (var i = 0; i < list.length; i++) for (var j = 0; j < list[i].addedNodes.length; j++) { var n = list[i].addedNodes[j]; if (n && n.id === 'evSheet') capRow(n); }
      }).observe(body, { childList: true });
    } catch (_) {}
    win.setTimeout(function () { paintSpeed(); icons(); }, 1500);
  }

  function boot(win) {
    if (!win || !win.document) return;
    var go = function () { try { mount(win); } catch (_) {} };
    if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', go); else go();
  }
  if (typeof window !== 'undefined' && window.document && /\/studio\/board\.html/.test(String(window.location && window.location.pathname))) boot(window);
  return { frame169: frame169, reelBox: reelBox, stripPageCaps: stripPageCaps, putPitch: putPitch, spreadPitch: spreadPitch, undoPitch: undoPitch, PITCH_KEYS: PITCH_KEYS, SPEED_ALL: SPEED_ALL, CAP: CAP,
    KIT_KEYS: KIT_KEYS, putKit: putKit, spreadKit: spreadKit, guardPages: guardPages };
});

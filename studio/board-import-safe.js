/* PROCESS STUDIO — «보드 가져오기»는 지금 페이지를 덮지 않는다(3.123, 오류 제보 b4578ca1).
   사용자(코치) «보관함에 있는 다른 걸 눌렀는데 기존 내 애니메이션에 덮혀서 그 전에 내가 만든 애니메이션으로 돌리지 못하고 결국 페이지를 삭제».
   페이지 줄의 «보드 가져오기»(board.html openBoardImport, 2.701)는 고른 작전판의 첫 페이지 판과 장면을 **지금 페이지에** 올린다 —
   되돌리기는 한 칸(⌘Z)뿐이고 페이지를 옮기면 그마저 지워진다(clearHistory). 장면 29개를 만든 페이지가 예시 «4-3-3 패턴북»으로 바뀌었다.
   이제 기본 동작: 지금 페이지에 무엇이 있으면(선수 · 장비 · 그림 · 장면 2개 이상) 지금 페이지 바로 뒤에 새 페이지를 만들고 거기에 가져온다.
   빈 페이지면 예전처럼 그 자리에. 새 페이지를 만들 수 없으면(페이지가 가득 · 빌려 쓰는 판) 덮기 전에 묻는다. 첨부 판(ps-capturing)은 그대로.
   board.html 은 크기 예산이 차서 고치지 않고 감싼다: openBoardImport 는 함수 선언(window 속성)이고 단추(#bpImportBoard)가 전역 이름으로 부른다.
   새 페이지는 페이지 줄의 «＋ 페이지» 단추(add — 바깥 창구가 없다)를 눌러 만든다.
   3.135 — 여러 페이지 작전판은 1페이지의 장면으로 가져온다(오류 제보 0917a39f 조사). 보관함 항목의 대표 장면(d.frames)은 3.135 전까지
   «저장할 때 보던 페이지»의 장면이었고 대표 판(d.snap)은 1페이지였다 — 가져오기가 1페이지 판에 다른 페이지 장면을 붙였고, 그대로 «저장»하면
   보관함 그 자료의 1페이지 장면이 덮였다(장면 [6,16,14,29] → [29,16,14,29]). 저장은 board.html 이 1페이지 장면으로 고쳤고,
   이미 저장된 자료는 가져오는 동안만 목록(libGet)을 감싸 d.pages[0].anim 으로 바꿔 보인다(보관함은 그대로). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSImportSafe = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  // 지금 페이지에 지킬 것이 있는가 — 새 빈 페이지(board.html blankSnap)는 선수 · 장비 · 그림이 없고 장면도 없다
  function hasContent(st, an) {
    if (!st || typeof st !== 'object') return true;   // 모르면 지킨다
    var n = function (a) { return Array.isArray(a) ? a.length : 0; };
    return n(st.players) > 0 || n(st.equipment) > 0 || n(st.drawings) > 0 || (!!an && n(an.frames) > 1);
  }
  // 여러 페이지 작전판 — 가져올 대표 장면을 1페이지 것으로(사본 · 원본은 그대로). 1페이지에 장면이 없으면 빈 목록(가져온 페이지도 장면 없음)
  function pageOneItem(d, toFrames) {
    if (!d || d.type !== 'board' || !Array.isArray(d.pages) || !d.pages[0] || typeof d.pages[0] !== 'object' || typeof toFrames !== 'function') return d;
    var fr = null; try { fr = toFrames(d.pages[0].anim); } catch (_) { fr = null; }
    var o = {}; for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) o[k] = d[k];
    o.frames = Array.isArray(fr) ? fr : [];
    return o;
  }
  function isMac(nav) { try { return /Mac|iPhone|iPad|iPod/.test(String((nav && (nav.platform || nav.userAgent)) || '')); } catch (_) { return false; } }
  // 창 안내 · 단추 설명 — 새 동작에 맞춘 글. 맥이 아니면 ⌘Z 대신 Ctrl+Z
  function texts(s, mac) {
    var t = String(s == null ? '' : s);
    t = t.replace('지금 페이지에 올리고, «보드 저장»하면 이 자료도', '지금 페이지에 내용이 있으면 새 페이지로 가져와요(원래 페이지는 그대로) · 가져온 페이지는 «저장»하면 이 자료도')
      .replace('보관함에 저장한 작전판을 골라 지금 페이지에 올립니다', '보관함에 저장한 작전판을 골라 가져옵니다 — 지금 페이지에 내용이 있으면 새 페이지로');
    if (!mac) t = t.replace(/⌘Z/g, 'Ctrl+Z');
    return t;
  }

  function install(win) {
    if (!win || win.__psImportSafe) return;
    win.__psImportSafe = true;
    var doc = win.document;
    function st() { try { return typeof state !== 'undefined' ? state : null; } catch (_) { return null; } }   // eslint-disable-line no-undef
    function an() { try { return typeof anim !== 'undefined' ? anim : null; } catch (_) { return null; } }    // eslint-disable-line no-undef
    function count() { try { var p = win.__psPages && win.__psPages.pg(); return Array.isArray(p) ? p.length : 1; } catch (_) { return 1; } }
    function capturing() { try { return doc.body.classList.contains('ps-capturing'); } catch (_) { return false; } }
    function say(m) { try { win.toast(m); } catch (_) {} }
    // 페이지 줄의 «＋ 페이지»(지금 페이지 뒤에 빈 페이지 · 그리로 옮김). 위쪽 막대(board-topbar.js)는 이 단추를 탭 옆으로,
    // «보드 가져오기»는 «보드 ▾» 메뉴로 옮긴다 — 같은 부모가 아니므로 띠 전체에서 찾는다
    function addBtn() {
      var box = doc.getElementById('boardPageStrip');
      if (!box) return null;
      return Array.prototype.filter.call(box.querySelectorAll('button.bp-add'), function (b) { return /^＋/.test(String(b.textContent || '').trim()); })[0] || null;
    }
    function relabel(root) {
      var mac = isMac(win.navigator);
      try {
        var imp = doc.getElementById('bpImportBoard'); if (imp && imp.title) { var t = texts(imp.title, mac); if (t !== imp.title) imp.title = t; }
        if (!root) return;
        Array.prototype.forEach.call(root.querySelectorAll('div'), function (d) {
          if (d.children.length || !/⌘Z|지금 페이지에 올리고/.test(d.textContent)) return;
          var t = texts(d.textContent, mac); if (t !== d.textContent) d.textContent = t;
        });
      } catch (_) {}
    }
    function guard(ov) {
      if (!ov || capturing()) return;
      relabel(ov);
      Array.prototype.forEach.call(ov.querySelectorAll('button'), function (b) {
        var on = b.onclick; if (typeof on !== 'function' || on.__psSafe || /^닫기$/.test(String(b.textContent || '').trim())) return;
        var name = ((b.querySelector('b') || {}).textContent || '작전판').trim();
        // 원래 동작의 알림(«… · ⌘Z 되돌리기»)도 맥이 아니면 Ctrl+Z 로
        var run = function (self, args) {
          var t0 = win.toast, mac = isMac(win.navigator);
          if (!mac && typeof t0 === 'function') win.toast = function (m) { var a = Array.prototype.slice.call(arguments); a[0] = texts(m, false); return t0.apply(this, a); };
          try { return on.apply(self, args); } finally { if (win.toast !== t0) win.toast = t0; }
        };
        var w = function (e) {
          var self = this, args = arguments;
          if (!hasContent(st(), an())) return run(self, args);
          var before = count(), add = addBtn();
          if (add) { try { add.click(); } catch (_) {} }
          if (count() > before) {
            var r = run(self, args);
            var at = count(); try { at = win.__psPages.pageInfo().idx + 1; } catch (_) {}
            say('«' + name + '»을(를) 새 페이지(' + at + '번째)로 가져왔어요 · 원래 페이지는 그대로예요');
            return r;
          }
          // 새 페이지를 못 만들면 덮기 전에 묻는다
          var ask = '지금 페이지의 선수 · 그림 · 장면을 «' + name + '»(으)로 바꿀까요?\n새 페이지를 더 만들 수 없어 지금 페이지에 올려야 해요.';
          if (typeof win.psConfirm === 'function') win.psConfirm(ask, function () { run(self, args); });
          else if (win.confirm && win.confirm(ask)) run(self, args);
          return undefined;
        };
        w.__psSafe = true; b.onclick = w;
      });
    }
    function wrap() {
      var f = win.openBoardImport;
      if (typeof f !== 'function' || f.__psSafe) return false;
      var w = function () {
        relabel(null);
        // openBoardImport 는 시작하자마자(첫 await 전에) libGet() 을 부른다 — 그 한 번만 감싼다
        var lg = win.libGet, tf = win._animToFrames, swapped = false, p;
        if (typeof lg === 'function' && typeof tf === 'function') {
          win.libGet = function () {
            return Promise.resolve(lg.apply(this, arguments)).then(function (lib) { return Array.isArray(lib) ? lib.map(function (d) { return pageOneItem(d, tf); }) : lib; });
          };
          swapped = true;
        }
        try { p = f.apply(this, arguments); } finally { if (swapped) win.libGet = lg; }
        return Promise.resolve(p).then(function (r) { try { guard(doc.getElementById('bdImportOverlay')); } catch (_) {} return r; });
      };
      w.__psSafe = true; win.openBoardImport = w;
      return true;
    }
    if (doc && doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', wrap); else wrap();
  }
  if (typeof window !== 'undefined' && window.document) install(window);
  return { hasContent: hasContent, isMac: isMac, texts: texts, pageOneItem: pageOneItem, install: install };
});

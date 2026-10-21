/* PROCESS STUDIO — 팀 운영 › 경기의 «상대 분석(01)» · «경기 준비(02)»에 보관함 자료를 따로 붙인다(3.133).
   사용자 «보관함에서 미팅 자료 만들기 들어가면 상대분석과 경기준비 페이지를 따로 따로 만들어서 팀운영 경기 페이지에 붙힐수 있게».
   · 자료 종류는 보관함 태그 «상대 분석» · «경기 준비»(board-meet-form.js 가 새 미팅에 붙인다 — 보관함 «태그»로 바꿀 수 있다). 태그 없는 옛 자료는 경기 준비.
   · 경기 준비의 «경기 보드» 카드(#matchMeetCard, 2.965) 하나를 두 칸이 같이 쓴다 — 보이는 칸(matchStage)으로 옮기고, 그 칸의 자료만 그린다.
     상대 분석 칸에서는 «상대 분석 자료»: «#상대 분석» 미팅만 · «＋ 새 상대 분석»(그 경기 상대 분석의 국면 메모가 장마다 들어간다) · 가져오기도 «#상대 분석»만.
   · 연결은 예전 그대로 자료 쪽(matchRef — 2.928). 경기 문서에는 쓰지 않는다.
   scout.html 은 크기 예산이 거의 차서(tests/code-budget-3043) 여기서 더한다. mmPaint · mmCreateNow · mmLinkSheet · mmPost · matchRenderMeetings 는 scout.html 의
   function 선언(window 속성)이라 감싼다. matchStage · mmVS · mmLib 는 let/var 전역 — 이름으로 읽는다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSMatchMeetParts = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var TAG = { opp: '상대 분석', prep: '경기 준비' };
  function isOpp(d) { return !!d && Array.isArray(d.tags) && d.tags.indexOf(TAG.opp) >= 0; }
  // 이 칸에 붙일 자료만 — 상대 분석 칸은 «#상대 분석» 미팅 · 작전판, 경기 준비 칸은 나머지(태그 없는 옛 자료 포함)
  function partOf(d) { return isOpp(d) ? 'opp' : 'prep'; }
  function filterLib(lib, part) { return (Array.isArray(lib) ? lib : []).filter(function (d) { return !d || (d.type !== 'meeting' && d.type !== 'board') || partOf(d) === part; }); }
  // 경기 상대 분석의 메모 → 상대 분석 장의 메모(board-meet-form.js OPP_TPL 의 note 칸)
  function oppNotes(m, Ls) {
    Ls = Ls || function (v) { return String(v || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
    var sum = [];
    [['결론', 'oppConclusion'], ['강점', 'oppStrengths'], ['약점', 'oppWeaknesses'], ['키 플레이어', 'oppKeyPlayers']].forEach(function (r) {
      var ls = Ls(m && m[r[1]]); if (ls.length) sum.push(r[0] + ' — ' + ls.join(' · '));
    });
    return { sum: sum, atk: Ls(m && m.oppAttack), def: Ls(m && m.oppDefense), ta: Ls(m && m.oppAttackTransition), td: Ls(m && m.oppDefenseTransition), set: Ls(m && m.oppSetPlay) };
  }
  var TXT = {
    opp: { h: '상대 분석 자료', s: '보관함의 «상대 분석» 미팅을 여기서 바로 봐요 · 고치는 건 보관함에서 · 선수에게는 안 보여요',
      eb: '이 경기 상대 분석 자료가 아직 없어요', es: '보관함 «미팅 만들기»에서 «상대 분석»으로 만든 미팅을 가져오거나 여기서 새로 만들면 바로 보여요', nw: '＋ 새 상대 분석' }
  };

  function install(win) {
    if (!win || !win.document || win.__psMatchMeetParts) return null;
    win.__psMatchMeetParts = true;
    var doc = win.document, home = null, orig = {}, side = {}, last = {}, posting = null;
    /* global matchStage, mmVS, mmLib */
    function stage() { try { return typeof matchStage !== 'undefined' && matchStage === 'opp' ? 'opp' : 'prep'; } catch (_) { return 'prep'; } }
    function VS() { try { return typeof mmVS !== 'undefined' ? mmVS : null; } catch (_) { return null; } }
    function card() { return doc.getElementById('matchMeetCard'); }
    // 카드를 보이는 칸으로 — 경기 준비는 원래 자리, 상대 분석은 그 칸 맨 위
    function place(part) {
      var c = card(); if (!c) return;
      if (!home) home = { parent: c.parentNode, next: c.nextSibling };
      var grid = part === 'opp' ? doc.querySelector('#matchOppPanel .match-grid') : home.parent;
      if (!grid) return;
      if (part === 'opp') { if (c.parentNode !== grid || grid.firstElementChild !== c) grid.insertBefore(c, grid.firstElementChild); }
      else if (c.parentNode !== home.parent) home.parent.insertBefore(c, home.next && home.next.parentNode === home.parent ? home.next : null);
      c.classList.toggle('mm-part-opp', part === 'opp');
      var hb = c.querySelector('.match-card-head b'), hs = c.querySelector('.match-card-head small');
      if (hb && orig.h == null) { orig.h = hb.textContent; orig.s = hs ? hs.textContent : ''; }
      if (hb) hb.textContent = part === 'opp' ? TXT.opp.h : orig.h;
      if (hs) hs.textContent = part === 'opp' ? TXT.opp.s : orig.s;
    }
    // 칸마다 고른 자료 · 장을 따로 기억한다(mmVS[경기] 를 칸을 바꿀 때 바꿔 끼운다)
    function swapVS(mid, part) {
      var vs = VS(); if (!vs || !mid) return;
      if (last[mid] && last[mid] !== part) { side[last[mid] + '|' + mid] = vs[mid]; vs[mid] = side[part + '|' + mid] || { lib: '', i: 0 }; }
      last[mid] = part;
    }
    function texts(c, part) {
      if (part !== 'opp' || !c) return;
      var eb = c.querySelector('.mmv-empty .t b'), es = c.querySelector('.mmv-empty .t span');
      if (eb) eb.textContent = TXT.opp.eb; if (es) es.textContent = TXT.opp.es;
      [].forEach.call(c.querySelectorAll('[data-mm-new]'), function (b) { b.textContent = TXT.opp.nw; });
    }
    function wrapPaint() {
      var f = win.mmPaint; if (typeof f !== 'function') return false; if (f.__psParts) return true;
      var g = function (c, m, lib) {
        var part = stage();
        if (c && m) { swapVS(m.id, part); if (c.__mmPart !== part) { c.__sig = ''; c.__mmPart = part; } }
        var r = f.call(this, c, m, filterLib(lib, part));
        texts(c, part);
        return r;
      };
      g.__psParts = 1; win.mmPaint = g; return true;
    }
    function wrapRender() {
      var f = win.matchRenderMeetings; if (typeof f !== 'function') return false; if (f.__psParts) return true;
      var g = function (m) { try { place(stage()); } catch (_) {} return f.apply(this, arguments); };
      g.__psParts = 1; win.matchRenderMeetings = g; return true;
    }
    // «＋ 새 상대 분석» — 같은 «＋ 새 미팅» 길에 상대 분석 재료를 싣는다(이름 · 종류 · 국면 메모)
    function wrapCreate() {
      var f = win.mmCreateNow; if (typeof f !== 'function') return false; if (f.__psParts) return true;
      var g = function (m) { posting = stage() === 'opp' && m ? m : null; try { return f.apply(this, arguments); } finally { posting = null; } };
      g.__psParts = 1; win.mmCreateNow = g; return true;
    }
    function wrapPost() {
      var f = win.mmPost; if (typeof f !== 'function') return false; if (f.__psParts) return true;
      var g = function (msg) {
        if (posting && msg && msg.type === 'meetingFromMatch' && msg.payload) {
          var m = posting, opp = String(m.opponent || '').trim() || '상대', Ls = typeof win.matchCarryLines === 'function' ? win.matchCarryLines : null;
          msg = Object.assign({}, msg, { payload: Object.assign({}, msg.payload, { name: opp + '전 상대 분석', part: 'opp', tags: [TAG.opp], oppNotes: oppNotes(m, Ls) }) });
        }
        return f.call(this, msg);
      };
      g.__psParts = 1; win.mmPost = g; return true;
    }
    // 상대 분석 칸의 «보관함에서 가져오기» — «#상대 분석» 미팅만. 경기 준비 칸은 예전 시트 그대로(어느 칸에 보일지는 자료의 태그가 정한다)
    function wrapLink() {
      var f = win.mmLinkSheet; if (typeof f !== 'function') return false; if (f.__psParts) return true;
      var g = function (m) { return stage() === 'opp' ? oppSheet(m) : f.apply(this, arguments); };
      g.__psParts = 1; win.mmLinkSheet = g; return true;
    }
    function oppSheet(m) {
      if (!win.mmCanLib()) { win.toast('보관함 편집 권한이 있어야 가져올 수 있어요'); return; }
      win.mmLoadLib().then(function (lib) {
        var esc = win.esc, uid = win.mmMyUid(), team = win.mmIsTeamWs(), opp = String(m.opponent || '').trim() || '상대';
        var all = (lib || []).filter(function (d) { return win.mmLinkable(d) && isOpp(d); })
          .sort(function (a, b) { return (+(b.editedAt || b.savedAt) || 0) - (+(a.editedAt || a.savedAt) || 0); }).slice(0, 40);
        function row(d) {
          var here = d.matchRef && String(d.matchRef.mid) === String(m.id), mine = win.mmMine(d, uid, team), sl = win.mmSlidesOf(d), unit = d.type === 'board' ? '페이지' : '장';
          var why = here ? '이 경기에 이어져 있어요' : (!mine ? '만든 사람만 이을 수 있어요' : (d.matchRef ? ('지금 ' + (String(d.matchRef.opp || '').trim() || '다른 경기') + ' ' + String(win.mmDateLabel(d.matchRef.date)).split(' ')[0] + '에서 옮겨 와요') : ''));
          var th = (sl[0] && sl[0].thumb) || d.thumb || '';
          return '<button type="button" class="mm-pick" data-mm-lib="' + esc(d.libId) + '"' + ((here || !mine) ? ' disabled' : '') + '><span class="mm-pt" aria-hidden="true">' + (win.PSSafe && win.PSSafe.svg ? win.PSSafe.svg(th) : '') + '</span><span class="mm-pw"><b>' + esc(d.name || '상대 분석') + '</b><small>' + esc([sl.length + unit, why].filter(Boolean).join(' · ')) + '</small></span></button>';
        }
        var sh = win.mmSheet('<div class="mm-t" id="mmSheetT">' + esc(opp) + '전 상대 분석 — 보관함에서 가져오기</div>'
          + '<p class="mm-p">보관함에서 «상대 분석»으로 만든 미팅(태그 #상대 분석)을 이 경기와 이어요 — 자료는 보관함에 그대로 있고, 이 경기 상대 분석에서 바로 보여요.</p>'
          + (all.length ? '<div class="mm-list">' + all.map(row).join('') + '</div>' : '<p class="mm-p">«상대 분석» 미팅이 보관함에 아직 없어요 — «＋ 새 상대 분석»으로 바로 시작하거나, 보관함 «미팅 만들기»에서 «상대 분석»을 고르세요.</p>')
          + '<div class="mm-foot"><button type="button" data-mm-x>닫기</button></div>');
        sh.ov.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-mm-lib]'); if (!b || b.disabled) return; sh.close(); win.mmPost({ type: 'meetingLink', libId: b.getAttribute('data-mm-lib'), ref: win.mmRefOf(m) }); });
      });
    }
    var css = doc.createElement('style'); css.id = 'ps-match-meet-parts';
    css.textContent = '#matchMeetCard.mm-part-opp .mmv-old{display:none}';   // 옛 «경기 준비 보드» 줄은 경기 준비 칸에만
    (doc.head || doc.documentElement).appendChild(css);
    // 상대 분석 칸에서 잇고 떼는 알림(scout.html meetingLinkResult)은 «경기 보드»가 아니라 이 칸을 말한다
    function wrapToast() {
      var f = win.toast; if (typeof f !== 'function') return false; if (f.__psParts) return true;
      var g = function (msg) {
        if (stage() === 'opp' && typeof msg === 'string') msg = msg.replace('경기 보드에서 바로 보여요', '상대 분석에서 바로 보여요');
        return f.apply(this, [msg].concat([].slice.call(arguments, 1)));
      };
      g.__psParts = 1; win.toast = g; return true;
    }
    var tries = 0;
    function hook() {
      var ok = wrapPaint() & wrapRender() & wrapCreate() & wrapPost() & wrapLink() & wrapToast();
      if (!ok && ++tries < 40) win.setTimeout(hook, 250);
      else { try { var m = win.matchGet && win.matchGet(); if (m && card()) { place(stage()); win.matchRenderMeetings(m); } } catch (_) {} }
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', hook); else hook();
    return { place: place };
  }
  if (typeof window !== 'undefined' && window.document && /\/studio\/scout\.html/.test(String(window.location && window.location.pathname))) install(window);
  return { TAG: TAG, isOpp: isOpp, partOf: partOf, filterLib: filterLib, oppNotes: oppNotes, install: install };
});

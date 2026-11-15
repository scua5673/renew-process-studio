/* PROCESS STUDIO — 폰 전용 세로 편집(3.299). 사용자 «폰에서는 운동장 하나에 세로만 수정 가능하게 · 폰 전용» → 목업 B «보기 → 편집».
   폰(셸 body.ps-phone-work · board-phone-view.js 가 보기 전용으로 잠근 기기)에서 작업 보드가 세로 · 운동장 하나면 판 위에 «편집» 단추가 선다.
   누르면 편집 모드: board-phone-view.js 의 가드가 풀리고(win.__psPhoneEditOn) 머리줄(편집 중 · 저장 · 완료)과 아래 도구 띠(이동 · 선수 · 화살표 · 선 · 구역 · 글 · 지우개 · 되돌리기)만 보인다.
   · 폰에서만(큰 화면 편집기는 그대로 — PSPhoneBoardView.phone · expanded 판정 그대로). 운동장이 여럿(pitchN>1)이면 «편집» 대신 한 줄 안내.
   · 편집 모드에 들어가며 방향을 세로로(__setBoardOrient('v') — 좌표는 그대로인 보기 깃발). 방향 · 운동장 개수 설정은 폰에 없다.
   · 도구는 본문의 #toolSeg 단추를 누른다(setTool 은 본문 닫힌 함수) — 선수 올리기는 addPlayers(team,1) · 포메이션은 __psOpenFormation() · 되돌리기는 undoLast().
   · 저장은 지금 길 그대로(__boardSaveExplicit — 작업 보드). 「완료」는 저장 안 한 변경이 있으면 묻는다(저장하고 나가기 · 나중에 저장 · 계속 편집) — «나중에 저장»은 기기 초안(board-draft.js)에 남는다.
   · 편집 모드 동안 셸에 focusBoard(on) — 앱 머리 · 아래 메뉴가 걷혀 판이 높이를 다 쓴다. 나가면 off.
   · 1차 범위: 작업 보드(csView board)만. 보관함 자료 · 커뮤니티 보기 · 미팅 · 훈련 편집기 · 장면(애니메이션) 편집은 큰 화면에서.
   board.html 은 <script> 한 줄. board-phone-view.js 의 readOnly 가 __psPhoneEditOn 을 본다(한 줄). 시험: tests/board-phone-edit-3299.test.cjs · tests/browser/board-phone-edit-3299.mjs */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.PSPhoneEdit = api; try { api.mount(root); } catch (_) {} }
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var BAR = 'psPhoneEditBar', HEAD = 'psPhoneEditHead', TOOLS = 'psPhoneTools', SHEET = 'psPhoneSheet', CSS_ID = 'psPhoneEditCss';
  var TICK_MS = 700;
  var TOOLS_LIST = [['move', '이동'], ['players', '선수'], ['arrow', '화살표'], ['line', '선'], ['rect', '구역'], ['text', '글'], ['eraser', '지우개'], ['undo', '되돌리기']];
  var ARROWS = [['run', '선수 이동', '점선 화살표'], ['pass', '패스', '직선 화살표'], ['dribble', '드리블', '물결 화살표'], ['line', '직선', '화살촉 없음'], ['dashline', '점선', '화살촉 없음']];
  var TEAMS = [['blue', '팀 1', '#1e2a4a'], ['red', '팀 2', '#c92a3d'], ['yellow', '팀 3', '#eab308'], ['green', '팀 4', '#0e7a5f']];
  var ICON = {
    move: '<path d="M5 3l14 8-6 2-3 6z"></path>',
    players: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8M19 5v4M17 7h4"></path>',
    arrow: '<path d="M4 20L20 4M13 4h7v7"></path>',
    line: '<path d="M4 20L20 4"></path>',
    rect: '<rect x="4" y="6" width="16" height="12" rx="2" stroke-dasharray="4 3"></rect>',
    text: '<path d="M5 6h14M12 6v13M8 19h8"></path>',
    eraser: '<path d="M4 16l9-9 5 5-9 9H5zM13 20h7"></path>',
    undo: '<path d="M9 14l-4-4 4-4M5 10h9a5 5 0 0 1 0 10h-3"></path>'
  };

  /* ── 순수 규칙(시험이 본다) ───────────────────────────────────────────── */
  /* 폰 편집을 열 수 있나 — 하나라도 아니면 까닭 */
  function canEdit(env) {
    env = env || {};
    if (!env.phone) return { ok: false, why: 'not-phone' };
    if (env.expanded) return { ok: false, why: 'expanded' };
    if (!env.ready) return { ok: false, why: 'booting' };
    if ((env.csView || 'board') !== 'board') return { ok: false, why: 'view:' + env.csView };
    if (env.vault) return { ok: false, why: 'vault' };
    if (env.community) return { ok: false, why: 'community' };
    if (env.meeting) return { ok: false, why: 'meeting' };
    if (env.editing) return { ok: false, why: 'editing' };
    if (env.viewOnly) return { ok: false, why: 'view-only' };
    if ((env.pitchN || 1) > 1) return { ok: false, why: 'multi-pitch' };
    return { ok: true, why: 'ok' };
  }
  /* 판 위 줄의 글 — 열 수 있으면 사실 한 줄, 운동장이 여럿이면 안내, 그 밖엔 줄 없음 */
  function barText(d) {
    if (!d) return '';
    if (d.ok) return '세로 · 운동장 1';
    if (d.why === 'multi-pitch') return '운동장이 여럿인 보드는 큰 화면에서 고쳐요';
    return '';
  }
  /* 선 단추: 직선 ↔ 점선 — 지금 직선이면 점선으로 */
  function nextLine(cur) { return cur === 'line' ? 'dashline' : 'line'; }

  /* ── 브라우저 ─────────────────────────────────────────────────────────── */
  function hasCls(win, c) { try { return !!(win.document.body && win.document.body.classList.contains(c)); } catch (_) { return false; } }
  function stateOf(win) { try { return (typeof win.state !== 'undefined' && win.state) ? win.state : (typeof state !== 'undefined' ? state : null); } catch (_) { return null; } }
  function PV(win) { return win.PSPhoneBoardView || null; }
  function envOf(win) {
    var pv = PV(win), s = stateOf(win), community = false;
    try { community = /(^|[?&])community_view=1(&|$)/.test(String(win.location.search || '')) || hasCls(win, 'comm-viewing'); } catch (_) { community = false; }
    return {
      phone: !!(pv && pv.phone(win)), expanded: !!(pv && pv.expanded(win)), ready: win.__boardReady === true,
      csView: win.__csView || 'board', vault: !!(win.__vaultViewMode || win.__vaultEdit || win.__vaultBook),
      community: community, meeting: hasCls(win, 'focus-board') || hasCls(win, 'meet-mode'), editing: hasCls(win, 'editing') || !!win.__trainingWizardActive,
      viewOnly: hasCls(win, 'ps-viewonly'), pitchN: (s && +s.pitchN) || 1
    };
  }

  var CSS = '' +
    'body.ps-phone-can-edit #psPhoneBoardNotice,body.ps-phone-edit #psPhoneBoardNotice{display:none!important}' +
    '#' + BAR + '{display:none;align-items:center;gap:10px;padding:8px 14px;background:var(--panel2,#f1f3f5);border-bottom:1px solid var(--line,#dfe4ec);font-size:14px;color:var(--txt,#172033);font-family:inherit}' +
    'body.ps-phone-can-edit #' + BAR + ',body.ps-phone-locked #' + BAR + '{display:flex}' +
    'body.ps-phone-edit #' + BAR + '{display:none!important}' +
    '#' + BAR + ' .pe-txt{min-width:0;font-size:14px;color:var(--txt-dim,#718096)}' +
    'body.ps-phone-locked #' + BAR + ' .pe-txt{color:var(--txt,#172033)}' +
    '#' + BAR + ' .pe-btn{margin-left:auto;height:36px;padding:0 16px;border-radius:10px;border:0;background:var(--blue,var(--ps-navy,#14213D));color:#fff;font-size:14px;font-weight:600;font-family:inherit;flex:0 0 auto}' +
    'body.ps-phone-locked #' + BAR + ' .pe-btn{display:none}' +
    '#' + HEAD + '{display:none;align-items:center;gap:8px;padding:8px 12px;background:var(--panel,#fff);border-bottom:1px solid var(--line,#dfe4ec);font-family:inherit}' +
    'body.ps-phone-edit #' + HEAD + '{display:flex}' +
    '#' + HEAD + ' .pe-ttl{font-size:14px;font-weight:700;color:var(--txt,#172033);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '#' + HEAD + ' .pe-ttl small{font-size:12px;font-weight:500;color:var(--txt-dim,#718096);margin-left:6px}' +
    '#' + HEAD + ' .pe-sp{flex:1}' +
    '#' + HEAD + ' button{height:36px;padding:0 14px;border-radius:10px;border:1px solid var(--line,#dfe4ec);background:var(--panel,#fff);color:var(--txt,#172033);font-size:14px;font-weight:600;font-family:inherit;flex:0 0 auto}' +
    '#' + HEAD + ' button.pri{background:var(--blue,var(--ps-navy,#14213D));border-color:var(--blue,var(--ps-navy,#14213D));color:#fff}' +
    '#' + HEAD + ' button[disabled]{opacity:.55}' +
    '#' + TOOLS + '{display:none;flex:0 0 72px;height:72px;grid-template-columns:repeat(8,minmax(0,1fr));align-items:center;background:var(--panel,#fff);border-top:1px solid var(--line,#dfe4ec);padding:0 6px;font-family:inherit}' +
    'body.ps-phone-edit #' + TOOLS + '{display:grid}' +
    '#' + TOOLS + ' button{border:0;background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;height:60px;border-radius:10px;font-size:12px;font-weight:500;color:var(--txt-dim,#718096);padding:0;font-family:inherit}' +
    '#' + TOOLS + ' button svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}' +
    '#' + TOOLS + ' button.on{background:var(--ps-color-action-soft,#E9EDF5);color:var(--blue,var(--ps-navy,#14213D));font-weight:600}' +
    /* 편집 모드에서도 큰 화면 도구는 숨긴다(보기 전용 잠금이 풀리면 되살아나므로) — 토스트(#hint) · 선택 띠(.sel-ctl) · 포메이션 카드(#emptyHint)는 둔다 */
    'body.ps-phone-edit :is(#boardToolbar,#bench,#drawPanel,.draw-ctl,#ps-dock,#ps-command-dock,#floatBar,#toolSeg,#cmd-board-settings-pop,#boardManualSave,#vaultSave,#psSaveBar,#ehDoor,#ps-df-tray,#ps-df-opts,#psPhoneHint,#hint,#alignBar,#psEditTools,#psEditToolsToggle){display:none!important}' +
    'body.ps-phone-edit #boardStage{touch-action:none}' +
    /* 시트 */
    '#' + SHEET + '{position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.42);display:flex;align-items:flex-end;font-family:inherit}' +
    '#' + SHEET + ' .ps-sh{width:100%;max-height:72%;background:var(--panel,#fff);color:var(--txt,#172033);border-radius:10px 10px 0 0;box-shadow:0 -12px 40px rgba(15,23,42,.25);display:flex;flex-direction:column;overflow:auto;padding-bottom:12px}' +
    '#' + SHEET + ' .ps-grab{width:36px;height:4px;border-radius:999px;background:var(--line,#dfe4ec);margin:8px auto 0;flex:0 0 4px}' +
    '#' + SHEET + ' .ps-hd{display:flex;align-items:flex-start;gap:12px;padding:12px 16px 0}' +
    '#' + SHEET + ' .ps-hd h2{font-size:20px;font-weight:700;margin:0;line-height:1.3}' +
    '#' + SHEET + ' .ps-hd p{font-size:14px;color:var(--txt-dim,#718096);margin:2px 0 0}' +
    '#' + SHEET + ' .ps-x{margin-left:auto;width:32px;height:32px;flex:0 0 32px;border-radius:6px;border:1px solid var(--line,#dfe4ec);background:var(--panel,#fff);color:var(--txt,#172033);font-size:16px;line-height:1;padding:0}' +
    '#' + SHEET + ' .ps-sec{padding:14px 16px 6px;font-size:14px;font-weight:600}' +
    '#' + SHEET + ' .ps-chips{display:flex;gap:8px;padding:0 16px 8px;flex-wrap:wrap}' +
    '#' + SHEET + ' .ps-chip{height:44px;padding:0 14px;border-radius:999px;border:1px solid var(--line,#dfe4ec);background:var(--panel,#fff);color:var(--txt,#172033);font-size:14px;font-weight:500;display:inline-flex;align-items:center;gap:8px;font-family:inherit}' +
    '#' + SHEET + ' .ps-dot{width:12px;height:12px;border-radius:999px;display:inline-block}' +
    '#' + SHEET + ' .ps-opt{display:flex;align-items:center;gap:12px;padding:12px 16px;border:0;border-top:1px solid var(--line2,#eceef2);background:transparent;color:var(--txt,#172033);font-size:14px;font-weight:500;text-align:left;width:100%;font-family:inherit;min-height:48px}' +
    '#' + SHEET + ' .ps-opt.on{background:var(--ps-color-action-soft,#E9EDF5)}' +
    '#' + SHEET + ' .ps-opt small{margin-left:auto;font-size:12px;color:var(--txt-dim,#718096)}' +
    '#' + SHEET + ' .ps-note{font-size:12px;color:var(--txt-dim,#718096);padding:10px 16px 0}';

  function el(doc, tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function svg(doc, name) { var s = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = ICON[name] || ''; return s; }
  function ensureCss(win) { var doc = win.document; if (doc.getElementById(CSS_ID)) return; var st = doc.createElement('style'); st.id = CSS_ID; st.textContent = CSS; (doc.head || doc.documentElement).appendChild(st); }
  function toast(win, msg) { try { if (typeof win.toast === 'function') win.toast(msg); } catch (_) {} }
  function stage(win) { return win.document.getElementById('boardStage'); }
  function curTool(win) { var s = stateOf(win); return (s && s.tool) || 'move'; }
  function setTool(win, t) {
    var b = win.document.querySelector('#toolSeg button[data-tool="' + t + '"]');
    if (b) { try { b.click(); } catch (_) {} }
    paintTools(win);
  }
  function dirty(win) { try { return typeof win.boardManualChanged === 'function' ? !!win.boardManualChanged() : false; } catch (_) { return false; } }
  /* 폰 편집 모드의 선수는 손가락 크기로 — 보관함 폰 보기(3.134)와 같은 길: commViewTok(그리는 배율만, tokenScale · 저장본은 그대로)을 감싼다.
     375px 폰의 세로 운동장은 1m ≈ 5px 라 기본 선수가 9px, 보기용 1.6 배도 14px — 손가락으로 끌려면 2.4 배(≈ 21px + 본문의 터치 여유 _tokHitPx). */
  var TOK = 2.4;
  function wrapTok(win) {
    var cv = win.commViewTok; if (typeof cv !== 'function' || cv.__psPhoneEdit) return;
    var w = function () { var r = cv.apply(this, arguments); if (r) return r; return (win.__psPhoneEditOn === true && !win.__psThumbNoEd) ? TOK : r; };
    w.__psPhoneEdit = true; win.commViewTok = w;
  }
  /* 배율만 바뀐 다시 그리기 — 편집으로 세지 않게 __capLock 을 살렸다 되돌린다(3.190 _consumePending 과 같은 방법) */
  function repaint(win) {
    var had = win.__capLock || 0; win.__capLock = had + 1;
    try { if (typeof win.renderTokens === 'function') win.renderTokens(); } catch (_) {}
    finally { win.__capLock = had; }
  }
  function focusShell(win, on) { try { if (win.parent && win.parent !== win) win.parent.postMessage({ source: 'board', type: 'focusBoard', on: !!on }, '*'); } catch (_) {} }
  function refit(win) { try { win.dispatchEvent(new win.Event('resize')); } catch (_) {} try { if (typeof win.applyView === 'function') win.applyView(); } catch (_) {} }

  /* ── 판 위 줄(보기) · 머리줄 · 도구 띠 ───────────────────────────────── */
  var ui = { bar: null, head: null, tools: null, lastArrow: 'pass', arrowSheetOpen: false };
  function build(win) {
    var doc = win.document, st = stage(win); if (!st || !st.parentNode) return false;
    if (!ui.bar) {
      var bar = el(doc, 'div'); bar.id = BAR; bar.setAttribute('role', 'note');
      bar.appendChild(el(doc, 'span', 'pe-txt', ''));
      var b = el(doc, 'button', 'pe-btn', '편집'); b.type = 'button'; b.onclick = function () { enter(win); }; bar.appendChild(b);
      ui.bar = bar;
    }
    if (!ui.head) {
      var head = el(doc, 'div'); head.id = HEAD;
      var ttl = el(doc, 'span', 'pe-ttl', '편집 중'); var sm = el(doc, 'small', null, '세로 · 운동장 1'); ttl.appendChild(sm); head.appendChild(ttl);
      head.appendChild(el(doc, 'span', 'pe-sp'));
      var save = el(doc, 'button', null, '저장'); save.type = 'button'; save.id = HEAD + 'Save'; save.onclick = function () { saveNow(win); }; head.appendChild(save);
      var done = el(doc, 'button', 'pri', '완료'); done.type = 'button'; done.id = HEAD + 'Done'; done.onclick = function () { leave(win, true); }; head.appendChild(done);
      ui.head = head;
    }
    if (!ui.tools) {
      var tools = el(doc, 'nav'); tools.id = TOOLS; tools.setAttribute('aria-label', '편집 도구');
      TOOLS_LIST.forEach(function (t) {
        var b = el(doc, 'button'); b.type = 'button'; b.dataset.pe = t[0]; b.appendChild(svg(doc, t[0])); b.appendChild(doc.createTextNode(t[1]));
        b.onclick = function () { act(win, t[0]); };
        tools.appendChild(b);
      });
      ui.tools = tools;
    }
    if (ui.bar.parentNode !== st.parentNode) st.parentNode.insertBefore(ui.bar, st);
    if (ui.head.parentNode !== st.parentNode) st.parentNode.insertBefore(ui.head, st);
    if (ui.tools.parentNode !== st.parentNode) st.parentNode.insertBefore(ui.tools, st.nextSibling);
    return true;
  }
  function paintTools(win) {
    if (!ui.tools) return;
    var t = curTool(win), key = t;
    if (['run', 'pass', 'dribble'].indexOf(t) >= 0) key = 'arrow';
    else if (t === 'dashline') key = 'line';
    [].forEach.call(ui.tools.querySelectorAll('button'), function (b) { b.classList.toggle('on', b.dataset.pe === key); });
  }
  function act(win, k) {
    if (k === 'move' || k === 'rect' || k === 'text' || k === 'eraser') { setTool(win, k); return; }
    if (k === 'line') { setTool(win, nextLine(curTool(win))); return; }
    if (k === 'undo') { try { if (typeof win.undoLast === 'function') win.undoLast(); } catch (_) {} paintTools(win); return; }
    if (k === 'arrow') { openArrows(win); return; }
    if (k === 'players') { openPlayers(win); return; }
  }

  /* ── 시트 ─────────────────────────────────────────────────────────────── */
  function closeSheet(win) { var s = win.document.getElementById(SHEET); if (s) s.remove(); ui.arrowSheetOpen = false; }
  function sheet(win, title, sub) {
    closeSheet(win);
    var doc = win.document, root = el(doc, 'div'); root.id = SHEET;
    var box = el(doc, 'section', 'ps-sh'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', title);
    box.appendChild(el(doc, 'div', 'ps-grab'));
    var hd = el(doc, 'div', 'ps-hd'), tx = el(doc, 'div'); tx.appendChild(el(doc, 'h2', null, title)); if (sub) tx.appendChild(el(doc, 'p', null, sub)); hd.appendChild(tx);
    var x = el(doc, 'button', 'ps-x', '×'); x.type = 'button'; x.setAttribute('aria-label', '닫기'); x.onclick = function () { closeSheet(win); }; hd.appendChild(x);
    box.appendChild(hd); root.appendChild(box);
    root.addEventListener('pointerdown', function (e) { if (e.target === root) { e.preventDefault(); closeSheet(win); } });
    doc.body.appendChild(root);
    return box;
  }
  function openPlayers(win) {
    var doc = win.document, box = sheet(win, '선수 올리기', '칩을 누르면 빈 자리에 하나씩 올라가요');
    box.appendChild(el(doc, 'div', 'ps-sec', '팀'));
    var chips = el(doc, 'div', 'ps-chips');
    TEAMS.forEach(function (t) {
      var c = el(doc, 'button', 'ps-chip'); c.type = 'button'; c.dataset.team = t[0];
      var d = el(doc, 'span', 'ps-dot'); d.style.background = t[2]; c.appendChild(d); c.appendChild(doc.createTextNode(t[1]));
      c.onclick = function () { try { if (typeof win.addPlayers === 'function') win.addPlayers(t[0], 1); } catch (_) {} setTool(win, 'move'); closeSheet(win); };
      chips.appendChild(c);
    });
    box.appendChild(chips);
    box.appendChild(el(doc, 'div', 'ps-sec', '한 번에'));
    var f = el(doc, 'button', 'ps-opt', '11명 포메이션으로 놓기'); f.type = 'button'; f.dataset.pe = 'formation';
    var fs = el(doc, 'small', null, '4-3-3 · 4-4-2 · …'); f.appendChild(fs);
    f.onclick = function () { closeSheet(win); setTool(win, 'move'); try { if (typeof win.__psOpenFormation === 'function') win.__psOpenFormation(); } catch (_) {} };
    box.appendChild(f);
    box.appendChild(el(doc, 'div', 'ps-note', '운동장은 하나 · 세로 고정이에요. 방향과 개수는 아이패드 · 컴퓨터에서 바꿔요.'));
  }
  function openArrows(win) {
    var doc = win.document, box = sheet(win, '화살표', '고른 종류가 도구 띠에 남아요'); ui.arrowSheetOpen = true;
    var cur = curTool(win);
    ARROWS.forEach(function (a) {
      var o = el(doc, 'button', 'ps-opt' + (cur === a[0] ? ' on' : ''), a[1]); o.type = 'button'; o.dataset.tool = a[0];
      o.appendChild(el(doc, 'small', null, a[2]));
      o.onclick = function () { ui.lastArrow = a[0]; setTool(win, a[0]); closeSheet(win); };
      box.appendChild(o);
    });
    box.appendChild(el(doc, 'div', 'ps-note', '연결선 · 다각형 · 자유선은 아이패드 · 컴퓨터에서.'));
  }

  /* ── 들어가기 · 저장 · 나가기 ─────────────────────────────────────────── */
  function enter(win) {
    var d = canEdit(envOf(win)); if (!d.ok) { toast(win, barText(d) || '지금은 폰에서 고칠 수 없어요'); return false; }
    if (!build(win)) return false;
    var body = win.document.body;
    win.__psPhoneEditOn = true;
    body.classList.add('ps-phone-edit'); body.classList.remove('ps-phone-can-edit'); body.classList.remove('ps-phone-locked');
    try { if (win.__psPhoneBoardView && win.__psPhoneBoardView.sync) win.__psPhoneBoardView.sync(); } catch (_) {}
    try { if (typeof win.__getBoardOrient === 'function' && win.__getBoardOrient() !== 'v' && typeof win.__setBoardOrient === 'function') win.__setBoardOrient('v'); } catch (_) {}
    focusShell(win, true);
    setTool(win, 'move');
    refit(win);
    repaint(win);
    return true;
  }
  function saveNow(win) {
    var b = win.document.getElementById(HEAD + 'Save');
    if (typeof win.__boardSaveExplicit !== 'function') { toast(win, '지금은 저장할 수 없어요'); return Promise.resolve(false); }
    if (b) b.disabled = true;
    return Promise.resolve().then(function () { return win.__boardSaveExplicit(); }).then(function (ok) {
      if (b) b.disabled = false;
      toast(win, ok ? '보드에 저장됨 ✓' : '저장하지 못했어요 — 잠시 뒤 다시');
      return !!ok;
    }, function () { if (b) b.disabled = false; toast(win, '저장하지 못했어요 — 잠시 뒤 다시'); return false; });
  }
  function exit(win) {
    var body = win.document.body;
    closeSheet(win);
    win.__psPhoneEditOn = false;
    body.classList.remove('ps-phone-edit');
    try { setTool(win, 'move'); } catch (_) {}
    try { if (typeof win.deselect === 'function') win.deselect(); } catch (_) {}
    try { if (win.__psPhoneBoardView && win.__psPhoneBoardView.sync) win.__psPhoneBoardView.sync(); } catch (_) {}
    focusShell(win, false);
    refit(win);
    repaint(win);
    tick(win);
  }
  function leave(win, ask) {
    if (!ask || !dirty(win) || typeof win.psChoice !== 'function') { exit(win); return; }
    win.psChoice('저장 안 한 변경이 있어요.\n저장하고 나갈까요?', [
      { label: '저장하고 나가기', primary: true, value: 'save' },
      { label: '나중에 저장', value: 'later' },
      { label: '계속 편집', value: null }
    ], function (pick) {
      if (pick === 'save') { saveNow(win).then(function () { exit(win); }); }
      else if (pick === 'later') exit(win);
    });
  }

  /* ── 보기 중 판 위 줄 ─────────────────────────────────────────────────── */
  function tick(win) {
    var body = win.document.body; if (!body) return;
    if (win.__psPhoneEditOn) return;
    var pv = PV(win), ro = false;
    try { ro = !!(pv && pv.readOnly(win)); } catch (_) { ro = false; }
    var d = ro ? canEdit(envOf(win)) : { ok: false, why: 'not-phone' };
    var can = d.ok, locked = !d.ok && d.why === 'multi-pitch';
    if ((can || locked) && !build(win)) return;
    if (ui.bar) { var t = ui.bar.querySelector('.pe-txt'); if (t) t.textContent = barText(d); }
    if (body.classList.contains('ps-phone-can-edit') !== can) body.classList.toggle('ps-phone-can-edit', can);
    if (body.classList.contains('ps-phone-locked') !== locked) body.classList.toggle('ps-phone-locked', locked);
  }
  function mount(win) {
    if (!win || !win.document) return;
    var boot = function () {
      ensureCss(win);
      try { wrapTok(win); } catch (_) {}
      win.setInterval(function () { try { tick(win); } catch (_) {} }, TICK_MS);
      try { win.document.addEventListener('click', function () { if (win.__psPhoneEditOn) paintTools(win); }); } catch (_) {}
    };
    if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
    win.__psPhoneEdit = { enter: function () { return enter(win); }, leave: function (ask) { return leave(win, ask !== false); }, save: function () { return saveNow(win); }, on: function () { return !!win.__psPhoneEditOn; }, can: function () { return canEdit(envOf(win)); } };
  }

  return { canEdit: canEdit, barText: barText, nextLine: nextLine, envOf: envOf, TOOLS_LIST: TOOLS_LIST, ARROWS: ARROWS, TEAMS: TEAMS, mount: mount };
});

/* PROCESS STUDIO — 앱을 열면 «불러오기» 창(3.297). 사용자 «처음 열었을 때 보드가 나오는데 불러오기 형태로 불러올 수 있게» → 목업 B-1 «보드 위에 떠 있는 창».
   앱을 열면 마지막 작업 보드가 뒤에 그대로 복원되고(«앱을 열면 언제나 작전판» 그대로), 그 위에 창 하나:
   «이어서»(작업 보드) · «새 보드» · 보관함 작전판 목록(이름 찾기 · 폴더 · 최근 저장 순).
   · 로그인한 코칭스태프에게만(psVaultUnlocked · PSPerms.role 이 player 가 아닐 때). 게스트 · 선수는 지금처럼 바로 보드로.
   · 보관함에 작전판(type board)이 하나 이상일 때만. 없으면 지금처럼 문(«포메이션으로 시작 ＋»)만.
   · 셸을 연 뒤 한 번(셸 창의 __psOpenChooserShown) — 다른 탭에서 보드로 돌아올 때 · 팀 전환으로 보드가 다시 실릴 때는 다시 뜨지 않는다. 새로고침은 새로 연 것.
   · 보드가 보이는 화면(셸 body[data-ps-app=board]) · 작업 보드 화면(csView board)일 때만. 보관함 자료 · 커뮤니티 보기 · 첨부 · 미팅 · 훈련 편집 · 보기 전용 · 공유 링크(#share · #s · #pack)면 뜨지 않는다.
   · 닫기 · Esc · 바깥 = 이어서. «새 보드» = 띠의 «새 보드»(#bpNewBoard) 그대로(비운 뒤 1분 «↶ 이전 보드»도 그대로).
   · «열기» = 보관함 «편집» 길(board.html __psVaultOpenItem → openItemEdit: 저장하기 → 그 자료 · 나가기 → 작업 보드). 남의 자료 · 폰(보기 전용)은 «보기».
   · 보드 설정 › 내 화면 › «앱을 열 때» 줄로 끈다(localStorage ps_open_chooser_v1 = '0'). 시험 fixture 는 기본으로 끈다(tests/fixtures/team-app.mjs openChooser).
   board.html 은 <script> 한 줄 + 보관함 IIFE 의 문 한 줄(__psVaultOpenItem). 시험: tests/board-open-chooser.test.cjs · tests/browser/board-open-chooser.mjs */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.PSOpenChooser = api; try { api.mount(root); } catch (_) {} }
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var PREF = 'ps_open_chooser_v1';
  var ID = 'psOpenChooser', CSS_ID = 'psOpenChooserCss', SEG_ID = 'psOpenChooserSeg', ROW_ID = 'psOpenChooserRow';
  var READY_WAIT_MS = 20000, READY_TICK_MS = 150, SETTLE_MS = 320;

  /* ── 순수 함수(시험이 본다) ───────────────────────────────────────────── */
  function prefOn(ls) { try { return (ls && ls.getItem(PREF)) !== '0'; } catch (_) { return true; } }
  function snapOf(d) { if (!d) return null; if (Array.isArray(d.pages) && d.pages.length && d.pages[0] && d.pages[0].snap) return d.pages[0].snap; return d.snap || null; }
  /* 보관함의 작전판만(type board · 판이 있는 것) · 최근 저장 순. 패턴북(book)도 작전판이다. */
  function boards(lib) {
    return (Array.isArray(lib) ? lib : []).filter(function (d) { return !!(d && d.type === 'board' && snapOf(d)); })
      .sort(function (a, b) { return (Number(b.savedAt) || Number(b.editedAt) || 0) - (Number(a.savedAt) || Number(a.editedAt) || 0); });
  }
  function dateLabel(ts, now) {
    if (!ts) return '';
    var d = new Date(ts), n = new Date(now || Date.now());
    if (isNaN(d.getTime())) return '';
    var hh = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()) return '오늘 ' + hh;
    var y = new Date(n.getTime() - 86400000);
    if (d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate()) return '어제 ' + hh;
    return (d.getFullYear() === n.getFullYear() ? '' : d.getFullYear() + '/') + (d.getMonth() + 1) + '/' + d.getDate();
  }
  /* «11/14 · 페이지 2 · 장면 6 · 미팅 자료» — 사실만, 있는 것만 */
  function meta(d, now) {
    var parts = [], dl = dateLabel(d && (d.savedAt || d.editedAt), now);
    if (dl) parts.push(dl);
    var np = (d && Array.isArray(d.pages) && d.pages.length > 1) ? d.pages.length : 1;
    if (np > 1) parts.push('페이지 ' + np);
    var nf = (d && Array.isArray(d.frames)) ? d.frames.length : 0;
    if (!nf && d && Array.isArray(d.pages)) d.pages.forEach(function (p) { var f = p && p.anim && p.anim.frames; if (Array.isArray(f) && f.length > 1) nf += f.length; });
    if (nf > 1) parts.push('장면 ' + nf);
    if (d && d.folder) parts.push(String(d.folder).split('/').filter(Boolean).pop() || String(d.folder));
    return parts.join(' · ');
  }
  function folderOf(d) { return (d && d.folder) ? String(d.folder) : ''; }
  /* 폴더 칩: 전체 n 이 먼저, 그 뒤 많은 순(같으면 이름순). 폴더 없는 자료는 «폴더 없음» */
  function folders(items) {
    var m = {}, out = [];
    (items || []).forEach(function (d) { var f = folderOf(d) || ''; m[f] = (m[f] || 0) + 1; });
    Object.keys(m).forEach(function (k) { out.push({ key: k, name: k ? (k.split('/').filter(Boolean).pop() || k) : '폴더 없음', n: m[k] }); });
    out.sort(function (a, b) { return (b.n - a.n) || a.name.localeCompare(b.name, 'ko'); });
    out.unshift({ key: null, name: '전체', n: (items || []).length });
    return out;
  }
  function filter(items, o) {
    o = o || {};
    var q = String(o.q || '').trim().toLowerCase();
    return (items || []).filter(function (d) {
      if (o.folder !== null && o.folder !== undefined && folderOf(d) !== o.folder) return false;
      if (q && String((d && d.name) || '').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  /* 뜰까 — 하나라도 아니면 그 이유를 돌려준다(시험 · 진단용) */
  function decide(env) {
    env = env || {};
    if (!env.inShell) return { show: false, why: 'standalone' };
    if (!env.pref) return { show: false, why: 'pref-off' };
    if (env.shown) return { show: false, why: 'shown' };
    if (!env.visible) return { show: false, why: 'not-visible' };
    if (!env.unlocked) return { show: false, why: 'locked' };
    if (env.role === 'player') return { show: false, why: 'player' };
    if (env.viewOnly) return { show: false, why: 'view-only' };
    if ((env.csView || 'board') !== 'board') return { show: false, why: 'view:' + env.csView };
    if (env.vault) return { show: false, why: 'vault' };
    if (env.capturing) return { show: false, why: 'capturing' };
    if (env.community) return { show: false, why: 'community' };
    if (env.meeting) return { show: false, why: 'meeting' };
    if (env.editing) return { show: false, why: 'editing' };
    if (env.deeplink) return { show: false, why: 'deeplink' };
    if (typeof env.count === 'number' && env.count < 1) return { show: false, why: 'no-boards' };
    return { show: true, why: 'ok' };
  }
  /* 작업 보드 타일의 글 */
  function workMeta(info) {
    info = info || {};
    if (info.draft) {   /* 3.317 — 보관함 자료를 고치다 둔 초안이 있으면 «이어서»는 그 자료다 */
      var f = info.draft.folder ? String(info.draft.folder).split('/').filter(Boolean).pop() : '';
      return { label: '이어서', name: info.draft.name || '보관함 작전판', meta: '보관함 · 저장 안 한 변경' + (f ? ' · ' + f : '') };
    }
    if (info.empty) return { label: '이어서', name: '빈 보드로 시작', meta: '운동장만 있어요' };
    var parts = [];
    if (info.pages > 1) parts.push('페이지 ' + info.pages);
    if (info.frames > 1) parts.push('장면 ' + info.frames);
    return { label: '이어서', name: '작업 보드', meta: parts.length ? parts.join(' · ') : '마지막에 보던 판 그대로' };
  }

  /* ── 브라우저 ─────────────────────────────────────────────────────────── */
  function hasCls(win, c) { try { return !!(win.document.body && win.document.body.classList.contains(c)); } catch (_) { return false; } }
  function parentOf(win) { try { return (win.parent && win.parent !== win) ? win.parent : null; } catch (_) { return null; } }
  function deeplink(win) {
    var p = parentOf(win), h = '';
    try { h = String((p || win).location.hash || ''); } catch (_) { h = ''; }
    return /^#(share=|s=|pack=)/.test(h);
  }
  function envOf(win, count) {
    var p = parentOf(win), visible = false, shown = false, role = '', unlocked = false, community = false;
    try { visible = !!(p && p.document && p.document.body && p.document.body.getAttribute('data-ps-app') === 'board'); } catch (_) { visible = false; }
    try { shown = !!(p && p.__psOpenChooserShown); } catch (_) { shown = true; }
    try { unlocked = typeof win.psVaultUnlocked === 'function' && win.psVaultUnlocked() === true; } catch (_) { unlocked = false; }
    try { role = (win.PSPerms && typeof win.PSPerms.role === 'function') ? String(win.PSPerms.role() || '') : ''; } catch (_) { role = ''; }
    try { community = /(^|[?&])community_view=1(&|$)/.test(String(win.location.search || '')) || hasCls(win, 'comm-viewing'); } catch (_) { community = false; }
    return {
      inShell: !!p, pref: prefOn(win.localStorage), shown: shown, visible: visible, unlocked: unlocked, role: role,
      viewOnly: hasCls(win, 'ps-viewonly'), csView: win.__csView || 'board',
      vault: !!(win.__vaultViewMode || win.__vaultEdit || win.__vaultBook), capturing: hasCls(win, 'ps-capturing'),
      community: community, meeting: hasCls(win, 'focus-board'), editing: hasCls(win, 'editing') || !!win.__trainingWizardActive,
      deeplink: deeplink(win), count: count
    };
  }
  function phone(win) { try { return (typeof win.psPhoneBoardReadOnly === 'function' && win.psPhoneBoardReadOnly()) || (win.innerWidth || 0) < 640; } catch (_) { return false; } }
  function canEdit(win, d) { try { return typeof win.canEditItem === 'function' ? !!win.canEditItem(d) : true; } catch (_) { return true; } }
  function safeSvg(win, s) { try { return (win.PSSafe && typeof win.PSSafe.svg === 'function') ? win.PSSafe.svg(s) : ''; } catch (_) { return ''; } }
  function workInfo(win) {
    var info = { empty: false, pages: 1, frames: 0 };
    try {
      var sn = typeof win.captureSnap === 'function' ? win.captureSnap() : null;
      if (sn) info.empty = !((sn.players || []).length || (sn.equipment || []).length || (sn.drawings || []).length);
    } catch (_) {}
    try {
      var pg = (win.__psPages && typeof win.__psPages.pg === 'function') ? win.__psPages.pg() : null;
      if (Array.isArray(pg) && pg.length) {
        info.pages = pg.length;
        var any = false, nf = 0;
        pg.forEach(function (p) { var f = p && p.anim && p.anim.frames; if (Array.isArray(f) && f.length > 1) nf += f.length; try { var s = p && p.snap; if (s && ((s.players || []).length || (s.equipment || []).length || (s.drawings || []).length)) any = true; } catch (_) {} });
        info.frames = nf; if (any) info.empty = false;
      }
    } catch (_) {}
    return info;
  }

  var CSS = '' +
    '#' + ID + '{position:fixed;inset:0;z-index:10040;background:rgba(15,23,42,.42);display:flex;align-items:center;justify-content:center;padding:24px;font-family:inherit}' +
    '#' + ID + ' .oc{width:760px;max-width:100%;max-height:100%;background:var(--panel,#fff);color:var(--txt,#172033);border:1px solid var(--line,#dfe4ec);border-radius:10px;box-shadow:0 24px 60px rgba(15,23,42,.28);display:flex;flex-direction:column;overflow:hidden;text-align:left;outline:0}' +
    '#' + ID + ' .oc-h{display:flex;align-items:flex-start;gap:12px;padding:20px 22px 0}' +
    '#' + ID + ' .oc-h h2{font-size:20px;font-weight:700;margin:0;line-height:1.3}' +
    '#' + ID + ' .oc-h p{font-size:14px;color:var(--txt-dim,#718096);margin:2px 0 0}' +
    '#' + ID + ' .oc-x{margin-left:auto;width:32px;height:32px;flex:0 0 32px;border-radius:6px;border:1px solid var(--line,#dfe4ec);background:var(--panel,#fff);color:var(--txt,#172033);display:grid;place-items:center;padding:0;font-size:16px;line-height:1;cursor:pointer}' +
    '#' + ID + ' .oc-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:16px 22px 0}' +
    '#' + ID + ' .oc-tile{display:flex;gap:14px;align-items:center;padding:12px;border-radius:10px;border:1px solid var(--line,#dfe4ec);background:var(--panel,#fff);color:var(--txt,#172033);text-align:left;min-height:88px;cursor:pointer;font:inherit}' +
    '#' + ID + ' .oc-tile.pri{border-color:var(--blue,var(--ps-navy,#14213D));box-shadow:inset 0 0 0 1px var(--blue,var(--ps-navy,#14213D))}' +
    '#' + ID + ' .oc-tile.new{border-style:dashed;justify-content:center;gap:10px}' +
    '#' + ID + ' .oc-plus{width:32px;height:32px;border-radius:999px;border:1.5px dashed var(--txt-dim,#718096);display:grid;place-items:center;font-size:20px;font-weight:500;color:var(--txt-dim,#718096);line-height:1;flex:0 0 auto}' +
    '#' + ID + ' .oc-tx{min-width:0;display:grid;gap:2px}' +
    '#' + ID + ' .oc-lbl{font-size:12px;font-weight:600;color:var(--blue,var(--ps-navy,#14213D))}' +
    '#' + ID + ' .oc-nm{font-size:16px;font-weight:700;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '#' + ID + ' .oc-tile.new .oc-nm{font-weight:600}' +
    '#' + ID + ' .oc-mt{font-size:12px;color:var(--txt-dim,#718096);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '#' + ID + ' .oc-th{position:relative;flex:0 0 auto;border-radius:6px;overflow:hidden;background:var(--panel2,#f1f3f5);display:block}' +
    '#' + ID + ' .oc-th svg,#' + ID + ' .oc-th img{width:100%;height:100%;display:block;object-fit:cover}' +
    '#' + ID + ' .oc-th.blank{background:linear-gradient(180deg,#567c40,#4c7136)}' +
    '#' + ID + ' .oc-th.blank::before{content:"";position:absolute;inset:12% 8%;border:1.5px solid rgba(255,255,255,.8)}' +
    '#' + ID + ' .oc-sec{display:flex;align-items:center;gap:10px;padding:18px 22px 8px;flex-wrap:wrap}' +
    '#' + ID + ' .oc-sec b{font-size:14px;font-weight:600}' +
    '#' + ID + ' .oc-sec span{font-size:12px;color:var(--txt-dim,#718096)}' +
    '#' + ID + ' .oc-q{margin-left:auto;width:220px;max-width:100%;height:32px;border:1px solid var(--line,#dfe4ec);border-radius:6px;padding:0 10px;font-size:12px;color:var(--txt,#172033);background:var(--panel,#fff);font:inherit;font-size:12px;outline:0}' +
    '#' + ID + ' .oc-q:focus{border-color:var(--blue,var(--ps-navy,#14213D))}' +
    '#' + ID + ' .oc-folders{display:flex;gap:6px;padding:0 22px 8px;flex-wrap:wrap}' +
    '#' + ID + ' .oc-f{padding:5px 10px;border-radius:999px;border:1px solid var(--line,#dfe4ec);background:var(--panel,#fff);color:var(--txt,#172033);font-size:12px;font-weight:500;cursor:pointer;font-family:inherit}' +
    '#' + ID + ' .oc-f.on{background:var(--txt,#172033);color:var(--panel,#fff);border-color:var(--txt,#172033);font-weight:600}' +
    '#' + ID + ' .oc-list{overflow:auto;padding:0 22px 8px;display:grid;gap:6px;align-content:start;min-height:0;max-height:min(46vh,420px)}' +
    '#' + ID + ' .oc-row{display:flex;align-items:center;gap:12px;padding:8px 10px;border-radius:10px;border:1px solid var(--line,#dfe4ec);background:var(--panel,#fff);color:var(--txt,#172033);text-align:left;width:100%;cursor:pointer;font:inherit}' +
    '#' + ID + ' .oc-row:hover,#' + ID + ' .oc-tile:hover{border-color:var(--txt-dim,#718096)}' +
    '#' + ID + ' .oc-row .oc-nm{font-size:14px;font-weight:600}' +
    '#' + ID + ' .oc-go{margin-left:auto;font-size:12px;font-weight:600;color:var(--txt-dim,#718096);white-space:nowrap}' +
    '#' + ID + ' .oc-empty{padding:18px 12px;text-align:center;color:var(--txt-dim,#718096);font-size:14px}' +
    '#' + ID + ' .oc-foot{display:flex;align-items:center;gap:10px;padding:12px 22px 16px;border-top:1px solid var(--line,#dfe4ec);font-size:12px;color:var(--txt-dim,#718096);margin-top:auto;flex-wrap:wrap}' +
    '#' + ID + ' .oc-foot label{display:flex;align-items:center;gap:8px;color:var(--txt,#172033);cursor:pointer}' +
    '#' + ID + ' .oc-foot input{width:16px;height:16px;margin:0;accent-color:var(--txt,#172033)}' +
    '#' + ID + ' .oc-sp{flex:1}' +
    '#' + ID + ' kbd{border:1px solid var(--line,#dfe4ec);border-radius:6px;padding:1px 5px;font-size:11px;font-family:inherit;background:var(--panel,#fff)}' +
    /* 폰 — 아래에서 올라오는 시트 · 모두 «보기» */
    '#' + ID + '.phone{align-items:flex-end;padding:0}' +
    '#' + ID + '.phone .oc{width:100%;max-height:78%;border-radius:10px 10px 0 0;border-bottom:0}' +
    '#' + ID + '.phone .oc-h{padding:14px 16px 0}' +
    '#' + ID + '.phone .oc-tiles{grid-template-columns:minmax(0,1fr);padding:12px 16px 0}' +
    '#' + ID + '.phone .oc-tile{min-height:0;padding:10px 12px}' +
    '#' + ID + '.phone .oc-sec{padding:14px 16px 6px}' +
    '#' + ID + '.phone .oc-folders{padding:0 16px 8px}' +
    '#' + ID + '.phone .oc-list{padding:0 16px 8px;max-height:none}' +
    '#' + ID + '.phone .oc-foot{padding:10px 16px 14px}' +
    '@media (max-width:767px){#' + ID + '{padding:16px}#' + ID + ' .oc-h{padding:16px 16px 0}#' + ID + ' .oc-tiles{padding:12px 16px 0}#' + ID + ' .oc-sec,#' + ID + ' .oc-folders,#' + ID + ' .oc-list{padding-left:16px;padding-right:16px}#' + ID + ' .oc-foot{padding:10px 16px 14px}}';

  function ensureCss(win) {
    var doc = win.document; if (doc.getElementById(CSS_ID)) return;
    var st = doc.createElement('style'); st.id = CSS_ID; st.textContent = CSS; (doc.head || doc.documentElement).appendChild(st);
  }
  function el(doc, tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function thumb(win, d, w, h) {
    var doc = win.document, box = el(doc, 'span', 'oc-th'); box.style.width = w + 'px'; box.style.height = h + 'px'; box.setAttribute('aria-hidden', 'true');
    var t = d && d.thumb ? String(d.thumb) : '';
    if (t.indexOf('<svg') === 0) { var s = safeSvg(win, t); if (s) { box.innerHTML = s; return box; } }
    else if (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(t)) { var im = doc.createElement('img'); im.alt = ''; im.src = t; box.appendChild(im); return box; }
    box.classList.add('blank'); return box;
  }
  function workThumb(win, w, h) {
    var doc = win.document, box = el(doc, 'span', 'oc-th'); box.style.width = w + 'px'; box.style.height = h + 'px'; box.setAttribute('aria-hidden', 'true');
    var s = '';
    try { s = typeof win.boardThumbSVG === 'function' ? safeSvg(win, win.boardThumbSVG()) : ''; } catch (_) { s = ''; }
    if (s) box.innerHTML = s; else box.classList.add('blank');
    return box;
  }

  var open = null;
  function close(win) {
    if (!open) return;
    try { win.document.removeEventListener('keydown', open.onKey, true); } catch (_) {}
    try { open.root.remove(); } catch (_) {}
    var back = open.back; open = null;
    try { if (back && back.focus) back.focus(); } catch (_) {}
  }
  function openItem(win, d) {
    var ro = phone(win) || !canEdit(win, d);
    close(win);
    try {
      if (typeof win.__psVaultOpenItem === 'function') { win.__psVaultOpenItem(d, ro); return true; }
    } catch (e) { try { if (typeof win.toast === 'function') win.toast('지금은 열 수 없어요 — 보관함에서 열어 주세요'); } catch (_) {} }
    return false;
  }
  function render(win, items) {
    var doc = win.document, isPhone = phone(win), now = Date.now();
    ensureCss(win);
    var old = doc.getElementById(ID); if (old) old.remove();
    var root = el(doc, 'div'); root.id = ID; if (isPhone) root.classList.add('phone');
    var box = el(doc, 'section', 'oc'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', ID + 'Title'); box.tabIndex = -1;
    /* 머리 */
    var h = el(doc, 'div', 'oc-h'), ht = el(doc, 'div'), h2 = el(doc, 'h2', null, '불러오기'); h2.id = ID + 'Title';
    ht.appendChild(h2); ht.appendChild(el(doc, 'p', null, isPhone ? '폰에서는 보기로 열어요' : '어느 작전판으로 시작할까요?'));
    var x = el(doc, 'button', 'oc-x', '×'); x.type = 'button'; x.setAttribute('aria-label', '닫기 · 이어서'); x.onclick = function () { close(win); };
    h.appendChild(ht); h.appendChild(x); box.appendChild(h);
    /* 타일 */
    var tiles = el(doc, 'div', 'oc-tiles'), wi = workInfo(win), wm = workMeta(wi);
    var cont = el(doc, 'button', 'oc-tile pri'); cont.type = 'button'; cont.id = ID + 'Continue';
    cont.appendChild(workThumb(win, isPhone ? 64 : 132, isPhone ? 42 : 84));
    var ctx = el(doc, 'span', 'oc-tx'), cLbl = el(doc, 'span', 'oc-lbl', wm.label), cNm = el(doc, 'span', 'oc-nm', wm.name), cMt = el(doc, 'span', 'oc-mt', wm.meta); ctx.appendChild(cLbl); ctx.appendChild(cNm); ctx.appendChild(cMt); cont.appendChild(ctx);
    cont.onclick = function () { close(win); };
    tiles.appendChild(cont);
    /* 3.317 — 보관함 자료를 고치다 둔 초안(기기)이 있으면 «이어서»는 그 자료로 돌아간다(board-vault-draft.js pending · restore) */
    var vd = win.__psVaultDraft;
    if (vd && typeof vd.pending === 'function') vd.pending().then(function (rec) {
      if (!rec || !rec.libId || !open || open.root !== root) return;
      var m = workMeta({ draft: { name: rec.name, folder: rec.folder } });
      cLbl.textContent = m.label; cNm.textContent = m.name; cMt.textContent = m.meta; cont.classList.add('draft');
      cont.onclick = function () { close(win); vd.restore(); };
    }).catch(function (e) { if (win.console && win.console.warn) win.console.warn('[open-chooser] draft', e); });
    var nb = doc.getElementById('bpNewBoard');
    if (nb && !isPhone && !wi.empty) {
      var nw = el(doc, 'button', 'oc-tile new'); nw.type = 'button'; nw.id = ID + 'New';
      nw.appendChild(el(doc, 'span', 'oc-plus', '＋'));
      var ntx = el(doc, 'span', 'oc-tx'); ntx.appendChild(el(doc, 'span', 'oc-nm', '새 보드')); ntx.appendChild(el(doc, 'span', 'oc-mt', '빈 운동장에서 시작')); nw.appendChild(ntx);
      nw.onclick = function () { close(win); try { var b = doc.getElementById('bpNewBoard'); if (b) b.click(); } catch (_) {} };
      tiles.appendChild(nw);
    } else { tiles.style.gridTemplateColumns = 'minmax(0,1fr)'; }
    box.appendChild(tiles);
    /* 목록 머리 · 찾기 */
    var sec = el(doc, 'div', 'oc-sec'); sec.appendChild(el(doc, 'b', null, '보관함 작전판')); var cnt = el(doc, 'span', null, items.length + '개 · 최근 저장 순'); sec.appendChild(cnt);
    var q = doc.createElement('input'); q.type = 'search'; q.className = 'oc-q'; q.placeholder = '이름으로 찾기'; q.setAttribute('aria-label', '작전판 이름으로 찾기'); q.autocomplete = 'off';
    if (!isPhone) sec.appendChild(q);
    box.appendChild(sec);
    /* 폴더 칩 */
    var fl = el(doc, 'div', 'oc-folders'); fl.setAttribute('role', 'group'); fl.setAttribute('aria-label', '폴더');
    var state = { folder: null, q: '' };
    var fs = folders(items);
    if (fs.length > 2) fs.forEach(function (f) {
      var b = el(doc, 'button', 'oc-f' + (f.key === null ? ' on' : ''), f.name + ' ' + f.n); b.type = 'button'; b.dataset.folder = f.key === null ? '' : f.key; b.dataset.all = f.key === null ? '1' : '';
      b.onclick = function () { state.folder = f.key; [].forEach.call(fl.children, function (c) { c.classList.toggle('on', c === b); }); draw(); };
      fl.appendChild(b);
    });
    box.appendChild(fl);
    /* 목록 */
    var list = el(doc, 'div', 'oc-list'); list.id = ID + 'List'; box.appendChild(list);
    function draw() {
      list.textContent = '';
      var rows = filter(items, state);
      if (!rows.length) { list.appendChild(el(doc, 'div', 'oc-empty', state.q ? '«' + state.q + '» 이름의 작전판이 없어요' : '이 폴더에 작전판이 없어요')); return; }
      rows.forEach(function (d) {
        var r = el(doc, 'button', 'oc-row'); r.type = 'button'; r.dataset.libId = d.libId || '';
        r.appendChild(thumb(win, d, isPhone ? 56 : 72, isPhone ? 38 : 46));
        var tx = el(doc, 'span', 'oc-tx'); tx.appendChild(el(doc, 'span', 'oc-nm', d.name || '작전판')); tx.appendChild(el(doc, 'span', 'oc-mt', meta(d, now))); r.appendChild(tx);
        var ro = isPhone || !canEdit(win, d);
        r.appendChild(el(doc, 'span', 'oc-go', (ro ? '보기' : '열기') + ' ›'));
        r.onclick = function () { openItem(win, d); };
        list.appendChild(r);
      });
    }
    q.oninput = function () { state.q = q.value || ''; draw(); };
    draw();
    /* 바닥 */
    var foot = el(doc, 'div', 'oc-foot'), lab = el(doc, 'label'), ck = doc.createElement('input'); ck.type = 'checkbox'; ck.id = ID + 'Pref'; ck.checked = prefOn(win.localStorage);
    ck.onchange = function () { try { if (ck.checked) win.localStorage.removeItem(PREF); else win.localStorage.setItem(PREF, '0'); } catch (_) {} syncSeg(win); };
    lab.appendChild(ck); lab.appendChild(doc.createTextNode('앱을 열 때 이 창 보기')); foot.appendChild(lab);
    foot.appendChild(el(doc, 'span', 'oc-sp'));
    if (!isPhone) { var hint = el(doc, 'span'); var kbd = el(doc, 'kbd', null, 'Esc'); hint.appendChild(kbd); hint.appendChild(doc.createTextNode(' ')); hint.appendChild(doc.createTextNode('· 바깥 누르기 = 이어서')); foot.appendChild(hint); }
    box.appendChild(foot);
    root.appendChild(box);
    root.addEventListener('pointerdown', function (e) { if (e.target === root) { e.preventDefault(); close(win); } });
    var onKey = function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(win); } };
    doc.addEventListener('keydown', onKey, true);
    open = { root: root, onKey: onKey, back: doc.activeElement };
    doc.body.appendChild(root);
    try { box.focus({ preventScroll: true }); } catch (_) { try { box.focus(); } catch (__) {} }
    return root;
  }

  /* ── 보드 설정 › 내 화면 › «앱을 열 때» 줄 ─────────────────────────── */
  function syncSeg(win) {
    var seg = win.document.getElementById(SEG_ID); if (!seg) return;
    var on = prefOn(win.localStorage);
    [].forEach.call(seg.querySelectorAll('button'), function (b) { b.classList.toggle('on', (b.dataset.v === '1') === on); b.setAttribute('aria-pressed', ((b.dataset.v === '1') === on) ? 'true' : 'false'); });
  }
  function settingsRow(win) {
    var doc = win.document, vm = doc.getElementById('viewMenu'); if (!vm) return null;
    var row = doc.getElementById(ROW_ID);
    if (!row) {
      row = el(doc, 'div', 'menurow'); row.id = ROW_ID; row.setAttribute('data-bs-tab', 'view');
      row.appendChild(el(doc, 'span', 'menulbl', '앱을 열 때'));
      var seg = el(doc, 'div', 'seg'); seg.id = SEG_ID; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', '앱을 열 때');
      [['1', '불러오기 창', '앱을 열면 작업 보드 위에 보관함 작전판을 고르는 창이 떠요'], ['0', '바로 보드', '앱을 열면 마지막 작업 보드가 바로 보여요']].forEach(function (o) {
        var b = el(doc, 'button', null, o[1]); b.type = 'button'; b.dataset.v = o[0]; b.title = o[2];
        b.addEventListener('click', function (e) { e.stopPropagation(); try { if (o[0] === '1') win.localStorage.removeItem(PREF); else win.localStorage.setItem(PREF, '0'); } catch (_) {} syncSeg(win); });
        seg.appendChild(b);
      });
      row.appendChild(seg);
    }
    vm.appendChild(row);   /* 맨 끝 — 패널이 줄을 다시 세운 뒤에도(«새 보드» 묶음 뒤) 마지막 줄로 */
    syncSeg(win);
    return row;
  }
  function watchSettings(win) {
    var doc = win.document;
    var place = function () { try { if (doc.getElementById('cmd-board-settings-pop')) settingsRow(win); } catch (_) {} };
    place();
    try {
      if (win.MutationObserver && doc.body) {
        var mo = new win.MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) { var a = ms[i].addedNodes; for (var j = 0; j < a.length; j++) { var n = a[j]; if (n && n.id === 'cmd-board-settings-pop') { place(); return; } } } });
        mo.observe(doc.body, { childList: true });
      }
    } catch (_) {}
  }

  /* ── 부팅 ─────────────────────────────────────────────────────────────── */
  function libItems(win) {
    try { return Promise.resolve(typeof win.libGet === 'function' ? win.libGet() : []).then(function (lib) { return boards(lib); }, function () { return []; }); } catch (_) { return Promise.resolve([]); }
  }
  function run(win) {
    var pre = decide(envOf(win));
    if (!pre.show) return Promise.resolve({ shown: false, why: pre.why });
    return libItems(win).then(function (items) {
      var d = decide(envOf(win, items.length));   /* 보관함을 읽는 사이에 화면이 바뀌었을 수 있다 */
      if (!d.show) return { shown: false, why: d.why };
      try { var p = parentOf(win); if (p) p.__psOpenChooserShown = true; } catch (_) {}
      render(win, items);
      return { shown: true, why: 'ok', count: items.length };
    });
  }
  /* 보드가 아직 안 보이면(폰은 팀 › 오늘로 열린다 · 다른 앱에서 시작) 셸이 처음 보드를 보일 때 한 번 더 본다 — «앱을 열 때 한 번»은 그대로(__psOpenChooserShown) */
  function whenVisible(win, cb) {
    var p = parentOf(win); if (!p || !p.document || !p.document.body || !win.MutationObserver) return false;
    try {
      var body = p.document.body, mo = new p.MutationObserver(function () {
        if (body.getAttribute('data-ps-app') !== 'board') return;
        mo.disconnect(); win.setTimeout(cb, SETTLE_MS);
      });
      mo.observe(body, { attributes: true, attributeFilter: ['data-ps-app'] });
      return true;
    } catch (_) { return false; }
  }
  /* 보드 복원이 끝나고(__boardReady) 셸의 부팅 덮개(body.ps-booting — «PROCESS STUDIO» 검은 덮개)가 걷힌 뒤에 — 덮개가 사라지는 중에 창이 겹쳐 보이지 않게 */
  function booting(win) {
    try {
      var p = parentOf(win); if (!p || !p.document || !p.document.body) return false;
      var body = p.document.body; if (body.classList.contains('ps-booting')) return true;
      /* 셸의 검은 «PROCESS STUDIO» 덮개(app.html — id 없는 fixed div, z-index 2147483646, 걷힌 0.38초 뒤 떼어진다) */
      for (var i = 0; i < body.children.length; i++) { var c = body.children[i]; if (c && c.style && c.style.zIndex === '2147483646') return true; }
      return false;
    } catch (_) { return false; }
  }
  function whenReady(win, cb) {
    var t0 = Date.now();
    (function tick() {
      if (win.__boardReady === true && !booting(win)) { win.setTimeout(cb, SETTLE_MS); return; }
      if (Date.now() - t0 > READY_WAIT_MS) return;
      win.setTimeout(tick, READY_TICK_MS);
    })();
  }
  function mount(win) {
    if (!win || !win.document) return;
    var boot = function () {
      try { watchSettings(win); } catch (_) {}
      whenReady(win, function () {
        var go = function () { return run(win).then(function (r) {
          win.__psOpenChooserResult = r;
          if (!r.shown && r.why === 'not-visible') whenVisible(win, go);
          return r;
        }, function () {}); };
        go();
      });
    };
    if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
  }

  return { PREF: PREF, ID: ID, prefOn: prefOn, boards: boards, meta: meta, dateLabel: dateLabel, folders: folders, filter: filter, decide: decide, workMeta: workMeta,
    envOf: envOf, render: render, run: run, close: close, settingsRow: settingsRow, mount: mount };
});

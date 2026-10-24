/* PROCESS 교과서: 고정된 앱 내 자료만 받아 보관함에 편집 가능한 사본으로 담는다. */
(function (root) {
  'use strict';
  var CATALOG = {ch10: {file: 'ch10.json', title: '중원 전진', items: ['ch10-t1', 'ch10-t2', 'ch10-t3']}};
  function knownChapter(id) { return typeof id === 'string' && Object.prototype.hasOwnProperty.call(CATALOG, id); }
  function parse(hash) {
    var m = /^#textbook=(ch10)(?:-(t[123]))?$/.exec(String(hash || ''));
    return m ? {chapter: m[1], item: m[2] ? m[1] + '-' + m[2] : ''} : null;
  }
  function packUrl(chapter, loc) {
    if (!knownChapter(chapter)) return null;
    return new URL('textbook/packs/' + CATALOG[chapter].file, loc.href).href;
  }
  var api = {parse: parse, packUrl: packUrl};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root || !root.document) return;
  root.PSTextbookPacks = api;
  var doc = root.document;

  function initApp() {
    var key = 'ps_textbook_pending_v1', timer, attempts = 0, memory = null;
    function pending() {
      try {
        var p = memory; if (!p) { try { p = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (_) {} }
        if (!p || !knownChapter(p.chapter) || (p.item && CATALOG[p.chapter].items.indexOf(p.item) < 0) ||
            typeof p.at !== 'number' || Date.now() - p.at < 0 || Date.now() - p.at > 1800000) return null;
        return p;
      } catch (_) { return null; }
    }
    function notice(text) {
      var el = doc.getElementById('psTextbookNotice');
      if (!text) { if (el) el.remove(); return; }
      if (!el) {
        el = doc.createElement('div'); el.id = 'psTextbookNotice'; el.setAttribute('role', 'status');
        el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:100001;max-width:90vw;padding:12px 18px;background:#14213d;color:white;border-radius:12px;font:600 14px/1.5 sans-serif;text-align:center;pointer-events:none';
        doc.body.appendChild(el);
      }
      el.textContent = text;
    }
    function clear() { memory = null; try { sessionStorage.removeItem(key); } catch (_) {} clearInterval(timer); timer = null; notice(''); }
    function run() {
      var p = pending(); if (!p) { clear(); return; }
      if (!doc.body || doc.body.classList.contains('ps-booting')) return;
      if (doc.body.classList.contains('ps-player-idp-only')) {
        clear(); notice('교과서 훈련을 담으려면 코치 계정으로 열어 주세요.'); return;
      }
      if (!root.PSSync || !root.PSSync.dataUnlocked()) { notice('로그인하면 교과서 훈련을 보관함에 담을 수 있어요.'); return; }
      notice('');
      if (root.__psShowApp) root.__psShowApp('design');
      var f = doc.getElementById('fBoard');
      if (f && f.contentWindow) {
        f.contentWindow.postMessage({source: 'app', type: 'textbookPack', chapter: p.chapter, item: p.item}, location.origin);
        if (++attempts > 60) { clear(); notice('자료 연결을 확인하지 못했어요. 교과서에서 다시 눌러 주세요.'); }
      }
    }
    function start() { attempts = 0; if (!timer) timer = setInterval(run, 650); run(); }
    function take() {
      var p = parse(location.hash); if (!p) return;
      p.at = Date.now(); memory = p; try { sessionStorage.setItem(key, JSON.stringify(p)); } catch (_) {}
      history.replaceState(null, '', location.pathname + location.search); start();
    }
    root.addEventListener('message', function (e) {
      var f = doc.getElementById('fBoard'), d = e.data || {};
      if (e.origin === location.origin && f && e.source === f.contentWindow && d.source === 'board' && d.type === 'textbookPackAck') clear();
    });
    root.addEventListener('hashchange', take);
    root.addEventListener('ps-auth-state', function () { if (pending()) start(); });
    take(); if (pending() && !timer) start();
  }

  function initBoard() {
    var busy = false;
    function wid() { return root.PSSync && root.PSSync.activeWs ? root.PSSync.activeWs() : ''; }
    function sameWorkspace(expected) { if (wid() !== expected) throw new Error('workspace-changed'); }
    function close() { var d = doc.getElementById('psTextbookDialog'); if (d) d.remove(); busy = false; }
    function selection(pack, request) {
      var meta = pack && pack.textbook;
      if (!pack || pack.type !== 'process-studio-drillpack' || !meta || meta.chapter !== request.chapter ||
          meta.version !== 1 || !Array.isArray(pack.drills) || pack.drills.length !== 3) throw new Error('shape');
      var ids = CATALOG[request.chapter].items;
      if (!pack.drills.every(function (d, i) { return d && d.textbookItem === ids[i] && d.type === 'train'; })) throw new Error('items');
      return pack.drills.filter(function (d) { return !request.item || d.textbookItem === request.item; });
    }
    function make(raw, chapter) {
      var card = letterPackCard({type: 'process-studio-drillpack', drills: [{name: raw.name, trainings: [raw]}]}, {
        draft: _trainDraftFrom, snap: __sanitizeSnap, thumb: function (sn) { return root.__snapToThumb(sn); },
        id: function () { return 'Ltb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }, now: Date.now()
      });
      if (!card) throw new Error('snap');
      delete card.letter;
      card.textbook = {chapter: chapter, itemId: raw.textbookItem, version: 1, source: {book: String(raw.source.book).slice(0,100), pdfPage: Number(raw.source.pdfPage)}};
      var ps = card.snap.players, gk = ps.filter(function (p) { return p.pos === 'GK' || String(p.num) === '1'; }).length;
      card.roster = {gk: gk, field: ps.length - gk, rehab: 0, out: 0};
      card.gmPhases = card.trainings[0].gmPhases = Array.isArray(raw.gmPhases) ? raw.gmPhases.slice(0,12).map(function(x) { return String(x).slice(0,80); }) : [];
      card.gmPhaseNames = card.trainings[0].gmPhaseNames = Array.isArray(raw.gmPhaseNames) ? raw.gmPhaseNames.slice(0,12).map(function(x) { return String(x).slice(0,100); }) : [];
      card.tags = ['프로세스 교과서', '중원 전진'];
      ['overview', 'setup', 'func', 'prog'].forEach(function (k) {
        card[k] = card.trainings[0][k] = typeof raw[k] === 'string' ? raw[k].slice(0, 6000) : '';
      });
      card.method = card.trainings[0].method;
      card.coaching = card.trainings[0].coaching;
      stampCreator(card); normalizeDrill(card); normalizeDrill(card.trainings[0]);
      return card;
    }
    function existing(lib, id) {
      return (lib || []).find(function (d) { return d && d.textbook && d.textbook.itemId === id && canEditItem(d); });
    }
    function sheet(rows, request, library, workspace) {
      var dialog = doc.createElement('dialog'); dialog.id = 'psTextbookDialog';
      dialog.setAttribute('aria-label', '프로세스 교과서 훈련 담기');
      dialog.style.cssText = 'width:min(440px,calc(100vw - 32px));max-height:85dvh;overflow:auto;border:1px solid #cfd5df;border-radius:16px;padding:24px;box-sizing:border-box;background:var(--panel,#fff);color:var(--txt,#172035);font:14px/1.6 -apple-system,sans-serif;';
      var h = doc.createElement('h2'); h.textContent = '중원 전진 · 훈련 ' + rows.length + '개'; h.style.cssText = 'font-size:20px;margin:0 0 12px'; dialog.appendChild(h);
      var note = doc.createElement('p'); note.textContent = '현재 선택한 공간의 보관함에 훈련별 카드로 담습니다. 설명·선수 배치·재생 장면을 함께 가져오며, 담은 뒤 수정할 수 있어요.'; dialog.appendChild(note);
      var list = doc.createElement('ul');
      rows.forEach(function (row) {
        var li = doc.createElement('li'); li.textContent = row.name + (existing(library, row.textbookItem) ? ' · 이미 담은 훈련' : ''); list.appendChild(li);
      }); dialog.appendChild(list);
      var status = doc.createElement('p'); status.setAttribute('role', 'status'); dialog.appendChild(status);
      var actions = doc.createElement('div'); actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:18px;justify-content:flex-end'; dialog.appendChild(actions);
      function button(text, fn, main) {
        var b = doc.createElement('button'); b.type = 'button'; b.textContent = text;
        b.style.cssText = 'padding:11px 14px;min-height:44px;border:1px solid #aeb8c8;border-radius:8px;font:600 14px/1.4 sans-serif;background:' + (main ? '#14213d;color:white' : 'transparent;color:inherit');
        b.onclick = fn; actions.appendChild(b); return b;
      }
      var saving = false;
      async function save(copy) {
        if (saving) return; saving = true;
        actions.querySelectorAll('button').forEach(function (b) { b.disabled = true; }); status.textContent = '보관함에 담는 중…';
        try {
          sameWorkspace(workspace); if (!psVaultRequireLogin()) throw new Error('locked');
          var result = await libTurn(async function () {
            sameWorkspace(workspace); var lib = await libGet(); sameWorkspace(workspace);
            var cards = [], first = '';
            rows.forEach(function (row) {
              var had = existing(lib, row.textbookItem);
              if (had && !copy) { if (!first) first = had.libId; return; }
              var card = make(row, request.chapter); cards.push(card); if (!first) first = card.libId;
            });
            if (cards.length) { sameWorkspace(workspace); await libWrite(cards.concat(lib)); libTouch(); }
            return {ids: cards.map(function (c) { return c.libId; }), first: first};
          });
          sameWorkspace(workspace);
          var saved = await libGet();
          if (!result.ids.every(function (id) { return saved.some(function (c) { return c.libId === id; }); })) throw new Error('readback');
          close(); letterPackShow(result.first);
          toast(result.ids.length ? ('교과서 훈련 ' + result.ids.length + '개를 보관함에 담았어요') : '이미 담은 훈련을 열었어요');
        } catch (error) {
          saving = false; actions.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
          status.textContent = error.message === 'workspace-changed' ? '선택한 공간이 바뀌었습니다. 닫은 뒤 교과서에서 다시 눌러 주세요.' : '담기를 확인하지 못했어요. 기존 훈련은 유지됩니다. 연결을 확인하고 다시 시도해 주세요.';
        }
      }
      button('취소', close);
      if (rows.some(function (row) { return existing(library, row.textbookItem); })) button('새 사본으로 담기', function () { save(true); });
      button(rows.every(function (row) { return existing(library, row.textbookItem); }) ? '보관함에서 보기' : '보관함에 담기', function () { save(false); }, true);
      dialog.addEventListener('cancel', function (e) { if (saving) e.preventDefault(); else { e.preventDefault(); close(); } });
      doc.body.appendChild(dialog); dialog.showModal();
    }
    root.addEventListener('message', async function (e) {
      var request = e.data || {};
      if (e.origin !== location.origin || e.source !== root.parent || request.source !== 'app' || request.type !== 'textbookPack' ||
          !knownChapter(request.chapter) || (request.item && CATALOG[request.chapter].items.indexOf(request.item) < 0)) return;
      root.parent.postMessage({source: 'board', type: 'textbookPackAck'}, location.origin);
      if (busy) return;
      if (!psVaultRequireLogin()) return;
      if (doc.body.classList.contains('editing') || root.__vaultEdit) { toast('편집 중인 자료를 저장하고 닫은 뒤 다시 눌러 주세요.'); return; }
      busy = true; var workspace = wid(), controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 15000);
      try {
        var response = await fetch(packUrl(request.chapter, location), {credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal});
        if (!response.ok) throw new Error('http'); var text = await response.text(); if (text.length > 1000000) throw new Error('size');
        var rows = selection(JSON.parse(text), request), lib = await libGet(); sameWorkspace(workspace);
        sheet(rows, request, lib, workspace);
      } catch (_) { close(); toast('교과서 훈련을 가져오지 못했어요. 연결을 확인하고 다시 눌러 주세요.'); }
      finally { clearTimeout(timer); }
    });
  }
  if (/\/app\.html$/.test(location.pathname)) initApp();
  else if (/\/board\.html$/.test(location.pathname)) initBoard();
})(typeof window === 'undefined' ? null : window);

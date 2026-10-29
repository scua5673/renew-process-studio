/* PROCESS 교과서: 고정된 앱 내 자료만 받아 보관함에 편집 가능한 사본으로 담는다. */
(function (root) {
  'use strict';
  var CATALOG = {ch10: {file: 'ch10.json', title: '중원 전진', items: ['ch10-t1', 'ch10-t2', 'ch10-t3']}};
  // Generated from the reviewed website scene sources; paths never come from the URL.
  var SCENES = ["carry","choice","d01","d02","d03","d04","d05","d06","d07","d08","d09","d10","d11","d12","d13","d14","d15","d16","d17","d18","direct","drill1","drill1_coach","drill1_fail","drill2","drill2_coach","drill2_fail","drill3","drill3_coach","drill3_fail","follow","follow_coach","follow_fail","match-breaking-lines","match-choose-development-target","match-compact-block","match-counterattack-support","match-counterpress-or-recover","match-defending-box","match-design-session-load","match-first-pass-after-regain","match-individual-within-team","match-individualise-the-week","match-plan-the-week","match-player-feedback","match-pressing-triggers","match-pressure-cover-balance","match-read-four-phases","match-receiving-between-lines","match-rest-defence","match-review-development","match-review-training-load","match-roles-and-relations","match-switching-play","match-team-principles","match-third-player","match-training-to-match","match12","match20","match63","secure","series-block","series-build","series-counter","series-press","series-regain","series-switch","series-wide","shape","shape_coach","shape_fail"];
  SCENES.forEach(function (key) { CATALOG['scene-' + key] = {file: 'scenes/' + key + '.json', title: '교과서 · 심화 주제', items: ['scene-' + key], scene: true}; });
  function validMode(mode) { return !mode || mode === 'fail' || mode === 'coach'; }
  function knownChapter(id) { return typeof id === 'string' && Object.prototype.hasOwnProperty.call(CATALOG, id); }
  function validRequest(p) { return p && knownChapter(p.chapter) && validMode(p.mode) && (!p.mode || (p.item && !CATALOG[p.chapter].scene)) && (!p.item || CATALOG[p.chapter].items.indexOf(p.item) >= 0); }
  function parse(hash) {
    var scene = /^#textbook=(scene-[a-z0-9_-]+)$/.exec(String(hash || ''));
    if (scene && knownChapter(scene[1])) return {chapter: scene[1], item: scene[1]};
    var m = /^#textbook=(ch10)(?:-(t[123])(?:-(fail|coach))?)?$/.exec(String(hash || ''));
    if (!m) return null;
    var p = {chapter: m[1], item: m[2] ? m[1] + '-' + m[2] : ''};
    if (m[3]) p.mode = m[3];
    return p;
  }
  function packUrl(chapter, loc) {
    if (!knownChapter(chapter)) return null;
    return new URL('textbook/packs/' + CATALOG[chapter].file, loc.href).href;
  }
  function selection(pack, request) {
      if (!validRequest(request)) throw new Error('request');
      var config = CATALOG[request.chapter], meta = pack && pack.textbook;
      if (!pack || pack.type !== 'process-studio-drillpack' || !meta || meta.chapter !== request.chapter ||
          meta.version !== 1 || !Array.isArray(pack.drills) || pack.drills.length !== config.items.length) throw new Error('shape');
      var ids = CATALOG[request.chapter].items;
      if (!pack.drills.every(function (d, i) { return d && d.textbookItem === ids[i] && (d.type === 'train' || (config.scene && d.type === 'board')) && Array.isArray(d.frames) && d.frames.length >= 2 && d.frames.length <= 40 && d.frames.every(function (f) { return f && f.snap && Array.isArray(f.snap.players); }); })) throw new Error('items');
      return pack.drills.filter(function (d) { return !request.item || d.textbookItem === request.item; }).map(function (d) {
        var row = JSON.parse(JSON.stringify(d));
        if (request.mode) {
          var frames = row.variants && row.variants[request.mode];
          if (!Array.isArray(frames) || frames.length < 2 || frames.length > 40) throw new Error('variant');
          row.frames = frames; row.snap = frames[0].snap;
          row.name += request.mode === 'fail' ? ' · 실패 분석' : ' · 코치 개입';
          row.textbookVariant = request.mode;
        }
        delete row.variants;
        return row;
      });
    }
  var api = {parse: parse, packUrl: packUrl, selection: selection};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root || !root.document) return;
  root.PSTextbookPacks = api;
  var doc = root.document;

  function initApp() {
    var key = 'ps_textbook_pending_v1', timer, attempts = 0, memory = null;
    function pending() {
      try {
        var p = memory; if (!p) { try { p = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (_) {} }
        if (!validRequest(p) ||
            typeof p.at !== 'number' || Date.now() - p.at < 0 || Date.now() - p.at > 1800000) return null;
        return p;
      } catch (_) { return null; }
    }
    function notice(text) {
      var el = doc.getElementById('psTextbookNotice');
      if (!text) { if (el) el.remove(); return; }
      if (!el) {
        el = doc.createElement('div'); el.id = 'psTextbookNotice'; el.setAttribute('role', 'status');
        el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:100001;max-width:90vw;padding:12px 18px;background:#14213d;color:white;border-radius:12px;font:600 14px/1.5 Pretendard,sans-serif;text-align:center;pointer-events:none';
        doc.body.appendChild(el);
      }
      el.textContent = text;
    }
    function clear() { memory = null; try { sessionStorage.removeItem(key); } catch (_) {} clearInterval(timer); timer = null; notice(''); }
    function run() {
      var p = pending(); if (!p) { clear(); return; }
      if (!doc.body || doc.body.classList.contains('ps-booting')) return;
      if (doc.body.classList.contains('ps-player-idp-only')) {
        clear(); notice('교과서 장면을 담으려면 코치 계정으로 열어 주세요.'); return;
      }
      if (!root.PSSync || !root.PSSync.dataUnlocked()) { notice('로그인하면 교과서 장면을 보관함에 담을 수 있어요.'); return; }
      notice('');
      if (root.__psShowApp) root.__psShowApp('design');
      var f = doc.getElementById('fBoard');
      if (f && f.contentWindow) {
        var message = {source: 'app', type: 'textbookPack', chapter: p.chapter, item: p.item};
        if (p.mode) message.mode = p.mode;
        f.contentWindow.postMessage(message, location.origin);
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
    function make(raw, chapter) {
      var card = letterPackCard({type: 'process-studio-drillpack', drills: [{name: raw.name, trainings: [raw]}]}, {
        draft: _trainDraftFrom, snap: __sanitizeSnap, thumb: function (sn) { return root.__snapToThumb(sn); },
        id: function () { return 'Ltb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }, now: Date.now()
      });
      if (!card) throw new Error('snap');
      delete card.letter;
      // 공통 유지 시간도 같은 원본 프레임에서 복원한다.
      if (raw.frames && raw.frames[0] && (raw.frames[0].__hold || raw.frames[0].hold)) {
        var hold = Math.max(.2, Math.min(20, +(raw.frames[0].__hold || raw.frames[0].hold) || .6));
        [card.frames, card.trainings[0].frames].forEach(function (frames) { if (frames && frames[0]) frames[0].__hold = hold; });
      }
      var source = raw.source || {};
      card.type = card.trainings[0].type = raw.type === 'board' ? 'board' : 'train';
      [card.frames, card.trainings[0].frames].forEach(function (frames) { (frames || []).forEach(function (f,i) { f.cap = String(raw.frames[i].cap || '').slice(0,500); }); });
      card.textbook = {chapter: chapter, itemId: raw.textbookItem, version: 1, revision: [2,3,4].indexOf(raw.textbookRevision) >= 0 ? raw.textbookRevision : 1, variant: raw.textbookVariant || 'success', source: {book: String(source.book || '').slice(0,100), pdfPage: Number(source.pdfPage) || null, url: String(source.article || source.url || '').slice(0,500), scene: String(source.scene || '').slice(0,100)}};
      var ps = card.snap.players, gk = ps.filter(function (p) { return p.pos === 'GK'; }).length;
      card.roster = {gk: gk, field: ps.length - gk, rehab: 0, out: 0};
      card.gmPhases = card.trainings[0].gmPhases = Array.isArray(raw.gmPhases) ? raw.gmPhases.slice(0,12).map(function(x) { return String(x).slice(0,80); }) : [];
      card.gmPhaseNames = card.trainings[0].gmPhaseNames = Array.isArray(raw.gmPhaseNames) ? raw.gmPhaseNames.slice(0,12).map(function(x) { return String(x).slice(0,100); }) : [];
      card.tags = ['프로세스 교과서', CATALOG[chapter].scene ? '심화 장면' : '중원 전진'];
      card.source = card.textbook.source;
      ['overview', 'setup', 'func', 'prog', 'method', 'coaching'].forEach(function (k) {
        card[k] = card.trainings[0][k] = typeof raw[k] === 'string' ? raw[k].slice(0, 6000) : '';
      });
      card.method = card.trainings[0].method;
      card.coaching = card.trainings[0].coaching;
      stampCreator(card); normalizeDrill(card); normalizeDrill(card.trainings[0]);
      return card;
    }
    function existing(lib, id, mode) {
      return (lib || []).filter(function (d) { return d && d.textbook && d.textbook.itemId === id && (d.textbook.variant || 'success') === (mode || 'success') && canEditItem(d); }).sort(function (a,b) { return ((b.textbook.revision || 1) - (a.textbook.revision || 1)) || ((b.savedAt || 0) - (a.savedAt || 0)); })[0];
    }
    function sheet(rows, request, library, workspace) {
      var dialog = doc.createElement('dialog'); dialog.id = 'psTextbookDialog';
      dialog.setAttribute('aria-label', '프로세스 교과서 장면 담기');
      dialog.style.cssText = 'width:min(440px,calc(100vw - 32px));max-height:85dvh;overflow:auto;border:1px solid #cfd5df;border-radius:16px;padding:24px;box-sizing:border-box;background:var(--panel,#fff);color:var(--txt,#172035);font:14px/1.6 Pretendard,-apple-system,sans-serif;';
      var h = doc.createElement('h2'); h.textContent = CATALOG[request.chapter].scene ? '이 장면을 스튜디오에서 수정' : '중원 전진 · 훈련 ' + rows.length + '개'; h.style.cssText = 'font-size:20px;margin:0 0 12px'; dialog.appendChild(h);
      var note = doc.createElement('p'); note.textContent = '현재 선택한 공간의 보관함에 편집 가능한 사본을 담고 바로 엽니다. 선수·공·화살표와 모든 단계 설명을 수정할 수 있어요. 이미 담은 장면은 수정본을 이어 엽니다.'; dialog.appendChild(note);
      var list = doc.createElement('ul');
      rows.forEach(function (row) {
        var li = doc.createElement('li'), had = existing(library, row.textbookItem, request.mode); li.textContent = row.name + (had ? ((had.textbook.revision || 1) < (row.textbookRevision || 1) ? ' · 이전 판을 담은 장면' : ' · 이미 담은 장면') : ''); list.appendChild(li);
      }); dialog.appendChild(list);
      var sourceUrl = rows[0].source && (rows[0].source.article || rows[0].source.url);
      if (typeof sourceUrl === 'string' && /^https:\/\/weloveprocess\.netlify\.app\/(focus|textbook)\/[a-z0-9_/#-]*$/.test(sourceUrl)) {
        var back = doc.createElement('a'); back.href = sourceUrl; back.target = '_blank'; back.rel = 'noopener'; back.textContent = '원문 설명 다시 읽기 ↗'; dialog.appendChild(back);
      }
      var status = doc.createElement('p'); status.setAttribute('role', 'status'); dialog.appendChild(status);
      var actions = doc.createElement('div'); actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:18px;justify-content:flex-end'; dialog.appendChild(actions);
      function button(text, fn, main) {
        var b = doc.createElement('button'); b.type = 'button'; b.textContent = text;
        b.style.cssText = 'padding:11px 14px;min-height:44px;border:1px solid #aeb8c8;border-radius:8px;font:600 14px/1.4 Pretendard,sans-serif;background:' + (main ? '#14213d;color:white' : 'transparent;color:inherit');
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
              var had = existing(lib, row.textbookItem, request.mode);
              if (had && (copy !== true && (copy !== 'upgrade' || (had.textbook.revision || 1) >= (row.textbookRevision || 1)))) { if (!first) first = had.libId; return; }
              var card = make(row, request.chapter); cards.push(card); if (!first) first = card.libId;
            });
            if (cards.length) { sameWorkspace(workspace); await libWrite(cards.concat(lib)); libTouch(); }
            return {ids: cards.map(function (c) { return c.libId; }), first: first};
          });
          sameWorkspace(workspace);
          var saved = await libGet(); sameWorkspace(workspace);
          if (!result.ids.every(function (id) { return saved.some(function (c) { return c.libId === id; }); })) throw new Error('readback');
          close();
          if (rows.length === 1) await openLibDrawEditor(result.first, false);
          else letterPackShow(result.first);
          toast(result.ids.length ? ('교과서 장면 ' + result.ids.length + '개를 보관함에 담았어요') : '이미 담은 장면을 열었어요');
        } catch (error) {
          saving = false; actions.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
          status.textContent = error.message === 'workspace-changed' ? '선택한 공간이 바뀌었습니다. 닫은 뒤 교과서에서 다시 눌러 주세요.' : '담기를 확인하지 못했어요. 기존 훈련은 유지됩니다. 연결을 확인하고 다시 시도해 주세요.';
        }
      }
      button('취소', close);
      var outdated = rows.some(function (row) { var had = existing(library, row.textbookItem, request.mode); return had && (had.textbook.revision || 1) < (row.textbookRevision || 1); });
      if (outdated) {
        note.textContent += ' 이전 판의 수정본은 그대로 유지합니다. 보강판을 새 사본으로 담으면 설명과 현장 개입이 보강된 카드가 추가됩니다.';
        button('보강판 새 사본으로 담기', function () { save('upgrade'); }, true);
      } else if (rows.some(function (row) { return existing(library, row.textbookItem, request.mode); })) button('새 사본으로 담기', function () { save(true); });
      button(rows.every(function (row) { return existing(library, row.textbookItem, request.mode); }) ? (rows.length === 1 ? '수정본 이어 열기' : '보관함에서 보기') : (rows.length === 1 ? '담고 수정하기' : '보관함에 담기'), function () { save(false); }, !outdated);
      dialog.addEventListener('cancel', function (e) { if (saving) e.preventDefault(); else { e.preventDefault(); close(); } });
      doc.body.appendChild(dialog); dialog.showModal();
    }
    root.addEventListener('message', async function (e) {
      var request = e.data || {};
      if (e.origin !== location.origin || e.source !== root.parent || request.source !== 'app' || request.type !== 'textbookPack' ||
          !validRequest(request)) return;
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
      } catch (_) { close(); toast('교과서 장면을 가져오지 못했어요. 연결을 확인하고 다시 눌러 주세요.'); }
      finally { clearTimeout(timer); }
    });
  }
  if (/\/app(?:\.html)?$/.test(location.pathname)) initApp();
  else if (/\/board(?:\.html)?$/.test(location.pathname)) initBoard();
})(typeof window === 'undefined' ? null : window);

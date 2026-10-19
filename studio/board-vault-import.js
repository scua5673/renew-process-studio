/* PROCESS STUDIO — 보관함 «＋ 만들기» 창의 «파일에서 가져오기»(3.114).
   사용자 «여기에 있는 훈련들 프로세스 스튜디오로 만들고 싶어» → 만든 훈련 파일(드릴 팩 JSON)을 보관함에 넣을 길이 화면에 없었다.
   카드 메뉴에 «파일 내보내기(JSON)»는 있는데, 받는 쪽(board.html importDrillPack)은 숨은 옛 라이브러리 창(#drillLib)에만 남아 있었다.
   ＋ 만들기 창(#vCreateChooser)이 열리면 «예시 담기» 줄과 같은 모양의 줄을 하나 더 단다. 고른 파일은 걸러서(cleanPack) importDrillPack 에 넘긴다:
   · 밖에서 온 그림(thumb)은 모두 버린다 — 보관함은 그림 없는 카드를 장면(snap)에서 그 자리에서 그린다.
   · 선수 사진 · 장비 그림 · 운동장 사진은 data:image(png · jpeg · webp · gif)만 받는다. 다른 주소는 지운다.
   · 남의 도장(createdBy …) · 표식(fav · tpl · pin · matchRef · _team…) · 번호(libId · id) · 날짜는 지운다 — 넣는 사람의 새 자료가 된다(«복사»와 같은 규칙).
   · 폴더 · 이름 · 훈련 · 장면 · 설명은 그대로. 넣은 자료가 한 폴더에 모이면 그 폴더를 연다.
   보기 전용(body.ps-viewonly)이면 줄을 두지 않는다. board.html 은 크기 예산이 다 차 있어 <script> 한 줄만 더했다.
   시험: tests/vault-import-3114.test.cjs(걸러내기) · tests/browser/vault-file-import.mjs(창 → 파일 고르기 → 보관함). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSVaultImport = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var MAX = 40 * 1024 * 1024;   /* 보관함 한 묶음(카드 스무 장 ≈ 3MB)보다 넉넉히 — 그보다 크면 읽지 않는다 */
  var TOP_DROP = ['libId', 'id', 'tpl', 'fav', 'pin', 'savedAt', 'editedAt', 'createdBy', 'createdByEmail', 'createdByName', 'matchRef', 'ex'];
  var IMG_RE = /^data:image\/(png|jpe?g|webp|gif);base64,/i;

  function okImg(v) { return typeof v === 'string' && IMG_RE.test(v); }
  function cleanSnap(sn) {
    if (!sn || typeof sn !== 'object' || Array.isArray(sn)) return;
    (Array.isArray(sn.players) ? sn.players : []).forEach(function (p) {
      if (!p || typeof p !== 'object') return;
      if ('img' in p && !okImg(p.img)) delete p.img;
      if ('imgBg' in p && !okImg(p.imgBg)) delete p.imgBg;
    });
    (Array.isArray(sn.equipment) ? sn.equipment : []).forEach(function (q) { if (q && typeof q === 'object' && q.src != null && !okImg(q.src)) q.src = null; });
    if (sn.pitchImg != null && !okImg(sn.pitchImg)) sn.pitchImg = null;
  }
  /* 깊이 내려가며: 그림(thumb)과 팀 표식(_team…)은 어디서든 지우고, 장면(snap)은 걸러 낸다 */
  function walk(o, depth) {
    if (!o || typeof o !== 'object' || depth > 12) return;
    if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) walk(o[i], depth + 1); return; }
    Object.keys(o).forEach(function (k) {
      if (k === 'thumb' || k.indexOf('_team') === 0) { delete o[k]; return; }
      var v = o[k];
      if (k === 'snap') cleanSnap(v);
      if (v && typeof v === 'object') walk(v, depth + 1);
    });
  }
  /* 드릴 팩 → 보관함에 넣을 깨끗한 사본. 모양이 다르면 null */
  function cleanPack(pack) {
    if (!pack || typeof pack !== 'object' || pack.type !== 'process-studio-drillpack' || !Array.isArray(pack.drills)) return null;
    var drills = [];
    pack.drills.forEach(function (raw) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
      var d = JSON.parse(JSON.stringify(raw));
      TOP_DROP.forEach(function (k) { delete d[k]; });
      walk(d, 0);
      if (typeof d.folder !== 'string' || d.folder.indexOf('__') === 0) d.folder = '';   /* 빠른 보기 키(__mine …)는 폴더가 아니다 */
      drills.push(d);
    });
    return drills.length ? {type: 'process-studio-drillpack', version: 1, date: String(pack.date || ''), drills: drills} : null;
  }
  function foldersOf(pack) {
    var seen = {};
    ((pack && pack.drills) || []).forEach(function (d) { seen[String((d && d.folder) || '')] = 1; });
    return Object.keys(seen);
  }

  function mount(win) {
    var doc = win.document;
    function toast(s) { try { if (typeof win.toast === 'function') win.toast(s); } catch (_) {} }
    function canWrite() { try { return !doc.body.classList.contains('ps-viewonly'); } catch (_) { return true; } }
    function run(file) {
      if (!file) return Promise.resolve(false);
      if (file.size > MAX) { toast('파일이 너무 커요'); return Promise.resolve(false); }
      return Promise.resolve().then(function () { return file.text(); }).then(function (text) {
        var pack = null;
        try { pack = cleanPack(JSON.parse(text)); } catch (_) { pack = null; }
        if (!pack) { toast('보관함에서 내보낸 파일(.json)이 아니에요'); return false; }
        if (typeof win.importDrillPack !== 'function') { toast('지금은 가져올 수 없어요'); return false; }
        var fs = foldersOf(pack);
        var f = new win.File([JSON.stringify(pack)], file.name || 'drillpack.json', {type: 'application/json'});
        return Promise.resolve(win.importDrillPack(f)).then(function () {
          /* 넣은 자료가 한 폴더면 그 폴더로 — 보관함 목록(libFilter)은 board.html 의 let 전역이라 이름으로 읽는다 */
          try { if (fs.length === 1 && fs[0] && typeof libFilter !== 'undefined') libFilter.folder = fs[0]; } catch (_) {}
          try { if (typeof win.renderDrillFiles === 'function') win.renderDrillFiles(); } catch (_) {}
          return true;
        });
      }, function () { toast('파일을 읽을 수 없어요'); return false; });
    }
    function pick() {
      var inp = doc.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json'; inp.id = 'vccImportFile'; inp.style.display = 'none';
      inp.onchange = function () { var f = inp.files && inp.files[0]; try { inp.remove(); } catch (_) {} if (f) run(f); };
      doc.body.appendChild(inp);
      inp.click();
    }
    function addRow(ov) {
      if (!ov || ov.querySelector('#vccImportRow') || !canWrite()) return;
      var grid = ov.querySelector('#vccGrid'); if (!grid || !grid.parentNode) return;
      var row = doc.createElement('div'); row.className = 'vcc-ex'; row.id = 'vccImportRow';
      row.innerHTML = '<span><b>파일에서 가져오기</b> 보관함에서 내보낸 파일(.json)을 넣습니다. 훈련 · 장면 · 설명 · 폴더가 그대로 들어와요.</span>'
        + '<button type="button" class="vcc-ex-go" id="vccImport">파일 고르기</button>';
      row.querySelector('button').onclick = function (e) {
        e.stopPropagation();
        var x = ov.querySelector('.vcc-x');   /* 창은 board.html 의 close() 로 닫는다(Esc 리스너도 같이 걷힌다) */
        if (x) x.click(); else { try { ov.remove(); } catch (_) {} }
        pick();   /* 누른 그 순간(사용자 동작) 안에서 파일 창을 연다 */
      };
      var ex = ov.querySelector('.vcc-ex');
      var after = ex || grid;
      after.parentNode.insertBefore(row, after.nextSibling);
    }
    /* 창은 body 의 자식으로 붙는다 — body 의 자식만 본다(줄은 창 안에 붙으니 이 감시를 다시 부르지 않는다) */
    var mo = new win.MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var add = recs[i].addedNodes;
        for (var j = 0; j < add.length; j++) if (add[j] && add[j].id === 'vCreateChooser') addRow(add[j]);
      }
    });
    function start() { if (doc.body) mo.observe(doc.body, {childList: true}); }
    if (doc.body) start(); else doc.addEventListener('DOMContentLoaded', start);
    return {run: run, pick: pick};
  }

  var api = {cleanPack: cleanPack, foldersOf: foldersOf, MAX: MAX};
  if (typeof window !== 'undefined' && window.document) { try { api.mounted = mount(window); } catch (_) {} }
  return api;
});

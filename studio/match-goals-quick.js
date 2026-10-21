/* PROCESS STUDIO — 경기 리뷰 «득실 기록»을 더 쉽게(3.138). 사용자 «득점 실점 기록하는 방식이 더 쉬워졌으면 좋겠어».
   · 점수 칸 바로 아래 큰 «＋ 득점» · «＋ 실점» — 한 번 누르면 장면이 생기고 점수가 오른다(득실 장면 접이가 닫혀 있으면 연다).
     마지막 장면은 «↶ 되돌리기»로 지운다(그 쪽의 마지막 것). 예전엔 «득실 장면» 접이를 열고 안쪽의 흐린 «＋ 득점»을 찾아야 했다.
   · 장면 줄의 득점자는 고르개 대신 등번호 칩 한 번 — 경기 명단(선발 · 리저브)이 있으면 그 선수만, 없으면 선수단 전체.
     칩에 없는 선수는 «다른 선수»로 예전 고르개를 연다. 고른 뒤엔 그 칩 하나만 남고(▾), 누르면 다시 펼친다. 실점 줄은 그대로(상대 득점자는 글로).
   · 시간은 숫자 옆 «전반» · «후반» 칩 — 전반은 빈 칸에 1′ 부터, 후반은 46′ 부터 두고 숫자를 고치면 된다(안 눌러도 된다).
   저장 칸은 그대로(goals[].side · min · who · note). matchRenderGoals 는 scout.html 의 function 선언(window 속성)이라 감싼다.
   scout.html 은 크기 예산이 거의 차서(tests/report-fixes-3117) 여기서 더한다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSMatchGoalsQuick = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var CSS = '#matchView .mgq-bar{display:flex;gap:10px;margin:-4px 0 8px}'
    + '#matchView .mgq-bar button{flex:1 1 0;min-width:0;height:40px;padding:0 10px;border:1.5px solid #2E7D63;border-radius:10px;background:rgba(46,125,99,.08);color:#2E7D63;font-family:inherit;font-size:14px;font-weight:800;cursor:pointer;-webkit-tap-highlight-color:transparent;white-space:nowrap}'
    + '#matchView .mgq-bar button.them{border-color:#C24A46;background:rgba(194,74,70,.08);color:#C24A46}'
    + '#matchView .mgq-bar button.undo{flex:0 0 auto;border-color:var(--line);background:transparent;color:var(--dim);font-size:12px;font-weight:700}'
    + '#matchView .mgq-bar button:disabled{opacity:.35;cursor:default}'
    + '#matchView .mgq-chips{grid-area:who;display:flex;flex-wrap:wrap;align-items:center;gap:5px;min-width:0}'
    + '#matchView .mgq-chip{display:inline-flex;align-items:center;gap:4px;height:32px;padding:0 9px 0 6px;border:1px solid var(--line);border-radius:999px;background:var(--panel,#fff);color:var(--txt);font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;-webkit-tap-highlight-color:transparent;white-space:nowrap}'
    + '#matchView .mgq-chip b{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 4px;border-radius:999px;background:var(--soft,#eef1f5);color:var(--muted);font-size:11px;font-weight:800;font-variant-numeric:tabular-nums}'
    + '#matchView .mgq-chip.on{border-color:#2E7D63;background:rgba(46,125,99,.12);color:#2E7D63}#matchView .mgq-chip.on b{background:#2E7D63;color:#fff}'
    + '#matchView .mgq-chip.more{border-style:dashed;color:var(--dim)}'
    + '#matchView .mgq-chips.picked:not(.open) .mgq-chip:not(.on){display:none}#matchView .mgq-chips.picked:not(.open) .mgq-chip.on::after{content:"▾";margin-left:2px;opacity:.6}'
    + '#matchView .mgq-chips .mgl-who{flex:1 1 140px;grid-area:auto;display:none}#matchView .mgq-chips.open .mgl-who{display:block}'
    + '#matchView .mgq-chips.open .mgq-chip.more{border-style:solid;color:var(--txt)}'
    + '#matchView .mgq-half{display:inline-flex;gap:3px;margin-left:4px}'
    + '#matchView .mgq-half button{height:28px;padding:0 7px;white-space:nowrap;border:1px solid var(--line);border-radius:6px;background:var(--panel,#fff);color:var(--dim);font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent}'
    + '#matchView .mgq-half button.on{border-color:var(--txt);color:var(--txt)}'
    + '#matchView .mgl.ro .mgq-chip,#matchView .mgl.ro .mgq-half{pointer-events:none}'
    + '@media(max-width:600px){#matchView .mgl-row.mgq{grid-template-areas:"seg min min x" "who who who who" "note note note note"}#matchView .mgq-bar button{height:44px}}';

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function canEdit(win) { try { return typeof win.matchCanEdit === 'function' ? !!win.matchCanEdit() : true; } catch (_) { return false; } }

  // 칩에 올릴 선수: 경기 명단(선발 → 리저브)이 있으면 그 선수만, 없으면 선수단 전체(이름 있는 선수)
  function chipPlayers(win, m) {
    var ours = [];
    try { ours = (win.tmOurs() || []).filter(function (p) { return p && String(p.name || '').trim(); }); } catch (_) { ours = []; }
    var sq = null; try { sq = typeof win.matchReviewSquad === 'function' ? win.matchReviewSquad(m) : null; } catch (_) { sq = null; }
    var ids = sq ? (sq.start || []).concat(sq.res || []) : [];
    if (!ids.length) return { list: ours, rest: [] };
    var byId = {}; ours.forEach(function (p) { byId[p.id] = p; });
    var list = ids.map(function (id) { return byId[id]; }).filter(Boolean);
    var inList = {}; list.forEach(function (p) { inList[p.id] = 1; });
    return { list: list, rest: ours.filter(function (p) { return !inList[p.id]; }) };
  }

  function paintChips(box, who) {
    box.querySelectorAll('.mgq-chip[data-who]').forEach(function (c) { c.classList.toggle('on', c.dataset.who === who && !!who); });
  }

  // 득점 줄의 고르개 → 등번호 칩(값은 예전처럼 select 에 넣고 change 로 저장)
  function chipsFor(win, m, row, ro) {
    var sel = row.querySelector('select.mgl-who'); if (!sel || row.classList.contains('them')) return;
    var who = String(sel.value || ''), ps = chipPlayers(win, m);
    var wrap = document.createElement('div'); wrap.className = 'mgq-chips' + (who ? ' picked' : '');
    ps.list.forEach(function (p) {
      var nm = String(p.name || '').trim();
      var b = document.createElement('button'); b.type = 'button'; b.className = 'mgq-chip' + (who === nm ? ' on' : ''); b.dataset.who = nm;
      b.innerHTML = (p.num ? '<b>' + esc(p.num) + '</b>' : '') + esc(nm); b.title = nm + (who === nm ? ' — 다시 누르면 지움' : '');
      b.disabled = !!ro;
      b.onclick = function () {
        if (ro || !canEdit(win)) return;
        if (wrap.classList.contains('picked') && !wrap.classList.contains('open')) { wrap.classList.add('open'); return; }   // 접힌 칩 → 펼치기
        var v = sel.value === nm ? '' : nm;
        if (!sel.querySelector('option[value="' + nm.replace(/"/g, '\\"') + '"]')) { var o = document.createElement('option'); o.value = nm; o.textContent = nm; sel.appendChild(o); }
        sel.value = v; sel.dispatchEvent(new Event('change'));
        paintChips(wrap, v); wrap.classList.remove('open'); wrap.classList.toggle('picked', !!v);
      };
      wrap.appendChild(b);
    });
    var inChips = ps.list.some(function (p) { return String(p.name || '').trim() === who; });
    if (ps.rest.length || (who && !inChips)) {
      var more = document.createElement('button'); more.type = 'button'; more.className = 'mgq-chip more'; more.disabled = !!ro;
      more.textContent = (who && !inChips) ? who : '다른 선수';
      more.onclick = function () { if (wrap.classList.contains('picked') && !wrap.classList.contains('open')) { wrap.classList.add('open'); return; } wrap.classList.toggle('open'); if (wrap.classList.contains('open')) { try { sel.focus(); } catch (_) {} } };
      wrap.appendChild(more);
    }
    sel.parentNode.insertBefore(wrap, sel); wrap.appendChild(sel);
    sel.addEventListener('change', function () { var v = String(sel.value || ''); paintChips(wrap, v); wrap.classList.toggle('picked', !!v); var mb = wrap.querySelector('.mgq-chip.more'); if (mb) { var inL = ps.list.some(function (p) { return String(p.name || '').trim() === v; }); mb.textContent = (v && !inL) ? v : '다른 선수'; } });
    row.classList.add('mgq');
  }

  // 시간 칩 «전반» · «후반» — 숫자 칸을 비워 두지 않게 한 번에 1′ · 46′ 을 두고, 이미 적힌 숫자는 그대로 둔다
  function halfFor(row, ro) {
    var min = row.querySelector('.mgl-min input'); if (!min) return;
    var wrap = document.createElement('span'); wrap.className = 'mgq-half';
    [['1', '전반', function (n) { return n >= 1 && n <= 45; }], ['2', '후반', function (n) { return n >= 46; }]].forEach(function (h) {
      var b = document.createElement('button'); b.type = 'button'; b.dataset.half = h[0]; b.textContent = h[1]; b.disabled = !!ro;
      b.onclick = function () {
        if (ro) return;
        var n = parseInt(min.value, 10), inHalf = isFinite(n) && h[2](n);
        if (!inHalf) { min.value = h[0] === '1' ? '1' : '46'; min.dispatchEvent(new Event('input', { bubbles: true })); }
        paint(); try { min.focus(); min.select(); } catch (_) {}
      };
      wrap.appendChild(b);
    });
    function paint() { var n = parseInt(min.value, 10); wrap.querySelectorAll('button').forEach(function (b) { var ok = isFinite(n) && (b.dataset.half === '1' ? (n >= 1 && n <= 45) : n >= 46); b.classList.toggle('on', ok); }); }
    min.addEventListener('input', paint); paint();
    min.parentNode.appendChild(wrap);
    row.classList.add('mgq');
  }

  // 점수 칸 아래 큰 «＋ 득점» · «＋ 실점» · «↶ 되돌리기»
  function bar(win, m, ro) {
    var score = document.querySelector('#matchView .match-score'); if (!score || !score.parentNode) return;
    var el = score.parentNode.querySelector('.mgq-bar');
    if (!el) {
      el = document.createElement('div'); el.className = 'mgq-bar';
      el.innerHTML = '<button type="button" data-mgq="us" aria-label="득점 장면 추가">＋ 득점</button><button type="button" class="them" data-mgq="them" aria-label="실점 장면 추가">＋ 실점</button><button type="button" class="undo" data-mgq="undo" aria-label="마지막 장면 지우기" title="마지막 장면 지우기">↶</button>';
      score.parentNode.insertBefore(el, score.nextSibling);
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-mgq]'); if (!b || !canEdit(win)) return;
        var box = $('matchGoals'); if (!box) return;
        if (b.dataset.mgq === 'undo') {
          var dels = box.querySelectorAll('[data-mgl-del]'); if (!dels.length) return;
          dels[dels.length - 1].click();
          return;
        }
        var add = box.querySelector('[data-mgl-add="' + b.dataset.mgq + '"]'); if (!add) return;
        var sec = $('matchGoalsSection'); if (sec && !sec.open) sec.open = true;
        add.click();
        try { var last = box.querySelector('.mgl-row:last-child'); if (last) last.scrollIntoView({ block: 'nearest' }); } catch (_) {}
      });
    }
    var n = 0; try { n = (win.matchGoals(m) || []).length; } catch (_) { n = 0; }
    el.hidden = !!ro;
    var u = el.querySelector('[data-mgq="undo"]'); if (u) { u.disabled = !n; u.title = n ? '마지막 장면 지우기' : '지울 장면이 없어요'; }
  }

  function decorate(win, m, ro) {
    var box = $('matchGoals'); if (!box || !m) return;
    box.querySelectorAll('.mgl-row').forEach(function (row) {
      if (row.classList.contains('mgq')) return;
      chipsFor(win, m, row, ro); halfFor(row, ro);
    });
    bar(win, m, ro);
  }

  function mount(win) {
    if (!win || win.__mgqMounted) return; win.__mgqMounted = true;
    var orig = win.matchRenderGoals; if (typeof orig !== 'function') return;
    if (!document.getElementById('ps-mgq-style')) { var st = document.createElement('style'); st.id = 'ps-mgq-style'; st.textContent = CSS; document.head.appendChild(st); }
    win.matchRenderGoals = function (m, readonly) {
      var r = orig.apply(this, arguments);
      try { decorate(win, m, !!readonly || !canEdit(win)); } catch (e) { try { console.warn('match-goals-quick', e); } catch (_) {} }
      return r;
    };
  }

  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mount(window); }); else mount(window);
  }
  return { mount: mount, chipPlayers: chipPlayers, CSS: CSS };
});

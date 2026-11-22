/* PROCESS STUDIO — 선수 평가서 · 추천서의 팀 쪽(scout.html 에서만 돈다).
   IDP › 선수 › «리포트»(idp.html)는 팀 문서를 못 쓴다 — 면담 기록(teamEvalMeet)과 같은 왕복으로 여기에 묻는다.
   · teamEvalPaper — 만든 종이의 사본을 선수 밑(`players[].papers`)에 남기거나 지운다. 팀 문서는 코칭스태프 전용이다.
     사본에는 **그날의 눈금**(levels)과 의견만 둔다. 그려진 종이(HTML)는 두지 않는다 — 팀 문서는 한 덩이로 동기화된다.
   · teamEvalStats — 기간의 경기 명단 · 훈련 참여 · 훈련 시간을 센다. 출석 탭과 같은 셈(avTotals)을 쓴다.
   scout.html 은 크기 예산이 거의 차서(tests/code-budget-3043) 여기서 더한다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.PSEvalPaperTeam = api; api.listen(root); }
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var MAX = 24, KINDS = { eval: 1, reco: 1 };
  function str(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }
  /* 받은 사본을 정해진 칸만 남겨 깨끗이 — 모르는 칸 · 큰 값은 버린다 */
  function clean(raw) {
    raw = raw || {};
    var id = str(raw.id, 40), kind = KINDS[raw.kind] ? raw.kind : '';
    if (!id || !kind) return null;
    var out = { id: id, kind: kind, at: +raw.at || 0, date: /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : '',
      label: str(raw.label, 80), by: str(raw.by, 80), opinion: str(raw.opinion, 2000) };
    if (kind === 'eval') {
      var lv = {}, src = (raw.levels && typeof raw.levels === 'object') ? raw.levels : {}, n = 0;
      Object.keys(src).forEach(function (k) { var v = Math.round(+src[k]);
        if (n < 80 && k.length <= 60 && v >= 1 && v <= 5) { lv[k] = v; n++; } });
      out.levels = lv;
    } else {
      out.to = str(raw.to, 80); out.contact = str(raw.contact, 80);
      out.picks = (Array.isArray(raw.picks) ? raw.picks : []).filter(function (x) { return typeof x === 'string' && x.length <= 60; }).slice(0, 3);
    }
    return out;
  }
  /* 새 것이 맨 앞. 같은 id 는 그 자리에서 바꾼다. MAX 를 넘으면 가장 오래된 것부터 떨어진다 */
  function upsert(list, paper) {
    list = (Array.isArray(list) ? list : []).filter(function (x) { return x && x.id; });
    var hit = -1; list.forEach(function (x, i) { if (x.id === paper.id) hit = i; });
    if (hit >= 0) list[hit] = paper; else list.unshift(paper);
    return list.slice(0, MAX);
  }
  /* 경기 명단에서 센다 — 선발 · 리저브 · 득점(득점자는 이름으로 적혀 있다). 출전 분은 팀 기록에 없다 */
  function matchStats(matches, pid, name, from, to, squadOf) {
    var o = { total: 0, start: 0, res: 0, goals: 0 };
    (matches || []).forEach(function (m) {
      var d = String((m && m.date) || ''); if (!m || d < from || d > to) return;
      o.total++;
      var sq = squadOf(m) || {};
      if ((sq.start || []).indexOf(pid) >= 0) o.start++; else if ((sq.res || []).indexOf(pid) >= 0) o.res++;
      (Array.isArray(m.goals) ? m.goals : []).forEach(function (g) { if (g && g.side === 'us' && name && String(g.who || '').trim() === name) o.goals++; });
    });
    return o;
  }
  function blockMinutes(t) { var n = 0; ((t && t.blocks) || []).forEach(function (b) {
    var v = parseInt(b.minutes || b.min || b.duration || b.dur, 10); if (isNaN(v)) return;
    n += v * Math.max(1, parseInt(b.sets, 10) || 1); }); return n; }

  function listen(w) {
    w.addEventListener('message', function (e) {
      var d = e.data || {}; if (!d || d.source !== 'app' || (d.type !== 'teamEvalPaper' && d.type !== 'teamEvalStats')) return;
      function reply(o) { try { (e.source || w.parent).postMessage(Object.assign({ source: 'scout', requestId: d.requestId, type: d.type + 'Ack' }, o), '*'); } catch (err) { console.warn('[eval-paper] reply', err); } }
      try {
        var role = (w.PSPerms && w.PSPerms.role) ? w.PSPerms.role() : 'admin';
        if (role === 'player') { reply({ ok: false, err: 'player' }); return; }
        var p = w.player(d.playerId);
        if (!p || w.isTargetPl(p)) { reply({ ok: false, err: 'noplayer' }); return; }
        if (d.type === 'teamEvalPaper') {
          if (!w.teEditable()) { reply({ ok: false, err: 'forbidden' }); return; }
          if (d.delId) p.papers = (Array.isArray(p.papers) ? p.papers : []).filter(function (x) { return x && x.id !== d.delId; });
          else { var c = clean(d.paper); if (!c) { reply({ ok: false, err: 'noid' }); return; } p.papers = upsert(p.papers, c); }
          w.save();
          reply({ ok: true, playerId: p.id, papers: p.papers.slice() });
          return;
        }
        var from = String(d.from || ''), to = String(d.to || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) { reply({ ok: false, err: 'range' }); return; }
        var ms = matchStats((w.matchLoad().matches) || [], p.id, String(p.name || '').trim(), from, to, w.matchReviewSquad);
        var minutes = 0, done = 0, sched = 0, PS = w.PSSchedule, PP = w.PSParticipation;
        if (PS && PS.cellOf && PP) {
          /* scout.html 의 `data` 는 let 이라 window 속성이 아니다 — 같은 전역 범위의 이름으로 읽는다 */
          var meta = (typeof data !== 'undefined' && data && data.meta) || {};
          var grp = w.plGrpOf(p), doc = (PS.view ? PS.view(grp) : PS.readFor ? PS.readFor(grp) : PS.read()) || {}, weeks = doc.weeks || {}, anchor = PS.anchor ? PS.anchor() : undefined;
          var today = w.stYmd(), st = w.plStatusOf(p), end = to < today ? to : today;
          for (var t = new Date(from + 'T00:00:00'), guard = 0; guard < 800; t.setDate(t.getDate() + 1), guard++) {
            var y = t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
            if (y > end) break;
            if (w.avDayKind(t, grp) !== 'train') continue;
            sched++;
            var r = PP.resolve(meta, p.id, y, 'train', st, today, true); if (!r || r.s !== 'ok') continue;
            done++;
            var c2 = PS.cellOf(t, anchor) || { wk: 0, di: 0 }, day = (weeks[c2.wk] || [])[c2.di] || {};
            (day.trainings || []).forEach(function (x) { minutes += blockMinutes(x); });
          }
        }
        reply({ ok: true, playerId: p.id, stats: { match: ms, train: { done: done, scheduled: sched, minutes: minutes } } });
      } catch (err) { reply({ ok: false, err: String((err && err.message) || err) }); }
    });
  }
  return { clean: clean, upsert: upsert, matchStats: matchStats, blockMinutes: blockMinutes, listen: listen, MAX: MAX };
});

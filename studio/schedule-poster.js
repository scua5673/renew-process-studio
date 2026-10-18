/* PROCESS STUDIO — 일정 PDF «깔끔하게»(3.091 · 사용자 «팀의 락커룸에 붙힐수 있는 퀄리티에 일정 PDF» → «깔끔하게 · 심플하게 · 최대한 담백하게»).
   흰 바탕에 글자 크기와 가는 선만: 머리는 «팀 이름 · 주간 일정» + 큰 기간, 색은 경기 하나(빨강). 색 블록 · 범례 · 부하 그래프 · 펜 줄은 뺀다.
   내용(세션 · 훈련 · 경기)은 process.html 의 weekBoardDocHTML · monthDocHTML 이 만든다.
   «자세히»를 고르면 예전 문서 모양(이 CSS 는 #printDoc.poster 에만 걸린다).
   CSS 는 process.html 에 <style id="ps-sched-poster-css"> 로 붙는다 — 인쇄 문서(__buildPrintDoc)가 페이지의 <style> 을 모아 싣는다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSSchedPoster = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var INK = '#111418', MUTED = '#6B7280', LINE = '#E5E7EB', RED = '#C8322D';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* 머리 한 줄. o = {team:{name, logo}, title, big, matches:[{when, opp, sub}]}
     작은 글자 «팀 이름 · 주간 일정», 큰 글자 «10월 12일 – 18일», 오른쪽에 이 기간의 경기(빨간 «경기» 한 단어만 색). team.logo 는 그릴 수 있는 주소 */
  function head(o) {
    o = o || {};
    var t = o.team || {}, name = String(t.name || '').trim();
    var emb = t.logo ? '<img class="pp-emb" src="' + esc(t.logo) + '" alt="">' : '';
    var eye = [name, o.title].filter(Boolean).map(esc).join(' · ');
    var ms = (o.matches || []).slice(0, 2).map(function (m) {
      return '<div class="pp-match"><span class="pp-ml">경기</span><b>' + (m.opp ? 'vs ' + esc(m.opp) : '상대 미정') + '</b><span>' + esc([m.when, m.sub].filter(Boolean).join(' · ')) + '</span></div>';
    }).join('');
    var more = (o.matches || []).length > 2 ? '<div class="pp-more">외 ' + ((o.matches || []).length - 2) + '경기</div>' : '';
    return '<div class="pp-head">' + emb + '<div class="pp-id"><div class="pp-eye">' + eye + '</div><div class="pp-big">' + esc(o.big || '') + '</div></div><div class="pp-sp"></div>' + ms + more + '</div>';
  }

  var P = '#printDoc.poster';
  var W = '#printDoc.pl-weekboard.poster';
  var M = '#printDoc.pl-month.poster';
  var CSS = [
    P + ',' + P + ' *{-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    /* ── 머리: 흰 바탕 · 글자와 선 하나 ── */
    P + ' .pp-head{flex:0 0 auto;display:flex;align-items:flex-end;gap:14px;padding:0 0 12px;margin-bottom:12px;border-bottom:2px solid ' + INK + '}',
    P + ' .pp-emb{flex:0 0 auto;height:42px;max-width:64px;object-fit:contain;align-self:center}',
    P + ' .pp-id{min-width:0;display:flex;flex-direction:column;gap:3px}',
    P + ' .pp-eye{font-size:12px;font-weight:600;color:' + MUTED + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    P + ' .pp-big{font-size:28px;font-weight:800;letter-spacing:-.03em;line-height:1.05;color:' + INK + ';white-space:nowrap}',
    P + ' .pp-sp{flex:1 1 auto}',
    P + ' .pp-match{flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-end;gap:2px;padding-left:16px}',
    P + ' .pp-match + .pp-match{border-left:1px solid ' + LINE + '}',
    P + ' .pp-ml{font-size:11px;font-weight:700;color:' + RED + '}',
    P + ' .pp-match b{font-size:17px;font-weight:800;letter-spacing:-.02em;color:' + INK + ';white-space:nowrap}',
    P + ' .pp-match span:last-child{font-size:12px;font-weight:500;color:' + MUTED + ';white-space:nowrap}',
    P + ' .pp-more{flex:0 0 auto;font-size:12px;font-weight:600;color:' + MUTED + '}',
    P + ' footer{border-top:0;margin-top:10px;padding-top:0;color:#B0B5BC}',

    /* ── 주간: 가는 세로선으로 나눈 일곱 칸 · 색은 경기 하나 ── */
    W + ' .pwb{gap:0;border-left:1px solid ' + LINE + '}',
    W + ' .pwb-col{padding:0 10px;border-right:1px solid ' + LINE + ';gap:12px}',
    W + ' .pwb-h{padding:0 0 8px;border-bottom:0;gap:6px;align-items:baseline}',
    W + ' .pwb-h.m b{color:' + RED + '}',
    W + ' .pwb-h b{font-size:19px;font-weight:800;color:' + INK + ';letter-spacing:-.02em}',
    W + ' .pwb-h .dt{font-size:13px;font-weight:500;color:' + MUTED + '}',
    W + ' .pwb-h .mn{display:none}',
    W + ' .pwb-md,' + W + ' .pwb-md.m{margin-left:auto;border:0;background:transparent;padding:0;font-size:10px;font-weight:600;color:#9CA3AF;letter-spacing:0}',
    W + ' .pwb-md.m{color:' + RED + '}',
    W + ' .pwb-s{gap:3px}',
    W + ' .pwb-sh{flex-wrap:wrap;row-gap:1px}',
    W + ' .pwb-sh b{font-size:16px;font-weight:800;color:' + INK + ';letter-spacing:-.02em}',
    W + ' .pwb-sh em{order:3;flex:1 0 100%;font-size:12.5px;font-weight:700;color:' + INK + ';white-space:normal;overflow:visible;line-height:1.3}',
    W + ' .pwb-sh .tag{background:transparent!important;color:#9CA3AF!important;font-size:10px;font-weight:600;padding:0}',
    W + ' .pwb-who{font-size:10.5px;font-weight:500;color:' + MUTED + ';margin-top:0}',
    W + ' .pwb-bl{gap:4px;margin-top:5px;padding-top:5px;border-top:1px solid ' + LINE + '}',
    W + ' .pwb-b,' + W + ' .pwb-b.meet{min-height:0!important;background:transparent!important;color:' + INK + '!important;border:0!important;border-radius:0;padding:0}',   // 높이 = 시간은 «자세히»에 — 여기는 목록
    W + ' .pwb-b b{font-size:11.5px;font-weight:600}',
    W + ' .pwb-b i{font-size:10.5px;font-weight:500;color:' + MUTED + ';opacity:1}',
    W + ' .pwb-co,' + W + ' .pwb-note{font-size:10px;font-weight:500;color:' + MUTED + '}',
    W + ' .pwb-tbd{font-size:11px;font-weight:500;color:#9CA3AF;padding:0}',
    W + ' .pwb-fill{display:none}',
    W + ' .pwb-match,' + W + ' .pwb-match.grow,' + W + ' .pwb-match.x{flex:0 0 auto;background:transparent;color:' + INK + ';border-radius:0;padding:0 0 0 8px;border-left:2px solid ' + RED + ';justify-content:flex-start;gap:2px}',
    W + ' .pwb-match small{font-size:11px;font-weight:700;letter-spacing:0;color:' + RED + ';opacity:1}',
    W + ' .pwb-match b{font-size:16px;font-weight:800;letter-spacing:-.02em;line-height:1.25}',
    W + ' .pwb-match span{font-size:14px;font-weight:700}',
    W + ' .pwb-match em{font-size:10.5px;font-weight:500;color:' + MUTED + ';opacity:1}',
    W + ' .pwb-match img{display:none}',
    W + ' .pwb-off{flex:0 0 auto;align-items:flex-start;background:none;padding:0}',
    W + ' .pwb-off b{font-size:14px;font-weight:700;letter-spacing:0;color:#9CA3AF}',
    W + ' .pwb-off b:after{content:" · 휴식";font-weight:600}',
    W + ' .pwb-off span{display:none}',
    W + ' .pwb-leg,' + W + ' .pwb-foot{display:none}',   // 범례 · 부하 · 합계는 «자세히»에

    /* ── 월간: 흰 칸 · 가는 선 · 큰 날짜 ── */
    M + ' table{margin-top:2px}',
    M + ' thead th{text-align:left;color:' + MUTED + '!important;font-size:12px!important;font-weight:700!important;padding:0 8px 6px!important;border-bottom:2px solid ' + INK + '}',
    M + ' tbody td{border:0!important;border-right:1px solid ' + LINE + '!important;border-bottom:1px solid ' + LINE + '!important;background:#fff!important;padding:8px 9px!important}',
    M + ' tbody td:first-child{border-left:1px solid ' + LINE + '!important}',
    M + ' tbody td.pm-out{opacity:.35}',
    M + ' tbody td > div:first-child > span:first-child{font-size:16px!important;font-weight:800!important;color:' + INK + '!important;letter-spacing:-.02em}',
    M + ' tbody td > div:first-child > span + span{color:#9CA3AF!important;font-weight:600!important}',
    M + ' tbody td.pm-match > div:first-child > span{color:' + RED + '!important}',
    M + ' tbody td.pm-match div{color:' + INK + '!important}',
    M + ' tbody td.pm-match > div:nth-child(2){color:' + RED + '!important;font-size:12px!important}',
    M + ' tbody td.pm-match > div:nth-child(3){color:' + MUTED + '!important}',
    M + ' tbody td.pm-off div{color:#9CA3AF!important}',
    M + ' tbody td div[style*="border-left:3px"]{border-left:0!important;padding-left:0!important}',
    M + ' tbody td div[style*="border-left:3px"] > div:first-child{font-size:11.5px!important;font-weight:700!important;color:' + INK + '!important}',
    M + ' tbody td div[style*="border-left:3px"] > div + div{color:' + MUTED + '!important}',
    M + ' .ponepage > div[style*="flex-wrap:wrap"]{display:none!important}'   // 색 범례 — 색을 걷었으니
  ].join('\n');

  function install(win) {
    var doc = win.document; if (!doc || doc.getElementById('ps-sched-poster-css')) return;
    var st = doc.createElement('style'); st.id = 'ps-sched-poster-css'; st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }
  if (typeof window !== 'undefined' && window.document) install(window);
  return { head: head, css: CSS, RED: RED };
});

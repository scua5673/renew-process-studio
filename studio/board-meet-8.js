/* PROCESS STUDIO — 경기 준비의 8 대 8 미팅(3.118). 사용자 «경기 준비하면서 처음에 8v8 인지 11v11 을 설정할 수 있게».
   경기에서 «＋ 새 미팅»을 누르면(scout.html mmCreateNow → app.html → __meetingFromMatch) 기본 9장이 붙는다 — board.html MEET_TPL(11인제).
   그 경기가 8 대 8 이면(payload.fmt === '8', scout 쪽 match-formats.js 가 싣는다) 같은 9장을 8인제 운동장(PITCH_SPECS.u12 — 65×48m)에
   8명씩으로 만든다: 우리 2-3-2(작전판 FORM["232"] 과 같은 번호 1~8) · 상대 3-3-1(FORM["331"] 번호). 좌표는 미터 — 우리 골대가 왼쪽(x 0),
   y 0 은 위 터치라인. 우리 팀은 위가 왼쪽(LCB · LM · 7번), 상대는 왼쪽으로 공격해 위가 오른쪽(RCB · RM)이다 — MEET_TPL 과 같은 쪽.
   board.html 은 크기 예산이 차서 고치지 않는다: __meetingFromMatch 를 감싸 그 동기 구간에만 깃발을 세우고, 그때 __meetTplSlides 가 8인제 판을 낸다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSMeet8 = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var LEN = 65, WID = 48;
  var US8 = [[1, 'GK'], [2, 'LCB'], [3, 'RCB'], [4, 'LM'], [5, 'CM'], [6, 'RM'], [7, 'ST'], [8, 'ST']];
  var OPP8 = [[1, 'GK'], [4, 'RCB'], [3, 'CB'], [2, 'LCB'], [7, 'RM'], [6, 'CM'], [5, 'LM'], [8, 'ST']];
  var TPL8 = [
    { t: 'BEST 8',   /* 우리 팀만 · 운동장 전체에 고르게(11인제 BEST 11 과 같은 생각) */
      us: [[5, 24], [20, 15], [20, 33], [37, 8], [37, 24], [37, 40], [54, 16], [54, 32]], op: [], ball: null },
    { t: '하이블록',   /* 상대 골키퍼부터 압박 — 수비 둘은 하프라인 */
      us: [[20, 24], [33, 17], [33, 31], [46, 9], [44, 23], [46, 39], [54, 18], [54, 30]],
      op: [[63, 24], [57, 10], [57, 24], [57, 38], [47, 4.5], [48, 27], [48, 44], [37, 24]], ball: [61.8, 25] },
    { t: '미드블록',   /* 가운데 1/3 에서 블록 — 상대 왼쪽 센터백이 공 */
      us: [[6, 24], [16, 17], [16, 31], [25, 9], [25, 24], [25, 39], [34, 17], [37, 32]],
      op: [[62, 24], [44, 10], [46, 24], [44, 38], [31, 4.5], [37, 21], [31, 44], [20, 24]], ball: [42.8, 38.8] },
    { t: '로우블록',   /* 우리 진영 깊이 — 상대 가운데 미드필더가 공 */
      us: [[3, 24], [10, 18], [10, 30], [16, 9], [16, 25], [16, 39], [22, 18], [22, 30]],
      op: [[61, 24], [37, 10], [41, 24], [37, 38], [18, 4], [28, 24], [18, 44], [12, 24]], ball: [26.8, 24.8] },
    { t: '빌드업',   /* 골키퍼부터 — 센터백 벌리고 가운데가 내려온다, 상대 3-3-1 압박 */
      us: [[3, 24], [9, 11], [9, 37], [24, 5], [16, 25], [24, 43], [33, 18], [33, 30]],
      op: [[62, 24], [34, 9], [38, 24], [34, 39], [17, 13], [22, 24], [17, 35], [11, 24]], ball: [4.3, 24.8] },
    { t: '전진·전개',   /* 가운데 1/3 — 상대 미드블록 사이로 */
      us: [[14, 24], [24, 14], [24, 34], [42, 6], [30, 24], [42, 42], [47, 19], [47, 30]],
      op: [[62, 24], [52, 14], [53, 24], [52, 34], [42, 13], [44, 24], [42, 35], [35, 22]], ball: [31.3, 24.8] },
    { t: '침투·마무리',   /* 마지막 1/3 — 상대 로우블록 */
      us: [[24, 24], [34, 14], [34, 34], [51, 6], [45, 24], [55, 43], [59, 18], [58, 30]],
      op: [[64, 24], [60, 13], [60, 25], [60, 35], [55, 15], [53, 25], [54, 34], [40, 28]], ball: [52.2, 6.8] },
    { t: '코너킥 수비',   /* 상대 코너(우리 골대 왼쪽 위) — 니어 포스트 · 골 에어리어 둘 · 대인 둘 · 박스 끝 · 역습 대기 */
      us: [[1.5, 24], [4.5, 21.5], [4.5, 27.5], [1, 19], [6, 15], [9, 29], [14, 22], [26, 30]],
      op: [[63, 24], [30, 21], [9, 25], [12, 31], [-1, -1], [17, 26], [5, 4], [8, 18]], ball: [0.8, 0.8] },
    { t: '코너킥 공격',   /* 우리 코너(상대 골대 오른쪽 위) — 수비와 같은 그림을 뒤집은 것 */
      us: [[18, 24], [35, 22], [56, 25], [60, 4], [48, 26], [66, -1], [57, 18], [53, 31]],
      op: [[63.5, 24], [60.5, 21.5], [60.5, 27.5], [56, 29], [64, 19], [59, 15], [51, 22], [39, 30]], ball: [64.2, 0.8] }
  ];
  var DEF_GEO = { mpp: 10, cx: 555, cy: 370 };   // board.html: MPP=10 · W=1110 · H=740
  function pt(g, m) {
    var l = g.cx - LEN * g.mpp / 2, t = g.cy - WID * g.mpp / 2;
    return { x: Math.round((l + (+m[0]) * g.mpp) * 10) / 10, y: Math.round((t + (+m[1]) * g.mpp) * 10) / 10 };
  }
  /* board.html meetTplSnap 과 같은 모양 — 판 바탕(base)의 겉모습만 빌리고 운동장은 8인제 전체 보기 */
  function snap(base, tp, g, tokFloor) {
    g = g || DEF_GEO;
    var sn = JSON.parse(JSON.stringify(base || {})), id = 1001;
    sn.players = []; sn.equipment = []; sn.drawings = [];
    Object.assign(sn, { pitchSpec: 'u12', area: 'full', pitchView: 'full', fieldMode: 'standard', halfSide: 'L', spFlip: false, pitchN: 1,
      press: null, spMarks: null, spMark: null, boardLocked: false, pitchTheme: '', pitchCustom: null, pitchImg: null, gridType: 'grid15' });   // 3.128 — 새 미팅은 네이비 · 15존(board.html meetTplSnap 과 같게)
    tp.us.forEach(function (m, i) { var q = pt(g, m), r = US8[i]; sn.players.push({ id: id++, team: 'blue', num: String(r[0]), pos: r[1], x: q.x, y: q.y }); });
    tp.op.forEach(function (m, i) { var q = pt(g, m), r = OPP8[i]; sn.players.push({ id: id++, team: 'red', num: String(r[0]), pos: r[1], x: q.x, y: q.y }); });
    sn.ball = tp.ball ? pt(g, tp.ball) : null;
    var f = +tokFloor > 0 ? +tokFloor : 0.4; if (!(+sn.tokenScale >= f)) sn.tokenScale = f;
    return sn;
  }
  function slides(base, skipFirst, oh, g, tokFloor) {
    var out = [];
    TPL8.forEach(function (tp, i) { if (skipFirst && i === 0) return; var sn = snap(base, tp, g, tokFloor); sn.orientation = oh === 'v' ? 'v' : 'h'; out.push({ title: tp.t, snap: sn }); });
    return out;
  }
  function is8(p) { return !!p && String(p.fmt || '') === '8'; }

  function install(win) {
    if (!win || win.__psMeet8) return;
    win.__psMeet8 = true;
    var on = false;
    /* 판의 const 전역(MPP · CX · CY)은 window 속성이 아니다 — 이름으로 읽는다(CLAUDE.md) */
    function geo() { try { return { mpp: MPP, cx: CX, cy: CY }; } catch (_) { return DEF_GEO; } }   // eslint-disable-line no-undef
    function floor() { try { return Math.min(0.4, win.defaultTokenScale()); } catch (_) { return 0.4; } }
    function wrap() {
      var f = win.__meetingFromMatch, t = win.__meetTplSlides;
      if (typeof f !== 'function' || typeof t !== 'function') return false;
      if (!f.__ps8) {
        var wf = function (p) { on = is8(p); try { return f.apply(this, arguments); } finally { on = false; } };
        wf.__ps8 = true; win.__meetingFromMatch = wf;
      }
      if (!t.__ps8) {
        var wt = function (base, skipFirst, oh) { return on ? slides(base, skipFirst, oh, geo(), floor()) : t.apply(this, arguments); };
        wt.__ps8 = true; win.__meetTplSlides = wt;
      }
      return true;
    }
    var doc = win.document;
    if (doc && doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', wrap); else wrap();
  }
  if (typeof window !== 'undefined' && window.document) install(window);
  return { LEN: LEN, WID: WID, US8: US8, OPP8: OPP8, TPL8: TPL8, pt: pt, snap: snap, slides: slides, is8: is8, install: install };
});

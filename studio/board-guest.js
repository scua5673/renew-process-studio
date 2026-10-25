/* PROCESS STUDIO — 로그인하지 않은 기기의 작전판은 이 기기에 저장한다(3.112 · 3.008 f196326 을 옮김).
   2.827(코치별 개인 작업 보드)부터 작전판의 저장 자리가 계정(uid)에 묶여, 로그인하지 않은 사람의 «저장»은 갈 곳이 없었다 —
   «보드를 아직 불러오는 중이에요…» 알림만 뜨고 새로고침하면 그림이 사라졌다. 약관 · 개인정보처리방침은 «로그인 없이 쓰면 기기에만 저장»을 약속한다.
   · 게스트 = 계정 보드 주인이 없고, 세션이 없고(셸이 늦게 떠도 기기의 ps_sync_session 으로), 계정 흔적(ps_cache_owner_v1 · ps_active_ws)도 없는 기기.
     계정 흔적이 남은 로그아웃 기기는 perms.js(1.831 guestOpen)가 작전판을 보기 전용으로 잠그므로 그 판정을 그대로 따른다.
   · 기기 전용 IndexedDB 칸 하나(ps_board_guest_v1 — 동기화 키가 아니라 서버로 가지 않는다). 저장한 뒤 다시 읽어 같은지 확인한다.
   · 게스트 편집도 «저장 ●» · 닫기 경고. 게스트가 그대로 게스트인 인증 신호(셸의 저장소 변경 등)에는 판을 비우지 않는다.
   · 로그인했는데 계정 보드가 비어 있으면(서버가 «없음»이라 답했고 이 기기에도 그 계정 사본 · 저장 안 한 초안이 없음) 이 기기의 게스트 보드를 연다.
     서버로 바로 보내지 않는다 — «저장 ●»으로 두고, 사용자의 «저장»이 계정에 들어가면 기기 칸을 비운다. 계정 보드가 있으면 아무것도 하지 않는다.
   · 계정 보드의 저장 · 불러오기 · 충돌 처리(board.html boardPrivate* · _boardLiveWriteNow)는 그대로 지난다 — 여기 감싼 함수는 게스트일 때만 다른 길로 가고,
     계정일 때는 같은 인자로 원래 함수를 부르고 그 결과를 그대로 돌려준다(빈 계정에 여는 경우만 불러오기가 끝난 뒤 한 걸음 더).
   board.html 이 본문 스크립트 끝, 부팅 복원(restoreLiveBoard) 바로 앞에서 PSBoardGuest.mount(window) 를 부른다 — 그때 감싸야 부팅 복원도 이 길을 지난다
   (본문의 function 선언은 window 속성이라 감쌀 수 있다 · let 전역 _bliveApplying · animPlaying 은 이름으로 읽는다). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSBoardGuest = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var KEY = 'ps_board_guest_v1';

  function parse(raw) { if (raw == null) return null; try { return JSON.parse(raw); } catch (_) { return null; } }
  function sameAccount(a, b) { return !!a && !!b && a.uid === b.uid && a.wid === b.wid; }

  /* 게스트인가 — o: {owner, community, shellUid, deviceUid, deviceOwner, deviceWs} */
  function isGuest(o) {
    o = o || {};
    if (o.owner || o.community) return false;
    if (o.shellUid || o.deviceUid) return false;     // 로그인한 기기 — 팀 전환 잠금처럼 잠깐 주인이 없는 것은 게스트가 아니다
    if (o.deviceOwner || o.deviceWs) return false;   // 다른 계정 흔적이 있는 로그아웃 기기 — perms.js 가 보기 전용으로 잠근다
    return true;
  }

  /* 기기 칸 한 줄 — {v:1, raw:<작전판 live 본문 JSON 글(계정 보드와 같은 모양 · boardLiveCapture)>, at} */
  function encode(raw, at) { return JSON.stringify({ v: 1, raw: raw, at: at }); }
  function decode(value) {
    var o = parse(value);
    if (!o || o.v !== 1 || typeof o.raw !== 'string') return null;
    var live = parse(o.raw);
    if (!live || typeof live !== 'object' || Array.isArray(live)) return null;
    return { value: value, raw: o.raw, at: +o.at || 0, live: live };
  }
  function snapEmpty(sn) { return !((sn && sn.players && sn.players.length) || (sn && sn.equipment && sn.equipment.length) || (sn && sn.drawings && sn.drawings.length)); }   // board.html _boardSnapEmpty 와 같다
  /* 열어 줄 만한 보드인가 — 지금 판 · 다른 페이지 · 장면 중 하나라도 선수 · 장비 · 그림이 있으면 */
  function hasContent(live) {
    if (!live || typeof live !== 'object') return false;
    if (live.snap && !snapEmpty(live.snap)) return true;
    var pg = live.boardPages && live.boardPages.pages;
    if (Array.isArray(pg) && pg.some(function (p) { return p && p.snap && !snapEmpty(p.snap); })) return true;
    var fr = live.animFrames;
    return Array.isArray(fr) && fr.some(function (f) { return f && f.snap && !snapEmpty(f.snap); });
  }

  /* 로그인한 계정 보드에 이 기기의 게스트 보드를 열어도 되나 — 불러오기가 끝난 뒤의 상태로만 판단한다.
     s: {loaded, record, base, head, idbHead, draft, dirty, edited, busy} (board.html 의 _boardPrivate* · _boardManual* 값) */
  function canAdopt(s) {
    s = s || {};
    if (s.loaded !== true || s.record) return false;                                  // 계정 보드를 다 읽었고 보일 본문이 없다
    if (!s.base || s.base.raw !== null || s.base.cupd !== null) return false;         // 서버가 «없음»이라고 답했다 — 못 읽은 것은 빈 것이 아니다
    if (s.head != null || s.idbHead != null) return false;                            // 이 기기에도 그 계정의 사본이 없다
    if (s.draft) return false;                                                        // 그 계정의 저장 안 한 기기 초안(3.038 «되살리기» 띠)이 먼저
    if (s.dirty || s.edited || s.busy) return false;                                  // 그새 손댔거나 다른 화면(보관함 · 편집기 · 미팅)이 판을 빌려 쓴다
    return true;
  }

  function mount(win, env) {
    if (!win || !win.document) return null;
    if (win.__psBoardGuest) return win.__psBoardGuest;
    try { if (/[?&]community_view=1(&|$)/.test(String(win.location && win.location.search || ''))) return null; } catch (_) { return null; }   // 커뮤니티 곁 보드는 남의 글을 본다
    var need = ['boardSaveExplicit', 'boardSaveOne', 'boardSaveLive', 'restoreLiveBoard', 'boardPrivateAuthChanged', 'boardPrivateOwner', 'boardLiveCapture', 'boardLiveApply'];
    for (var i = 0; i < need.length; i++) if (typeof win[need[i]] !== 'function') return null;   // 작전판이 바뀌었다 — 감싸지 않는다(예전 동작 그대로)
    var doc = win.document;
    /* let 전역은 window 속성이 아니라 이름으로 읽는다(시험은 env.lex 로 준다) */
    var lex = (env && env.lex) || function () {
      var o = { applying: false, playing: false };
      try { o.applying = typeof _bliveApplying !== 'undefined' && !!_bliveApplying; } catch (_) { o.applying = false; }   // eslint-disable-line no-undef
      try { o.playing = typeof animPlaying !== 'undefined' && !!animPlaying; } catch (_) { o.playing = false; }          // eslint-disable-line no-undef
      return o;
    };
    var st = { loaded: false, gen: 0, reading: 0, seq: 0, saving: false, adopted: null, adoptGen: 0 };
    var orig = {};
    need.forEach(function (n) { orig[n] = win[n]; });

    function ls(k) { try { return win.localStorage.getItem(k); } catch (_) { return null; } }
    function cls(c) { try { return !!(doc.body && doc.body.classList.contains(c)); } catch (_) { return false; } }
    function community() { try { return /[?&]community_view=1(&|$)/.test(String(win.location.search || '')) || cls('comm-viewing'); } catch (_) { return true; } }
    function shellUid() { try { var p = win.parent, s = p && p !== win && p.PSSync && p.PSSync.session && p.PSSync.session(); return s && s.uid ? String(s.uid) : ''; } catch (_) { return ''; } }
    function deviceUid() { var s = parse(ls('ps_sync_session')); return s && s.uid ? String(s.uid) : ''; }
    function owner() { try { return orig.boardPrivateOwner.call(win); } catch (_) { return null; } }
    function active() { return isGuest({ owner: owner(), community: community(), shellUid: shellUid(), deviceUid: deviceUid(), deviceOwner: !!ls('ps_cache_owner_v1'), deviceWs: !!ls('ps_active_ws') }); }
    function toast(m) { try { if (typeof win.toast === 'function') win.toast(m); } catch (e) { diag('board-guest-toast', e); } }
    function status() { try { if (typeof win.boardManualStatus === 'function') win.boardManualStatus(); } catch (e) { diag('board-guest-status', e); } }
    function diag(stage, e) { try { if (typeof win.PSStorageDiagnostic === 'function') win.PSStorageDiagnostic(stage, e); } catch (_) { /* 진단을 남기지 못해도 작전판은 그대로 */ } }
    /* 판을 다른 일이 빌려 쓰는 중 — 계정 보드 저장(_boardLiveWriteNow)과 같은 문지기. 미팅 중 저장은 계정 보드처럼 된다(작업 보드 장면은 따로 둔 것을 담는다) */
    function saveBusy() {
      if (win.__psThumbCapturing || win.__capLock || win.__animExport || win._vaultBoardContext || win._vaultBoardRestoring || win.__vaultEdit) return true;
      var l = lex(); if (l.applying || l.playing) return true;
      return cls('editing') || (win.__csView || 'board') === 'session';
    }
    /* 판을 바꿔 끼워도 되나 — 서버 보드 적용(boardApplyServerLive)과 같은 문지기 */
    function applyBusy() { return saveBusy() || cls('meet-mode'); }
    /* boardSaveLive 가 «편집»으로 셌을 자리까지 왔나(그 함수의 앞 문지기와 같은 차례) */
    function liveReach() {
      if (win.__psThumbCapturing || win.__psPreviewRefreshing || win._vaultBoardContext || win._vaultBoardRestoring) return false;
      var l = lex(); if (l.applying) return false;
      if (community() || win.__capLock || cls('editing')) return false;
      if ((win.__csView || 'board') === 'session' || win.__animExport) return false;
      return !l.playing;
    }
    function read() {
      var s = win.storage;
      if (!s || typeof s.get !== 'function') return Promise.resolve(null);
      return Promise.resolve().then(function () { return s.get(KEY); }).then(function (r) { return decode(r && r.value); }, function (e) { diag('board-guest-read', e); return null; });
    }

    /* 게스트 보드 열기 — 읽는 사이 손댄 판은 그대로 둔다(빈 판에서 바로 그리기 시작한 경우) */
    function restore() {
      if (!active()) return Promise.resolve(false);
      var gen = ++st.gen; st.loaded = false; st.reading = gen;
      if (!win._boardManualDirty) win._boardUserTouched = false;   // restoreLiveBoard 와 같다 — 깨끗한 상태에서 불러오면 불러오기 렌더는 «변경»이 아니다
      return read().then(function (g) {
        if (gen !== st.gen || !active()) return false;
        if (g && !win._boardManualDirty && !win._boardUserTouched && !applyBusy()) {
          try { orig.boardLiveApply.call(win, g.live); } catch (e) { diag('board-guest-apply', e); }
        }
        st.loaded = true; st.reading = 0;
        if (win._boardUserTouched && !win._boardManualDirty) { win._boardManualDirty = true; status(); }   // 여는 사이 그린 것은 저장 전 — «저장 ●» · 닫기 경고
        return true;
      });
    }
    function save(o) {
      o = o || {};
      if (!st.loaded) { toast('보드를 여는 중이에요 — 잠시 뒤 «저장»을 다시 눌러 주세요'); return Promise.resolve(false); }
      if (st.saving || saveBusy()) return Promise.resolve(false);
      try { if (typeof win.restoreAnimBeforeCapture === 'function') win.restoreAnimBeforeCapture(); } catch (e) { diag('board-guest-anim', e); }
      var cap = null;
      try { cap = orig.boardLiveCapture.call(win, win.__csView || 'board'); } catch (e) { cap = null; }
      if (!cap || typeof cap.raw !== 'string') { toast('저장 준비를 완료하지 못했습니다 — 현재 화면을 유지하고 다시 저장해 주세요'); return Promise.resolve(false); }
      var rec = encode(cap.raw, Date.now()), seq = st.seq, s = win.storage;
      st.saving = true;
      return Promise.resolve().then(function () {
        if (!s || typeof s.set !== 'function' || typeof s.get !== 'function') throw new Error('기기 저장소를 찾지 못했습니다');
        return s.set(KEY, rec);
      }).then(function () { return s.get(KEY); }).then(function (chk) {
        if (!chk || chk.value !== rec) throw new Error('기기 저장을 확인하지 못했습니다');
        st.saving = false;
        if (seq === st.seq && active()) win._boardManualDirty = false;   // 저장하는 사이 또 손댔으면 «저장 ●» 그대로
        status();
        if (!o.quiet) toast('이 기기에 저장됨 ✓ · 로그인하면 다른 기기·팀과 함께 써요');
        return true;
      }).catch(function (e) {
        st.saving = false; diag('board-guest-save', e);
        toast('이 기기에 저장하지 못했어요 — 저장 공간을 확인해 주세요');
        return false;
      });
    }
    /* 빈 계정 보드에 이 기기의 게스트 보드를 연다(불러오기가 끝난 뒤). 서버로 보내지 않는다 — «저장 ●» */
    function adopt(o, ag) {
      function current() { return ag === st.adoptGen && sameAccount(win._boardPrivateOwner, o) && sameAccount(owner(), o); }
      function now(draft) { return { loaded: win._boardPrivateLoaded, record: win._boardPrivateRecord, base: win._boardPrivateBase, head: win._boardPrivateHead, idbHead: win._boardPrivateIdbHead, draft: draft, dirty: !!win._boardManualDirty, edited: !!win._boardUserTouched, busy: applyBusy() }; }
      if (!current() || !canAdopt(now(false))) return Promise.resolve(false);
      var gen = win._boardPrivateGeneration, edit = win._boardPrivateEditSeq, slot = null;
      return read().then(function (g) {
        if (!g || !hasContent(g.live) || !current()) return null;
        slot = g;
        if (typeof win.boardDraftRead !== 'function') return null;
        return Promise.resolve().then(function () { return win.boardDraftRead(o); }).catch(function () { return 'unknown'; });   // 초안을 확인하지 못하면 열지 않는다
      }).then(function (draft) {
        if (!slot || !current() || gen !== win._boardPrivateGeneration || edit !== win._boardPrivateEditSeq || !canAdopt(now(!!draft))) return false;
        try { orig.boardLiveApply.call(win, slot.live); } catch (e) { diag('board-guest-adopt', e); return false; }
        win._boardPrivateEditSeq = (win._boardPrivateEditSeq || 0) + 1;   // 진행 중인 불러오기 · 저장이 이 판을 «저장됨»으로 덮지 않게(«되살리기»와 같다)
        win._boardManualDirty = true; win._boardUserTouched = true;
        st.adopted = { uid: o.uid, wid: o.wid, value: slot.value, seq: win._boardPrivateEditSeq };
        status();
        toast('로그인 전에 이 기기에서 만든 보드를 열었어요 — «저장»하면 계정에 저장돼요');
        return true;
      });
    }
    /* 계정에 저장됐으니 기기 칸을 비운다 — 연 그 원문 그대로일 때만(다른 창의 게스트가 그 사이 새로 저장했으면 남긴다) */
    function clearSlot(a) {
      st.adopted = null;
      var s = win.storage; if (!s) return;
      Promise.resolve().then(function () {
        if (typeof s.delIfValue === 'function') return s.delIfValue(KEY, a.value);
        if (typeof s.del === 'function') return s.del(KEY);
      }).catch(function (e) { diag('board-guest-clear', e); });
    }

    /* ── 감싸기 ── */
    function saveExplicit(o) {
      if (active()) return save((o && typeof o === 'object' && !o.type) ? o : {});
      var a = st.adopted, p = orig.boardSaveExplicit.apply(this, arguments);
      if (!a) return p;
      var noLink = !!(o && typeof o === 'object' && !o.type && o.noLink);
      return Promise.resolve(p).then(function (ok) {
        if (ok !== true || st.adopted !== a || !sameAccount(win._boardPrivateOwner, a)) return ok;
        if (noLink) st.adopted = null;   // «새 보드»의 저장 — 연 보드가 아니라 새 판이 계정에 들어갔다. 기기 칸은 지우지 않고 남긴다
        else clearSlot(a);
        return ok;
      });
    }
    function saveOne() {
      if (active()) return save({});   // 보관함은 로그인해야 쓰니 «보관함에 담을까요»는 묻지 않는다
      return orig.boardSaveOne.apply(this, arguments);
    }
    function saveLive() {
      var guest = st.loaded && liveReach() && active();
      var r = orig.boardSaveLive.apply(this, arguments);
      if (guest) {
        st.seq++; win._boardManualDirty = true;   // 게스트 편집도 «저장 ●» · 닫기 경고(beforeunload 가 _boardManualDirty 를 본다)
        try { if (typeof win.boardSchedulePreview === 'function') win.boardSchedulePreview(); } catch (e) { diag('board-guest-preview', e); }
        status();
      }
      return r;
    }
    /* 연 그대로(손대지 않은) 보드는 그 계정의 기기 초안(3.038)으로 따로 적지 않는다 — 원문은 기기 칸에 있다.
       로그인 첫 부팅은 서버 자료를 받으면 앱을 한 번 새로 연다(sync.js onApplied 'boot'). 그때 초안을 적으면 다음 부팅이 «되살리기» 띠를 내고
       빈 계정 보드에 다시 열지 않는다. 손대면(boardSaveLive 가 편집 순번을 올린다) 예전처럼 초안이 지킨다. */
    function draftSuppressed() {
      var a = st.adopted;
      return !!(a && win._boardPrivateEditSeq === a.seq && sameAccount(win._boardPrivateOwner, a));
    }
    function draftWrite() {
      if (draftSuppressed()) return false;
      return orig.boardDraftWriteNow.apply(this, arguments);
    }
    function restoreLive() {
      if (community()) return orig.restoreLiveBoard.apply(this, arguments);
      if (active()) return restore();
      var o = owner(), p = orig.restoreLiveBoard.apply(this, arguments);
      if (!o) return p;
      var ag = ++st.adoptGen;
      return Promise.resolve(p).then(function (ok) {
        if (ok !== true) return ok;
        return adopt(o, ag).then(function () { return ok; }, function (e) { diag('board-guest-adopt', e); return ok; });
      });
    }
    function authChanged() {
      if (community()) return orig.boardPrivateAuthChanged.apply(this, arguments);
      if (!win._boardPrivateOwner && active()) {
        /* 게스트가 그대로 게스트 — 계정 보드를 연 적이 없으니 비울 것이 없다. 저장 안 한 그림을 지키고, 아직 안 열었으면 연다 */
        if (!st.loaded && !st.reading) restore();
        return;
      }
      st.gen++; st.loaded = false; st.reading = 0;   // 게스트를 벗어난다 — 읽던 게스트 칸은 버린다
      if (st.adopted && !sameAccount(owner(), st.adopted)) st.adopted = null;
      var r = orig.boardPrivateAuthChanged.apply(this, arguments);
      if (!win._boardPrivateOwner && active()) restore();
      return r;
    }
    win.boardSaveExplicit = saveExplicit;
    win.boardSaveOne = saveOne;
    win.boardSaveLive = saveLive;
    win.restoreLiveBoard = restoreLive;
    win.boardPrivateAuthChanged = authChanged;
    if (typeof win.boardDraftWriteNow === 'function') { orig.boardDraftWriteNow = win.boardDraftWriteNow; win.boardDraftWriteNow = draftWrite; }
    if (typeof win.__boardSaveExplicit === 'function') win.__boardSaveExplicit = saveExplicit;
    if (typeof win.__boardSaveOne === 'function') win.__boardSaveOne = saveOne;

    var api = {
      active: active,
      loaded: function () { return st.loaded; },
      adopted: function () { return !!st.adopted; },
      draftSuppressed: draftSuppressed,
      restore: restore,
      save: save
    };
    win.__psBoardGuest = api;
    return api;
  }

  return { KEY: KEY, isGuest: isGuest, encode: encode, decode: decode, hasContent: hasContent, snapEmpty: snapEmpty, canAdopt: canAdopt, sameAccount: sameAccount, mount: mount };
});

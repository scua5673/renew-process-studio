/* PROCESS STUDIO — 장면 줄 + 도구 = 한 덩어리(3.079, 레이아웃 2단계). 사용자 목업 «장면 줄 + 도구 = 한 덩어리» → «2단계 만들어서 보여줘».
   떠 있는 하단 도크(body.ps-dock-float)에서 도크(#ps-command-dock) 자체를 카드 하나로 만들고,
   위는 필름 줄(#animBar) — ▶ 재생 · 장면 썸네일(번호 · 시간) · ＋ · 장면 편집 · 속도 · 내보내기, 아래는 도구 줄(#cmd-tool-row).
   - 노드는 옮기지 않는다: #animBar 는 #ps-command-dock 의 바로 아래 자식 그대로(숨김 · 스킨 · 무대 여백 규칙이 그 자리를 본다).
     차례는 묶음(.cmd-cluster)의 CSS order 로만 바꾼다.
   - 장면 칩(.anim-frame)의 썸네일 칸(.aft)은 보드가 이미 채운다(__afWindow) — 숨겨 두던 것을 보이게 하고,
     장면마다 확대가 다르지 않게 전체 운동장 viewBox(data-psvb)로 맞춘다. #animFrames 에는 칩 말고 아무것도 넣지 않는다(순서 · 끌기가 자식 번호를 쓴다).
   - 시간 표시는 칩 안의 작은 글자(.df-dur): 머무는 시간(animHold) + 다음 장면까지 이동(1 ÷ 속도). 마지막 장면은 머무는 시간만. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSDockFilm = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  // 장면 i 의 재생 시간(초) — 보드 playAnim 과 같은 셈: 머묾 max(.2, hold) + (마지막이 아니면) 이동 max(.3, dur||1) / 속도
  function sceneSecs(frames, i, hold, speedOf) {
    if (!frames || !frames[i]) return 0;
    var f = frames[i], s = Math.max(0.2, +hold || 0.6);
    if (i < frames.length - 1) { var sp = speedOf ? +speedOf(f) : (+f.moveSpeed > 0 ? +f.moveSpeed : 1); s += Math.max(0.3, +f.dur || 1) / (sp > 0 ? sp : 1); }
    return Math.round(s * 10) / 10;
  }
  // 썸네일 SVG 글: 언제나 전체 운동장(data-psvb, 없으면 제 viewBox) — 가로 판은 칸을 채우고(slice), 세로 판은 잘리지 않게(meet)
  function fitThumb(markup, w, h) {
    var m = /^\s*<svg\b[^>]*>/.exec(markup || ''); if (!m) return markup || '';
    var tag = m[0], vb = (/\sdata-psvb="([^"]+)"/.exec(tag) || [])[1] || (/\sviewBox="([^"]+)"/.exec(tag) || [])[1], q = vb ? vb.split(/[\s,]+/).map(Number) : null, wide = !!(q && q.length === 4 && q[2] >= q[3]);
    var t = tag.replace(/\spreserveAspectRatio="[^"]*"/, '');
    if (vb) t = /\sviewBox="[^"]*"/.test(t) ? t.replace(/\sviewBox="[^"]*"/, ' viewBox="' + vb + '"') : t.replace(/^(\s*<svg\b)/, '$1 viewBox="' + vb + '"');
    t = t.replace(/^(\s*<svg\b)/, '$1 preserveAspectRatio="' + (wide ? 'xMidYMid slice' : 'xMidYMid meet') + '"');
    if (w > 0 && h > 0) { t = t.replace(/\s(width|height)="[^"]*"/g, '').replace(/^(\s*<svg\b)/, '$1 width="' + w + '" height="' + h + '"'); }
    return t + markup.slice(tag.length);
  }
  function fmtSecs(s) { return (Math.round(s * 10) / 10).toFixed(1) + '초'; }

  var N = []; for (var i = 0; i < 16; i++) N.push(':not(#fm' + i + ')');
  var NN = N.join('');
  var F = 'html.ps-page-board body.ps-dock-float #ps-command-dock' + NN;                 // 도크(카드)
  var A = 'html.ps-page-board body.ps-dock-float:not(.ps-df-anim-off):not(.cmd-dock-folded) #ps-command-dock' + NN + '>#animBar';   // 필름 줄(보일 때만)
  function css() {
    var white = 'background:linear-gradient(180deg,rgba(255,255,255,.97),rgba(246,247,250,.94))!important;border:1px solid rgba(20,22,26,.07)!important;box-shadow:0 1px 0 rgba(255,255,255,.8) inset,0 12px 30px rgba(8,12,24,.22)!important;-webkit-backdrop-filter:blur(18px) saturate(1.4)!important;backdrop-filter:blur(18px) saturate(1.4)!important;';
    return [
      // 카드: 도크가 판 하나 — 줄 둘은 투명, 사이 가는 선
      F + '{gap:0!important;padding:0!important;align-items:stretch!important;border-radius:24px!important;overflow:visible!important}',
      // 스킨이 없을 때(또는 «기본» 밝은 화면): 흰 판
      'html.ps-page-board body.ps-dock-float:not(.ps-skin-glass):not(.ps-skin-bevel):not(.fmdark) #ps-command-dock' + NN + '{' + white + '}',
      F + '>#animBar,' + F + ' #cmd-tool-row{background:transparent!important;border:0!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;max-width:none!important}',
      F + '>#floatBar{min-height:0!important;height:auto!important;align-items:stretch!important}',
      F + ' #cmd-tool-row{justify-content:center!important;border-radius:0 0 24px 24px!important;max-height:none!important}',
      // 색: 스킨마다 강조색 · 선
      'html.ps-page-board body.ps-dock-float #ps-command-dock{--df-accent:#14213D;--df-line:rgba(20,33,61,.1);--df-ink:#1A2233;--df-dim:#5E6675;--df-well:rgba(20,33,61,.06);--df-on-ink:#fff}',
      'html.ps-page-board body.ps-dock-float.ps-skin-glass #ps-command-dock,html.ps-page-board body.ps-dock-float.fmdark #ps-command-dock{--df-accent:#5B82FF;--df-line:rgba(255,255,255,.1);--df-ink:#E8ECF4;--df-dim:rgba(232,236,244,.6);--df-well:rgba(255,255,255,.08)}',
      'html.ps-page-board body.ps-dock-float.ps-skin-bevel.fmdark #ps-command-dock,html.ps-page-board body.ps-dock-float.ps-skin-flat.fmdark #ps-command-dock{--df-accent:#E6E9EF;--df-on-ink:#14161A}',
      // 필름 줄
      A + '{display:flex!important;flex-direction:row!important;align-items:center!important;gap:8px!important;height:auto!important;min-height:0!important;max-height:none!important;padding:8px 12px 8px 10px!important;width:auto!important;overflow:visible!important;border-bottom:1px solid var(--df-line)!important;border-radius:24px 24px 0 0!important;column-gap:8px!important}',
      A + '>.cmd-cluster{height:auto!important;min-height:0!important;max-height:none!important;padding:0!important;background:transparent!important;box-shadow:none!important;border:0!important;display:flex!important;align-items:center!important;gap:4px!important;flex:0 0 auto!important;width:auto!important;max-width:none!important}',
      A + '>#cmd-scene-transport{order:0!important}' + A + '>#cmd-scene-strip{order:1!important;flex:1 1 auto!important;min-width:120px!important;overflow:hidden!important}' + A + '>#cmd-scene-edit{order:2!important}' + A + '>#cmd-scene-time{order:3!important}' + A + '>#cmd-scene-export{order:4!important}',
      A + '>#cmd-scene-time,' + A + '>#cmd-scene-export{padding-left:8px!important;border-left:1px solid var(--df-line)!important;border-radius:0!important}',
      A + ' #cmd-scene-meta{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;height:46px!important;min-width:0!important;padding:0 4px 0 0!important;margin:0!important;background:transparent!important;border:0!important;box-shadow:none!important}',
      A + ' #cmd-scene-status{height:auto!important;padding:0!important;font:800 11px/1.25 Pretendard,-apple-system,sans-serif!important;color:var(--df-dim)!important;white-space:nowrap!important;background:transparent!important}',
      A + ' #cmd-scene-strip{display:flex!important;align-items:center!important;gap:2px!important}',
      // ▶ 큰 둥근 단추
      A + ' #animPlay{width:44px!important;min-width:44px!important;max-width:44px!important;height:44px!important;min-height:44px!important;max-height:44px!important;flex:0 0 44px!important;border-radius:50%!important;padding:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border:0!important}',
      A + ' #animPlay{background:linear-gradient(180deg,rgba(255,255,255,.24),rgba(255,255,255,0) 55%,rgba(0,0,0,.14)),var(--df-accent)!important;color:var(--df-on-ink)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.4),inset 0 -2px 0 rgba(0,0,0,.2),0 6px 14px rgba(0,0,0,.28)!important}',
      A + ' #animPlay:hover{transform:translateY(-1px)!important}',
      A + ' #animPlay svg{color:var(--df-on-ink)!important;fill:var(--df-on-ink)!important;stroke:none!important}',
      A + ' #animPlay svg{width:20px!important;height:20px!important;max-width:20px!important;max-height:20px!important}',
      // 장면 썸네일
      A + ' #animFrames{display:flex!important;align-items:center!important;gap:8px!important;flex:1 1 auto!important;min-width:0!important;max-width:442px!important;width:auto!important;height:60px!important;min-height:60px!important;max-height:60px!important;padding:7px 6px!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important;background:transparent!important;box-shadow:none!important;border:0!important}',
      A + ' #animFrames::-webkit-scrollbar{display:none}',
      A + ' #animFrames.df-more-r{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 26px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 26px),transparent)}',
      A + ' #animFrames.df-more-l{-webkit-mask-image:linear-gradient(90deg,transparent,#000 26px);mask-image:linear-gradient(90deg,transparent,#000 26px)}',
      A + ' #animFrames.df-more-l.df-more-r{-webkit-mask-image:linear-gradient(90deg,transparent,#000 26px,#000 calc(100% - 26px),transparent);mask-image:linear-gradient(90deg,transparent,#000 26px,#000 calc(100% - 26px),transparent)}',
      A + ' #animFrames>.anim-frame{position:relative!important;flex:0 0 78px!important;width:78px!important;min-width:78px!important;max-width:78px!important;height:46px!important;min-height:46px!important;max-height:46px!important;padding:0!important;border:0!important;border-radius:10px!important;overflow:hidden!important;background:#2f6e3a!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12),0 2px 6px rgba(0,0,0,.28)!important;display:block!important;cursor:pointer!important;transition:transform .15s,box-shadow .15s!important}',
      A + ' #animFrames>.anim-frame:hover{transform:translateY(-1px)!important}',
      A + ' #animFrames>.anim-frame.on{box-shadow:0 0 0 2px #fff,0 0 0 4.5px var(--df-accent),0 4px 12px rgba(0,0,0,.35)!important}',
      A + ' #animFrames>.anim-frame.sel{outline:2px dashed var(--df-accent)!important;outline-offset:3px!important}',
      A + ' #animFrames>.anim-frame.sel::after{content:"";position:absolute;inset:0;border:2px dashed #fff;border-radius:10px;pointer-events:none;z-index:2}',
      A + ' #animFrames>.anim-frame.sel:not(.on){box-shadow:inset 0 0 0 1px rgba(255,255,255,.12),0 2px 6px rgba(0,0,0,.28)!important}',
      A + ' #animFrames>.anim-frame.dragging{opacity:.45!important}',
      A + ' #animFrames>.anim-frame.drop{box-shadow:0 0 0 2.5px dashed var(--df-accent)!important;outline:2px dashed var(--df-accent)!important;outline-offset:2px!important}',
      A + ' #animFrames>.anim-frame .aft{display:block!important;position:absolute!important;inset:0!important;left:0!important;top:0!important;width:100%!important;height:100%!important;border-radius:0!important;background:#2f6e3a!important;overflow:hidden!important;pointer-events:none!important}',
      A + ' #animFrames>.anim-frame .aft>svg{display:none!important}',
      A + ' #animFrames>.anim-frame .aft>img.df-thumb{display:block!important;width:100%!important;height:100%!important;object-fit:cover!important;border:0!important;pointer-events:none!important}',
      A + ' #animFrames>.anim-frame .afi{position:absolute!important;left:5px!important;top:4px!important;right:auto!important;width:auto!important;min-width:0!important;height:auto!important;padding:1px 6px!important;border-radius:6px!important;background:rgba(0,0,0,.55)!important;color:#fff!important;font:900 10.5px/14px Pretendard,-apple-system,sans-serif!important;z-index:2!important;pointer-events:none!important;transform:none!important}',
      A + ' #animFrames>.anim-frame .df-dur{position:absolute!important;right:5px!important;bottom:3px!important;z-index:2!important;font:800 10px/1 Pretendard,-apple-system,sans-serif!important;color:#fff!important;background:rgba(0,0,0,.55)!important;padding:2px 5px!important;border-radius:6px!important;text-shadow:none!important;pointer-events:none!important}',
      A + ' #animFrames>.anim-frame .afm{display:none!important}',
      A + ' #animFrames>.anim-frame.on .afm,' + A + ' #animFrames>.anim-frame.on .afm *{color:#fff!important}' + A + ' #animFrames>.anim-frame.on .afm{display:inline-flex!important;position:absolute!important;right:3px!important;top:3px!important;left:auto!important;width:22px!important;min-width:22px!important;height:18px!important;min-height:18px!important;max-height:18px!important;padding:0!important;align-items:center!important;justify-content:center!important;border:0!important;border-radius:6px!important;background:rgba(0,0,0,.55)!important;color:#fff!important;font:900 12px/1 Pretendard,-apple-system,sans-serif!important;z-index:3!important}',
      A + ' #animFrames>.anim-frame .afc{z-index:2!important}',
      A + ' #animFrames>.anim-frame.sg-start{margin-left:12px!important}',
      A + ' #animFrames:empty::before{content:"1"!important;display:flex!important;align-items:flex-start!important;justify-content:flex-start!important;flex:0 0 78px!important;width:78px!important;height:46px!important;padding:4px 6px!important;box-sizing:border-box!important;border-radius:10px!important;background:#2f6e3a!important;color:#fff!important;font:900 10.5px/14px Pretendard,-apple-system,sans-serif!important;box-shadow:0 0 0 2.5px var(--df-accent)!important}',
      A + ' #animFrames:empty::after{display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:2!important;align-self:center!important;flex:1 1 auto!important;min-width:0!important;overflow:hidden!important;color:var(--df-dim)!important;font:700 11.5px/1.3 Pretendard,-apple-system,sans-serif!important;margin-left:10px!important;white-space:normal!important}',
      // ＋ 다음 장면: 점선 칸
      A + ' #animAdd{width:46px!important;min-width:46px!important;max-width:46px!important;height:46px!important;min-height:46px!important;max-height:46px!important;flex:0 0 46px!important;border-radius:10px!important;background:transparent!important;border:1.5px dashed var(--df-line)!important;box-shadow:none!important;color:var(--df-dim)!important;padding:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;margin-right:4px!important}',
      A + ' #animAdd:hover{border-color:var(--df-accent)!important;color:var(--df-ink)!important;background:var(--df-well)!important}',
      A + ' #animAdd svg{width:20px!important;height:20px!important}',
      A + ' #cmd-scene-edit>button:not(#animAdd),' + A + ' #animLoopBtn,' + A + ' #cmd-export-btn{width:34px!important;min-width:34px!important;max-width:34px!important;height:34px!important;min-height:34px!important;max-height:34px!important;flex:0 0 34px!important;padding:0!important;border-radius:10px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}',
      A + ' #cmd-export-btn>:not(svg){display:none!important}',
      A + ' #cmd-scene-time select{height:32px!important;min-height:32px!important;max-height:32px!important;border-radius:10px!important;padding:0 8px!important;font:800 12px/1 Pretendard,-apple-system,sans-serif!important;width:auto!important;min-width:52px!important}',
      // 알림(#cs-ftoast)이 카드 위에 겹치지 않게
      'html body.ps-dock-float #cs-ftoast{bottom:calc(var(--dock-h,72px) + 32px)!important}'
    ].join('\n');
  }

  function install(win) {
    var doc = win.document, body = doc.body;
    if (!body || body.__psDockFilm) return null;
    body.__psDockFilm = true;
    var st = doc.createElement('style'); st.id = 'ps-dock-film-css'; st.textContent = css(); doc.head.appendChild(st);
    function on() { return body.classList.contains('ps-dock-float'); }
    /* global anim, animHold */
    function g(name) {   // 작전판의 let/const 전역은 같은 문서의 다른 스크립트에서 이름으로 읽힌다(eval 없이 — CSP)
      try { switch (name) {
        case 'anim': return typeof anim !== 'undefined' ? anim : null;
        case 'animHold': return typeof animHold !== 'undefined' ? animHold : null;
      } } catch (_) {} return null;
    }
    // 칩마다: 시간 글자 · 썸네일을 전체 운동장으로
    function decorate() {
      var box = doc.getElementById('animFrames'); if (!box) return;
      var chips = box.children;
      if (!box.__dfE) { box.__dfE = 1; win.requestAnimationFrame(function () { box.__dfE = 0; edges(box); }); }   // 크기 읽기는 다음 그림 때(관찰자 안에서 배치를 강제하지 않게)
      if (!on()) { undecorate(box); return; }
      var A0 = g('anim'), frames = A0 && A0.frames, hold = g('animHold'), sp = typeof win.animMoveSpeed === 'function' ? win.animMoveSpeed : null;
      for (var i = 0; i < chips.length; i++) {
        var c = chips[i]; if (!c.classList || !c.classList.contains('anim-frame')) continue;
        if (frames && frames[i]) {
          var t = fmtSecs(sceneSecs(frames, i, hold, sp)), d = c.querySelector('.df-dur');
          if (!d) { d = doc.createElement('span'); d.className = 'df-dur'; d.setAttribute('aria-hidden', 'true'); c.appendChild(d); }
          if (d.textContent !== t) d.textContent = t;
          if (c.__dfTitle == null) c.__dfTitle = c.title || '';
          var tt = '장면 ' + (i + 1) + ' · ' + t + (c.__dfTitle ? ' — ' + c.__dfTitle : ''); if (c.title !== tt) c.title = tt;
        }
        // 보드가 넣은 SVG(수천 개 노드)는 그리지 않고, 장면마다 한 번 만든 그림(img)으로 바꿔 끼운다 — 줄을 다시 그릴 때마다 SVG 를 배치하지 않게
        var aft = c.querySelector('.aft'), sv = aft && aft.querySelector(':scope>svg');
        if (sv && frames && frames[i] && frames[i].thumb) {
          var url = thumbUrl(frames[i]);
          if (url) {   // 같은 장면은 같은 img 를 다시 쓴다(새로 만들면 매번 다시 불러온다)
            var rc = cache.get(frames[i]), im = rc && rc.img;
            if (!im || im.__u !== url) { im = doc.createElement('img'); im.className = 'df-thumb'; im.alt = ''; im.decoding = 'async'; im.draggable = false; im.src = url; im.__u = url; if (rc) rc.img = im; }
            else if (im.isConnected) im = im.cloneNode();
            aft.replaceChildren(im);
          }
        }
      }
    }
    // 장면 그림 캐시: 장면 객체 → { thumb 글, blob URL }. 글이 바뀔 때만 다시 만든다(최근 80장만 남긴다)
    // SVG 그림을 img 로 쓰면 줄을 다시 그릴 때마다 SVG 를 새로 그려 느리다(실측 4장에 ~35ms) — 장면마다 한 번 PNG(156×92)로 구워 둔다
    var cache = new win.WeakMap(), lru = [], TW = 156, TH = 92;
    function drop(rec) { if (!rec) return; if (rec.url) { try { win.URL.revokeObjectURL(rec.url); } catch (_) {} } rec.url = null; rec.thumb = null; rec.img = null; }   // thumb 을 비워 다음에 다시 굽게
    function thumbUrl(f) {
      var rec = cache.get(f); if (rec && rec.thumb === f.thumb) return rec.url || '';   // 굽는 중이면 ''(잔디색 칸)
      drop(rec);
      var mk = ''; try { mk = typeof win.thumbView === 'function' ? win.thumbView(f) : f.thumb; } catch (_) { mk = f.thumb; }
      rec = { thumb: f.thumb, url: null }; cache.set(f, rec);
      if (!mk) return '';
      var svgUrl = ''; try { svgUrl = win.URL.createObjectURL(new win.Blob([fitThumb(mk, TW, TH)], { type: 'image/svg+xml' })); } catch (_) { return ''; }
      var img = new win.Image();
      img.onload = function () {
        var done = function (url) { try { win.URL.revokeObjectURL(svgUrl); } catch (_) {} if (cache.get(f) !== rec) { if (url) try { win.URL.revokeObjectURL(url); } catch (_) {} return; } rec.url = url; for (var q = lru.length - 1; q >= 0; q--) if (!lru[q].url) lru.splice(q, 1); lru.push(rec); while (lru.length > 120) drop(lru.shift()); later(); };
        try {
          var cv = doc.createElement('canvas'); cv.width = TW; cv.height = TH; var cx = cv.getContext('2d');
          cx.fillStyle = '#2f6e3a'; cx.fillRect(0, 0, TW, TH); cx.drawImage(img, 0, 0, TW, TH);
          cv.toBlob(function (b) { done(b ? win.URL.createObjectURL(b) : ''); }, 'image/png');
        } catch (_) { done(''); }
      };
      img.onerror = function () { try { win.URL.revokeObjectURL(svgUrl); } catch (_) {} };
      img.src = svgUrl;
      return '';
    }
    // 떠 있는 도크가 아니면 칩을 보드가 그린 그대로 둔다
    function undecorate(box) {
      var ds = box.querySelectorAll('.df-dur,.aft>img.df-thumb'); for (var k = 0; k < ds.length; k++) ds[k].remove();
      for (var j = 0; j < box.children.length; j++) { var c = box.children[j]; if (c.__dfTitle != null) { c.title = c.__dfTitle; c.__dfTitle = null; } }
    }
    // 가려진 장면이 있으면 그쪽 가장자리를 흐리게
    function edges(box) {
      var l = on() && box.scrollLeft > 2, r = on() && box.scrollLeft + box.clientWidth < box.scrollWidth - 2;
      if (box.classList.contains('df-more-l') !== l) box.classList.toggle('df-more-l', l);
      if (box.classList.contains('df-more-r') !== r) box.classList.toggle('df-more-r', r);
    }
    var busy = false, queued = false;
    function later() { if (queued) return; queued = true; win.requestAnimationFrame(function () { queued = false; if (busy) return; busy = true; try { decorate(); } catch (_) {} busy = false; }); }
    function watch() {
      var box = doc.getElementById('animFrames'); if (!box || box.__psFilm) return !!box;
      box.__psFilm = true;
      try { new win.MutationObserver(function () { if (busy) return; busy = true; try { decorate(); } catch (_) {} busy = false; }).observe(box, { childList: true, subtree: true }); } catch (_) {}
      box.addEventListener('scroll', function () { edges(box); }, { passive: true });
      // 마우스 휠(세로)로도 장면 줄을 옆으로 넘긴다
      box.addEventListener('wheel', function (e) {
        if (!on() || Math.abs(e.deltaY) <= Math.abs(e.deltaX) || box.scrollWidth <= box.clientWidth + 1) return;
        box.scrollLeft += e.deltaY; e.preventDefault();
      }, { passive: false });
      ['animSpeedSel', 'animHoldSel'].forEach(function (id) { var s = doc.getElementById(id); if (s) s.addEventListener('change', function () { win.setTimeout(later, 0); }); });
      later();
      return true;
    }
    var lastKey = '';
    win.addEventListener('resize', function () { var b = doc.getElementById('animFrames'); if (b) edges(b); });
    try { new win.MutationObserver(function () {
      var k = [on(), body.classList.contains('ps-df-anim-off'), body.classList.contains('cmd-dock-folded')].join();
      if (k === lastKey) return; lastKey = k; later();
      // 카드 높이가 바뀌면 무대 아래 여백을 다시 잰다(보드는 창 크기 바뀜에서 다시 맞춘다)
      win.requestAnimationFrame(function () { try { win.dispatchEvent(new win.Event('resize')); } catch (_) {} });
    }).observe(body, { attributes: true, attributeFilter: ['class'] }); } catch (_) {}
    var n = 0; (function tryIt() { if (watch()) return; if (++n < 80) win.setTimeout(tryIt, 250); })();
    return { decorate: decorate };
  }
  if (typeof window !== 'undefined' && window.document) {
    var go = function () { window.__psDockFilm = install(window); };
    if (window.document.readyState === 'loading') window.document.addEventListener('DOMContentLoaded', go); else go();
  }
  return { sceneSecs: sceneSecs, fmtSecs: fmtSecs, fitThumb: fitThumb, css: css, install: install };
});

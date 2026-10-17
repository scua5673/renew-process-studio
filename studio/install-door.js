/* PROCESS STUDIO — 홈 화면 설치의 문(門)과 한 번만 뜨는 안내.
   사용자 «홈화면에 설치도 만들고 싶은데 앱안에 어디다 넣으면 좋을까?» → 목업 «너의 추천대로» → «아이패드와 컴퓨터 사용자도 볼 수 있게».
   설치 안내 시트와 원클릭 설치는 셸(app.html · window.psInstallGo)이 맡는다. 이 파일은 그 시트로 가는 문만 연다:
   - 폰: 하단 «더보기» 시트의 «앱» 줄(앱 더보기 · 팀 더보기 둘 다) — [data-install-door]
   - 아이패드 · 컴퓨터: 왼쪽 메뉴 아래, 업데이트 · 앱 설정 바로 위 한 칸 — #psInstWrap
   - 세 기기 모두: 다른 날 세 번째로 열 때 한 번만 뜨는 안내 카드 — #psInstNudge
   문은 설치되면 사라진다(눌러도 아무 일 없는 문은 두지 않는다). 데스크톱 파이어폭스는 설치를 못 하므로 문도 안내도 없다.
   앱 설정 › 기기 › 앱·오프라인 줄(#psPwaInstall)은 그대로다 — 이 문들은 같은 시트를 여는 바로가기다. */
(function(root,factory){
  'use strict';
  var api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSInstallDoor=api;
})(typeof window!=='undefined'?window:null,function(win){
  'use strict';
  var KEY='ps_install_nudge_v1',DAYS_BEFORE=3,WAIT_MS=6000,RETRY_MS=5000,TRIES=24,LATER_MS=4200;

  /* ── 판정(시험은 이 함수들을 돌려 본다) ─────────────────────────────── */
  /* 셸의 browserKind 와 같은 갈래 — 안내 시트가 고르는 길과 문 이름이 어긋나지 않게 */
  function kindOf(ua,platform,touchPoints){
    ua=String(ua||'');
    var ios=/iPad|iPhone|iPod/.test(ua)||(platform==='MacIntel'&&(touchPoints|0)>1);
    if(ios)return /CriOS/.test(ua)?'ios-chrome':(/EdgiOS/.test(ua)?'ios-edge':(/FxiOS/.test(ua)?'ios-firefox':'ios-safari'));
    if(/Android/i.test(ua))return /SamsungBrowser/i.test(ua)?'and-samsung':(/Firefox/i.test(ua)?'and-firefox':'and-chrome');
    if(/Edg\//.test(ua))return 'desk-edge';
    if(/Firefox/.test(ua))return 'desk-firefox';
    if(/Safari/.test(ua)&&!/Chrome|Chromium/.test(ua))return 'desk-safari';
    return 'desk-chrome';
  }
  function mobileOS(kind){ return /^(ios|and)-/.test(String(kind||'')); }
  function canInstall(kind){ return kind!=='desk-firefox'; }
  /* 폰 · 아이패드는 «홈 화면», 컴퓨터는 «앱 설치» — 컴퓨터에는 홈 화면이 없다 */
  function label(kind){ return mobileOS(kind)?'홈 화면에 추가':'앱 설치'; }
  function copy(kind){
    return mobileOS(kind)
      ?{title:'홈 화면에 추가해 보세요',body:'주소창 없이 전체 화면으로 열리고, 아이콘 하나로 바로 들어와요. 자료는 그대로예요.'}
      :{title:'앱으로 설치해 보세요',body:'주소창 없이 창 하나로 열리고, 독 · 작업 표시줄 아이콘으로 바로 들어와요. 자료는 그대로예요.'};
  }
  function showDoors(ctx){ return !!ctx&&!ctx.installed&&canInstall(ctx.kind); }
  function dayOf(ms){ var d=new Date(ms); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
  function readState(raw){
    var s=null; try{ s=JSON.parse(raw||'null'); }catch(_){}
    if(!s||typeof s!=='object')s={};
    var days=Array.isArray(s.days)?s.days.filter(function(d){ return typeof d==='string'&&/^\d{4}-\d\d-\d\d$/.test(d); }):[];
    return {days:days.slice(-DAYS_BEFORE),shown:typeof s.shown==='string'?s.shown:''};
  }
  /* 쓴 날을 센다 — 같은 날 여러 번 열거나 새로고침해도 하루로. 새 판으로 다시 열릴 때마다 세면 판 올린 날 안내가 뜬다 */
  function noteOpen(state,nowMs){
    var day=dayOf(nowMs),days=state.days.slice();
    if(days[days.length-1]!==day)days.push(day);
    return {days:days.slice(-DAYS_BEFORE),shown:state.shown};
  }
  function shouldNudge(state,ctx){ return showDoors(ctx)&&!state.shown&&state.days.length>=DAYS_BEFORE; }
  /* «괜찮아요» 뒤 한 줄 — 지금 화면에 보이는 문을 가리킨다 */
  function laterText(surface,kind){
    if(surface==='more')return '언제든 더보기 › '+label(kind)+'에서 다시 볼 수 있어요';
    if(surface==='rail')return '언제든 왼쪽 아래 «'+label(kind)+'»에서 다시 볼 수 있어요';
    return '언제든 앱 설정 › 기기 탭에서 다시 볼 수 있어요';
  }

  var api={kindOf:kindOf,mobileOS:mobileOS,canInstall:canInstall,label:label,copy:copy,showDoors:showDoors,
    dayOf:dayOf,readState:readState,noteOpen:noteOpen,shouldNudge:shouldNudge,laterText:laterText,KEY:KEY,DAYS_BEFORE:DAYS_BEFORE};
  if(!win||!win.document)return api;

  /* ── 셸에 붙이기 ──────────────────────────────────────────────────── */
  var doc=win.document,nav=win.navigator||{};
  var kind=kindOf(nav.userAgent,nav.platform,nav.maxTouchPoints);
  function installed(){ try{ return (win.matchMedia&&win.matchMedia('(display-mode: standalone)').matches)||nav.standalone===true; }catch(_){ return false; } }
  function ctx(){ return {installed:installed(),kind:kind}; }
  function $(id){ return doc.getElementById(id); }
  function visible(el){ try{ if(!el||el.hidden)return false; var r=el.getBoundingClientRect(); return r.width>0&&r.height>0&&win.getComputedStyle(el).visibility!=='hidden'; }catch(_){ return false; } }
  function lsGet(){ try{ return win.localStorage.getItem(KEY); }catch(_){ return null; } }
  function lsSet(s){ try{ win.localStorage.setItem(KEY,JSON.stringify(s)); }catch(_){} }
  function go(){ try{ if(win.psInstallGo)win.psInstallGo(); }catch(_){} }

  function sync(){
    var on=showDoors(ctx()),lb=label(kind);
    [].forEach.call(doc.querySelectorAll('[data-install-door]'),function(b){
      b.hidden=!on;
      var t=b.querySelector('[data-install-label]'); if(t)t.textContent=lb;
      b.setAttribute('aria-label',lb+' — 방법 보기');
    });
    var w=$('psInstWrap'); if(w)w.hidden=!on;
    var rl=$('psInstRailLb'); if(rl)rl.textContent=lb;
    if(!on)closeNudge();
  }

  function css(){
    if($('ps-install-door-css'))return;
    var st=doc.createElement('style'); st.id='ps-install-door-css';
    /* 색 · 글자 · 모서리는 tokens.css 의 값(--c-* · --t-* · --sp-* · --r-*) — 다크 모드는 그 변수가 따라온다 */
    st.textContent=''
      /* 더보기 시트의 문: 옆 알약과 같은 모양 + 옅은 남색(새로 생긴 문이 보이게). 시트의 알약 규칙(html body … button:not(#_))보다 세게 */
      +'#appMoreSheet#appMoreSheet [data-install-door],#teamMoreSheet#teamMoreSheet [data-install-door]{display:inline-flex;align-items:center;gap:var(--sp-1,4px);'
        +'background:var(--ps-color-action-soft,#E9EDF5);border-color:color-mix(in srgb,var(--c-act,#14213D) 18%,var(--ps-color-action-soft,#E9EDF5));color:var(--c-act,#14213D);font-weight:700}'
      +'#appMoreSheet#appMoreSheet [data-install-door][hidden],#teamMoreSheet#teamMoreSheet [data-install-door][hidden]{display:none}'
      +'[data-install-door] svg{width:16px;height:16px;flex:0 0 auto}'
      /* 아이패드 · 컴퓨터 왼쪽 메뉴의 칸: 앱 설정 타일과 같은 옷(.gearbtn)을 입는다 — 여기서는 자리만 */
      +'.ps-instwrap{display:none}'
      +'@media (min-width:768px){.appbar>.ps-instwrap{display:block;order:9;width:100%}.appbar>.ps-instwrap[hidden]{display:none}}'
      /* 한 번만 뜨는 안내 카드 */
      +'#psInstNudge{position:fixed;z-index:2147483050;left:10px;right:10px;bottom:calc(var(--ps-seg-h,64px) + 10px);box-sizing:border-box;'
        +'padding:var(--sp-3,12px);background:var(--c-surface,#fff);color:var(--c-ink,#14161A);border:1px solid var(--c-line,#E3E6EA);border-radius:16px;'
        +'box-shadow:var(--sh-3,0 24px 48px rgba(16,24,40,.22));font-family:inherit;animation:psnIn .18s ease-out}'
      /* 아이패드 · 컴퓨터는 오른쪽 위 — 브라우저의 설치 단추가 있는 쪽이고, 아래에는 작전판 도구 막대가 있다 */
      +'@media (min-width:768px){#psInstNudge{left:auto;right:20px;top:72px;bottom:auto;width:360px}}'
      +'@media (prefers-reduced-motion:reduce){#psInstNudge{animation:none}}'
      +'@keyframes psnIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'
      +'#psInstNudge .psn-top{display:flex;gap:var(--sp-3,12px);align-items:flex-start}'
      +'#psInstNudge .psn-ic{width:44px;height:44px;flex:0 0 auto;border-radius:11px;display:block}'
      +'#psInstNudge .psn-tx{flex:1 1 auto;min-width:0}'
      +'#psInstNudge .psn-t{display:block;margin:2px 0 3px;word-break:keep-all;font-size:var(--t-5,14px);font-weight:800;letter-spacing:-.01em}'
      +'#psInstNudge .psn-b{display:block;word-break:keep-all;font-size:var(--t-3,12px);font-weight:500;line-height:1.5;color:var(--c-muted,#646A73)}'
      +'#psInstNudge .psn-btns{display:flex;gap:var(--sp-2,8px);margin-top:var(--sp-3,12px)}'
      +'#psInstNudge .psn-btns button{flex:1 1 0;min-height:44px;border-radius:var(--r-control,10px);font:inherit;font-size:var(--t-4,13px);cursor:pointer}'
      +'#psInstNudge .psn-no{border:1px solid var(--c-line,#E3E6EA);background:var(--c-surface,#fff);color:var(--c-ink,#14161A);font-weight:700}'
      +'#psInstNudge .psn-go{border:0;background:var(--ps-navy,var(--c-act,#14213D));color:#fff;font-weight:800}'
      +'#psInstNudge.is-later{word-break:keep-all;padding:var(--sp-3,12px) var(--sp-4,16px);background:var(--c-ink,#14161A);border-color:transparent;color:var(--c-surface,#fff);'
        +'font-size:var(--t-4,13px);font-weight:600;line-height:1.45;text-align:center}'
      +'@media (min-width:768px){#psInstNudge.is-later{width:auto;max-width:360px}}';
    (doc.head||doc.documentElement).appendChild(st);
  }

  /* 안내는 하던 일을 막지 않을 때만 — 입력 중 · 열린 시트 · 끄는 중이면 기다린다(셸의 업데이트와 같은 기준) */
  function quietNow(){
    if(doc.hidden)return false;
    try{ if(typeof win.psSafeToReload==='function'&&!win.psSafeToReload({}))return false; }catch(_){ return false; }
    if($('psInstallSheet')||$('psUpdProg'))return false;
    var gp=$('gearPop'); if(gp&&gp.classList.contains('on'))return false;
    var busy=['appMoreSheet','teamMoreSheet','psUpdPop'].some(function(id){ var el=$(id); return el&&!el.hidden&&visible(el); });
    if(busy)return false;
    return ![].some.call(doc.querySelectorAll('[role="dialog"][aria-modal="true"]'),visible);
  }
  function surface(){
    var phone=false; try{ phone=!!(win.matchMedia&&win.matchMedia('(max-width:767px)').matches); }catch(_){}
    if(phone){ var mb=$('psMoreBtn'),tm=doc.querySelector('#teamBottom [data-tb="more"]'); if(visible(mb)||visible(tm))return 'more'; return 'settings'; }
    return visible($('psInstRail'))?'rail':'settings';
  }
  function esc(t){ return String(t==null?'':t).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  var nudgeTimer=0,laterTimer=0;
  function closeNudge(){ clearTimeout(laterTimer); var n=$('psInstNudge'); if(n&&n.parentNode)n.parentNode.removeChild(n); doc.removeEventListener('keydown',onKey,true); }
  function onKey(e){ if(e.key==='Escape'&&$('psInstNudge')&&!$('psInstNudge').classList.contains('is-later'))later(); }
  function later(){
    var n=$('psInstNudge'); if(!n)return;
    n.className='is-later'; n.setAttribute('role','status'); n.removeAttribute('aria-labelledby'); n.removeAttribute('aria-describedby');
    n.textContent=laterText(surface(),kind);
    clearTimeout(laterTimer); laterTimer=setTimeout(closeNudge,LATER_MS);
  }
  function showNudge(){
    if($('psInstNudge'))return;
    var c=copy(kind),n=doc.createElement('div');
    n.id='psInstNudge'; n.setAttribute('role','dialog'); n.setAttribute('aria-labelledby','psInstNudgeT'); n.setAttribute('aria-describedby','psInstNudgeB');
    n.innerHTML='<div class="psn-top"><img class="psn-ic" src="/icon-mac-192.png" alt="" width="44" height="44">'
      +'<div class="psn-tx"><b class="psn-t" id="psInstNudgeT">'+esc(c.title)+'</b><span class="psn-b" id="psInstNudgeB">'+esc(c.body)+'</span></div></div>'
      +'<div class="psn-btns"><button type="button" class="psn-no">괜찮아요</button><button type="button" class="psn-go">방법 보기</button></div>';
    n.querySelector('.psn-no').addEventListener('click',later);
    n.querySelector('.psn-go').addEventListener('click',function(){ closeNudge(); go(); });
    doc.body.appendChild(n); place();
    doc.addEventListener('keydown',onKey,true);
  }
  /* 폰: 지금 보이는 하단 메뉴(앱 · 팀 — 높이가 다르다) 바로 위. 아이패드 · 컴퓨터는 CSS 의 오른쪽 위 */
  function place(){
    var n=$('psInstNudge'); if(!n)return;
    var top=0; try{ if(win.matchMedia&&win.matchMedia('(max-width:767px)').matches)
      [$('teamBottom'),$('appSeg')].forEach(function(b){ if(visible(b)){ var t=b.getBoundingClientRect().top; if(t>0&&(!top||t<top))top=t; } }); }catch(_){}
    n.style.bottom=top?Math.round(win.innerHeight-top+10)+'px':'';
  }
  /* 다른 날 세 번째로 열면, 조용해진 때 한 번. 띄운 순간 «봤음»을 적는다 — 무시하고 새로고침해도 다시 안 뜬다 */
  function maybeNudge(){
    var s=noteOpen(readState(lsGet()),Date.now()); lsSet(s);
    if(!shouldNudge(s,ctx()))return;
    var tries=0;
    function attempt(){
      nudgeTimer=0;
      var now=readState(lsGet());
      if(!shouldNudge(now,ctx()))return;
      if(!quietNow()){ if(++tries<TRIES)nudgeTimer=setTimeout(attempt,RETRY_MS); return; }
      now.shown=dayOf(Date.now()); lsSet(now);
      showNudge();
    }
    nudgeTimer=setTimeout(attempt,WAIT_MS);
  }

  function init(){
    css(); sync();
    var rail=$('psInstRail'); if(rail)rail.addEventListener('click',go);
    win.addEventListener('appinstalled',function(){ setTimeout(sync,0); });
    win.addEventListener('resize',place);
    try{ var mq=win.matchMedia&&win.matchMedia('(display-mode: standalone)'); if(mq&&mq.addEventListener)mq.addEventListener('change',sync); }catch(_){}
    if(win.top===win)maybeNudge();
  }
  api.sync=sync; api.show=showNudge; api.close=closeNudge;
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init); else init();
  return api;
});

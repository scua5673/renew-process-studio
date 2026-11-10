/* PROCESS STUDIO — 바로 연 화면의 자료 잠금(3.272, 보안 점검 «같이 쓰는 기기»)
   로그아웃해도 팀 자료 사본은 기기에 남는다(보내지 못한 변경을 잃지 않게 — sync.js signOut). 셸(app.html)은 잠금 화면으로 덮지만,
   속 화면(일정 · IDP · 선수단 · 작전판 · 노트 · 게임모델 · 스카우팅)을 주소로 바로 열면 저마다 localStorage 를 읽어 그대로 그렸다
   (일정 · IDP 가 로그아웃한 기기에서 팀 일정과 선수 기록을 보여 줬다 — tests/browser/logout-direct-pages).
   이 파일은 그 화면들의 <head> 맨 앞에서 읽힌다. 맨 위 창으로 열렸고 이 기기가 «잠긴 상태»면 문서 읽기를 멈추고(window.stop — 뒤의 스크립트가 돌지 않는다)
   안내만 남긴다. 잠긴 상태 = 셸의 dataUnlocked() 와 같은 표식:
     · 로그인 세션이 없는데 이 기기에 계정 자료 흔적(ps_cache_owner_v1 · ps_active_ws)이 있다
     · 로그인한 계정과 기기 사본의 주인(ps_cache_owner_v1.uid)이 다르다(다음 계정이 로그인했고 아직 셸이 사본을 비우지 않았다)
   그대로 두는 것: 셸 안의 iframe(셸이 잠금을 맡는다) · 로그인한 사용자 · 계정 흔적이 없는 기기의 손님(작전판 게스트 3.112 · perms.js guestOpen 과 같은 판정).
   저장소를 읽지 못하면 막지 않는다(막아서 생기는 잠김이 더 나쁘다 — 그런 브라우저는 사본도 읽지 못한다). */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&root.document)root.PSLockGuard=api.run(root);
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function read(store,key){ try{ return store.getItem(key); }catch(_){ return undefined; } }
  function json(raw){ try{ return JSON.parse(raw||'null'); }catch(_){ return null; } }
  /* '' = 열어도 된다, 그 밖 = 잠근 까닭 */
  function state(store){
    var rawSession=read(store,'ps_sync_session'),rawOwner=read(store,'ps_cache_owner_v1'),ws=read(store,'ps_active_ws');
    if(rawSession===undefined||rawOwner===undefined)return '';   /* 저장소를 읽을 수 없다 */
    var s=json(rawSession),o=json(rawOwner);
    /* 세션 판정은 느슨하게(토큰이나 uid 가 하나라도 있으면 세션) — 로그아웃은 이 키를 통째로 지운다. 엄격하게 보면 갱신 중인 세션을 잠글 수 있다 */
    var session=(s&&typeof s==='object'&&(s.at||s.uid))?s:null,owner=(o&&o.uid)?String(o.uid):'';
    if(!session)return (rawOwner||ws)?'signed-out':'';
    if(session.uid&&owner&&String(session.uid)!==owner)return 'other-account';
    return '';
  }
  function notice(win,why){
    var doc=win.document,html=doc.documentElement;
    try{ html.classList.add('ps-lock-guard'); }catch(_){}
    function paint(){
      try{
        if(doc.getElementById('psLockGuard'))return;
        var style=doc.createElement('style');
        style.textContent='html.ps-lock-guard body>*:not(#psLockGuard){display:none!important}html.ps-lock-guard,html.ps-lock-guard body{background:#F4F5F7!important;margin:0}'
          +'#psLockGuard{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;background:#F4F5F7;color:#14161A;font:500 15px/1.6 Pretendard,system-ui,-apple-system,sans-serif}'
          +'#psLockGuard div{width:min(420px,100%);text-align:center;background:#fff;border:1px solid #E2E4E8;border-radius:18px;padding:28px 22px}'
          +'#psLockGuard b{display:block;font-size:19px;font-weight:800;margin-bottom:8px}#psLockGuard a{display:inline-block;margin-top:16px;padding:11px 20px;border-radius:12px;background:#14213D;color:#fff;font-weight:700;text-decoration:none}';
        var box=doc.createElement('div'),card=doc.createElement('div'),title=doc.createElement('b'),text=doc.createElement('span'),go=doc.createElement('a');
        box.id='psLockGuard';box.setAttribute('role','alert');box.setAttribute('data-why',why);
        title.textContent='로그인이 필요합니다';
        text.textContent=why==='other-account'
          ?'이 기기에 남아 있는 자료는 다른 계정의 것입니다. 앱을 열어 계정을 확인한 뒤 이용해 주세요.'
          :'로그아웃된 기기예요. 팀 자료는 로그인한 뒤에 보입니다.';
        go.href='/studio/app.html';go.textContent='로그인하러 가기';
        card.appendChild(title);card.appendChild(text);card.appendChild(doc.createElement('br'));card.appendChild(go);box.appendChild(card);
        (doc.head||html).appendChild(style);
        if(!doc.body)html.appendChild(doc.createElement('body'));
        doc.body.appendChild(box);
      }catch(_){}
    }
    try{ win.stop(); }catch(_){}          /* 뒤따르는 마크업 · 스크립트를 읽지 않는다 — 팀 자료를 그릴 코드가 돌지 않는다 */
    paint();
    try{ doc.addEventListener('DOMContentLoaded',paint); win.setTimeout(paint,0); }catch(_){}
  }
  function run(win){
    var why='';
    try{ if(win.top===win)why=state(win.localStorage); }catch(_){ why=''; }
    if(why)notice(win,why);
    return {locked:!!why,why:why,state:state};
  }
  return {run:run,state:state};
});

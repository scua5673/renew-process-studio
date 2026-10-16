/* 3.060 — 업데이트 진행 카드. 새 판을 받고(서비스워커 install) · 작업을 기기에 저장한 걸 확인하고 · 다시 여는 세 단계를
   MP4 내보내기 카드(board.html #psExpProg)와 같은 모양으로 «업데이트 중 42%»처럼 보인다.
   - 받는 중(0~70%): 서비스워커가 판 파일을 하나 담을 때마다 알린다(sw.js «ps-sw-progress»). 화면 아래 작은 카드 — 하던 일을 막지 않는다.
   - 준비됨: «지금 업데이트» · «나중에». 안전한 때(입력 중이 아니고 열린 시트가 없을 때)는 예전처럼 스스로 바꾼다.
   - 저장 확인(70~95%) · 다시 여는 중(100%): 화면 전체를 덮는 카드. 저장 확인을 못 하면 바꾸지 않고 이유와 «다시 시도»를 보인다.
   카드는 내용·입력값을 담지 않는다. 판 번호와 단계 문구뿐. */
(function(root,factory){
  'use strict';
  var api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSUpdProg=api;
})(typeof window!=='undefined'?window:null,function(win){
  'use strict';
  var DL_SPAN=0.70,SAVE_SPAN=0.25;   /* 받기 70% · 저장 확인 25% · 다시 열기 5% */
  var doc=win&&win.document,ov=null,state='',hideT=0,laterUntil=0;

  /* 0~1 로 자르고, 단계별 몫을 전체 비율로 바꾼다(시험이 이 둘만 본다) */
  function clamp(x){x=+x;return isFinite(x)?Math.max(0,Math.min(1,x)):0;}
  function downloadFraction(done,total){return total>0?clamp(done/total)*DL_SPAN:0;}
  function saveFraction(pending,total){return DL_SPAN+(total>0?clamp((total-pending)/total):1)*SAVE_SPAN;}
  function pctText(fr){return Math.floor(clamp(fr)*100)+'%';}
  function releaseNo(name){var m=/(\d+\.\d+(?:\.\d+)?)/.exec(String(name||''));return m?m[1]:'';}

  function css(){
    if(!doc||doc.getElementById('ps-upd-prog-css'))return;
    var st=doc.createElement('style');st.id='ps-upd-prog-css';
    st.textContent='#psUpdProg{position:fixed;inset:0;z-index:2147483002;display:flex;align-items:center;justify-content:center;background:rgba(10,14,22,.28);font-family:inherit;padding:16px;box-sizing:border-box}'
      +'#psUpdProg.dl,#psUpdProg.ready{inset:auto 0 calc(16px + env(safe-area-inset-bottom)) 0;background:transparent;pointer-events:none;align-items:flex-end}'
      +'#psUpdProg .pup-card{pointer-events:auto;width:min(92vw,340px);box-sizing:border-box;background:var(--surface,#fff);color:var(--ink,#14161A);border-radius:16px;padding:16px 18px 14px;box-shadow:0 22px 64px rgba(0,0,0,.32)}'
      +'#psUpdProg .pup-top{display:flex;align-items:center;gap:10px}'
      +'#psUpdProg .pup-ic{flex:0 0 auto;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--accent-soft,#E9EDF5);color:var(--accent,var(--ps-navy,#14213D))}'
      +'#psUpdProg .pup-ic svg{width:18px;height:18px}#psUpdProg .pup-ic .ok{display:none}'
      +'#psUpdProg.dl .pup-ic .dn,#psUpdProg.save .pup-ic .dn{animation:pupSpin 1.4s linear infinite}'
      +'#psUpdProg.done .pup-ic{background:#E7F5EC;color:#1f8a4c}#psUpdProg.done .pup-ic .dn{display:none}#psUpdProg.done .pup-ic .ok{display:block}'
      +'#psUpdProg .pup-t{flex:1 1 auto;min-width:0;font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      +'#psUpdProg .pup-pct{flex:0 0 auto;font-size:24px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.02em}'
      +'#psUpdProg .pup-bar{margin:12px 0 8px;height:10px;border-radius:99px;background:var(--panel2,#F1F3F5);overflow:hidden}'
      +'#psUpdProg .pup-bar i{display:block;height:100%;width:0;border-radius:99px;background-color:var(--accent,var(--ps-navy,#14213D));transition:width .25s linear}'
      +'#psUpdProg.dl .pup-bar i,#psUpdProg.save .pup-bar i{background-image:linear-gradient(45deg,rgba(255,255,255,.28) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.28) 50%,rgba(255,255,255,.28) 75%,transparent 75%);background-size:18px 18px;animation:pupStripe .7s linear infinite}'
      +'#psUpdProg.done .pup-bar i{background-color:#1f8a4c}'
      +'#psUpdProg.warn .pup-ic{background:#FDF3E7;color:#B5762B}#psUpdProg.warn .pup-bar i{background-color:#B5762B}'
      +'#psUpdProg .pup-sub{font-size:13px;line-height:1.45;color:var(--dim,#646A73);min-height:18px;overflow-wrap:anywhere}'
      +'#psUpdProg .pup-acts{display:flex;gap:8px;margin-top:12px}#psUpdProg .pup-acts[hidden]{display:none}'
      +'#psUpdProg .pup-acts button{flex:1 1 0;min-height:44px;padding:0 12px;border-radius:10px;border:1px solid var(--line,#E3E6EA);background:var(--surface,#fff);color:var(--ink,#14161A);font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}'
      +'#psUpdProg .pup-acts .pup-go{flex:1.4 1 0;border-color:transparent;background:var(--accent,var(--ps-navy,#14213D));color:#fff}'
      +'@keyframes pupStripe{to{background-position:18px 0}}@keyframes pupSpin{to{transform:rotate(360deg)}}'
      +'@media (prefers-reduced-motion:reduce){#psUpdProg .pup-bar i,#psUpdProg .pup-ic .dn{animation:none!important}}';
    (doc.head||doc.documentElement).appendChild(st);
  }
  function q(sel){return ov?ov.querySelector(sel):null;}
  function ensure(){
    if(!doc||!doc.body)return null;
    if(ov&&doc.body.contains(ov))return ov;
    css();ov=doc.createElement('div');ov.id='psUpdProg';ov.setAttribute('role','dialog');ov.setAttribute('aria-label','업데이트 진행');
    ov.innerHTML='<div class="pup-card"><div class="pup-top"><span class="pup-ic" aria-hidden="true">'
      +'<svg class="dn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4"/></svg>'
      +'<svg class="ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
      +'</span><b class="pup-t"></b><span class="pup-pct">0%</span></div>'
      +'<div class="pup-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>'
      +'<div class="pup-sub" aria-live="polite"></div><div class="pup-acts" hidden></div></div>';
    doc.body.appendChild(ov);return ov;
  }
  function paint(cls,title,fr,sub,list){
    if(!ensure())return;clearTimeout(hideT);state=cls;ov.className=cls;
    ov.setAttribute('aria-modal',(cls==='dl'||cls==='ready')?'false':'true');
    q('.pup-t').textContent=title;q('.pup-pct').textContent=pctText(fr);
    q('.pup-bar i').style.width=(clamp(fr)*100).toFixed(1)+'%';q('.pup-bar').setAttribute('aria-valuenow',String(Math.floor(clamp(fr)*100)));
    q('.pup-sub').textContent=sub||'';
    var a=q('.pup-acts');a.innerHTML='';(list||[]).forEach(function(x){var b=doc.createElement('button');b.type='button';b.textContent=x[0];if(x[2])b.className=x[2];b.onclick=x[1];a.appendChild(b);});a.hidden=!(list&&list.length);
  }
  function close(){clearTimeout(hideT);if(ov){try{ov.remove();}catch(_){}}ov=null;state='';}
  function startUpdate(){try{if(!win.__psForceReload&&typeof win.psAutoReloadWhenSafe==='function')win.psAutoReloadWhenSafe(true);if(win.__psForceReload)win.__psForceReload(true);}catch(_){}}
  function later(){laterUntil=Date.now()+30*60000;try{win.__psUpdateLater=true;}catch(_){}close();}

  var api={
    /* 서비스워커가 판 파일을 담을 때마다(sw.js) */
    download:function(done,total,release){
      if(state==='save'||state==='done'||state==='warn')return;   /* 적용 중에는 받기 알림으로 덮지 않는다 */
      var v=releaseNo(release),fr=downloadFraction(done,total);
      if(total>0&&done>=total){api.ready(release);return;}
      if(Date.now()<laterUntil)return;
      paint('dl','새 버전'+(v?(' '+v):'')+' 받는 중',fr,'작업은 그대로 계속하셔도 돼요');
    },
    ready:function(release){
      if(state==='save'||state==='done'||state==='warn')return;
      if(Date.now()<laterUntil)return;
      var v=releaseNo(release);
      paint('ready','새 버전'+(v?(' '+v):'')+' 준비됐어요',DL_SPAN,'저장을 확인한 뒤 바로 바꿔요. 입력을 멈추면 스스로 바뀌어요.',
        [['지금 업데이트',startUpdate,'pup-go'],['나중에',later]]);
    },
    /* 저장 확인 — pending: 아직 확인 안 된 화면 수, total: 확인할 화면 수 */
    saving:function(pending,total){paint('save','업데이트 중',saveFraction(pending,total),'작성한 내용을 기기에 저장했는지 확인하고 있어요');},
    reloading:function(){paint('done','다시 여는 중',1,'잠시만요 — 새 버전으로 열고 있어요');},
    failed:function(message){
      paint('warn','업데이트를 잠시 미뤘어요',DL_SPAN,message||'작성 내용의 저장을 확인하지 못했어요. 작업은 이 기기에 그대로 있어요.',
        [['다시 시도',startUpdate,'pup-go'],['닫기',close]]);
    },
    close:close,
    state:function(){return state;},
    _math:{downloadFraction:downloadFraction,saveFraction:saveFraction,pctText:pctText,releaseNo:releaseNo}
  };

  /* 서비스워커의 받기 알림. 이 문서의 판과 같은 판(처음 설치)은 보이지 않는다 */
  try{
    if(win&&win.navigator&&win.navigator.serviceWorker&&win.navigator.serviceWorker.addEventListener){
      win.navigator.serviceWorker.addEventListener('message',function(e){
        var d=e&&e.data;if(!d||d.type!=='ps-sw-progress')return;
        if(!win.navigator.serviceWorker.controller)return;
        if(releaseNo(d.release)===String(win.PS_BUILD||''))return;
        api.download(+d.done||0,+d.total||0,d.release);
      });
    }
  }catch(_){}
  return api;
});

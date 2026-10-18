/* 3.060 — 업데이트 진행 카드. 새 판을 받고(서비스워커 install) · 작업을 기기에 저장한 걸 확인하고 · 다시 여는 세 단계를
   «업데이트 중 42%»처럼 보인다. 카드는 내용·입력값을 담지 않는다. 판 번호와 단계 문구뿐.
   3.098 — 사용자 «막 깜박이고 그냥 막 나가지면 불안» — 한 장의 카드가 처음부터 끝까지 같은 자리(화면 아래 가운데)에서 이어진다:
   - 받는 중(0~60%): 서비스워커가 판 파일을 하나 담을 때마다(sw.js «ps-sw-progress»). 하던 일을 막지 않는다.
   - 준비됨: 스스로 바꿀 때도 갑자기 다시 열지 않는다 — «5초 뒤 바꿔요» 세고, «지금 업데이트» · «나중에».
   - 저장 확인(60~80%) · 다시 여는 중(80%): 뒤를 살짝 어둡게 덮어 손이 닿지 않게(카드는 제자리).
   - 새 판이 열리면 같은 카드가 80%에서 이어서 100% → «업데이트 완료 ✓» 뒤 사라진다(sessionStorage ps_upd_cont_v1 — 판 번호 · 시각뿐).
   - 숫자는 한 번에 뛰지 않고 차오른다(빠른 기기에서 깜박 지나가지 않게). */
(function(root,factory){
  'use strict';
  var api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSUpdProg=api;
})(typeof window!=='undefined'?window:null,function(win){
  'use strict';
  var DL_SPAN=0.60,SAVE_SPAN=0.20,OPEN_AT=0.80;   /* 받기 60% · 저장 확인 20% · 다시 열기 20%(새 판이 뜨며 100%) */
  var CD_SEC=5,CONT_KEY='ps_upd_cont_v1';
  var doc=win&&win.document,ov=null,state='',hideT=0,laterUntil=0,quietUntil=0,goAt=0,relName='';
  var shown=0,target=0,raf=0,lastT=0,cdT=0,cdLeft=0,cdFn=null;

  /* 0~1 로 자르고, 단계별 몫을 전체 비율로 바꾼다(시험이 이 둘만 본다) */
  function clamp(x){x=+x;return isFinite(x)?Math.max(0,Math.min(1,x)):0;}
  function downloadFraction(done,total){return total>0?clamp(done/total)*DL_SPAN:0;}
  function saveFraction(pending,total){return DL_SPAN+(total>0?clamp((total-pending)/total):1)*SAVE_SPAN;}
  function pctText(fr){return Math.floor(clamp(fr)*100)+'%';}
  function releaseNo(name){var m=/(\d+\.\d+(?:\.\d+)?)/.exec(String(name||''));return m?m[1]:'';}
  function now(){return Date.now();}

  function css(){
    if(!doc||doc.getElementById('ps-upd-prog-css'))return;
    var st=doc.createElement('style');st.id='ps-upd-prog-css';
    /* 카드는 늘 화면 아래 가운데. 단계가 바뀌어도 자리를 옮기지 않는다 — 뒤 덮개만 옅게 들어오고 나간다 */
    st.textContent='#psUpdProg{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:flex-end;justify-content:center;padding:16px 16px calc(20px + env(safe-area-inset-bottom));box-sizing:border-box;font-family:inherit;background:rgba(10,14,22,0);pointer-events:none;transition:background-color .3s ease,opacity .35s ease}'
      +'#psUpdProg.save,#psUpdProg.done,#psUpdProg.warn{background:rgba(10,14,22,.24);pointer-events:auto}'
      +'#psUpdProg.boot,#psUpdProg.fin{pointer-events:auto}#psUpdProg.out{opacity:0;pointer-events:none}'
      +'#psUpdProg .pup-card{pointer-events:auto;width:min(92vw,360px);box-sizing:border-box;background:var(--surface,#fff);color:var(--ink,#14161A);border-radius:16px;padding:16px 18px 14px;box-shadow:0 18px 56px rgba(0,0,0,.28);animation:pupIn .28s ease both}'
      +'#psUpdProg .pup-top{display:flex;align-items:center;gap:10px}'
      +'#psUpdProg .pup-ic{flex:0 0 auto;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--accent-soft,#E9EDF5);color:var(--accent,var(--ps-navy,#14213D))}'
      +'#psUpdProg .pup-ic svg{width:18px;height:18px}#psUpdProg .pup-ic .ok{display:none}'
      +'#psUpdProg.dl .pup-ic .dn,#psUpdProg.save .pup-ic .dn,#psUpdProg.done .pup-ic .dn,#psUpdProg.boot .pup-ic .dn{animation:pupSpin 1.4s linear infinite}'
      +'#psUpdProg.fin .pup-ic{background:#E7F5EC;color:#1f8a4c}#psUpdProg.fin .pup-ic .dn{display:none}#psUpdProg.fin .pup-ic .ok{display:block}'
      +'#psUpdProg .pup-t{flex:1 1 auto;min-width:0;font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      +'#psUpdProg .pup-pct{flex:0 0 auto;font-size:24px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums}'
      +'#psUpdProg .pup-bar{margin:12px 0 8px;height:10px;border-radius:99px;background:var(--panel2,#F1F3F5);overflow:hidden}'
      +'#psUpdProg .pup-bar i{display:block;height:100%;width:0;border-radius:99px;background-color:var(--accent,var(--ps-navy,#14213D))}'
      +'#psUpdProg.dl .pup-bar i,#psUpdProg.save .pup-bar i,#psUpdProg.done .pup-bar i,#psUpdProg.boot .pup-bar i{background-image:linear-gradient(45deg,rgba(255,255,255,.28) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.28) 50%,rgba(255,255,255,.28) 75%,transparent 75%);background-size:18px 18px;animation:pupStripe .7s linear infinite}'
      +'#psUpdProg.fin .pup-bar i{background-color:#1f8a4c}'
      +'#psUpdProg.warn .pup-ic{background:#FDF3E7;color:#B5762B}#psUpdProg.warn .pup-bar i{background-color:#B5762B}'
      +'#psUpdProg .pup-sub{font-size:13px;line-height:1.45;color:var(--dim,#646A73);min-height:18px;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}'
      +'#psUpdProg .pup-acts{display:flex;gap:8px;margin-top:12px}#psUpdProg .pup-acts[hidden]{display:none}'
      +'#psUpdProg .pup-acts button{flex:1 1 0;min-height:44px;padding:0 12px;border-radius:10px;border:1px solid var(--line,#E3E6EA);background:var(--surface,#fff);color:var(--ink,#14161A);font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}'
      +'#psUpdProg .pup-acts .pup-go{flex:1.4 1 0;border-color:transparent;background:var(--accent,var(--ps-navy,#14213D));color:#fff}'
      +'@keyframes pupStripe{to{background-position:18px 0}}@keyframes pupSpin{to{transform:rotate(360deg)}}@keyframes pupIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}'
      +'@media (prefers-reduced-motion:reduce){#psUpdProg .pup-bar i,#psUpdProg .pup-ic .dn,#psUpdProg .pup-card{animation:none!important}}';
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
  /* 숫자 · 막대 — 목표까지 차오른다(뒤로 가지 않는다). 그림 틀이 없거나(숨은 탭 · 시험) 줄인 움직임이면 바로 */
  function draw(){
    if(!ov)return;var p=q('.pup-pct'),b=q('.pup-bar i'),bar=q('.pup-bar');
    if(p)p.textContent=pctText(shown);if(b)b.style.width=(clamp(shown)*100).toFixed(1)+'%';if(bar)bar.setAttribute('aria-valuenow',String(Math.floor(clamp(shown)*100)));
  }
  function reduced(){try{return !!(win.matchMedia&&win.matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(_){return false;}}
  function step(t){
    raf=0;var dt=lastT?Math.min(120,t-lastT):16;lastT=t;
    var speed=state==='boot'?0.06:0.55;   /* 초당 몫 — 받기 60% 는 1초 남짓, 새 판 여는 동안은 천천히 */
    shown=Math.min(target,shown+speed*dt/1000);draw();
    if(shown<target)raf=win.requestAnimationFrame(step);else lastT=0;
  }
  function setTarget(fr,jump){
    target=Math.max(clamp(fr),jump?0:shown);if(jump||target<shown)shown=target;
    if(!ov||jump||!win||typeof win.requestAnimationFrame!=='function'||reduced()||(doc&&doc.hidden)){shown=target;draw();return;}
    if(!raf){lastT=0;raf=win.requestAnimationFrame(step);}
  }
  function paint(cls,title,fr,sub,list,jump){
    if(!ensure())return;clearTimeout(hideT);var fresh=state==='';state=cls;ov.className=cls;
    ov.setAttribute('aria-modal',(cls==='dl'||cls==='ready')?'false':'true');
    q('.pup-t').textContent=title;q('.pup-sub').textContent=sub||'';
    var a=q('.pup-acts');a.innerHTML='';(list||[]).forEach(function(x){var b=doc.createElement('button');b.type='button';b.textContent=x[0];if(x[2])b.className=x[2];b.onclick=x[1];a.appendChild(b);});a.hidden=!(list&&list.length);
    setTarget(fr,jump||fresh&&cls!=='dl'&&cls!=='boot');
  }
  function stopCd(){clearInterval(cdT);cdT=0;cdFn=null;}
  function close(){stopCd();clearTimeout(hideT);if(raf&&win&&win.cancelAnimationFrame)win.cancelAnimationFrame(raf);raf=0;if(ov){try{ov.remove();}catch(_){}}ov=null;state='';shown=target=0;}
  function fadeOut(ms){clearTimeout(hideT);hideT=setTimeout(function(){if(ov)ov.classList.add('out');hideT=setTimeout(close,380);},ms);}
  /* 다시 열린 새 판이 이어서 그리도록 판 번호 · 시각만 적는다 */
  function mark(){try{win.sessionStorage.setItem(CONT_KEY,JSON.stringify({from:String(win.PS_BUILD||''),to:releaseNo(relName),at:now()}));}catch(_){}}
  function startUpdate(){stopCd();try{if(!win.__psForceReload&&typeof win.psAutoReloadWhenSafe==='function')win.psAutoReloadWhenSafe(true);if(win.__psForceReload)win.__psForceReload(true);}catch(_){}}
  function later(){stopCd();laterUntil=now()+30*60000;try{win.__psUpdateLater=true;}catch(_){}close();}
  function verText(){var v=releaseNo(relName);return v?(' '+v):'';}
  function paintReady(){
    if(state==='ready'&&cdT&&ov){q('.pup-sub').textContent=cdLeft+'초 뒤 새 버전으로 바꿔요 · 작성 중인 내용은 저장하고 바꿔요';return;}   /* 세는 동안은 글만 — 단추를 다시 만들지 않는다(누르는 중 놓치지 않게) */
    paint('ready','새 버전'+verText()+' 준비됐어요',DL_SPAN,
      cdT?(cdLeft+'초 뒤 새 버전으로 바꿔요 · 작성 중인 내용은 저장하고 바꿔요'):'저장을 확인한 뒤 바꿔요. 입력을 멈추면 스스로 바뀌어요.',
      [['지금 업데이트',startUpdate,'pup-go'],['나중에',later]]);
  }

  var api={
    /* 서비스워커가 판 파일을 담을 때마다(sw.js) */
    download:function(done,total,release){
      if(release)relName=release;
      if(state==='save'||state==='done'||state==='warn'||state==='boot'||state==='fin')return;   /* 적용 중에는 받기 알림으로 덮지 않는다 */
      if(total>0&&done>=total){api.ready(release);return;}
      if(now()<laterUntil)return;
      paint('dl','새 버전'+verText()+' 받는 중',downloadFraction(done,total),'작업은 그대로 계속하셔도 돼요');
    },
    ready:function(release){
      if(release)relName=release;
      if(state==='save'||state==='done'||state==='warn'||state==='boot'||state==='fin'){
        /* 스스로 한 시도가 저장 확인에서 돌아오면(app.html finish) 카드를 «준비됨»으로 — 2분은 다시 세지 않는다(덮개가 되풀이해 깜박이지 않게) */
        if((state==='save'||state==='done')&&now()-goAt<25000){quietUntil=now()+120000;stopCd();paintReady();}
        return;
      }
      if(now()<laterUntil)return;
      paintReady();
    },
    /* app.html psAutoReloadWhenSafe 의 바꾸기(go) 앞문. 누른 것 · 숨은 탭은 바로, 보이는 화면에서 스스로 바꿀 때는 5초를 센다 */
    gate:function(manual,go,safe){
      if(manual){stopCd();goAt=now();mark();go(true);return 'go';}
      if(doc&&doc.hidden){stopCd();goAt=now();mark();go(false);return 'go';}
      if(now()<laterUntil||now()<quietUntil)return 'later';
      if(state==='save'||state==='done'||state==='warn')return 'busy';
      if(cdT)return 'counting';
      if(!ensure()){goAt=now();mark();go(false);return 'go';}
      cdLeft=CD_SEC;cdFn=function(){var w={};var ok=(doc&&doc.hidden)||typeof safe!=='function'||safe(w);if(ok){goAt=now();mark();go(false);}else paintReady();};
      cdT=setInterval(function(){cdLeft--;if(cdLeft<=0){var f=cdFn;stopCd();try{f&&f();}catch(_){}}else paintReady();},1000);
      paintReady();return 'counting';
    },
    /* 저장 확인 — pending: 아직 확인 안 된 화면 수, total: 확인할 화면 수 */
    saving:function(pending,total){stopCd();paint('save','업데이트 중',saveFraction(pending,total),'작성한 내용을 기기에 저장하고 있어요');},
    reloading:function(){mark();paint('done','새 버전으로 여는 중',OPEN_AT,'잠시만요 — 화면이 한 번 새로 열려요');},
    failed:function(message){
      stopCd();
      paint('warn','업데이트를 잠시 미뤘어요',DL_SPAN,message||'작성 내용의 저장을 확인하지 못했어요. 작업은 이 기기에 그대로 있어요.',
        [['다시 시도',startUpdate,'pup-go'],['닫기',close]],true);
    },
    close:close,
    state:function(){return state;},
    _math:{downloadFraction:downloadFraction,saveFraction:saveFraction,pctText:pctText,releaseNo:releaseNo,OPEN_AT:OPEN_AT,CD_SEC:CD_SEC}
  };

  /* 새 판으로 다시 열렸으면 같은 카드가 80% 에서 이어서 100% → «업데이트 완료». 판이 그대로면(바꾸기 전 실패 · 같은 판 새로 열기) 아무것도 안 한다 */
  function resume(){
    var j=null;try{var raw=win.sessionStorage.getItem(CONT_KEY);if(!raw)return;win.sessionStorage.removeItem(CONT_KEY);j=JSON.parse(raw);}catch(_){return;}
    if(!j||!(now()-(+j.at||0)<120000))return;
    var t0=now();
    (function wait(){
      if(!doc.body||!win.PS_BUILD){if(now()-t0<8000)setTimeout(wait,16);return;}
      var cur=String(win.PS_BUILD);if(!cur||cur===String(j.from||''))return;
      relName=cur;
      function finish(){paint('fin','업데이트 완료',1,cur+' 버전으로 바뀌었어요');fadeOut(1800);}
      function booting(){return doc.body.classList.contains('ps-booting');}
      if(doc.hidden){   /* 숨은 채로 새로 열렸으면 돌아왔을 때 «바뀌었어요»만 */
        var onVis=function(){if(doc.hidden)return;doc.removeEventListener('visibilitychange',onVis);if(!booting())finish();};
        doc.addEventListener('visibilitychange',onVis);return;
      }
      shown=OPEN_AT;paint('boot','새 버전'+verText()+' 여는 중',0.97,'거의 다 됐어요');shown=OPEN_AT;draw();setTarget(0.97);
      var tries=0;(function poll(){if(state!=='boot')return;if(!booting()||++tries>160){finish();return;}setTimeout(poll,120);})();
    })();
  }

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
  try{if(doc&&win.sessionStorage)resume();}catch(_){}
  return api;
});

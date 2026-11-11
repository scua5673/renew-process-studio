/* 3.279 — 개인 노트 «그림 넣기»(제보 09e84929 «보드에서 편집해 PDF 로 변환한 훈련 세션을 코칭 일지(내가 만든 양식)의 운동장 항목에
   필드 크기에 맞게 넣을 수 있으면» · 사용자 11/11 «이것도 만들어줘»).
   예전엔 PDF · 보관함 훈련을 «새 문서의 쪽 배경»으로만 가져올 수 있었다 — 내 양식의 한 칸(운동장 칸)에 맞춰 넣을 길이 없었다.
   · 고르기: 위쪽 막대 «그림 넣기 ▾» → «PDF · 이미지 파일에서» / «보관함 훈련에서»(원래 «보관함 훈련 가져오기» 목록을 그대로 쓴다 —
     받은 PDF 를 새 문서로 만들지 않고 첫 쪽을 그림으로 돌린다: importPdfBuffer 를 감싼다).
   · 놓기: 넣을 칸을 끌어서 정한다 → 그림은 그 칸 안에 비율을 지켜 가운데로(contain). 한 번 누르기만 하면 쪽 가운데에 반 크기로.
   · 고치기: «넣은 그림 고치기» → 끌어 옮기기 · 모서리로 크기(비율 유지) · ✕ 지우기 · «완료».
   · 저장: 그 쪽의 pics[{id,src,x,y,w,h}](노트 좌표 LW×LH) — 같은 노트 문서(cs_notes_v1). 새 저장 키 없음. 그림은 긴 변 1600px JPEG.
   · 그리기: drawTpl(양식 · 배경) 바로 뒤, 손글씨 아래. 인쇄 · 이미지 · PDF 내보내기(pageCanvas)도 같은 길이라 그대로 나온다(loadBgs 가 그림도 미리 읽는다).
   note · pi · LW · LH · cv 는 let/const 전역이라 이름으로 읽는다(window 속성이 아니다). */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSNotePicture=api;var go=function(){api.install(root);};if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',go);else go();}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  var MAX_SIDE=1600,MIN_BOX=24;
  /* 칸(box) 안에 비율(ar = 너비/높이)을 지켜 가운데로 */
  function fit(box,ar){
    var w=box.w,h=box.h;if(!(ar>0)||!(w>0)||!(h>0))return {x:box.x,y:box.y,w:Math.max(0,w),h:Math.max(0,h)};
    if(w/h>ar)w=h*ar;else h=w/ar;
    return {x:box.x+(box.w-w)/2,y:box.y+(box.h-h)/2,w:w,h:h};
  }
  /* 쪽 밖으로 나가지 않게, 너무 작아지지 않게 */
  function clamp(r,LW,LH){
    var w=Math.max(MIN_BOX,Math.min(r.w,LW)),h=Math.max(MIN_BOX,Math.min(r.h,LH));
    return {x:Math.max(0,Math.min(r.x,LW-w)),y:Math.max(0,Math.min(r.y,LH-h)),w:w,h:h};
  }
  function rectOf(a,b){return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)};}
  /* 저장된 그림 한 장이 쓸 만한가(다른 기기 · 옛 판이 보낸 문서도 지난다) — src 는 그림 data URL 만 */
  function okPic(p){return !!p&&typeof p.src==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(p.src)&&[p.x,p.y,p.w,p.h].every(function(v){return typeof v==='number'&&isFinite(v);})&&p.w>0&&p.h>0;}
  function picsOf(page){return page&&Array.isArray(page.pics)?page.pics.filter(okPic):[];}
  function scaleTo(w,h,max){var s=Math.min(1,max/Math.max(w,h));return {w:Math.max(1,Math.round(w*s)),h:Math.max(1,Math.round(h*s))};}

  var CSS='.ps-np-menu{min-width:236px}.ps-np-menu .btn{display:flex;flex-direction:column;align-items:flex-start;gap:2px;height:auto;min-height:0;line-height:1.25;padding:9px 12px}'
    +'.ps-np-menu .btn b{font-size:var(--fs-sub,13px);font-weight:var(--fw-strong,700)}.ps-np-menu .btn span{font-size:var(--fs-caption,11px);color:var(--dim)}'
    +'.ps-np-btn{display:inline-flex;align-items:center;gap:6px;font-weight:var(--fw-strong,700)}.ps-np-btn[aria-busy="true"]{opacity:.62;pointer-events:none}'
    +'body.memo-mode .ps-np{display:none!important}'
    +'#psNpLayer{position:fixed;z-index:140;touch-action:none}#psNpLayer.place{cursor:crosshair}'
    +'#psNpLayer .np-drag{position:absolute;border:2px dashed #3A6DF0;background:rgba(58,109,240,.10);border-radius:4px;pointer-events:none}'
    +'#psNpLayer .np-box{position:absolute;border:2px solid #3A6DF0;border-radius:4px;cursor:move;background:rgba(58,109,240,.06)}'
    +'#psNpLayer .np-x{position:absolute;right:-14px;top:-14px;width:30px;height:30px;border-radius:50%;border:0;background:#D6453D;color:#fff;font:700 15px/30px inherit;cursor:pointer;padding:0}'
    +'#psNpLayer .np-h{position:absolute;right:-11px;bottom:-11px;width:24px;height:24px;border-radius:50%;background:#fff;border:2px solid #3A6DF0;cursor:nwse-resize}'
    +'#psNpBar{position:fixed;left:50%;transform:translateX(-50%);top:calc(112px + env(safe-area-inset-top,0px));z-index:141;display:flex;gap:8px;align-items:center;padding:8px 8px 8px 14px;border-radius:14px;background:rgba(18,22,30,.94);color:#fff;font-size:13px;font-weight:600;box-shadow:0 8px 22px rgba(0,0,0,.35);max-width:92vw}'
    +'#psNpBar button{min-height:38px;padding:0 14px;border:0;border-radius:10px;font:inherit;font-weight:700;cursor:pointer;background:rgba(255,255,255,.14);color:#fff}#psNpBar button.ok{background:#ffd24a;color:#14213D}'
    +'@media (max-width:767px){.ps-np-btn .ps-np-lb,.ps-np-btn .ps-np-caret{display:none}.ps-np-btn{padding:0 10px}html.ps-page-note .bar>.ps-np:not(#_){order:4!important;margin-left:0}}';
  var ICON='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="m4 17 5-4 4 3 3-2 4 3"/></svg>';
  var T={btn:'그림 넣기',file:'PDF · 이미지 파일에서',fileSub:'보드에서 내보낸 훈련 PDF 도 돼요',vault:'보관함 훈련에서',vaultSub:'훈련을 고르면 첫 쪽이 그림으로 들어가요',edit:'넣은 그림 고치기',editSub:'옮기기 · 크기 · 지우기',
    place:'넣을 칸을 끌어서 정해 주세요 — 그림이 그 칸에 맞춰 들어가요',cancel:'취소',done:'완료',editing:'그림을 끌어 옮기고, 모서리로 크기를 바꿔요',none:'이 쪽에 넣은 그림이 없어요',
    added:'그림을 넣었어요 ✓',full:'문서 보관함 용량이 찼어요 — 그림을 넣지 못했어요',bad:'그림을 읽을 수 없어요',pick:'보관함 훈련을 고르면 이 쪽에 그림으로 넣어요',del:'그림 지우기',size:'크기 바꾸기'};

  function install(w){
    var d=w&&w.document;if(!d||w.__psNotePicture)return false;
    var bar=d.querySelector('.bar');if(!bar||!d.getElementById('nTitle')||typeof w.drawTpl!=='function')return false;
    w.__psNotePicture=true;
    function N(){try{return typeof note!=='undefined'?note:null;}catch(_){return null;}}
    function PI(){try{return typeof pi!=='undefined'?pi:0;}catch(_){return 0;}}
    function L(){try{return {w:LW,h:LH};}catch(_){return {w:1000,h:1414};}}
    function CV(){try{return typeof cv!=='undefined'?cv:d.getElementById('cv');}catch(_){return d.getElementById('cv');}}
    function page(){var n=N();return n&&n.pages?n.pages[PI()]:null;}
    function say(t){try{if(typeof w.toast==='function')w.toast(t);}catch(_){}}
    function redraw(){try{w.rebuildBase();w.present();}catch(_){}}
    function persist(){try{w.save();}catch(_){}try{if(typeof w.updateUI==='function')w.updateUI();}catch(_){}}
    var cache={};
    function imgOf(src,onload){var e=cache[src];if(!e){e=cache[src]=new w.Image();e.onload=function(){if(onload)onload();};e.src=src;}return e;}
    /* 양식 · 배경 뒤, 손글씨 앞 */
    var drawTpl=w.drawTpl;
    w.drawTpl=function(c){
      var r=drawTpl.apply(this,arguments);
      try{picsOf(page()).forEach(function(p){var im=imgOf(p.src,redraw);if(im.complete&&im.naturalWidth)c.drawImage(im,p.x,p.y,p.w,p.h);});}catch(_){}
      return r;
    };
    /* 내보내기 전 미리 읽기 */
    if(typeof w.loadBgs==='function'){var loadBgs=w.loadBgs;w.loadBgs=function(){
      var n=N(),jobs=[];try{(n&&n.pages||[]).forEach(function(pg){picsOf(pg).forEach(function(p){var im=imgOf(p.src);if(!(im.complete&&im.naturalWidth))jobs.push(new Promise(function(res){im.addEventListener('load',res,{once:true});im.addEventListener('error',res,{once:true});w.setTimeout(res,4000);}));});});}catch(_){}
      return Promise.all([Promise.resolve(loadBgs.apply(this,arguments))].concat(jobs));
    };}

    var st=d.createElement('style');st.id='psNotePictureCss';st.textContent=CSS;(d.head||d.documentElement).appendChild(st);
    var wrap=d.createElement('div');wrap.className='filewrap ps-np';wrap.id='npWrap';
    function item(k,a,b){return '<button type="button" class="btn" role="menuitem" data-np="'+k+'"><b>'+a+'</b><span>'+b+'</span></button>';}
    wrap.innerHTML='<button type="button" class="btn ps-np-btn" id="npBtn" aria-haspopup="true" aria-expanded="false" aria-label="'+T.btn+'" title="'+T.btn+'">'+ICON+'<span class="ps-np-lb">'+T.btn+'</span><span class="ps-np-caret">▾</span></button>'
      +'<div class="filemenu ps-np-menu" id="npMenu" role="menu">'+item('file',T.file,T.fileSub)+item('vault',T.vault,T.vaultSub)+item('edit',T.edit,T.editSub)+'</div>';
    var nx=d.getElementById('nxWrap');if(nx&&nx.parentNode===bar)bar.insertBefore(wrap,nx);else bar.appendChild(wrap);
    try{var no=nx&&w.getComputedStyle(nx).order;if(no&&no!=='0')wrap.style.order=no;}catch(_){}   /* 막대는 order 로 줄을 세운다 — «내보내기» 바로 앞에 서게 */
    var btn=wrap.querySelector('#npBtn');
    function close(){wrap.classList.remove('open');btn.setAttribute('aria-expanded','false');}
    btn.addEventListener('click',function(e){e.stopPropagation();var on=!wrap.classList.contains('open');wrap.classList.toggle('open',on);btn.setAttribute('aria-expanded',on?'true':'false');});
    d.addEventListener('click',function(e){if(wrap.classList.contains('open')&&!wrap.contains(e.target))close();});
    var file=d.createElement('input');file.type='file';file.id='npFile';file.accept='image/png,image/jpeg,image/webp,.pdf,application/pdf';file.style.cssText='position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';d.body.appendChild(file);

    /* ── 그림 만들기: 긴 변 1600 · 흰 바탕 JPEG ── */
    function toJpeg(src,sw,sh){
      var s=scaleTo(sw,sh,MAX_SIDE),c=d.createElement('canvas');c.width=s.w;c.height=s.h;
      var g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,s.w,s.h);g.drawImage(src,0,0,s.w,s.h);
      return {src:c.toDataURL('image/jpeg',0.86),ar:s.w/s.h};
    }
    /* 파일 → data URL 로 읽는다(blob: 주소는 웹킷 시험 환경에서 빈 그림이 된다 — 3.265 의 fetch(blob:) 와 같은 까닭. FileReader 는 어디서나 같다) */
    function fromImageFile(f){
      return new Promise(function(res,rej){var r=new w.FileReader();
        r.onerror=function(){rej(Error('read'));};
        r.onload=function(){var im=new w.Image();
          im.onload=function(){try{res(toJpeg(im,im.naturalWidth,im.naturalHeight));}catch(e){rej(e);}};
          im.onerror=function(){rej(Error('image'));};im.src=String(r.result||'');};
        r.readAsDataURL(f);});
    }
    async function fromPdf(buf){
      var lib=await w.ensurePdfjs(),doc=await lib.getDocument({data:buf,isEvalSupported:false}).promise,pg=await doc.getPage(1);
      var vp=pg.getViewport({scale:1}),sc=MAX_SIDE/Math.max(vp.width,vp.height);vp=pg.getViewport({scale:sc});
      var c=d.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);
      await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
      return toJpeg(c,c.width,c.height);
    }

    /* ── 덮개: 캔버스 위에 딱 맞춰 ── */
    var layer=null,tip=null,mode='',pending=null;
    function geom(){var r=CV().getBoundingClientRect(),l=L();return {r:r,kx:r.width/l.w,ky:r.height/l.h,l:l};}
    function toL(e,g){return {x:(e.clientX-g.r.left)/g.kx,y:(e.clientY-g.r.top)/g.ky};}
    function end(){mode='';pending=null;if(layer){layer.remove();layer=null;}if(tip){tip.remove();tip=null;}w.removeEventListener('resize',relayout);d.removeEventListener('keydown',onKey,true);}
    function onKey(e){if(e.key==='Escape'&&mode){e.preventDefault();e.stopPropagation();if(mode==='edit')persist();end();}}
    function open(kind,text,buttons){
      end();mode=kind;layer=d.createElement('div');layer.id='psNpLayer';layer.className=kind;d.body.appendChild(layer);
      tip=d.createElement('div');tip.id='psNpBar';tip.setAttribute('role','status');var sp=d.createElement('span');sp.textContent=text;tip.appendChild(sp);
      buttons.forEach(function(b){var x=d.createElement('button');x.type='button';x.textContent=b[0];if(b[2])x.className=b[2];x.addEventListener('click',b[1]);tip.appendChild(x);});
      d.body.appendChild(tip);w.addEventListener('resize',relayout);d.addEventListener('keydown',onKey,true);relayout();
    }
    function relayout(){
      if(!layer)return;var g=geom();layer.style.left=g.r.left+'px';layer.style.top=g.r.top+'px';layer.style.width=g.r.width+'px';layer.style.height=g.r.height+'px';
      if(mode==='edit')paintBoxes();
    }
    function roomFor(src){try{var s=w.store(),n=JSON.stringify(s).length+src.length;return n<=(typeof NOTE_SYNC_SAFE!=='undefined'?NOTE_SYNC_SAFE:11500000);}catch(_){return true;}}
    function add(pic,box){
      var pg=page(),l=L();if(!pg)return false;
      if(!roomFor(pic.src)){say(T.full);return false;}
      var r=clamp(fit(box,pic.ar),l.w,l.h);
      if(!Array.isArray(pg.pics))pg.pics=[];
      pg.pics.push({id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),src:pic.src,x:Math.round(r.x*10)/10,y:Math.round(r.y*10)/10,w:Math.round(r.w*10)/10,h:Math.round(r.h*10)/10});
      redraw();persist();say(T.added);return true;
    }
    /* 놓기: 끌어서 칸을 정한다. 거의 안 움직였으면 쪽 가운데 반 크기 */
    function place(pic){
      open('place',T.place,[[T.cancel,function(){end();}]]);pending=pic;   /* open 이 앞 덮개를 걷으며 pending 을 비운다 — 그 뒤에 쥔다 */
      var a=null,box=null,g=null;
      layer.addEventListener('pointerdown',function(e){if(e.button)return;e.preventDefault();g=geom();a=toL(e,g);try{layer.setPointerCapture(e.pointerId);}catch(_){}
        box=d.createElement('div');box.className='np-drag';layer.appendChild(box);});
      layer.addEventListener('pointermove',function(e){if(!a)return;var r=rectOf(a,toL(e,g));box.style.left=r.x*g.kx+'px';box.style.top=r.y*g.ky+'px';box.style.width=r.w*g.kx+'px';box.style.height=r.h*g.ky+'px';});
      function up(e){if(!a)return;var r=rectOf(a,toL(e,g)),l=g.l,p=pending;a=null;
        if(r.w<MIN_BOX||r.h<MIN_BOX)r={x:l.w*.25,y:l.h*.25,w:l.w*.5,h:l.h*.5};
        end();if(p)add(p,r);}
      layer.addEventListener('pointerup',up);layer.addEventListener('pointercancel',function(){a=null;if(box){box.remove();box=null;}});
    }
    /* 고치기 */
    function paintBoxes(){
      if(!layer)return;var g=geom(),pg=page(),list=pg&&Array.isArray(pg.pics)?pg.pics:[];layer.innerHTML='';
      list.forEach(function(p){
        if(!okPic(p))return;
        var b=d.createElement('div');b.className='np-box';b.style.left=p.x*g.kx+'px';b.style.top=p.y*g.ky+'px';b.style.width=p.w*g.kx+'px';b.style.height=p.h*g.ky+'px';
        var x=d.createElement('button');x.type='button';x.className='np-x';x.textContent='✕';x.setAttribute('aria-label',T.del);
        var h=d.createElement('span');h.className='np-h';h.setAttribute('aria-label',T.size);b.appendChild(x);b.appendChild(h);layer.appendChild(b);
        x.addEventListener('pointerdown',function(e){e.stopPropagation();});
        x.addEventListener('click',function(e){e.stopPropagation();var i=pg.pics.indexOf(p);if(i>=0)pg.pics.splice(i,1);redraw();paintBoxes();});
        function drag(resize){return function(e){
          if(e.button)return;e.preventDefault();e.stopPropagation();var g0=geom(),s=toL(e,g0),o={x:p.x,y:p.y,w:p.w,h:p.h},ar=o.w/o.h,el=e.currentTarget;try{el.setPointerCapture(e.pointerId);}catch(_){}
          function mv(ev){var q=toL(ev,g0),r;
            if(resize){var nw=Math.max(MIN_BOX,o.w+(q.x-s.x));nw=Math.min(nw,g0.l.w-o.x,(g0.l.h-o.y)*ar);r={x:o.x,y:o.y,w:nw,h:nw/ar};}
            else r=clamp({x:o.x+(q.x-s.x),y:o.y+(q.y-s.y),w:o.w,h:o.h},g0.l.w,g0.l.h);
            p.x=Math.round(r.x*10)/10;p.y=Math.round(r.y*10)/10;p.w=Math.round(r.w*10)/10;p.h=Math.round(r.h*10)/10;
            b.style.left=p.x*g0.kx+'px';b.style.top=p.y*g0.ky+'px';b.style.width=p.w*g0.kx+'px';b.style.height=p.h*g0.ky+'px';redraw();}
          function up(){el.removeEventListener('pointermove',mv);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);}
          el.addEventListener('pointermove',mv);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
        };}
        b.addEventListener('pointerdown',drag(false));h.addEventListener('pointerdown',drag(true));
      });
    }
    function edit(){
      if(!picsOf(page()).length){say(T.none);return;}
      open('edit',T.editing,[[T.done,function(){persist();end();},'ok']]);
    }

    /* ── 고르기 ── */
    var busy=false,wantVault=0;
    function working(on){busy=on;if(on)btn.setAttribute('aria-busy','true');else btn.removeAttribute('aria-busy');}
    file.addEventListener('change',function(){
      var f=file.files&&file.files[0];file.value='';if(!f||busy)return;
      working(true);
      var job=/pdf$/i.test(f.type)||/\.pdf$/i.test(f.name)?f.arrayBuffer().then(fromPdf):fromImageFile(f);
      job.then(function(pic){working(false);place(pic);},function(){working(false);say(T.bad);});
    });
    /* «보관함 훈련에서»: 원래 목록에서 고르면 셸이 PDF 를 만들어 importPdfBuffer 로 돌려준다 — 그 한 번만 그림으로 받는다 */
    if(typeof w.importPdfBuffer==='function'){var importPdf=w.importPdfBuffer;w.importPdfBuffer=function(buf,name,meta){
      var vault=meta&&(meta.kind==='vault'||meta.kind==='vault-pdf'||meta.libId);
      if(!(wantVault&&Date.now()<wantVault&&vault))return importPdf.apply(this,arguments);
      wantVault=0;working(true);
      return fromPdf(buf).then(function(pic){working(false);try{w.closeDocLibrary();}catch(_){}try{w.__noteSetMode&&w.__noteSetMode('draw');}catch(_){}place(pic);return true;},function(){working(false);say(T.bad);return false;});
    };}
    wrap.querySelector('#npMenu').addEventListener('click',function(e){
      var it=e.target.closest('[data-np]');if(!it)return;var k=it.getAttribute('data-np');close();
      if(busy||!N())return;
      if(k==='file')file.click();
      else if(k==='edit')edit();
      else if(k==='vault'){wantVault=Date.now()+180000;say(T.pick);var v=d.getElementById('vaultPdfB');if(v)v.click();}
    });
    /* 쪽을 넘기거나 다른 노트를 열면 덮개를 걷는다(다른 쪽 그림 위에 상자가 남지 않게) */
    ['pgPrev','pgNext','pgAdd','pgDel','newB','libB','orientB'].forEach(function(id){var b=d.getElementById(id);if(b)b.addEventListener('click',function(){if(mode==='edit')persist();if(mode)end();},true);});
    w.__psNotePic={place:place,edit:edit,end:end,add:add,mode:function(){return mode;},fromPdf:fromPdf};
    return true;
  }
  return {install:install,fit:fit,clamp:clamp,rectOf:rectOf,okPic:okPic,picsOf:picsOf,scaleTo:scaleTo,MAX_SIDE:MAX_SIDE};
});

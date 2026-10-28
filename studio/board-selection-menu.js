/* Selection UI only: original controls retain their edit, undo and save handlers.
   View state is transient. Mounting and positioning never repaint the board. */
(function(root,factory){
  var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSSelectionMenu=api;root.document.addEventListener('DOMContentLoaded',function(){
    var attempts=0;function boot(){if(root.__psInspector&&root.PSBoardEdit&&root.document.getElementById('lockSelBtn'))api.install(root);else if(++attempts<80)root.setTimeout(boot,100);}boot();
  });}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  function placement(anchor,size,area,padding){
    var gap=padding||12,w=size.width,h=size.height;
    var left=anchor.right+gap;if(left+w>area.right)left=anchor.left-gap-w;
    left=Math.max(area.left,Math.min(left,area.right-w));
    var top=Math.max(area.top,Math.min((anchor.top+anchor.bottom-h)/2,area.bottom-h));
    return {left:left,top:top};
  }
  function install(win){
    var doc=win.document,ctl=doc.querySelector('.sel-ctl');if(!ctl||ctl.__selectionMenu)return;ctl.__selectionMenu=true;
    var body=doc.body,head=ctl.querySelector('.ps-in-hd'),foot=ctl.querySelector('.ps-in-foot'),lastKey='',dismissed=false,syncing=false,frame=0,uiScale=1,physicalWidth=win.innerWidth,reserved=false,previousPadding='';
    function el(tag,cls,text){var n=doc.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;}
    function selected(){try{return typeof multiSel!=='undefined'&&multiSel.length?multiSel.slice():(typeof sel!=='undefined'&&sel&&sel.ref?[sel.ref]:[]);}catch(_){return [];}}
    function S(){return typeof state!=='undefined'?state:null;}
    function kind(o){return win.typeOfItem(o);}
    function move(id,to){var n=doc.getElementById(id);if(n&&n.parentNode!==to)to.appendChild(n);return n;}
    function label(text,to){var n=el('div','ps-sm-label',text);to.appendChild(n);return n;}
    function button(text,title,fn){var b=el('button','',text);b.type='button';b.title=title||text;b.setAttribute('aria-label',title||text);b.onclick=fn;return b;}
    function proxy(target,text){return button(text,text,function(){var n=doc.querySelector(target);if(n)n.click();soon();});}
    var scroll=el('div','ps-sm-body'),identity=el('div','ps-sm-identity'),align=el('section','ps-sm-align'),bib=el('section','ps-sm-bibs'),size=el('div','ps-sm-size'),quick=el('div','ps-sm-quick'),more=el('details','ps-sm-more'),summary=el('summary','','포지션 · 주발 · 장면'),extras=el('div','ps-sm-extras'),bottom=el('div','ps-sm-footer');
    more.append(summary,extras);scroll.append(identity,align,bib,size,quick,more);
    ['left','right','top','bottom'].forEach(function(k){ctl.style.removeProperty(k);});
    body.classList.add('ps-selection-ui');
    ctl.classList.add('ps-selection-menu','sel-near');ctl.setAttribute('role','region');ctl.setAttribute('aria-label','선택 항목 편집');
    ctl.append(head,scroll,bottom);
    label('이름',identity);label('번호',identity);move('nameCtl',identity);move('numCtl',identity);
    doc.getElementById('nameInput').setAttribute('aria-label','선수 이름');
    label('정렬 · 간격',align);var grid=el('div','ps-sm-align-grid'),dist=el('div','ps-sm-distribute');align.append(grid,dist);
    var paths=['M4 3v18M7 7h12v4H7zM7 15h8v4H7z','M12 3v18M5 7h14v4H5zM8 15h8v4H8z','M20 3v18M5 7h12v4H5zM9 15h8v4H9z','M3 4h18M7 7h4v12H7zM15 7h4v8h-4z','M3 12h18M7 5h4v14H7zM15 8h4v8h-4z','M3 20h18M7 5h4v12H7zM15 9h4v8h-4z'];
    [['minX','왼쪽 정렬'],['colX','가운데 정렬'],['maxX','오른쪽 정렬'],['minY','위쪽 정렬'],['rowY','중간 정렬'],['maxY','아래쪽 정렬']].forEach(function(v,i){var b=button('',v[1],function(){win.alignMulti(v[0]);});b.dataset.align=v[0];b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="'+paths[i]+'"/></svg>';grid.appendChild(b);});
    [['distX','가로 균등'],['distY','세로 균등']].forEach(function(v){var b=button(v[1],v[1],function(){win.alignMulti(v[0]);});b.dataset.align=v[0];dist.appendChild(b);});
    var bibLabel=label('조끼',bib),scope=el('span','ps-sm-scope'),swatches=el('div','ps-sm-swatches'),mixed=el('span','ps-sm-mixed');bibLabel.append(scope);bib.append(swatches,mixed);
    [['','없음'],['#facc15','노랑'],['#fb923c','주황'],['#4ade80','초록'],['#38bdf8','하늘'],['#f472b6','분홍']].forEach(function(v){var b=proxy('#psEditTools [data-bib="'+v[0]+'"]','조끼 '+v[1]);b.textContent='';b.dataset.bib=v[0];b.className='ps-sm-swatch'+(v[0]?'':' ps-sm-off');if(v[0])b.style.setProperty('--bib',v[0]);swatches.appendChild(b);});
    label('크기',size);move('sizeCtl',size);['dupSelBtn','lockSelBtn','labelVisBtn'].forEach(id=>move(id,quick));
    move('delSelBtn',bottom);var deletion=el('span','ps-sm-delete-label'),delButton=doc.getElementById('delSelBtn');Array.from(delButton.childNodes).filter(n=>n.nodeType===3).forEach(n=>n.remove());delButton.appendChild(deletion);
    var positions=el('div','ps-sm-position'),feet=el('div','ps-sm-feet'),meter=el('div','ps-sm-meter');extras.append(positions,feet,meter);
    label('포지션',positions);move('posCtl',positions);label('주발',feet);feet.appendChild(foot);
    label('간격 (m)',meter);var meterTools=el('div','ps-sm-meter-tools'),meterValue=el('output','','5');meterTools.append(proxy('#alignBar [data-msp="-"]','−'),meterValue,proxy('#alignBar [data-msp="+"]','＋'),proxy('#alignBar [data-mspx]','가로 적용'),proxy('#alignBar [data-mspy]','세로 적용'));meter.appendChild(meterTools);
    function collect(){Array.from(ctl.children).forEach(function(n){if(n===head||n===scroll||n===bottom||n.classList.contains('ps-in-h'))return;if(n.id==='alignBar'||n.id==='selMoreBtn'||n.id==='selRowBreak')return;extras.appendChild(n);});}
    collect();
    function readOnly(){return !!(S()&&S().boardLocked)||win.__vaultReadOnly||win.__animExport||doc.getElementById('psRoHide')||body.classList.contains('comm-viewing')||body.classList.contains('focus-board')||(win.communityBoardReadOnly&&win.communityBoardReadOnly());}
    function shown(){return !dismissed&&!readOnly()&&ctl.style.display!=='none'&&selected().length>0&&!body.classList.contains('ps-shape-menu-on');}
    function cls(name,on){if(body.classList.contains(name)!==on)body.classList.toggle(name,on);}
    function hide(n,on){if(n.hidden!==on)n.hidden=on;}
    function text(n,s){if(n.textContent!==s)n.textContent=s;}
    function viewport(){
      var host=win.frameElement,r=host&&host.getBoundingClientRect();physicalWidth=r&&r.width>0?r.width:win.innerWidth;uiScale=physicalWidth>0&&win.innerWidth>0?win.innerWidth/physicalWidth:1;
      var mobile=physicalWidth<=760;if(ctl.classList.contains('ps-sm-mobile')!==mobile)ctl.classList.toggle('ps-sm-mobile',mobile);cls('ps-selection-mobile',mobile);put('--sm-ui-scale',String(uiScale));put('--sm-mobile-width',Math.max(200,physicalWidth-24)+'px');
    }
    /* 3.207 — 썸네일을 그리느라 판을 잠깐 갈아 끼우는 동안(__psThumbCapturing — __snapToThumb 의 loadSnap 두 번)은 선택이 비었다 돌아오므로 key 가 바뀌어
       «포지션 · 주발 · 장면»(더보기)을 접고 스크롤을 맨 위로 올렸다(폰 폭 CI 가 잡음 — board-feedback-3163). 그 사이의 sync 는 건너뛴다(되돌린 뒤 rAF 의 sync 가 같은 선택을 본다). */
    function sync(){
      if(syncing||win.__psThumbCapturing)return;syncing=true;
      try{
        viewport();collect();var list=selected(),s=S(),many=list.length>1,players=s?list.filter(p=>s.players.includes(p)&&!p.coach):[],one=list[0],singlePlayer=!many&&one&&kind(one)==='player';
        var key=list.map(o=>String(o.id||kind(o))).join('|');if(key!==lastKey){dismissed=false;more.open=false;scroll.scrollTop=0;lastKey=key;}
        cls('ps-selection-open',shown());cls('ps-insp-on',!!singlePlayer&&shown());
        ctl.dataset.open=shown()?'true':'false';ctl.dataset.multiple=many?'true':'false';ctl.dataset.readonly=readOnly()?'true':'false';
        var title=many?list.length+'개 선택':singlePlayer?'선수 편집':one?({equip:'장비 편집',ball:'공 편집',drawing:one.type==='text'?'글자 편집':'도형 편집'}[kind(one)]||'선택 항목'):'선택 항목';
        text(head.querySelector('.ps-in-nm'),title);text(head.querySelector('.ps-in-ball'),many?String(list.length):singlePlayer?String(one.num||''):'·');
        var counts={};list.forEach(o=>{var k=kind(o);counts[k]=(counts[k]||0)+1;});
        var subtitle=many?Object.keys(counts).map(k=>({player:'선수',equip:'장비',drawing:'도형',ball:'공'}[k]||'항목')+' '+counts[k]+(k==='player'?'명':'개')).join(' · '):singlePlayer?[one.pos||'포지션 미지정',one.name||'이름 미지정'].join(' · '):'선택한 항목에 적용';
        text(head.querySelector('.ps-in-sub'),subtitle);head.querySelector('.ps-in-ball').classList.toggle('ps-sm-count',many);
        hide(identity,!singlePlayer);hide(align,!many);hide(bib,!players.length);hide(size,doc.getElementById('sizeCtl').style.display==='none');hide(positions,!singlePlayer||doc.getElementById('posCtl').style.display==='none');hide(feet,!singlePlayer);hide(meter,!many);
        // Names and numbers remain available for mixed selections in the expanded area.
        ['nameCtl','numCtl'].forEach(id=>move(id,many?extras:identity));
        text(scope,players.length!==list.length?'선수 '+players.length+'명만':many?players.length+'명':'');
        var colors=players.map(p=>win.PSBoardEdit.bibColor(p)),same=colors.every(c=>c===colors[0]);text(mixed,same?'':'여러 색');
        swatches.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',same&&colors[0]===b.dataset.bib?'true':'false'));
        grid.querySelectorAll('button').forEach(b=>b.disabled=list.filter(o=>!o.locked&&win.PSBoardEdit.center(o)).length<2);
        dist.querySelectorAll('button').forEach(b=>b.disabled=list.filter(o=>!o.locked&&win.PSBoardEdit.center(o)).length<3);
        text(summary,many?'반전 · 겹침 순서 · 장면':'포지션 · 주발 · 장면');text(deletion,many?'선택한 '+list.length+'개 삭제':'선택 항목 삭제');
        var ab=doc.getElementById('mspVal');if(ab)text(meterValue,ab.textContent);
        if(singlePlayer)foot.querySelectorAll('button').forEach(function(b){var on=b.dataset.foot===(one.foot||'');b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));});
      }finally{syncing=false;}
      if((!shown()||physicalWidth>760)&&reserved){reserved=false;var stage=doc.getElementById('boardStage');stage.style.setProperty('padding-bottom',previousPadding,'important');win.psSelBarLayout();}
      place();
    }
    function put(name,value){if(ctl.style.getPropertyValue(name)!==value)ctl.style.setProperty(name,value);}
    function place(){
      if(!shown())return;
      var list=selected(),rects=[];list.forEach(function(o){var n;if(kind(o)==='drawing')n=win.PSBoardText&&win.PSBoardText.node(o);else n=Array.from(doc.querySelectorAll('#tokenLayer .token')).find(n=>n.dataset.id===String(o===S().ball?'ball':o.id));if(n){var r=n.getBoundingClientRect();if(r.width&&r.height)rects.push(r);}});
      if(!rects.length)return;
      var vv=win.visualViewport,left=vv?vv.offsetLeft:0,top=vv?vv.offsetTop:0,width=vv?vv.width:win.innerWidth,height=vv?vv.height:win.innerHeight,mobile=physicalWidth<=760,pad=12*uiScale;
      var area={left:left+pad,right:left+width-pad,top:top+pad,bottom:top+height-pad};
      if(!mobile)doc.querySelectorAll('#ps-command-dock,#ps-dock,#boardToolbar,#boardPageStrip').forEach(function(n){var r=n.getBoundingClientRect();if(!r.width||!r.height||win.getComputedStyle(n).display==='none')return;if(r.top>top+height*.5)area.bottom=Math.min(area.bottom,r.top-pad);else if(n.id==='boardPageStrip')area.top=Math.max(area.top,r.bottom+pad);});
      var r=ctl.getBoundingClientRect(),style=win.getComputedStyle(ctl),sx=r.width/(parseFloat(style.width)||r.width)||1,sy=r.height/(parseFloat(style.height)||r.height)||1;
      put('--sm-height',Math.max(160,Math.min(mobile?height*.54:height,area.bottom-area.top)/sy)+'px');
      r=ctl.getBoundingClientRect();
      if(mobile){var stage=doc.getElementById('boardStage'),sr=stage.getBoundingClientRect(),reserve=Math.round(Math.max(0,sr.bottom-area.bottom)+r.height+pad)+'px';if(!reserved){previousPadding=stage.style.getPropertyValue('padding-bottom');reserved=true;}if(stage.style.getPropertyValue('padding-bottom')!==reserve){stage.style.setProperty('padding-bottom',reserve,'important');if(win.applyView)win.applyView();}}
      var a={left:Math.min(...rects.map(r=>r.left)),right:Math.max(...rects.map(r=>r.right)),top:Math.min(...rects.map(r=>r.top)),bottom:Math.max(...rects.map(r=>r.bottom))};
      var p=mobile?{left:area.left,top:area.bottom-r.height}:placement(a,r,area,pad);
      var moved=!mobile&&win.__psPlayerPanelDrag&&win.__psPlayerPanelDrag.position(ctl);if(moved)p={left:moved.left,top:moved.top};
      var cs=win.getComputedStyle(ctl);put('--sm-left',Math.round((parseFloat(cs.left)||0)+(p.left-r.left)/(sx/uiScale))+'px');put('--sm-top',Math.round((parseFloat(cs.top)||0)+(p.top-r.top)/(sy/uiScale))+'px');
    }
    function soon(){if(!frame)frame=win.requestAnimationFrame(function(){frame=0;sync();});}
    win.__psSelectionMenu={sync:sync,place:place,mobileOpen:function(){return physicalWidth<=760&&shown();}};
    // Touch redraws may show the legacy panel again. Keep an explicit dismissal
    // until the user selects a token or another feature deliberately opens it.
    var oldOpen=win.__selPanelOpen;win.__selPanelOpen=function(on){dismissed=on===false;var result=oldOpen.apply(this,arguments);sync();return result;};
    // A touch after scrolling can deliver pointerup without a compatibility click.
    // Reuse the original close action for a stationary touch inside its button.
    var closeButton=head.querySelector('.ps-in-x'),closeTouch=null;
    closeButton.addEventListener('pointerdown',function(e){if(e.pointerType!=='mouse'&&e.isPrimary!==false&&e.button===0)closeTouch={id:e.pointerId,x:e.clientX,y:e.clientY};});
    closeButton.addEventListener('pointermove',function(e){if(closeTouch&&closeTouch.id===e.pointerId&&Math.hypot(e.clientX-closeTouch.x,e.clientY-closeTouch.y)>8)closeTouch=null;});
    closeButton.addEventListener('pointercancel',function(){closeTouch=null;});
    closeButton.addEventListener('pointerup',function(e){var t=closeTouch;closeTouch=null;if(!t||t.id!==e.pointerId||!closeButton.contains(doc.elementFromPoint(e.clientX,e.clientY)))return;e.preventDefault();e.stopPropagation();closeButton.click();});
    doc.addEventListener('pointerdown',function(e){if(e.target.closest&&e.target.closest('#tokenLayer .token'))dismissed=false;},true);
    doc.addEventListener('contextmenu',function(e){if(e.target.closest&&e.target.closest('#tokenLayer .token'))dismissed=false;},true);
    win.positionSelCtl=function(){if(!ctl.classList.contains('sel-near'))ctl.classList.add('sel-near');sync();};
    ['updateDelUI','updateAlignBar'].forEach(function(name){var old=win[name];win[name]=function(){var result=old.apply(this,arguments);sync();return result;};});
    var oldLayout=win.psSelBarLayout;win.psSelBarLayout=function(){if(!ctl.classList.contains('sel-near'))ctl.classList.add('sel-near');if(reserved&&shown()&&physicalWidth<=760){place();return;}return oldLayout.apply(this,arguments);};
    more.addEventListener('toggle',soon);ctl.addEventListener('input',soon);ctl.addEventListener('change',soon);ctl.addEventListener('click',soon);
    doc.addEventListener('keydown',function(e){if(e.key==='Escape'&&shown()&&!e.target.closest('dialog,[role=dialog],.ps-text-inline-editor')){e.preventDefault();e.stopImmediatePropagation();win.__selPanelOpen(false);ctl.style.display='none';sync();} },true);
    win.addEventListener('resize',soon);if(win.visualViewport){win.visualViewport.addEventListener('resize',soon);win.visualViewport.addEventListener('scroll',soon);}
    new win.ResizeObserver(soon).observe(ctl);new win.MutationObserver(soon).observe(ctl,{attributes:true,attributeFilter:['style','data-kind']});
    sync();
  }
  return {placement:placement,install:install};
});

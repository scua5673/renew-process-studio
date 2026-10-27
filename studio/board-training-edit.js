/* Training editing: one coordinate system for mixed selections, optional grid,
   position locks, bibs and text styles. Existing document/undo paths own writes. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root) return;
  root.PSBoardEdit = api;
  root.__psLookExt = root.__psLookExt || {};
  root.__psLookExt.editGrid = {def: 0, ok: function (v) { return [0,1,2,3,5,10].indexOf(+v) >= 0; }};
  root.__editGrid = 0;
  root.document.addEventListener('DOMContentLoaded', function () { api.install(root); });
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var BIBS = [['', '없음'], ['#facc15', '노랑'], ['#fb923c', '주황'], ['#4ade80', '초록'], ['#38bdf8', '하늘'], ['#f472b6', '분홍']];
  function hex(v) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : ''; }
  function center(o) {
    if (!o) return null;
    if (Number.isFinite(o.x) && Number.isFinite(o.y)) return {x:o.x,y:o.y};
    if (!Array.isArray(o.pts) || !o.pts.length || o.type === 'link') return null;
    var p = o.pts.filter(function (q) { return q && Number.isFinite(q.x) && Number.isFinite(q.y); });
    if (!p.length) return null;
    return {x:(Math.min.apply(null,p.map(q=>q.x))+Math.max.apply(null,p.map(q=>q.x)))/2,
      y:(Math.min.apply(null,p.map(q=>q.y))+Math.max.apply(null,p.map(q=>q.y)))/2};
  }
  function translate(o, dx, dy) {
    if (!o || o.locked || !Number.isFinite(dx) || !Number.isFinite(dy)) return false;
    if (Number.isFinite(o.x) && Number.isFinite(o.y)) { o.x+=dx;o.y+=dy; }
    else if (center(o)) { o.pts=o.pts.map(function(p){return Object.assign({},p,{x:p.x+dx,y:p.y+dy});});delete o.tk; }
    else return false;
    return !!(dx || dy);
  }
  function alignPlan(items, mode, vertical, flip) {
    var axis = /X$/.test(mode) ? 'x' : 'y';
    if (vertical) axis = axis === 'x' ? 'y' : 'x';
    if (!/^(rowY|colX|distX|distY|minX|maxX|minY|maxY)$/.test(mode)) return [];
    var a=items.filter(o=>o&&!o.locked).map(o=>({o,p:center(o)})).filter(v=>v.p);
    if(a.length<2)return [];
    if (/^dist/.test(mode)) {
      if(a.length<3)return [];
      a.sort((u,v)=>u.p[axis]-v.p[axis]);
      var first=a[0].p[axis],step=(a[a.length-1].p[axis]-first)/(a.length-1);
      a.forEach((v,i)=>v.target=first+step*i);
    } else {
      var values=a.map(v=>v.p[axis]), edge=/^(min|max)/.test(mode);
      var reverse=vertical && (/X$/.test(mode)?!flip:!!flip);
      var target=edge?((/^min/.test(mode)!==reverse)?Math.min.apply(null,values):Math.max.apply(null,values)):values.reduce((sum,v)=>sum+v,0)/a.length;
      a.forEach(v=>v.target=target);
    }
    return a.map(v=>({o:v.o,dx:axis==='x'?v.target-v.p.x:0,dy:axis==='y'?v.target-v.p.y:0})).filter(v=>Math.abs(v.dx)+Math.abs(v.dy)>1e-8);
  }
  function snapPoint(p, grid, others, pitch, tolerance) {
    var r={x:p.x,y:p.y,gx:null,gy:null};
    if(grid && grid.sx>0 && grid.sy>0) {
      r.x=grid.x0+Math.round((p.x-grid.x0)/grid.sx)*grid.sx;
      r.y=grid.y0+Math.round((p.y-grid.y0)/grid.sy)*grid.sy;
      r.gx=r.x;r.gy=r.y;return r; // A grid intersection must stay on the grid.
    }
    var tx=tolerance||7,ty=tx;
    (others||[]).concat(pitch?[pitch]:[]).forEach(function(q){
      if(!q)return;var dx=Math.abs(q.x-p.x),dy=Math.abs(q.y-p.y);
      if(dx<tx){r.x=q.x;r.gx=q.x;tx=dx;}if(dy<ty){r.y=q.y;r.gy=q.y;ty=dy;}
    });return r;
  }
  function textStyle(d) {
    d=d||{};return {textWeight:[400,700,900].includes(+d.textWeight)?+d.textWeight:700,
      textItalic:d.textItalic===true,textAngle:Number.isFinite(+d.textAngle)?Math.max(-180,Math.min(180,+d.textAngle)):0};
  }
  function textPoint(d,p,vertical,flip){var c=d.pts[0],a=(((vertical?(flip?-90:90):0)+textStyle(d).textAngle)*Math.PI/180),x=p.x-c.x,y=p.y-c.y;return {x:x*Math.cos(a)+y*Math.sin(a),y:-x*Math.sin(a)+y*Math.cos(a)};}
  function bibColor(p){return p&&!p.coach?hex(p.bib):'';}
  function bibPath(){return 'M-9 -18L-5 -18Q0 -10 5 -18L9 -18L10 -8L14 -4L12 17Q0 21 -12 17L-14 -4L-10 -8Z';}
  function install(win) {
    var doc=win.document, body=doc.body, panel, toggle, additive=false,lastDrawingTap=null,lastDrawingTime=0;
    function S(){return typeof state!=='undefined'?state:null;}
    function selected(){return typeof multiSel!=='undefined'&&multiSel.length?multiSel.slice():(typeof sel!=='undefined'&&sel&&sel.ref?[sel.ref]:[]);}
    function tokenNode(o){var id=o===S().ball?'ball':String(o.id);return Array.from(doc.querySelectorAll('#tokenLayer .token')).find(g=>g.getAttribute('data-id')===id);}
    function editable(){var s=S();return !!s&&!s.boardLocked&&!win.__vaultReadOnly&&!win.__animExport&&!doc.getElementById('psRoHide')&&!body.classList.contains('comm-viewing')&&!body.classList.contains('focus-board')&&!(win.communityBoardReadOnly&&win.communityBoardReadOnly());}
    function finish(){win.renderTokens();win.renderDrawings();win.updateDelUI();win.updateAlignBar();win.autoSaveAnimFrame();win.boardSaveLive();sync();}
    function wrap(name,after){var old=win[name];if(typeof old!=='function')return;win[name]=function(){var r=old.apply(this,arguments);after.apply(this,arguments);return r;};}
    function grid(){
      var q=win.PR(),n=+win.__editGrid;
      if(n>0)return {x0:q.L,y0:q.T,sx:M2U(n),sy:M2U(n)};
      return doc.documentElement.dataset.pitch==='train'?win.__trainGridSpec:null;
    }
    function paintGrid(){
      var layer=doc.getElementById('snapGuideLayer'),n=doc.getElementById('psEditGrid');
      if(!layer)return;if(n)n.remove();if(!(win.__editGrid>0))return;
      var q=win.PR(),g=grid(),d=[];
      for(var x=q.L;x<=q.R+.1;x+=g.sx)d.push('M'+x+' '+q.T+'V'+q.B);
      for(var y=q.T;y<=q.B+.1;y+=g.sy)d.push('M'+q.L+' '+y+'H'+q.R);
      n=doc.createElementNS(NS,'path');n.id='psEditGrid';n.setAttribute('d',d.join(' '));n.setAttribute('fill','none');n.setAttribute('stroke',doc.documentElement.dataset.pitch==='white'||doc.documentElement.dataset.pitch==='train'?'#64748b':'#ffffff');n.setAttribute('stroke-opacity','.24');n.setAttribute('stroke-width','.8');n.setAttribute('pointer-events','none');layer.prepend(n);
    }
    win.snapDrag=function(p,kind,u){
      var s=S(),skip=selected();if(!skip.includes(p))skip=[p];
      var others=[].concat(s.players,s.equipment,s.drawings,s.ball?[s.ball]:[]).filter(o=>!skip.includes(o)).map(center).filter(Boolean),q=win.PR();
      return snapPoint(u,grid(),others,{x:q.CX,y:q.CY},7);
    };
    api.snapDelta=function(group,anchor,dx,dy,e){
      if(!(e.metaKey||e.ctrlKey||win._dragSnapOn())){win.drawSnapGuides(null,null);return {x:dx,y:dy};}
      var item=group.find(v=>v.o===anchor)||group.find(v=>!v.locked),c=item&&(item.draw?center({pts:item.pts0}):{x:item.x0,y:item.y0});
      if(!c)return {x:dx,y:dy};var p=win.snapDrag(anchor,'group',{x:c.x+dx,y:c.y+dy});win.drawSnapGuides(p.gx,p.gy);return {x:p.x-c.x,y:p.y-c.y};
    };
    win.alignMulti=function(mode){
      if(!editable())return;var items=selected(),plan=alignPlan(items,mode,S().orientation==='v',!!S().spFlip);
      if(!plan.length){win.toast('움직일 항목을 '+(/^dist/.test(mode)?'3':'2')+'개 이상 선택하세요');return;}
      win.pushUndo();plan.forEach(p=>translate(p.o,p.dx,p.dy));finish();
      win.toast(items.some(o=>o.locked)?'정렬 완료 · 고정한 항목은 유지했어요':'정렬 완료');
    };
    function bibs(color){
      if(!editable())return;var list=selected().filter(p=>S().players.includes(p)&&!p.coach);
      color=hex(color);if(!list.some(p=>bibColor(p)!==color))return;
      win.pushUndo();list.forEach(p=>{if(color)p.bib=color;else delete p.bib;});finish();
    }
    function decorateBib(g,p){
      var color=bibColor(p);if(!color||!g||g.querySelector('.ps-bib'))return;
      var jersey=g.querySelector('.ps-jersey'),base=g.querySelector('.tok-c');if(!base)return;
      var n=doc.createElementNS(NS,'path');n.setAttribute('class','ps-bib');n.setAttribute('d',bibPath());n.setAttribute('fill',color);n.setAttribute('stroke','#334155');n.setAttribute('stroke-width','1');n.setAttribute('pointer-events','none');
      if(jersey)jersey.appendChild(n);else if(p.img){n.setAttribute('transform','translate(15 13) scale(.6)');g.appendChild(n);}else base.parentNode.insertBefore(n,base.nextSibling);
      var number=Array.from(g.children).find(t=>t.tagName.toLowerCase()==='text');
      if(number){number.setAttribute('fill','#172033');number.setAttribute('stroke','rgba(255,255,255,.75)');}
    }
    // Before depth meshes copy the face; after makeToken covers flat/photo tokens.
    if(win.PSBoardDepth){var depth=win.PSBoardDepth.apply;win.PSBoardDepth.apply=function(g,p,kind){if(kind==='player'){win.PSJersey.decorate(win,g,p);decorateBib(g,p);}return depth.apply(this,arguments);};}
    var make=win.makeToken;win.makeToken=function(p,kind){var g=make.apply(this,arguments);if(kind==='player')decorateBib(g,p);return g;};
    // Text styles are part of each drawing. Measurement and SVG export use them.
    var measuring=null,box=win._textBox,measure=win._txMeasW,measureContext=doc.createElement('canvas').getContext('2d');
    win._textBox=function(d){var prev=measuring;measuring=textStyle(d);try{return box.apply(this,arguments);}finally{measuring=prev;}};
    win._txMeasW=function(str,fs,style){var st=style?textStyle(style):measuring;if(!st)return measure.apply(this,arguments);var c=measureContext;c.font=(st.textItalic?'italic ':'')+st.textWeight+' '+fs+'px Pretendard,sans-serif';return c.measureText(str||'').width;};
    var fit=win.PSBoardText.fitEditor;win.PSBoardText.fitEditor=function(ed,d){var prev=measuring;measuring=textStyle(ed.__psTextStyle||d);try{return fit.apply(this,arguments);}finally{measuring=prev;}};
    win.findTextAt=function(u){var s=S();for(var i=s.drawings.length-1;i>=0;i--){var d=s.drawings[i];if(d.type!=='text')continue;var b=win._textBox(d),p=textPoint(d,u,s.orientation==='v',s.spFlip);if(Math.abs(p.x)<=b.boxW/2+6&&Math.abs(p.y)<=b.boxH/2+6)return d;}return null;};
    win.enableTextResize=function(hg,d){hg.style.cursor='ew-resize';hg.style.touchAction='none';hg.addEventListener('pointerdown',function(e){
      if(e.button!==0||S().tool!=='move'||!editable()||d.locked)return;e.preventDefault();e.stopPropagation();var pid=e.pointerId,g=hg.parentNode,changed=false,start=d.w||win._textBox(d).boxW;
      function move(ev){if(ev.pointerId!==pid)return;var p=textPoint(d,win.toUnit(ev),S().orientation==='v',S().spFlip),w=Math.max((d.size||30)*2.2,Math.abs(p.x)*2);if(!changed&&Math.abs(w-start)<1)return;if(!changed){win.pushUndo();changed=true;}d.w=w;var next=win.redrawOne(d,g);if(next)g=next;}
      function end(ev){if(ev.pointerId!==pid)return;win.removeEventListener('pointermove',move,true);win.removeEventListener('pointerup',end,true);win.removeEventListener('pointercancel',end,true);if(changed)finish();}
      win.addEventListener('pointermove',move,true);win.addEventListener('pointerup',end,true);win.addEventListener('pointercancel',end,true);
    });};
    win.enableDrawingDrag=function(g,d){
      var pid=null,start=null,group=null,moved=false;
      g.style.cursor='grab';
      g.addEventListener('pointerdown',function(e){
        if(e.button!==0||pid!==null||!editable())return;
        if(typeof _inkPalm==='function'&&_inkPalm(e)){e.stopPropagation();return;}
        var s=S();if(s.tool==='eraser'){e.stopPropagation();win.removeDrawing(d);return;}
        if(s.tool==='text'){e.stopPropagation();win.addText(win.toUnit(e),d.type==='text'?d:win.findTextAt(win.toUnit(e)));return;}
        if(s.tool!=='move')return;e.stopPropagation();
        if(d.locked){if(d.type==='text'&&win.PSBoardText.lockedTap(d,e))return;win.selectItem('drawing',d);win.toast('고정된 항목입니다 · 고정 해제 후 이동하세요');return;}
        pid=e.pointerId;start=win.toUnit(e);moved=false;var list=selected();if(!list.includes(d))list=[d];
        group=list.map(function(o){var drawing=s.drawings.includes(o);return {o:o,draw:drawing,locked:!!o.locked,pts0:drawing?(o.pts||[]).map(p=>Object.assign({},p)):null,tk0:o.tk&&o.tk.slice(),x0:o.x,y0:o.y,g:drawing?win.PSBoardText.node(o):tokenNode(o)};});
        try{g.setPointerCapture(pid);}catch(_){}g.style.cursor='grabbing';
        win.addEventListener('pointermove',move,true);win.addEventListener('pointerup',end,true);win.addEventListener('pointercancel',end,true);
      });
      function move(e){
        if(e.pointerId!==pid)return;var p=win.toUnit(e),dx=p.x-start.x,dy=p.y-start.y;
        if(!moved&&Math.hypot(dx,dy)<3)return;
        if(!moved){win.pushUndo();moved=true;}
        var delta=api.snapDelta(group,d,dx,dy,e);dx=delta.x;dy=delta.y;
        group.forEach(function(v){if(v.locked)return;
          if(v.draw){v.o.pts=v.pts0.map(p=>Object.assign({},p,{x:p.x+dx,y:p.y+dy}));
            if(v.tk0){v.o.tk=v.tk0.map(id=>group.some(q=>!q.draw&&!q.locked&&(q.o.id===id||(id==='ball'&&q.o===S().ball)))?id:null);if(v.o.tk.every(id=>id==null))delete v.o.tk;}
            if(v.g)v.g.setAttribute('transform','translate('+dx+','+dy+')');
          }else{v.o.x=v.x0+dx;v.o.y=v.y0+dy;if(v.g)v.g.setAttribute('transform',win.tokenTransform(v.o));}
        });win.renderMultiGuides();
      }
      function end(e){
        if(e.pointerId!==pid)return;
        if(e.type==='pointerup')move(e);
        var old=pid;pid=null;win.removeEventListener('pointermove',move,true);win.removeEventListener('pointerup',end,true);win.removeEventListener('pointercancel',end,true);
        try{g.releasePointerCapture(old);}catch(_){}g.style.cursor='grab';win.clearGuides();
        if(moved){finish();return;}
        if(e.type==='pointercancel')return;
        var now=Date.now();if(d.type==='text'&&lastDrawingTap===d&&now-lastDrawingTime<360){lastDrawingTap=null;win.addText(d.pts[0],d);return;}lastDrawingTap=d;lastDrawingTime=now;
        if(e.shiftKey||e.metaKey||e.ctrlKey)win.toggleMulti(d);else win.selectItem('drawing',d);
      }
    };
    api.editorStyle=function(bar,ed,draft,change){
      function repaint(){ed.style.setProperty('font-weight',draft.textWeight,'important');ed.style.setProperty('font-style',draft.textItalic?'italic':'normal','important');ed.__psTextStyle=draft;change();}
      function button(label,action){var b=doc.createElement('button');b.type='button';b.textContent=label;b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();});b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();action(b);repaint();ed.focus();});bar.appendChild(b);return b;}
      var weight=button('굵게',b=>{draft.textWeight=draft.textWeight===700?900:draft.textWeight===900?400:700;syncText();});
      var italic=button('기울임',b=>{draft.textItalic=!draft.textItalic;syncText();});
      var label=doc.createElement('label');label.className='ps-text-color-pick';label.textContent='회전';var angle=doc.createElement('input');angle.type='number';angle.min='-180';angle.max='180';angle.step='15';angle.value=draft.textAngle;angle.setAttribute('aria-label','텍스트 회전 각도');angle.style.width='4em';angle.addEventListener('input',()=>{draft.textAngle=textStyle({textAngle:angle.value}).textAngle;repaint();});label.append(angle);bar.append(label);
      function syncText(){weight.textContent=draft.textWeight===400?'보통':draft.textWeight===900?'아주 굵게':'굵게';italic.setAttribute('aria-pressed',String(draft.textItalic));italic.classList.toggle('on',draft.textItalic);}
      syncText();repaint();
    };
    function mk(tag,text){var n=doc.createElement(tag);if(text)n.textContent=text;return n;}
    panel=mk('section');panel.id='psEditTools';panel.hidden=true;panel.setAttribute('aria-label','배치 도구');
    panel.innerHTML='<div class="pe-head"><strong>배치 도구</strong><button type="button" data-close aria-label="배치 도구 닫기">×</button></div><p data-count aria-live="polite"></p><div class="pe-row"><button type="button" data-pick aria-pressed="false">여러 개 선택</button><button type="button" data-lock>고정</button></div><div class="pe-grid"><button type="button" data-align="rowY">가로로 정렬</button><button type="button" data-align="colX">세로로 정렬</button><button type="button" data-align="distX">가로 같은 간격</button><button type="button" data-align="distY">세로 같은 간격</button></div><hr><label class="pe-row">격자 간격 <select aria-label="편집 격자 간격"><option value="0">기존 배경</option><option value="1">1 m</option><option value="2">2 m</option><option value="3">3 m</option><option value="5">5 m</option><option value="10">10 m</option></select></label><label class="pe-row"><input type="checkbox" data-snap>격자·안내선에 맞추기</label><hr><strong>훈련 조끼</strong><div class="pe-bibs"></div><p class="pe-hint">여러 개 선택을 켜고 항목을 누르세요. 선택을 마치면 끄고 함께 이동할 수 있어요.</p>';
    BIBS.forEach(function(v){var b=mk('button',v[1]);b.type='button';b.dataset.bib=v[0];b.setAttribute('aria-label','훈련 조끼 '+v[1]);if(v[0])b.style.setProperty('--bib-color',v[0]);panel.querySelector('.pe-bibs').append(b);});doc.body.append(panel);
    toggle=mk('button','배치 도구');toggle.type='button';toggle.id='psEditToolsToggle';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',panel.id);
    function mount(){var host=doc.querySelector('#boardPageStrip .tb-r')||doc.getElementById('boardStage');if(host&&toggle.parentNode!==host){host.append(toggle);toggle.classList.toggle('pe-fallback',host.id==='boardStage');}toggle.hidden=!editable();if(toggle.hidden)close();}
    function place(){var r=toggle.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(r.right-320,win.innerWidth-328))+'px';panel.style.top=Math.max(8,Math.min(r.bottom+8,win.innerHeight-panel.offsetHeight-8))+'px';}
    function close(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');}
    toggle.onclick=function(){if(!editable())return;if(additive){additive=false;sync();return;}panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));sync();place();};
    function sync(){
      var a=selected(),free=a.filter(o=>!o.locked&&center(o)),players=a.filter(p=>S().players.includes(p)&&!p.coach),locked=a.filter(o=>o.locked).length;
      panel.querySelector('[data-count]').textContent=a.length?a.length+'개 선택'+(locked?' · '+locked+'개 고정':''):'선수·도형·장비를 선택하세요';
      panel.querySelectorAll('[data-align]').forEach(b=>b.disabled=free.length<(/^dist/.test(b.dataset.align)?3:2));
      var lock=panel.querySelector('[data-lock]');lock.disabled=!a.length;lock.textContent=a.length&&a.every(o=>o.locked)?'고정 해제':'고정';
      panel.querySelector('select').value=win.__editGrid||0;panel.querySelector('[data-snap]').checked=win._dragSnapOn();
      panel.querySelector('[data-pick]').setAttribute('aria-pressed',String(additive));
      panel.querySelectorAll('[data-bib]').forEach(b=>{b.disabled=!players.length;b.setAttribute('aria-pressed',String(!!players.length&&players.every(p=>bibColor(p)===b.dataset.bib)));});
      toggle.textContent=additive?'선택 마침':'배치 도구';mount();
    }
    panel.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;
      if(b.hasAttribute('data-close')){close();return;}if(!editable())return;
      if(b.dataset.align)win.alignMulti(b.dataset.align);
      else if(b.hasAttribute('data-pick')){additive=!additive;if(additive){win._activateMoveTool();close();}sync();}
      else if(b.hasAttribute('data-lock')){var a=selected();if(!a.length)return;win.pushUndo();var on=!a.every(o=>o.locked);a.forEach(o=>{if(on)o.locked=true;else delete o.locked;});finish();}
      else if(b.hasAttribute('data-bib'))bibs(b.dataset.bib);
    });
    panel.querySelector('select').onchange=function(){if(!editable())return;win.pushUndo();win.__editGrid=+this.value;paintGrid();win.autoSaveAnimFrame();win.boardSaveLive();};
    panel.querySelector('[data-snap]').onchange=function(){if(!editable())return;win.localStorage.setItem('cs_drag_snap_v1',this.checked?'1':'0');var b=doc.querySelector('#dragSnapSeg [data-ds="'+(this.checked?'1':'0')+'"]');if(b)b.click();sync();};
    function objectAt(target){var t=target;while(t&&t!==doc){if(t.__psD)return t.__psD;if(t.classList&&t.classList.contains('token')){var id=t.getAttribute('data-id'),s=S();return [].concat(s.players,s.equipment,s.ball?[s.ball]:[]).find(o=>String(o.id)===id||(id==='ball'&&o===s.ball));}t=t.parentNode;}return null;}
    doc.addEventListener('pointerdown',function(e){if(!additive||!editable()||S().tool!=='move')return;var o=objectAt(e.target);if(!o)return;e.preventDefault();e.stopImmediatePropagation();if(typeof sel!=='undefined'&&sel&&sel.ref&&!multiSel.length){multiSel=[sel.ref];sel=null;}win.toggleMulti(o);sync();},true);
    doc.addEventListener('keydown',function(e){if(e.key==='Escape'){additive=false;close();sync();}});
    // Pointer cancellation/secondary fingers must not select a different rectangle.
    var marqueePid=null;
    doc.addEventListener('pointerdown',function(e){if(e.target.closest&&e.target.closest('#board')&&S().tool==='move'&&!objectAt(e.target)){if(marqueePid!==null&&marqueePid!==e.pointerId){e.stopImmediatePropagation();return;}marqueePid=e.pointerId;}},true);
    ['pointermove','pointerup','pointercancel'].forEach(function(type){doc.addEventListener(type,function(e){if(marqueePid===null)return;if(e.pointerId!==marqueePid){if(e.target.closest&&e.target.closest('#board'))e.stopImmediatePropagation();return;}if(type==='pointercancel'){win.clearMarquee();marqueePid=null;}else if(type==='pointerup')marqueePid=null;},true);});
    wrap('updateDelUI',sync);wrap('clearGuides',paintGrid);wrap('buildPitch',paintGrid);wrap('loadSnap',function(){additive=false;paintGrid();sync();});
    win.addEventListener('resize',()=>{mount();if(!panel.hidden)place();});
    var strip=doc.getElementById('boardPageStrip');if(strip)new win.MutationObserver(mount).observe(strip,{childList:true});
    new win.MutationObserver(mount).observe(body,{attributes:true,attributeFilter:['class']});
    // Repaint only existing bib tokens: a full render at boot would mark the
    // board dirty and could cancel a pending restore from storage.
    (S().players||[]).forEach(function(p){var g=bibColor(p)&&tokenNode(p);if(g)g.replaceWith(win.makeToken(p,'player'));});
    (S().drawings||[]).forEach(function(d){if(d.type!=='text')return;var g=win.PSBoardText.node(d);if(g)g.replaceWith(win.drawingEl(d));});
    mount();paintGrid();sync();
  }
  var api={center:center,translate:translate,alignPlan:alignPlan,snapPoint:snapPoint,textStyle:textStyle,textPoint:textPoint,bibColor:bibColor,bibPath:bibPath,install:install};
  return api;
});

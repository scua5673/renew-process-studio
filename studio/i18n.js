/* PROCESS STUDIO — 화면 글 번역기(PSI18n). 셸(app.html)과 같은 출처 iframe 의 DOM 을 걸어 고정 문구만 바꾼다.
   HTML 은 한국어 그대로 두고, 사전에 있는 글(정확히 같은 글 · 규칙)만 화면에서 바꾼다. 원문은 WeakMap 에 두어
   언어를 한국어로 돌리면 새로고침 없이 그대로 돌아온다. 사용법 · 용어는 studio/i18n/GLOSSARY.md.

   사전
   · 기본: app.html 의 DICT(원문 → [ja,en,zh,es,pt]) · RULES([정규식, ja,en,zh,es,pt]) — window.PS_I18N_BASE={D,R}
   · 덧붙임: window.PS_I18N_EXTRA = { "한국어 원문": {en:"…"} } · window.PS_I18N_RULES_EXTRA = [ [정규식, {en:"… $1 …"}] ]
     파일은 studio/i18n/en-<영역>.js(shell · board · team · schedule · idp · gamemodel · community · note · common).
     영어일 때만 <script> 로 받는다(한국어 사용자는 받지 않는다): 셸은 common + shell, iframe 은 주소로 영역을 정해
     부모 창이 받는다 — 자식 화면은 고치지 않는다. 덧붙임이 기본보다 먼저다(같은 원문이면 덧붙임).
   · 자리마다 다른 말: window.PS_I18N_CTX_EXTRA = [ [CSS 선택자, { "원문": {en:"…"} }] ] — 그 선택자 안의 글 · 속성에만(먼저 본다)
   · 찾기: 앞뒤 공백을 떼고 안쪽 공백 · 줄바꿈을 한 칸으로 줄인 글로 Map 한 번(O(1)), 없으면 규칙을 차례로. 결과는 글마다 기억.

   바꾸는 것
   · 글 노드(HTML · SVG <text>/<tspan>/<title> · <option>) — 한글이 든 것만
   · 속성: placeholder · title · aria-label · aria-description · aria-placeholder · aria-valuetext · aria-roledescription ·
     alt · data-tip · data-ph · data-title · data-short · data-df-label · data-sel-note · (optgroup/option/track 의) label
   · alert · confirm · prompt 의 글(창마다 감싼다)
   · 나중에 바뀐 것: MutationObserver(childList · characterData · 위 속성) — textContent · innerHTML · 알림 · 새로 붙은 iframe
   바꾸지 않는 것(사용자 내용)
   · script · style · noscript · template · textarea 안, contenteditable 안, translate="no" · .notranslate · [data-i18n-skip] 안
   · 작전판 그림(svg.board · svg#board · svg#wbSurface · g.token) 안의 글 — 선수 이름 · 번호 · 메모
   · input 의 value, canvas 에 그린 글, CSS content:"…" 글, 다른 출처 iframe
   · 사전에 정확히 같은 글이 없는 모든 글(이름 · 팀 이름 · 메모는 그대로) */
(function(win){
  'use strict';
  if(win.PSI18n)return;
  var doc=win.document;
  var LANGS={ko:0,ja:1,en:2,zh:3,es:4,pt:5};
  var PACK_LANGS={en:1};
  var HANGUL=/[ㄱ-ㆎ가-힣]/;
  var ATTRS=['placeholder','title','aria-label','aria-description','aria-placeholder','aria-valuetext','aria-roledescription','alt','data-tip','data-ph','data-title','data-short','data-df-label','data-sel-note','label'];
  var LABEL_TAGS={OPTGROUP:1,OPTION:1,TRACK:1};
  var SKIP='script,style,noscript,template,textarea,[contenteditable]:not([contenteditable="false"]),[translate="no"],.notranslate,[data-i18n-skip],svg.board,svg#board,svg#wbSurface,g.token';
  /* iframe 주소 → 영역. 표에 없는 화면은 common 만 쓴다 */
  var AREA_OF={'board.html':'board','analysis.html':'board','process.html':'schedule','scout.html':'team','scouting.html':'team',
    'idp.html':'idp','gamemodel.html':'gamemodel','playbook.html':'gamemodel','terms.html':'gamemodel','community.html':'community','note.html':'note'};
  /* 처음 온 기기인지 볼 때 세지 않는 키 — 이 파일보다 먼저 도는 부팅 코드가 적는 것 */
  var BOOT_KEYS=/^(ps_crash_|ps_boot_|ps_diag_|ps_support_diag|ps_client_id|ps_device_id|ps_tab_|ps_opt_)/;

  var base=null,X=new Map(),XR=[],CX=new Map(),seenExtra=0,seenRules=0,seenCtx=0,memo=new Map();
  var oText=new WeakMap(),oAttr=new WeakMap(),DOCS=[],packs={},touched=false,started=false;
  var here='';try{here=String(doc.currentScript&&doc.currentScript.src||'').replace(/[^\/]*$/,'');}catch(_){}
  var cur='ko',auto=false;

  function stored(){try{return win.localStorage.getItem('cs_lang');}catch(_){return null;}}
  function firstRun(){
    try{
      var ls=win.localStorage;
      for(var i=0;i<ls.length;i++){var k=ls.key(i)||'';if(/^(cs_|ps_|sb-|scout_)/.test(k)&&!BOOT_KEYS.test(k))return false;}
      return true;
    }catch(_){return false;}
  }
  /* 저장된 선택이 없고 · 이 기기를 처음 쓰며 · 브라우저 언어가 한국어가 아니면 영어로 시작한다(저장된 선택은 안 건드린다) */
  function initialLang(){
    var s=stored();
    if(s&&LANGS.hasOwnProperty(s))return s;
    var nav='';try{nav=String(win.navigator.language||'');}catch(_){}
    if(nav&&!/^ko\b/i.test(nav)&&firstRun()){auto=true;try{win.localStorage.setItem('cs_lang','en');}catch(_){}return 'en';}
    return 'ko';
  }
  function norm(s){return String(s).replace(/\s+/g,' ').trim();}
  function merge(force){
    var E=win.PS_I18N_EXTRA,R=win.PS_I18N_RULES_EXTRA,changed=false;
    if(E){
      var keys=Object.keys(E);
      if(force||keys.length!==seenExtra){seenExtra=keys.length;for(var i=0;i<keys.length;i++){var v=E[keys[i]];if(v&&typeof v==='object')X.set(norm(keys[i]),v);}changed=true;}
    }
    if(R&&(force||R.length!==seenRules)){
      XR=[];for(var j=0;j<R.length;j++){var r=R[j];if(r&&r[0]&&typeof r[0].test==='function'&&r[1])XR.push(r);}
      /* 구멍을 뺀 글자가 긴(더 구체적인) 규칙 먼저 */
      XR.forEach(function(r){
        if(r[2]!=null)return;
        var lit=r[0].source.replace(/\((?:\\.|[^)\\])*\)/g,'');
        r[2]=lit.length;
        /* 한글이 두 자 이하인 틀(«{}에서 {}» · «{}명»)은 구멍이 숫자 · 영문일 때만 — 문장을 잘못 물지 않게 */
        r[3]=lit.replace(/[^\u3131-\u318E\uAC00-\uD7A3]/g,'').length<3;
      });
      XR.sort(function(p,q){return q[2]-p[2];});
      seenRules=R.length;changed=true;
    }
    /* 자리마다 다른 말(같은 «경기»가 메뉴에서는 Matches): PS_I18N_CTX_EXTRA=[[선택자,{원문:{en}}]] */
    var C=win.PS_I18N_CTX_EXTRA;
    if(C&&(force||C.length!==seenCtx)){
      CX=new Map();
      for(var c=0;c<C.length;c++){var sel=C[c][0],mp=C[c][1]||{};for(var ck in mp){var nk=norm(ck),arr=CX.get(nk);if(!arr){arr=[];CX.set(nk,arr);}arr.push([sel,mp[ck]]);}}
      seenCtx=C.length;changed=true;
    }
    if(changed)memo=new Map();
    return changed;
  }
  var partial=false;
  /* 구멍에 든 값이 사전에 있는 말이면 그것도 바꾼다(덧붙임 규칙만, 한 단계) */
  function fill(tpl,m,lang,deep){
    return String(tpl).replace(/\$(\d)/g,function(_,n){
      var g=m[+n];if(g==null)return '';
      if(lang&&HANGUL.test(g)){
        var t=g.trim(),r=(t&&!deep)?find(t,lang,1):null;
        if(r!=null){var a=g.indexOf(t);return g.slice(0,a)+r+g.slice(a+t.length);}
        partial=true;   /* 구멍에 한글이 그대로 남았다(이름이면 맞고, 문구면 덜 번역된 것) */
      }
      return g;
    });
  }
  function exact(k,t,lang){
    var hit=X.get(k);
    if(hit&&typeof hit[lang]==='string'&&hit[lang])return hit[lang];
    var B=base||(base=win.PS_I18N_BASE||null);
    if(B){hit=B.D[k]||B.D[t];if(hit&&hit[LANGS[lang]-1]!=null)return hit[LANGS[lang]-1];}
    return null;
  }
  function find(t,lang,deep){
    var li=LANGS[lang],k=norm(t),i,m,r=exact(k,t,lang);
    if(r!=null)return r;
    for(i=0;i<XR.length;i++){
      if(typeof XR[i][1][lang]!=='string')continue;
      m=k.match(XR[i][0]);
      if(!m||(XR[i][3]&&HANGUL.test(m.slice(1).join(''))))continue;
      return fill(XR[i][1][lang],m,lang,deep);
    }
    var B=base;
    if(B){for(i=0;i<B.R.length;i++){m=k.match(B.R[i][0]);if(m&&B.R[i][li]!=null)return fill(B.R[i][li],m);}}
    /* « · »로 이은 글은 토막마다 — 한 토막이라도 바뀌면 이어 붙인다(앞에 «· »가 붙은 틀도 본다) */
    if((deep||0)<2&&k.indexOf(' · ')>0){
      var parts=k.split(' · '),any=false,all=true;
      for(i=0;i<parts.length;i++){
        if(!HANGUL.test(parts[i]))continue;
        r=find(parts[i],lang,2);
        if(r==null&&i>0){r=find('· '+parts[i],lang,2);if(r!=null)r=r.replace(/^·\s*/,'');}
        if(r!=null){parts[i]=r;any=true;}else all=false;
      }
      partial=!all;
      if(any)return parts.join(' · ');
    }
    return null;
  }
  function lookup(t,lang){
    var key=lang+'\n'+t,r=memo.get(key);
    if(r===undefined){r=find(t,lang);if(memo.size>20000)memo=new Map();memo.set(key,r);}
    return r;
  }
  /* 한국어가 아니면 번역한 글, 번역이 없으면 null */
  function ctxFind(t,lang,el){
    var arr=CX.get(norm(t));
    if(!arr||!el||!el.closest)return null;
    for(var i=0;i<arr.length;i++){try{if(typeof arr[i][1][lang]==='string'&&el.closest(arr[i][0]))return arr[i][1][lang];}catch(_){}}
    return null;
  }
  function trStr(s,lang,el){
    if(!s||lang==='ko'||!HANGUL.test(s))return null;
    var t=s.trim();if(!t)return null;
    var r=CX.size&&el?ctxFind(t,lang,el):null;
    if(r==null)r=lookup(t,lang);
    if(r==null)return null;
    var a=s.indexOf(t);
    return s.slice(0,a)+r+s.slice(a+t.length);
  }
  function inSkip(el){try{return !!(el&&el.closest&&el.closest(SKIP));}catch(_){return false;}}
  function setText(node,lang){
    var has=oText.has(node),orig=has?oText.get(node):node.nodeValue,v;
    if(lang==='ko'){ if(has&&node.nodeValue!==orig)node.nodeValue=orig; return; }
    v=trStr(orig,lang,node.parentNode);
    if(v==null){ if(has&&node.nodeValue!==orig)node.nodeValue=orig; return; }
    if(!has){ if(inSkip(node.parentNode))return; oText.set(node,orig); touched=true; }
    if(node.nodeValue!==v)node.nodeValue=v;
  }
  function expected(node,lang){
    if(!oText.has(node))return null;
    var orig=oText.get(node);
    return lang==='ko'?orig:(trStr(orig,lang,node.parentNode)||orig);
  }
  function attrOk(el,a){return a!=='label'||LABEL_TAGS[el.tagName]===1;}
  function setAttr(el,a,lang){
    var st=oAttr.get(el);
    if(!(st&&(a in st))){
      if(lang==='ko'||!el.hasAttribute(a)||!attrOk(el,a))return;
      var val=el.getAttribute(a);
      if(!HANGUL.test(val)||trStr(val,lang,el)==null)return;
      if(!st){st={};oAttr.set(el,st);}
      st[a]=val;touched=true;
    }
    var orig=st[a],v=lang==='ko'?orig:(trStr(orig,lang,el)||orig);
    if(el.getAttribute(a)!==v)el.setAttribute(a,v);
  }
  function setAttrs(el,lang){
    if(!el.getAttribute)return;
    if(lang==='ko'&&!oAttr.has(el))return;
    for(var i=0;i<ATTRS.length;i++)setAttr(el,ATTRS[i],lang);
  }
  /* 앱이 속성을 새로 썼다 — 적어 둔 원문을 새 값으로 바꾸거나(한글) 지운다(한글 아님) */
  function attrChanged(el,a,lang){
    var st=oAttr.get(el),v=el.getAttribute(a);
    if(st&&(a in st)){
      var exp=lang==='ko'?st[a]:(trStr(st[a],lang,el)||st[a]);
      if(v===exp)return;
      delete st[a];
    }
    if(v==null||!HANGUL.test(v))return;
    if(el.parentNode&&inSkip(el.parentNode))return;
    setAttr(el,a,lang);
  }
  function walk(root,lang){
    var d=root.nodeType===9?root:root.ownerDocument,top=root.nodeType===9?root.body:root;
    if(!top||!d||top.nodeType!==1)return;
    if(lang==='ko'&&!touched){frames(top);return;}
    if(top.parentNode&&inSkip(top.parentNode))return;
    var view=d.defaultView||win,NF=view.NodeFilter||win.NodeFilter;
    function skipSelf(n){try{return n.matches(SKIP);}catch(_){return false;}}
    setAttrs(top,lang);
    if(skipSelf(top))return;
    var w=d.createTreeWalker(top,NF.SHOW_ELEMENT|NF.SHOW_TEXT,{acceptNode:function(n){
      if(n.nodeType===3)return NF.FILTER_ACCEPT;
      if(skipSelf(n)){setAttrs(n,lang);return NF.FILTER_REJECT;}
      return NF.FILTER_ACCEPT;
    }},false);
    var n;
    while((n=w.nextNode())){
      if(n.nodeType===3)setText(n,lang);
      else{setAttrs(n,lang);if(n.tagName==='IFRAME')hookFrame(n);}
    }
    if(top.tagName==='IFRAME')hookFrame(top);
  }
  function frames(top){
    try{
      if(top.tagName==='IFRAME')hookFrame(top);
      var fs=top.querySelectorAll?top.querySelectorAll('iframe'):[];
      for(var i=0;i<fs.length;i++)hookFrame(fs[i]);
    }catch(_){}
  }
  function wrapDialogs(w){
    if(!w)return;
    ['alert','confirm','prompt'].forEach(function(fn){
      try{
        var nat=w[fn];
        if(!nat||nat.__cs)return;
        var f=function(msg,def){
          if(cur!=='ko'&&typeof msg==='string'){var t=trStr(msg,cur);if(t)msg=t;}
          return fn==='prompt'?nat.call(w,msg,def):nat.call(w,msg);
        };
        f.__cs=1;w[fn]=f;
      }catch(_){}
    });
  }
  function areaOfDoc(d){
    try{var m=String(d.location&&d.location.pathname||'').match(/([^\/]+\.html)$/);return m&&AREA_OF[m[1]]||'';}catch(_){return '';}
  }
  function setDocLang(d){
    try{var h=d.documentElement;if(h.getAttribute('lang')!==cur)h.setAttribute('lang',cur);if(h.getAttribute('data-ps-lang')!==cur)h.setAttribute('data-ps-lang',cur);}catch(_){}
  }
  function register(d,w){
    if(!d||!d.body||d.__csI18n)return;
    d.__csI18n=1;
    DOCS.push(d);
    w=w||d.defaultView;
    wrapDialogs(w);
    setDocLang(d);
    var area=d===doc?'':areaOfDoc(d);
    if(area&&PACK_LANGS[cur])need(area);
    try{walk(d,cur);}catch(_){}
    /* 감시자는 대상 문서의 창에서 만든다 — realm 이 다르면 observe() 가 Node 를 거부한다 */
    var MO=w&&w.MutationObserver,NodeCtor=w&&w.Node;
    if(!MO||!NodeCtor||!(d.body instanceof NodeCtor))return;
    var mo=new MO(function(muts){
      if(cur==='ko'&&!touched){
        for(var q=0;q<muts.length;q++){var an=muts[q].addedNodes;if(an)for(var z=0;z<an.length;z++)if(an[z].nodeType===1)frames(an[z]);}
        return;
      }
      for(var k=0;k<muts.length;k++){
        var m=muts[k];
        try{
          if(m.type==='characterData'){
            var nd=m.target,v=nd.nodeValue;
            if(nd.nodeType===3&&v!==expected(nd,cur)){oText.delete(nd);setText(nd,cur);}
          }else if(m.type==='attributes'){
            attrChanged(m.target,m.attributeName,cur);
          }else{
            for(var j=0;j<m.addedNodes.length;j++){
              var n2=m.addedNodes[j];
              if(n2.nodeType===3){ if(n2.nodeValue!==expected(n2,cur)){oText.delete(n2);setText(n2,cur);} }
              else if(n2.nodeType===1)walk(n2,cur);
            }
          }
        }catch(_){}
      }
    });
    try{mo.observe(d.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRS});d.__csI18nObserver=mo;}catch(_){}
  }
  function hookFrame(f){
    if(!f||f.__psI18nHook)return;
    f.__psI18nHook=1;
    f.addEventListener('load',function(){try{register(f.contentDocument,f.contentWindow);}catch(_){}});
    try{var d=f.contentDocument;if(d&&d.body&&d.body.childNodes.length)register(d,f.contentWindow);}catch(_){}
  }
  function alive(){
    DOCS=DOCS.filter(function(d){try{return !!d.defaultView;}catch(_){return false;}});
    return DOCS;
  }
  function applyAll(){
    try{doc.title='PROCESS STUDIO';}catch(_){}
    var list=alive();
    for(var i=0;i<list.length;i++){setDocLang(list[i]);try{walk(list[i],cur);}catch(_){}}
  }
  /* 영역 사전 받기 — 영어일 때만. 받으면 사전을 합치고 열린 화면을 다시 걷는다 */
  function need(area){
    if(!area||!PACK_LANGS[cur])return Promise.resolve(false);
    var id=cur+'-'+area;
    if(packs[id])return packs[id];
    packs[id]=new Promise(function(done){
      try{
        var s=doc.createElement('script');
        s.src=here+'i18n/'+id+'.js';s.async=false;s.setAttribute('data-ps-i18n',id);
        s.onload=function(){if(merge(true)&&started)applyAll();done(true);};
        s.onerror=function(){done(false);};
        (doc.head||doc.documentElement).appendChild(s);
      }catch(_){done(false);}
    });
    return packs[id];
  }
  function shellPacks(){
    if(!PACK_LANGS[cur])return Promise.resolve();
    var list=[need('common'),need('shell')];
    alive().forEach(function(d){var a=d===doc?'':areaOfDoc(d);if(a)list.push(need(a));});
    return Promise.all(list);
  }
  function markButtons(){
    var sw=doc.getElementById('langSw');
    if(sw)[].forEach.call(sw.children,function(b){var on=b.dataset.lang===cur;if(b.classList.contains('on')!==on)b.classList.toggle('on',on);});
  }
  function setLang(l){
    if(!LANGS.hasOwnProperty(l))return;
    var was=cur;cur=l;
    try{win.localStorage.setItem('cs_lang',l);}catch(_){}
    markButtons();
    merge();
    applyAll();
    shellPacks();
    if(was!==l){try{win.dispatchEvent(new win.CustomEvent('ps-lang',{detail:{lang:l}}));}catch(_){}}
  }
  var readyDone,ready=new Promise(function(r){readyDone=r;});
  function start(){
    if(started)return;
    started=true;
    merge();
    var sw=doc.getElementById('langSw');
    if(sw)sw.addEventListener('click',function(e){var b=e.target.closest('button');if(b)setLang(b.dataset.lang);});
    markButtons();
    register(doc,win);
    frames(doc.body);
    try{doc.title='PROCESS STUDIO';}catch(_){}
    readyDone(cur);
  }
  function boot(){
    if(!PACK_LANGS[cur]){start();return;}
    /* 영어: 셸 사전을 받은 뒤 첫 걸음(최대 1.5초 — 못 받으면 기본 사전으로 걷고, 받는 대로 다시 걷는다) */
    var t=win.setTimeout(start,1500);
    shellPacks().then(function(){win.clearTimeout(t);start();});
  }
  cur=initialLang();
  try{doc.documentElement.setAttribute('lang',cur);doc.documentElement.setAttribute('data-ps-lang',cur);}catch(_){}
  if(PACK_LANGS[cur]){need('common');need('shell');}
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot);else boot();

  win.PSI18n={
    lang:function(){return cur;},
    auto:function(){return auto;},
    set:setLang,
    /* 모듈이 글을 직접 바꿀 때(canvas · 파일 이름 등): 번역이 없으면 원문 */
    t:function(s){return trStr(String(s),cur)||String(s);},
    /* 재기용: 토막 일부만 바뀐 글은 «번역됨»으로 세지 않는다 */
    has:function(s,lang){merge();partial=false;var r=find(norm(s),lang||'en');return r!=null&&!partial;},
    register:register,
    refresh:function(){if(merge(true)&&started)applyAll();},
    need:need,
    ready:ready,
    packs:function(){return Object.keys(packs);},
    attrs:function(){return ATTRS.slice();},
    skip:SKIP
  };
})(window);

/* 3.280 — «프로필»(사용자 11/11 «프로필이라는 탭을 만들어서 간편하게 선수나 코치의 프로필을 만들 수 있게 · 커뮤니티 밑에 ·
   팀운영과 별개로 만들 수 있게 · 간단하게 출력할 수 있게»).
   팀 명단과 이어지지 않는 혼자 쓰는 도구: 이름과 몇 칸을 적으면 A4 한 장이 되고, «PDF · 인쇄»로 바로 뽑는다.
   · 종류 둘: 선수 · 코치(칸만 다르다 — FIELDS). 빈 칸은 종이에 나오지 않는다.
   · 저장: 이 기기에만(IndexedDB `ps_profiles_v1:<계정|guest>` — storage.js). 팀 자료 · 서버 · 동기화와 무관하다(새 동기화 키 없음).
     손댄 뒤 0.4초 · 탭 숨김에 적는다. 사진은 정사각 240px JPEG(photo-crop.js).
   · 뽑기: pdf-export.js 창(PDF 내려받기 · 인쇄) — 선수 문서 · 일정 PDF 와 같은 창. 종이는 검정 · 회색 · 가는 선(3.094 문서 결).
   글은 모두 esc 를 지나 종이 · 화면에 들어간다. 영상 주소는 http(s) 만 글자로 싣는다(링크 태그 없음). */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.PSProfileApp=api;var go=function(){api.mount(root);};if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',go);else go();}
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  var PREFIX='ps_profiles_v1:',MAX=200,PHOTO=240;
  var KIND={player:'선수',coach:'코치'};
  /* [키, 이름표, 모양(line 한 줄 · area 여러 줄), 도움말, 머리줄에 실을지] */
  var FIELDS={
    player:[['name','이름','line','예: 김서율'],['birth','생년월일','line','예: 2010. 3. 14.',1],['position','포지션','line','예: RB · 오른발',1],['body','키 · 몸무게','line','예: 172cm · 63kg',1],['number','등번호','line','예: 6'],
      ['team','소속','line','예: OO중학교 · OO FC',1],['strengths','장점','area','한 줄에 하나씩'],['improve','보완할 점','area','한 줄에 하나씩'],['career','경력 · 수상','area','예: 2025 전국대회 8강'],['video','경기 영상 주소','line','https://…'],['contact','연락처(선택)','line','적으면 종이에 나와요']],
    coach:[['name','이름','line','예: 이승기'],['birth','생년월일','line','예: 1985. 6. 2.',1],['role','직책','line','예: 감독 · GK 코치',1],['team','소속','line','예: OO중학교 · OO FC',1],
      ['license','자격증','area','예: AFC B · KFA 골키퍼 2급'],['coaching','지도 경력','area','한 줄에 하나씩'],['playing','선수 경력','area','한 줄에 하나씩'],['philosophy','지도 철학','area','한두 문장'],['contact','연락처(선택)','line','적으면 종이에 나와요']]
  };
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function lines(v){return String(v||'').split(/\r?\n/).map(function(s){return s.replace(/^\s*(?:\d+[.)]|[-•·])\s*/,'').trim();}).filter(Boolean);}
  function okPhoto(s){return typeof s==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s)?s:'';}
  function okUrl(s){s=String(s||'').trim();return /^https?:\/\/[^\s<>"']+$/i.test(s)?s:'';}
  function uid(){return 'pf'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
  function blank(kind){return {id:uid(),kind:kind==='coach'?'coach':'player',photo:'',f:{},updated:Date.now()};}
  /* 저장본 → 쓸 수 있는 목록(모르는 칸 · 깨진 값은 버린다) */
  function norm(raw){
    var d=null;try{d=typeof raw==='string'?JSON.parse(raw):raw;}catch(_){}
    var list=d&&Array.isArray(d.list)?d.list:[];
    return list.filter(function(p){return p&&typeof p==='object'&&(p.kind==='player'||p.kind==='coach')&&typeof p.id==='string';}).slice(0,MAX).map(function(p){
      var f={},src=p.f&&typeof p.f==='object'?p.f:{};FIELDS[p.kind].forEach(function(d){var v=src[d[0]];if(typeof v==='string'&&v)f[d[0]]=v.slice(0,d[2]==='area'?1200:160);});
      return {id:p.id.slice(0,40),kind:p.kind,photo:okPhoto(p.photo),f:f,updated:+p.updated||0};
    });
  }
  function pack(list){return JSON.stringify({v:1,list:list});}
  /* 채운 칸 수 / 전체(연락처는 선택이라 세지 않는다) */
  function progress(p){var defs=FIELDS[p.kind].filter(function(d){return d[0]!=='contact';}),n=defs.filter(function(d){return String(p.f[d[0]]||'').trim();}).length+(p.photo?1:0);return {done:n,total:defs.length+1};}
  function title(p){return String(p.f.name||'').trim()||('이름 없는 '+KIND[p.kind]);}
  function sub(p){return FIELDS[p.kind].filter(function(d){return d[4];}).map(function(d){return String(p.f[d[0]]||'').trim();}).filter(Boolean).join(' · ');}
  /* A4 한 장(794×1123) — 빈 칸은 싣지 않는다 */
  function sheet(p){
    var h='',num=p.kind==='player'&&String(p.f.number||'').trim();
    h+='<div class="pf-h">'+(p.photo?'<img class="pf-ph" alt="" src="'+esc(okPhoto(p.photo))+'">':'<div class="pf-ph pf-noph"></div>')
      +'<div class="pf-hd"><div class="pf-k">'+esc(KIND[p.kind])+' 프로필</div><div class="pf-n">'+esc(title(p))+(num?'<span class="pf-no">#'+esc(num)+'</span>':'')+'</div><div class="pf-s">'+esc(sub(p))+'</div></div></div>';
    FIELDS[p.kind].forEach(function(d){
      if(d[4]||d[0]==='name'||d[0]==='number')return;
      var v=String(p.f[d[0]]||'').trim();if(!v)return;
      if(d[0]==='video'){v=okUrl(v);if(!v)return;}
      var body=d[2]==='area'?'<ul>'+lines(v).map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>':'<p>'+esc(v)+'</p>';
      h+='<section class="pf-sec"><h3>'+esc(d[1].replace('(선택)',''))+'</h3>'+body+'</section>';
    });
    return '<div class="a4 pf-a4">'+h+'</div>';
  }
  var SHEET_CSS='.pf-a4{width:794px;min-height:1123px;box-sizing:border-box;padding:64px 64px 56px;background:#fff;color:#14161A;font-family:"Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo",sans-serif;font-size:14px;line-height:1.6}'
    +'.pf-h{display:flex;gap:24px;align-items:flex-end;padding-bottom:20px;border-bottom:2px solid #14161A;margin-bottom:26px}'
    +'.pf-ph{width:132px;height:132px;object-fit:cover;border:1px solid #C9CED6;flex:none;display:block}.pf-noph{background:#F1F3F6}'
    +'.pf-hd{min-width:0;flex:1}.pf-k{font-size:11px;letter-spacing:.14em;color:#6B7380;font-weight:700}.pf-n{font-size:34px;font-weight:800;letter-spacing:-.01em;line-height:1.2;margin-top:4px;overflow-wrap:anywhere}'
    +'.pf-no{font-size:18px;font-weight:700;color:#6B7380;margin-left:10px}.pf-s{font-size:14px;color:#3D4450;margin-top:8px;overflow-wrap:anywhere}'
    +'.pf-sec{margin:0 0 20px;break-inside:avoid}.pf-sec h3{margin:0 0 6px;font-size:11px;letter-spacing:.12em;color:#6B7380;font-weight:700;border-bottom:1px solid #D7DBE2;padding-bottom:5px}'
    +'.pf-sec p{margin:0;overflow-wrap:anywhere}.pf-sec ul{margin:0;padding:0;list-style:none}.pf-sec li{padding:3px 0;overflow-wrap:anywhere}';
  function docHTML(p){return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>'+esc(title(p))+'</title><style>html,body{margin:0;background:#fff}@page{size:A4;margin:0}'+SHEET_CSS+'</style></head><body>'+sheet(p)+'</body></html>';}
  function fileName(p){return (String(p.f.name||'').trim()||KIND[p.kind])+'_프로필';}

  var CSS=':root{--bg:#F1F2F4;--panel:#fff;--panel2:#F6F7F9;--line:#E3E6EA;--ink:#14161A;--ink2:#646A73;--navy:var(--ps-navy,#14213D);--font:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif}'
    +'body.fmdark{--bg:#121417;--panel:#161C25;--panel2:#1B2230;--line:#26313D;--ink:#F2F3F5;--ink2:#A7B1BE}'
    +'*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font);font-size:var(--t-5,14px);line-height:1.5;-webkit-font-smoothing:antialiased}'
    +'button{font:inherit;color:inherit;cursor:pointer}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid var(--navy);outline-offset:2px}'
    +'.pf-wrap{max-width:1280px;margin:0 auto;padding:18px 20px 60px}.pf-top{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px}'
    +'.pf-top h1{margin:0;font-size:var(--t-7,20px);font-weight:800}.pf-top .pf-lead{color:var(--ink2);font-size:var(--t-4,13px);flex:1 1 200px;min-width:0}'
    +'.pf-btn{min-height:40px;padding:0 14px;border:1px solid var(--line);border-radius:10px;background:var(--panel);font-weight:700;font-size:var(--t-4,13px);white-space:nowrap}'
    +'.pf-btn.pri{background:var(--navy);border-color:var(--navy);color:#fff}.pf-btn.warn{color:#B3261E}.pf-btn[disabled]{opacity:.5;cursor:default}'
    +'.pf-grid{display:grid;grid-template-columns:280px minmax(0,1fr) 340px;gap:16px;align-items:start}'
    +'.pf-list{background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden}.pf-seg{display:flex;gap:4px;padding:8px;border-bottom:1px solid var(--line);background:var(--panel2)}'
    +'.pf-seg button{flex:1;min-height:36px;border:0;border-radius:9px;background:none;font-weight:700;font-size:var(--t-4,13px);color:var(--ink2)}.pf-seg button.on{background:var(--panel);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.08)}'
    +'.pf-row{display:flex;gap:10px;align-items:center;width:100%;padding:10px 12px;border:0;border-bottom:1px solid var(--line);background:none;text-align:left}.pf-row:last-child{border-bottom:0}'
    +'.pf-row.on{background:color-mix(in srgb,var(--navy) 8%,transparent);box-shadow:inset 3px 0 0 var(--navy)}'
    +'.pf-av{width:38px;height:38px;border-radius:50%;background:var(--panel2);border:1px solid var(--line);display:grid;place-items:center;font-weight:800;color:var(--ink2);flex:none;overflow:hidden}.pf-av img{width:100%;height:100%;object-fit:cover;display:block}'
    +'.pf-rt{min-width:0;flex:1;display:block}.pf-rn,.pf-rs{display:block}.pf-rn{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pf-rs{font-size:var(--t-3,12px);color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    +'.pf-tag{flex:none;font-size:var(--t-2,11px);font-weight:700;padding:3px 8px;border-radius:99px;background:#FFF3D6;color:#8A5A00}.pf-tag.ok{background:#E7F5EC;color:#1E7B45}'
    +'.pf-empty{padding:28px 16px;text-align:center;color:var(--ink2);font-size:var(--t-4,13px)}'
    +'.pf-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}.pf-card h2{margin:0 0 12px;font-size:var(--t-6,16px);font-weight:800}'
    +'.pf-photo{display:flex;gap:12px;align-items:center;margin-bottom:14px}.pf-photo .pf-pv{width:84px;height:84px;border-radius:12px;background:var(--panel2);border:1px solid var(--line);overflow:hidden;display:grid;place-items:center;color:var(--ink2);font-weight:800;font-size:var(--t-8,24px);flex:none}.pf-pv img{width:100%;height:100%;object-fit:cover;display:block}'
    +'.pf-f{display:grid;grid-template-columns:104px minmax(0,1fr);gap:8px 12px;align-items:start}.pf-f label{color:var(--ink2);font-weight:600;font-size:var(--t-4,13px);padding-top:9px}'
    +'.pf-f input,.pf-f textarea{width:100%;font:inherit;color:inherit;background:var(--panel2);border:1px solid var(--line);border-radius:9px;padding:8px 11px;min-height:38px}.pf-f textarea{min-height:76px;resize:vertical}'
    +'.pf-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.pf-note{font-size:var(--t-3,12px);color:var(--ink2);margin-top:12px}'
    +'.pf-prev{position:sticky;top:12px}.pf-paper{border:1px solid var(--line);border-radius:6px;overflow:hidden;background:#fff;box-shadow:0 6px 18px rgba(0,0,0,.08);position:relative}'
    +'.pf-paper .pf-a4{transform-origin:0 0;position:absolute;left:0;top:0;height:1123px;overflow:hidden}'
    +'@media(max-width:1100px){.pf-grid{grid-template-columns:240px minmax(0,1fr)}.pf-prev{grid-column:1/-1;position:static;max-width:420px}}'
    +'@media(max-width:700px){.pf-wrap{padding:12px 12px 80px}.pf-grid{grid-template-columns:minmax(0,1fr)}.pf-f{grid-template-columns:minmax(0,1fr)}.pf-f label{padding-top:4px}.pf-top .pf-lead{flex-basis:100%;order:3}}'
    +SHEET_CSS;

  function mount(w){
    var d=w&&w.document,host=d&&d.getElementById('pfApp');if(!host||w.__psProfileApp)return null;
    var st=d.createElement('style');st.id='psProfileCss';st.textContent=CSS;(d.head||d.documentElement).appendChild(st);
    function account(){try{var s=JSON.parse(w.localStorage.getItem('ps_sync_session')||'null');return s&&typeof s.uid==='string'&&s.uid?s.uid:'guest';}catch(_){return 'guest';}}
    var acct=account(),KEY=PREFIX+acct,list=[],cur='',tab='player',loaded=false,timer=null,dirty=false,saving=Promise.resolve();
    function say(t){try{if(typeof w.toast==='function')w.toast(t);else{var o=d.getElementById('pfToast');if(!o){o=d.createElement('div');o.id='pfToast';o.setAttribute('role','status');o.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:50;background:rgba(18,22,30,.94);color:#fff;padding:10px 16px;border-radius:12px;font-weight:600;max-width:90vw';d.body.appendChild(o);}o.textContent=t;o.hidden=false;w.clearTimeout(o._t);o._t=w.setTimeout(function(){o.hidden=true;},2600);}}catch(_){}}
    function write(){
      if(!loaded||!dirty)return saving;dirty=false;var text=pack(list);
      saving=saving.catch(function(){}).then(function(){if(!w.storage||!w.storage.set)throw Error('storage');return w.storage.set(KEY,text);}).then(function(){w.__pfSavedAt=Date.now();return true;},function(){dirty=true;say('이 기기에 저장하지 못했어요 — 저장 공간을 확인해 주세요');return false;});
      return saving;
    }
    function touch(){dirty=true;w.clearTimeout(timer);timer=w.setTimeout(write,400);}
    function flush(){w.clearTimeout(timer);return write();}
    function get(id){for(var i=0;i<list.length;i++)if(list[i].id===id)return list[i];return null;}
    function shown(){return list.filter(function(p){return p.kind===tab;});}
    function el(tag,cls,text){var e=d.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
    host.innerHTML='<div class="pf-wrap"><div class="pf-top"><h1>프로필</h1><span class="pf-lead">선수 · 코치 프로필을 한 장으로 만들어 바로 뽑아요</span>'
      +'<button type="button" class="pf-btn" id="pfAddCoach">＋ 코치 프로필</button><button type="button" class="pf-btn pri" id="pfAddPlayer">＋ 선수 프로필</button></div>'
      +'<div class="pf-grid"><div class="pf-list"><div class="pf-seg" role="tablist"><button type="button" role="tab" data-tab="player"></button><button type="button" role="tab" data-tab="coach"></button></div><div id="pfRows"></div></div>'
      +'<div class="pf-card" id="pfForm"></div><div class="pf-prev" id="pfPrev"></div></div></div>';
    var rows=d.getElementById('pfRows'),form=d.getElementById('pfForm'),prev=d.getElementById('pfPrev');
    var pick=d.createElement('input');pick.type='file';pick.accept='image/*';pick.id='pfPhotoFile';pick.style.cssText='position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';d.body.appendChild(pick);
    function paintList(){
      [].forEach.call(host.querySelectorAll('.pf-seg button'),function(b){var k=b.getAttribute('data-tab'),n=list.filter(function(p){return p.kind===k;}).length;b.textContent=KIND[k]+' '+n;b.classList.toggle('on',k===tab);b.setAttribute('aria-selected',k===tab?'true':'false');});
      rows.textContent='';var arr=shown();
      if(!arr.length){rows.appendChild(el('div','pf-empty',loaded?('아직 '+KIND[tab]+' 프로필이 없어요 — 위의 «＋ '+KIND[tab]+' 프로필»로 시작하세요'):'불러오는 중…'));return;}
      arr.forEach(function(p){
        var b=el('button','pf-row'+(p.id===cur?' on':''));b.type='button';b.setAttribute('data-id',p.id);
        var av=el('span','pf-av');if(p.photo){var im=d.createElement('img');im.alt='';im.src=okPhoto(p.photo);av.appendChild(im);}else av.textContent=title(p).slice(0,1);
        var t=el('span','pf-rt');t.appendChild(el('span','pf-rn',title(p)));t.appendChild(el('span','pf-rs',[p.f.position||p.f.role,p.f.team].filter(Boolean).join(' · ')||KIND[p.kind]));
        var g=progress(p),tag=el('span','pf-tag'+(g.done>=g.total?' ok':''),g.done>=g.total?'완성':((g.total-g.done)+'칸 남음'));
        b.appendChild(av);b.appendChild(t);b.appendChild(tag);rows.appendChild(b);
      });
    }
    function paintPrev(){
      var p=get(cur);prev.textContent='';if(!p)return;
      var paper=el('div','pf-paper');paper.innerHTML=sheet(p);prev.appendChild(paper);
      var a4=paper.firstChild,k=paper.clientWidth/794;a4.style.transform='scale('+k+')';paper.style.height=Math.round(1123*k)+'px';
      var acts=el('div','pf-acts');var pr=el('button','pf-btn pri','PDF · 인쇄');pr.type='button';pr.id='pfPrint';acts.appendChild(pr);prev.appendChild(acts);
    }
    function paintForm(){
      var p=get(cur);form.textContent='';
      if(!p){form.appendChild(el('div','pf-empty',loaded?'왼쪽에서 프로필을 고르거나 새로 만들어 주세요':'불러오는 중…'));return;}
      form.appendChild(el('h2',null,KIND[p.kind]+' 프로필'));
      var ph=el('div','pf-photo'),pv=el('span','pf-pv');if(p.photo){var im=d.createElement('img');im.alt='';im.src=okPhoto(p.photo);pv.appendChild(im);}else pv.textContent=title(p).slice(0,1);
      var pb=el('button','pf-btn',p.photo?'사진 바꾸기':'사진 올리기');pb.type='button';pb.id='pfPhotoBtn';ph.appendChild(pv);ph.appendChild(pb);
      if(p.photo){var px=el('button','pf-btn','사진 빼기');px.type='button';px.id='pfPhotoDel';ph.appendChild(px);}
      form.appendChild(ph);
      var f=el('div','pf-f');
      FIELDS[p.kind].forEach(function(def){
        var id='pf_'+def[0],lb=el('label',null,def[1]);lb.setAttribute('for',id);
        var inp=d.createElement(def[2]==='area'?'textarea':'input');inp.id=id;inp.setAttribute('data-f',def[0]);inp.placeholder=def[3]||'';inp.value=p.f[def[0]]||'';inp.maxLength=def[2]==='area'?1200:160;if(def[2]!=='area')inp.type='text';
        if(def[0]==='video')inp.inputMode='url';f.appendChild(lb);f.appendChild(inp);
      });
      form.appendChild(f);
      var acts=el('div','pf-acts'),out=el('button','pf-btn pri pf-print','PDF · 인쇄'),dup=el('button','pf-btn','복제'),del=el('button','pf-btn warn','지우기');out.type=dup.type=del.type='button';dup.id='pfDup';del.id='pfDel';acts.appendChild(out);acts.appendChild(dup);acts.appendChild(del);form.appendChild(acts);
      form.appendChild(el('div','pf-note','이 기기에만 저장돼요 · 팀 명단과는 따로예요. 빈 칸은 종이에 나오지 않아요.'));
    }
    function paint(){paintList();paintForm();paintPrev();}
    function select(id){cur=id;var p=get(id);if(p)tab=p.kind;paint();}
    function add(kind){if(list.length>=MAX){say('프로필은 '+MAX+'개까지 만들 수 있어요');return;}var p=blank(kind);list.unshift(p);tab=p.kind;cur=p.id;touch();paint();var n=d.getElementById('pf_name');if(n)n.focus();}
    host.addEventListener('click',function(e){
      var t=e.target.closest('button');if(!t||!host.contains(t))return;
      if(t.id==='pfAddPlayer')return add('player');if(t.id==='pfAddCoach')return add('coach');
      if(t.hasAttribute('data-tab')){tab=t.getAttribute('data-tab');var a=shown();cur=a.length?a[0].id:'';return paint();}
      if(t.classList.contains('pf-row'))return select(t.getAttribute('data-id'));
      var p=get(cur);if(!p)return;
      if(t.id==='pfPhotoBtn')return pick.click();
      if(t.id==='pfPhotoDel'){p.photo='';p.updated=Date.now();touch();return paint();}
      if(t.id==='pfDup'){var c=blank(p.kind);c.photo=p.photo;c.f=JSON.parse(JSON.stringify(p.f));if(c.f.name)c.f.name=(c.f.name+' 사본').slice(0,160);list.splice(list.indexOf(p),0,c);cur=c.id;touch();return paint();}
      if(t.id==='pfDel'){if(t.getAttribute('data-sure')!=='1'){t.setAttribute('data-sure','1');t.textContent='정말 지울까요? 한 번 더';w.setTimeout(function(){if(t.isConnected){t.removeAttribute('data-sure');t.textContent='지우기';}},4000);return;}
        list.splice(list.indexOf(p),1);var a2=shown();cur=a2.length?a2[0].id:'';touch();paint();return say('프로필을 지웠어요');}
      if(t.id==='pfPrint'||t.classList.contains('pf-print')){flush();if(w.PSPdfExport&&typeof w.PSPdfExport.open==='function')return w.PSPdfExport.open({title:title(p)+' — PDF',html:docHTML(p),fname:fileName(p),land:false,note:false,pages:{sel:'.a4',land:function(){return false;}}});
        var pw=w.open('','_blank');if(pw){pw.document.write(docHTML(p));pw.document.close();pw.focus();pw.print();}}
    });
    /* 치는 중엔 칸을 다시 그리지 않는다(한글 조합이 끊긴다) — 목록 · 종이만 */
    form.addEventListener('input',function(e){var k=e.target&&e.target.getAttribute&&e.target.getAttribute('data-f'),p=get(cur);if(!k||!p)return;var v=e.target.value;if(v)p.f[k]=v;else delete p.f[k];p.updated=Date.now();touch();paintList();paintPrev();});
    pick.addEventListener('change',function(){
      var f=pick.files&&pick.files[0],p=get(cur);pick.value='';if(!f||!p)return;
      var r=new w.FileReader();r.onload=function(){
        var src=String(r.result||'');if(!/^data:image\//.test(src))return say('사진을 읽을 수 없어요');
        var done=function(out){out=okPhoto(out);if(!out||get(cur)!==p)return;p.photo=out;p.updated=Date.now();touch();paint();};
        if(w.PSPhotoCrop&&typeof w.PSPhotoCrop.open==='function')w.PSPhotoCrop.open({src:src,size:PHOTO,doc:d}).then(function(out){if(out)done(out);},function(){say('사진을 읽을 수 없어요');});
        else say('사진을 읽을 수 없어요');
      };r.onerror=function(){say('사진을 읽을 수 없어요');};r.readAsDataURL(f);
    });
    w.addEventListener('resize',paintPrev);
    w.addEventListener('pagehide',flush);d.addEventListener('visibilitychange',function(){if(d.visibilityState==='hidden')flush();});
    paint();
    Promise.resolve().then(function(){return w.storage&&w.storage.get?w.storage.get(KEY):null;}).then(function(v){list=norm(v&&v.value);},function(){list=[];}).then(function(){
      loaded=true;var a=shown();if(!a.length&&list.length){tab=list[0].kind;a=shown();}cur=a.length?a[0].id:'';paint();
    });
    var api={flush:flush,list:function(){return list;},key:KEY,loaded:function(){return loaded;}};
    w.__psProfileApp=api;w.psFlushPending=flush;return api;
  }
  return {mount:mount,norm:norm,pack:pack,sheet:sheet,docHTML:docHTML,progress:progress,blank:blank,lines:lines,okPhoto:okPhoto,okUrl:okUrl,title:title,sub:sub,FIELDS:FIELDS,PREFIX:PREFIX};
});

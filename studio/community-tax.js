/* PROCESS STUDIO — 커뮤니티 공통 분류(3.075 · 사용자 «E안으로 앱에 적용해줘 · 커뮤니티에 전부 적용해줘 다른 탭에도»).
   목업 E안: 경기 4국면 타일(공격 · 수비 전환 · 공격 전환 · 수비) + 경기 밖 주제 칩(세트피스 · 개인 기술 · 골키퍼 · 피지컬·웜업)
   + 연령 칩 + «오늘 인원» −/+(상관없음) + 카드를 누르면 미리보기 창(그림 · 훈련 · 오늘 인원 맞춤 · 재생 · 보관함에 담기).
   코치 자료 · 프로세스 · FIFA 가 같은 고르개를 쓴다. 엘미하는 고르개 없이 미리보기 창만(사용자 3.042 «엘미하는 분류 필요없고»).
   · 칸마다 원래 분류(코치 CATS 21종 · 프로세스 테마 · FIFA 묶음)는 그대로 두고 여기서 새 주제 8개 · 연령 · 인원으로 옮긴다(fromCoach · fromProc · fromFifa).
   · 연령을 모르는 글은 연령 고르개에 걸리지 않는다(보인다). 인원을 모르는 글도 같다.
   · 화면에 쓰는 글은 textContent 로만. 그림은 <img src> 로만(코치 글 그림은 커뮤니티가 정리한 thumbImg 의 HTML 을 받는다). */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSCommTax=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  /* [키, 이름, 색, 짧은 설명] — 앞 넷이 경기의 네 국면(공격 → 잃으면 수비 전환 → 수비 → 얻으면 공격 전환) */
  var TOPICS=[['att','공격','#3A6DF0','공을 가졌을 때'],['trd','수비 전환','#C2573F','잃은 순간'],['tra','공격 전환','#2E9E6B','빼앗은 순간'],['def','수비','#5B6B8C','공이 없을 때'],
    ['set','세트피스','#2A8FA6',''],['tech','개인 기술','#7A5BC0',''],['gk','골키퍼','#A07C12',''],['phys','피지컬·웜업','#B0582A','']];
  var PHASES=['att','trd','tra','def'],EXTRAS=['set','tech','gk','phys'];
  var AGES=['U8','U10','U12','U15','U18','성인'];
  var TMAP={}; TOPICS.forEach(function(t){ TMAP[t[0]]=t; });
  /* 코치 자료 CATS(21종) → 새 주제. 경기 분석(match)은 주제가 없다(«전체»에서만 보인다) */
  var COACH={idp:'tech',warm:'phys',rondo:'att',poss:'att',posgame:'att',ssg:'att',game:'att',pass:'tech',control:'tech',dribble:'tech',shoot:'tech',cross:'att',
    tech:'tech',attack:'att',defend:'def',buildup:'att',trans:'tra',set:'set',gk:'gk',phys:'phys',fun:'tech'};
  /* 작전판 FOCUS → 새 주제(FIFA 애니메이션 팩 · 보관함 카드) */
  var FOCUS={bp:'att',poss:'att',bpo:'def',tr_att:'tra',tr_def:'trd',set:'set',tech:'tech',phys:'phys',warm:'phys',rec:'phys'};
  /* 프로세스 세션의 훈련 인원(판 위 선수 수: 가장 적은 훈련 ~ 가장 많은 훈련) — studio/packs 사본에서 셌다(3.075). 목록에 없는 새 세션은 인원 모름 */
  var PROC_PL={2:[6,13],3:[4,14],4:[7,14],5:[3,12],6:[4,14],7:[4,9],8:[9,15],9:[8,15],10:[5,12],11:[8,12],12:[5,14],13:[9,14],14:[4,12],15:[8,14],16:[6,14],17:[10,14],18:[6,14],
    19:[3,12],20:[4,14],21:[8,14],22:[7,13],23:[6,10],24:[6,13],25:[10,16],26:[3,14],27:[5,14],28:[7,14],29:[5,16],30:[7,13],31:[8,16],32:[5,13],33:[7,16],34:[4,9],35:[5,10],
    36:[3,9],37:[5,14],38:[4,10],39:[9,13],40:[5,14],41:[7,14],42:[12,14],43:[8,16],44:[5,14],45:[6,16],46:[6,13]};
  var ELITE=['U15','U18','성인'];
  /* 3.079 — 세부 국면(사용자 «세부 국면도 선택할 수 있게»). 작전판 편집기의 경기 국면 기본 골격(board.html EP_STD_MOMENTS)과 같은 id · 이름이라
     보관함에 담으면 편집기의 경기 국면 칩이 그대로 켜진다. [id, 짧은 이름]. 큰 국면 이름은 MOM(작전판 gmPhaseNames 의 «국면 › 세부» 앞쪽) */
  var SUBS={att:[['std_ao_1','빌드업'],['std_ao_2','전진 · 전개'],['std_ao_3','침투 · 마무리']],def:[['std_do_1','전방 압박'],['std_do_2','미드 블록'],['std_do_3','로우 블록']],
    trd:[['std_dt_1','즉시 반응 (역압박)'],['std_dt_2','후퇴 · 재정비']],tra:[['std_at_1','빠른 역습'],['std_at_2','점유 안정화']],set:[['std_set_1','공격 세트피스'],['std_set_2','수비 세트피스']]};
  var MOM={att:'공격 조직',def:'수비 조직',trd:'공격 → 수비 전환',tra:'수비 → 공격 전환',set:'세트피스'};
  var SUBMAP={}; Object.keys(SUBS).forEach(function(t){ SUBS[t].forEach(function(x){ SUBMAP[x[0]]={topic:t,name:x[1],full:MOM[t]+' › '+x[1]}; }); });
  /* 세부 국면 읽기 — std id 그대로, 아니면 «국면 › 세부» 이름(팀 게임모델로 고른 훈련도 이름이 같으면 맞춘다) */
  function subsOf(ids,names){
    var out=[]; (Array.isArray(ids)?ids:[]).forEach(function(k){ if(SUBMAP[k]&&out.indexOf(k)<0)out.push(k); });
    (Array.isArray(names)?names:[]).forEach(function(nm){ var tail=String(nm||'').split(' › ').pop().trim();
      Object.keys(SUBMAP).forEach(function(k){ if((SUBMAP[k].full===nm||SUBMAP[k].name===tail)&&out.indexOf(k)<0)out.push(k); }); });
    return out.slice(0,4);
  }
  /* 프로세스 세션 n → 세부 국면(레터의 테마 «국면 › 주제»에서 골랐다 · 훈련 설계 · 피지컬 · 경기 준비 · 소통은 없음) */
  var PROC_SUB={2:['ao_1'],3:['ao_2'],4:['dt_1'],5:['ao_2'],6:['set_1'],7:['ao_3'],8:['at_1'],9:['do_2'],10:['ao_2'],11:['do_2'],12:['ao_3'],13:['ao_3'],14:['ao_2'],15:['ao_2'],
    16:['ao_2'],17:['do_1'],20:['do_3'],23:['ao_3'],24:['do_1'],26:['ao_2'],28:['ao_1'],29:['ao_3'],30:['ao_2'],31:['ao_1','ao_3'],33:['ao_1'],36:['do_3'],37:['dt_2'],
    39:['ao_1'],40:['ao_2','ao_3'],41:['ao_3'],42:['ao_2'],43:['ao_1'],44:['set_1'],45:['ao_1'],46:['do_3']};

  function num(v){ v=parseInt(v,10); return v>0&&v<200?v:0; }
  function uniq(a){ var o=[]; a.forEach(function(x){ if(x&&o.indexOf(x)<0)o.push(x); }); return o; }
  function item(topics,ages,min,max,subs){ var sb=subsOf(subs),tp=uniq((topics||[]).concat(sb.map(function(k){ return SUBMAP[k].topic; })));
    var it={topics:tp,ages:(ages&&ages.length)?uniq(ages):null,min:num(min),max:num(max)||num(min)}; if(sb.length)it.subs=sb; return it; }
  function fromCoach(p,keysOf){
    var ks=keysOf(p&&p.cat),ag=keysOf(p&&p.age).filter(function(a){ return AGES.indexOf(a)>=0; }),n=num(p&&p.players);
    if(!ks.length&&p&&p.item&&FOCUS[p.item.focus])ks=[p.item.focus];
    var it=p&&p.item,sb=ks.filter(function(k){ return SUBMAP[k]; });   /* 3.079 — 올릴 때 cat 에 세부 국면 id 도 적는다(목록에는 item 이 없다) */
    if(!sb.length&&it)sb=subsOf(it.gmPhases,it.gmPhaseNames);
    return item(ks.map(function(k){ return COACH[k]||FOCUS[k]||''; }),ag,n,n,sb);
  }
  function fromProc(s){
    var h=String(s&&s.head||String(s&&s.theme||'').split(' › ')[0]).trim(),t='';
    if(h.indexOf('공격 → 수비')===0)t='trd'; else if(h.indexOf('수비 → 공격')===0)t='tra'; else if(h.indexOf('전환')>=0)t='tra';
    else if(h==='공격 조직')t='att'; else if(h==='수비 조직')t='def'; else if(h==='세트피스')t='set';
    else if(h==='피지컬'||h==='경기 준비')t='phys'; else if(h==='훈련 설계')t='tech';
    var pl=PROC_PL[s&&s.n]||[0,0];
    return item([t],['U12','U15','U18','성인'],pl[0],pl[1],(PROC_SUB[s&&s.n]||[]).map(function(k){ return 'std_'+k; }).filter(function(k){ return SUBMAP[k].topic===t; }));   /* 세션 번호 표와 테마가 어긋나면(다른 레터 사본) 세부 국면을 붙이지 않는다 */   /* 프로세스 레터는 U12~성인 팀을 두고 쓴 세션이다 */
  }
  /* FIFA 줄(e: community-fifa.js list 의 한 줄) + 애니메이션 목록 줄(an: 있으면 focus · players) */
  function fifaAges(e){
    var g=e&&e.g,ko=String(e&&e.ko||'');
    if(g==='u8')return ['U8']; if(g==='u12')return ['U10','U12']; if(g==='u15')return ['U12','U15'];
    if(g==='yb'){ if(ko.indexOf('4–8세')===0)return ['U8']; if(ko.indexOf('8–12세')===0)return ['U10','U12']; if(ko.indexOf('12–15세')===0)return ['U12','U15']; return ['U8','U10','U12','U15']; }
    if(g==='yc')return ['U8','U10','U12','U15'];
    return ELITE;
  }
  var FIFA_G={att:'att',def:'def',tra:'tra',trd:'trd',gk:'gk',phys:'phys',club:'att',view:'att',fs:'att',u8:'tech',u12:'tech',u15:'tech',yb:'tech',yc:'tech'};
  function fromFifa(e,an){
    var t=(an&&FOCUS[an.focus])||FIFA_G[e&&e.g]||'';
    var pl=(an&&Array.isArray(an.players))?an.players:[0,0];
    return item([t],fifaAges(e),pl[0],pl[1],an&&an.subs);
  }

  /* 고르개 상태 — 이 탭(창)에서만. 인원은 처음엔 «상관없음» */
  var S={topic:'',sub:'',age:'',n:12,any:true};
  function state(){ return {topic:S.topic,sub:S.sub,age:S.age,n:S.n,any:S.any}; }
  function set(o){ o=o||{}; if('topic' in o){ S.topic=TMAP[o.topic]?o.topic:''; if(!SUBMAP[S.sub]||SUBMAP[S.sub].topic!==S.topic)S.sub=''; }
    if('sub' in o){ S.sub=SUBMAP[o.sub]?o.sub:''; if(S.sub)S.topic=SUBMAP[S.sub].topic; }
     if('age' in o)S.age=AGES.indexOf(o.age)>=0?o.age:'';
    if('n' in o){ var n=Math.floor(+o.n); S.n=Math.max(1,Math.min(30,isFinite(n)?n:12)); } if('any' in o)S.any=!!o.any; }
  function okAgePl(it){
    if(S.age&&it.ages&&it.ages.indexOf(S.age)<0)return false;
    if(!S.any&&it.min&&it.min>S.n)return false;
    return true;
  }
  function ok(it){ if(!it)return true; if(S.topic&&it.topics.indexOf(S.topic)<0)return false; if(S.sub&&(it.subs||[]).indexOf(S.sub)<0)return false; return okAgePl(it); }   /* 세부 국면을 고르면 그 표시가 있는 글만 */
  /* 카드의 «오늘 인원» 맞춤 — 인원을 고르지 않았거나 모르면 없음 */
  function fit(it){
    if(S.any||!it||!it.min)return null;
    var mx=it.max||it.min;
    return mx<=S.n?{text:'오늘 인원으로 전부 할 수 있어요',kind:'ok'}:{text:'마지막 훈련은 '+mx+'명 — 줄여서 진행',kind:'warn'};
  }
  function counts(items){ var c={}; (items||[]).forEach(function(it){ if(!okAgePl(it))return; it.topics.concat(it.subs||[]).forEach(function(k){ c[k]=(c[k]||0)+1; }); }); return c; }

  function el(doc,tag,cls,text){ var x=doc.createElement(tag); if(cls)x.className=cls; if(text!=null)x.textContent=text; return x; }
  function dot(doc,color){ var d=el(doc,'span','tx-dot'); d.setAttribute('aria-hidden','true'); d.style.background=color; return d; }
  function badge(host,it){
    if(!host)return; var f=fit(it),old=host.querySelector('.tx-fit'); if(old)old.remove(); if(!f)return;
    host.appendChild(el(host.ownerDocument,'span','tx-fit tx-fit-'+f.kind,f.text));
  }
  function topicBadge(doc,k){ var t=TMAP[k]; if(!t)return null; var b=el(doc,'span','tx-topic',t[1]); b.style.background=t[2]; return b; }

  /* 고르개 — host 를 비우고 다시 그린다. items: 지금 칸의 글들(fromX 결과) — 타일 옆 숫자. onChange: 고른 것이 바뀌면 */
  function draw(host,items,onChange){
    if(!host)return; var doc=host.ownerDocument,c=counts(items),ch=function(o){ set(o); if(onChange)onChange(); };
    /* 폰에서는 줄마다 옆으로 밀어 본다 — 칩을 눌러 다시 그려도 민 자리를 지킨다(끝의 U18 을 누르면 그 칩이 그대로 보이게) */
    var sx={}; [].forEach.call(host.querySelectorAll('[data-sx]'),function(r){ sx[r.getAttribute('data-sx')]=r.scrollLeft; });
    host.textContent='';
    var ph=el(doc,'div','tx-phases'); ph.setAttribute('role','group'); ph.setAttribute('aria-label','경기 국면');
    PHASES.forEach(function(k){ var t=TMAP[k],on=S.topic===k,b=el(doc,'button','tx-tile'+(on?' on':'')); b.type='button'; b.setAttribute('aria-pressed',on?'true':'false');
      if(on){ b.style.background=t[2]; b.style.borderColor=t[2]; }
      var top=el(doc,'span','tx-tile-top'); top.appendChild(dot(doc,on?'#fff':t[2])); top.appendChild(el(doc,'span','tx-tile-nm',t[1])); top.appendChild(el(doc,'span','tx-n',String(c[k]||0)));
      b.appendChild(top); b.appendChild(el(doc,'span','tx-tile-hint',t[3]));
      b.onclick=function(){ ch({topic:on?'':k}); }; ph.appendChild(b); });
    host.appendChild(ph);
    var ex=el(doc,'div','tx-row'); ex.setAttribute('data-sx','ex'); ex.setAttribute('role','group'); ex.setAttribute('aria-label','경기 밖의 주제');
    EXTRAS.forEach(function(k){ var t=TMAP[k],on=S.topic===k,b=el(doc,'button','tx-chip'+(on?' on':'')); b.type='button'; b.setAttribute('aria-pressed',on?'true':'false');
      if(on){ b.style.background=t[2]; b.style.borderColor=t[2]; }
      b.appendChild(dot(doc,on?'#fff':t[2])); b.appendChild(doc.createTextNode(t[1])); b.appendChild(el(doc,'span','tx-n',String(c[k]||0)));
      b.onclick=function(){ ch({topic:on?'':k}); }; ex.appendChild(b); });
    host.appendChild(ex);
    if(SUBS[S.topic]){   /* 3.079 — 고른 국면의 세부 국면 */
      var t0=TMAP[S.topic],sr=el(doc,'div','tx-row tx-subs'); sr.setAttribute('data-sx','sub:'+S.topic); sr.setAttribute('role','group'); sr.setAttribute('aria-label',t0[1]+' 세부 국면');
      sr.appendChild(el(doc,'span','tx-lb','세부 국면'));
      SUBS[S.topic].forEach(function(x){ var on=S.sub===x[0],b=el(doc,'button','tx-chip'+(on?' on':'')); b.type='button'; b.setAttribute('aria-pressed',on?'true':'false');
        if(on){ b.style.background=t0[2]; b.style.borderColor=t0[2]; }
        b.appendChild(doc.createTextNode(x[1])); b.appendChild(el(doc,'span','tx-n',String(c[x[0]]||0)));
        b.onclick=function(){ ch({sub:on?'':x[0]}); }; sr.appendChild(b); });
      host.appendChild(sr);
    }
    var who=el(doc,'div','tx-who'); who.setAttribute('data-sx','who');
    var ag=el(doc,'div','tx-row'); ag.setAttribute('role','group'); ag.setAttribute('aria-label','연령');
    ag.appendChild(el(doc,'span','tx-lb','연령'));
    AGES.forEach(function(a){ var on=S.age===a,b=el(doc,'button','tx-chip'+(on?' on':''),a); b.type='button'; b.setAttribute('aria-pressed',on?'true':'false');
      b.onclick=function(){ ch({age:on?'':a}); }; ag.appendChild(b); });
    who.appendChild(ag);
    var pl=el(doc,'div','tx-row tx-pl'); pl.setAttribute('role','group'); pl.setAttribute('aria-label','오늘 인원');
    pl.appendChild(el(doc,'span','tx-lb','오늘 인원'));
    var mi=el(doc,'button','tx-step','−'); mi.type='button'; mi.setAttribute('aria-label','한 명 빼기'); mi.onclick=function(){ ch({any:false,n:S.any?S.n:S.n-1}); };
    var nv=el(doc,'span','tx-nv',S.any?'—':(S.n+'명')); nv.setAttribute('aria-live','polite');
    var pv=el(doc,'button','tx-step','+'); pv.type='button'; pv.setAttribute('aria-label','한 명 더하기'); pv.onclick=function(){ ch({any:false,n:S.any?S.n:S.n+1}); };
    var an=el(doc,'button','tx-chip'+(S.any?' on':''),'상관없음'); an.type='button'; an.setAttribute('aria-pressed',S.any?'true':'false'); an.onclick=function(){ ch({any:!S.any}); };
    [mi,nv,pv,an].forEach(function(x){ pl.appendChild(x); });
    who.appendChild(pl);
    host.appendChild(who);
    [].forEach.call(host.querySelectorAll('[data-sx]'),function(r){ var v=sx[r.getAttribute('data-sx')]; if(v)r.scrollLeft=v; });
  }

  /* 미리보기 창 — o = {title, topic(키), item, by, thumbUrl | thumbHtml(정리된 HTML), trainings:[{name,minutes}], desc, onPlay(k), onSave(), saveLabel} */
  var SHEET=null;
  function close(){ if(SHEET){ try{ SHEET.doc.removeEventListener('keydown',SHEET.key); }catch(_){} SHEET.node.remove(); var f=SHEET.focus; SHEET=null; try{ if(f&&f.focus)f.focus(); }catch(_){} } }
  function open(doc,o){
    close(); o=o||{};
    var trs=Array.isArray(o.trainings)?o.trainings:[],mask=el(doc,'div','tx-mask'),k=(o.k>0&&o.k<trs.length)?Math.floor(o.k):0;   /* 카드에서 고른 훈련부터 */
    var aside=el(doc,'aside','tx-sheet'); aside.setAttribute('role','dialog'); aside.setAttribute('aria-modal','true'); aside.setAttribute('aria-label',(o.title||'')+' 미리보기');
    var hd=el(doc,'div','tx-sh-hd'),hl=el(doc,'div','tx-sh-hl'),bg=el(doc,'div','tx-row');
    var tb=topicBadge(doc,o.topic); if(tb)bg.appendChild(tb);
    if(o.form)bg.appendChild(el(doc,'span','tx-form',o.form));
    ((o.item&&o.item.subs)||[]).forEach(function(k){ if(SUBMAP[k]&&SUBMAP[k].name!==o.form)bg.appendChild(el(doc,'span','tx-form',SUBMAP[k].name)); });
    hl.appendChild(bg); hl.appendChild(el(doc,'h2','tx-sh-tt',o.title||''));
    var it=o.item||null,meta=[];
    if(it&&it.ages)meta.push('연령 '+(it.ages.length>1?it.ages[0]+'~'+it.ages[it.ages.length-1]:it.ages[0]));
    if(it&&it.min)meta.push('인원 '+(it.max&&it.max!==it.min?it.min+'~'+it.max:it.min)+'명');
    if(o.by)meta.push(o.by);
    if(meta.length)hl.appendChild(el(doc,'span','tx-sh-meta',meta.join(' · ')));
    var x=el(doc,'button','tx-x','×'); x.type='button'; x.setAttribute('aria-label','닫기'); x.onclick=close;
    hd.appendChild(hl); hd.appendChild(x); aside.appendChild(hd);
    var pic=el(doc,'div','tx-sh-pic');
    var img=null;
    if(o.thumbUrl){ img=el(doc,'img'); img.alt=''; img.decoding='async'; img.referrerPolicy='no-referrer'; img.src=typeof o.thumbUrl==='function'?o.thumbUrl(k+1):o.thumbUrl; pic.appendChild(img); }
    else if(o.thumbHtml)pic.innerHTML=o.thumbHtml;   /* 커뮤니티의 thumbImg(정리한 SVG 를 <img src="data:"> 로) 결과만 */
    aside.appendChild(pic);
    if(trs.length){
      var tl=el(doc,'div','tx-sh-trs'); tl.setAttribute('role','group'); tl.setAttribute('aria-label','훈련');
      var mark=function(){ [].forEach.call(tl.children,function(b,j){ b.setAttribute('aria-pressed',j===k?'true':'false'); b.classList.toggle('on',j===k); });
        if(img&&typeof o.thumbUrl==='function')img.src=o.thumbUrl(k+1); };
      trs.forEach(function(t,j){ var b=el(doc,'button','tx-tr'); b.type='button';
        b.appendChild(el(doc,'span','tx-i',String(j+1))); b.appendChild(el(doc,'span','tx-tr-nm',t&&t.name||('훈련 '+(j+1)))); b.appendChild(el(doc,'span','tx-tr-mn',t&&t.minutes?t.minutes+'분':''));
        b.onclick=function(){ k=j; mark(); }; tl.appendChild(b); });
      aside.appendChild(tl); mark();
    }
    if(o.desc)aside.appendChild(el(doc,'p','tx-sh-desc',o.desc));
    var f=fit(it); if(f)aside.appendChild(el(doc,'span','tx-fit tx-fit-'+f.kind,f.text));
    var act=el(doc,'div','tx-sh-act');
    var play=el(doc,'button','tx-btn','▶ 크게 재생'); play.type='button'; play.onclick=function(){ var kk=k; close(); if(o.onPlay)o.onPlay(kk); };
    act.appendChild(play);
    if(o.onSave){ var sv=el(doc,'button','tx-btn tx-btn-pri',o.saveLabel||'보관함에 담기'); sv.type='button'; sv.onclick=function(){ close(); o.onSave(); }; act.appendChild(sv); }
    aside.appendChild(act);
    mask.appendChild(aside);
    mask.addEventListener('click',function(e){ if(e.target===mask)close(); });
    var key=function(e){ if(e.key==='Escape')close(); };
    doc.addEventListener('keydown',key);
    (doc.body||doc.documentElement).appendChild(mask);
    SHEET={node:mask,doc:doc,key:key,focus:doc.activeElement};
    try{ x.focus(); }catch(_){}
  }
  /* 3.076 — 훈련 만들기 ↔ 커뮤니티를 한 표로(사용자 «훈련만들기와 잘 연동이 되어야 해 · 둘이 잘 맞추고 싶어»).
     작전판 훈련의 성격(FOCUS 10가지)은 운동량 · 일정에 쓰이니 그대로 두고, 커뮤니티 주제 8개와는 이 표 하나로만 오간다.
     · 올릴 때 주제는 작전판 키로 적는다(TO_CAT) — 예전 글 표시(catOf 의 국면 키 호환) · fromCoach 가 그대로 읽는다
     · 담을 때는 거꾸로(focusOfPost) — 보관함에는 언제나 작전판이 아는 키만 들어간다 */
  var TO_CAT={att:'bp',def:'bpo',tra:'tr_att',trd:'tr_def',set:'set',tech:'tech',gk:'gk',phys:'phys'};
  var TO_FOCUS={att:'bp',def:'bpo',tra:'tr_att',trd:'tr_def',set:'set',tech:'tech',gk:'tech',phys:'phys'};
  function keys(s){ return String(s==null?'':s).split(',').map(function(x){ return x.trim(); }).filter(Boolean); }
  function topicOf(k){ return FOCUS[k]||COACH[k]||(TMAP[k]?k:''); }
  /* 커뮤니티 글(p.cat) → 보관함의 훈련 성격. 작전판 키가 있으면 그대로, 없으면 주제를 거꾸로. 모르면 기술(옛 기본값) */
  function focusOfPost(p){
    var it=p&&p.item; if(it&&FOCUS[it.focus])return it.focus;
    var ks=keys(p&&p.cat),i,t,gk=false;
    for(i=0;i<ks.length;i++){ if(FOCUS[ks[i]])return ks[i]; t=topicOf(ks[i]); if(t==='gk')gk=true; else if(t)return TO_FOCUS[t]; }
    return gk?TO_FOCUS.gk:'tech';
  }
  /* 보관함 훈련 → 커뮤니티 주제 제안(작전판 성격 + 판에 골키퍼가 있으면 골키퍼는 묻지 않는다 — 골키퍼 훈련인지는 코치가 안다) */
  function topicsOfDrill(d){ var t=d&&FOCUS[d.focus]; var a=t?[t]:[]; (Array.isArray(d&&d.topics)?d.topics:[]).forEach(function(k){ if(TMAP[k]&&a.indexOf(k)<0)a.push(k); }); return a; }
  /* 판 위 선수 수 — 훈련이 여럿이면 가장 많은 훈련(그 인원이면 전부 할 수 있다) */
  function headcount(d){
    var n=function(sn){ return (sn&&Array.isArray(sn.players))?sn.players.length:0; },m=n(d&&d.snap);
    (Array.isArray(d&&d.trainings)?d.trainings:[]).forEach(function(t){ var fr=Array.isArray(t&&t.frames)&&t.frames[0]; m=Math.max(m,n(t&&t.snap),n(fr&&fr.snap)); });
    return m;
  }
  /* 올리기 창의 주제 · 연령 · 인원 — 커뮤니티 고르개와 같은 이름 · 순서. fill(d) 는 고른 훈련에서 미리 채운다(코치는 확인만) */
  function upForm(doc,o){
    var tp=[],ag=[],sb=[],pl=o&&o.pl;
    function chips(host,list,sel,label){
      if(!host)return function(){};
      var bs=list.map(function(k){ var b=el(doc,'button','',label(k)); b.type='button'; b.dataset.k=k;
        b.onclick=function(){ var i=sel.indexOf(k); if(i>=0)sel.splice(i,1); else sel.push(k); mark(); }; host.appendChild(b); return b; });
      function mark(){ bs.forEach(function(b){ var on=sel.indexOf(b.dataset.k)>=0; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); }); }
      mark(); return mark;
    }
    var mS=chips(o&&o.subs,Object.keys(SUBMAP),sb,function(k){ return SUBMAP[k].name; });
    /* 세부 국면 칩은 고른 주제의 것만 보인다 — 주제를 빼면 그 세부 국면도 빠진다 */
    function vis(){ if(!o||!o.subs)return; for(var i=sb.length-1;i>=0;i--)if(tp.indexOf(SUBMAP[sb[i]].topic)<0)sb.splice(i,1);
      [].forEach.call(o.subs.children,function(b){ var v=tp.indexOf(SUBMAP[b.dataset.k].topic)>=0; if(v)b.style.removeProperty('display'); else b.style.setProperty('display','none'); });
      if(o.subs.parentNode&&o.subs.parentNode.style)o.subs.parentNode.style[tp.some(function(k){ return SUBS[k]; })?'removeProperty':'setProperty']('display','none'); mS(); }
    var mT0=chips(o&&o.topics,PHASES.concat(EXTRAS),tp,function(k){ return TMAP[k][1]; }),mT=function(){ mT0(); vis(); },mA=chips(o&&o.ages,AGES,ag,function(a){ return a; });
    if(o&&o.topics)[].forEach.call(o.topics.children,function(b){ var f=b.onclick; b.onclick=function(){ f(); vis(); }; });
    vis();
    return {
      fill:function(d){
        var ds=subsOf(d&&d.gmPhases,d&&d.gmPhaseNames);
        if(!tp.length){ topicsOfDrill(d).concat(ds.map(function(k){ return SUBMAP[k].topic; })).forEach(function(k){ if(tp.indexOf(k)<0)tp.push(k); }); mT(); }
        if(!sb.length){ ds.forEach(function(k){ if(tp.indexOf(SUBMAP[k].topic)>=0)sb.push(k); }); vis(); }
        if(!ag.length&&Array.isArray(d&&d.ages)){ d.ages.forEach(function(a){ if(AGES.indexOf(a)>=0&&ag.indexOf(a)<0)ag.push(a); }); mA(); }
        var h=headcount(d); if(pl&&!pl.value&&h)pl.value=String(h);
      },
      get:function(){ return {topics:tp.slice(),subs:sb.slice(),subNames:sb.map(function(k){ return SUBMAP[k].full; }),cat:tp.map(function(k){ return TO_CAT[k]; }).concat(sb).join(','),ages:ag.slice(),age:ag.join(','),players:String(pl&&pl.value||'').replace(/[^0-9]/g,'')}; }
    };
  }
  /* 옛 고르개(주제 칩 · 콘텐츠 유형 · 연령 · 인원 · 폰 필터 시트의 같은 칸)를 감춘다 — 새 고르개가 대신한다. 정렬 · 검색 · 보기 방식은 그대로 */
  function hideOld(doc,noNav){
    var hide=function(n){ if(n&&n.style)n.style.setProperty('display','none','important'); };
    /* 3.081 — 폰의 «필터» 단추는 이제 정렬만 연다(유형 · 연령 · 인원은 위의 고르개로) — 이름을 맞춘다 */
    var fb=doc.getElementById('commFiltBtn'); if(fb&&fb.firstChild&&fb.firstChild.nodeType===3&&fb.firstChild.nodeValue!=='정렬'){ fb.firstChild.nodeValue='정렬'; fb.setAttribute('aria-label','정렬'); }
    var nav=doc.querySelector('.comm-nav'); if(nav){ if(noNav)hide(nav); else nav.style.removeProperty('display'); }   /* 정렬(탐색)만 남는 코치 자료 칸 밖에서는 왼쪽 칸이 빈다 */
    [].forEach.call(doc.querySelectorAll('.comm-nav .pr-cat-sec,#ageSel,#plSel,#cfTypeSel'),hide);
    var tn=doc.getElementById('typeNav'); if(tn&&tn.closest)hide(tn.closest('.nav-sec'));
    [].forEach.call(doc.querySelectorAll('#commFiltSheet .ps-fsheet-sec'),function(s){ if(s.querySelector('#cfsType,#cfsSel,#cfsAge,#cfsPl'))hide(s); });
  }
  return {TOPICS:TOPICS,PHASES:PHASES,EXTRAS:EXTRAS,AGES:AGES,COACH:COACH,FOCUS:FOCUS,PROC_PL:PROC_PL,
    fromCoach:fromCoach,fromProc:fromProc,fromFifa:fromFifa,fifaAges:fifaAges,state:state,set:set,ok:ok,fit:fit,counts:counts,
    draw:draw,badge:badge,TO_CAT:TO_CAT,SUBS:SUBS,SUBMAP:SUBMAP,subsOf:subsOf,PROC_SUB:PROC_SUB,subsOfPost:function(p){ var it=fromCoach(p,keys),ids=it.subs||[]; return {ids:ids,names:ids.map(function(k){ return SUBMAP[k].full; })}; },TO_FOCUS:TO_FOCUS,focusOfPost:focusOfPost,topicsOfDrill:topicsOfDrill,headcount:headcount,upForm:upForm,open:open,close:close,hideOld:hideOld,isOpen:function(){ return !!SHEET; }};
});

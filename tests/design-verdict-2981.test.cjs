const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 2.981 — 디자인 판정 이어서(보드 제외): 선수단 머리 두 줄 · 경기 목록(전적 한 줄 · 줄의 더보기 · 기록 줄) ·
   자료가 오기 전 뼈대 · 프레임 뼈대 · 새 판으로 다시 열려도 보던 화면.
   기준(글자 12·14·16·20·28 / 굵기 500·600·700 / 모서리 6·10·999)은 2.979 이후의 **모든** 새 블록이 지킨다 —
   판마다 테스트에 블록 이름을 손으로 더하지 않아도 되게, 번호로 훑는다(작전판은 판정에서 뺐으므로 여기서도 뺀다). */
const read=f=>fs.readFileSync(path.join(__dirname,'..','studio',f),'utf8');
const scout=read('scout.html'),app=read('app.html');
const css=b=>b.replace(/\/\*[\s\S]*?\*\//g,'');
const between=(s,a,b)=>{const i=s.indexOf(a);assert.ok(i>=0,'시작 표식: '+a);const j=s.indexOf(b,i+a.length);assert.ok(j>i,'끝 표식: '+b);return s.slice(i,j);};
const styleBlock=(s,id)=>between(s,'<style id="'+id+'">','</style>');

test('every style block added since 2.979 keeps the type scale, weights and radii (board excluded)',()=>{
  let seen=0;
  for(const f of ['scout.html','process.html','idp.html','app.html','note.html','community.html','gamemodel.html','terms.html','playbook.html','learning.html','scouting.html']){
    const s=read(f);
    for(const m of s.matchAll(/<style id="(ps-(\d{4})-[^"]+)">([\s\S]*?)<\/style>/g)){
      if(Number(m[2])<2979)continue;
      seen++;const id=f+' #'+m[1],b=css(m[3]);
      for(const x of b.matchAll(/font-size:\s*([\d.]+)px/g))assert.ok(['12','14','16','20','28'].includes(x[1]),id+' font-size '+x[1]+'px');
      assert.equal(/font:\s*[^;]*\d+px/.test(b),false,id+' — font 축약으로 크기를 숨기지 않는다');
      for(const x of b.matchAll(/font-weight:\s*(\d+)/g))assert.ok(['500','600','700'].includes(x[1]),id+' font-weight '+x[1]);
      for(const x of b.matchAll(/border-radius:\s*([\d.]+)(px)?/g))assert.ok(['0','6','10','999'].includes(x[1]),id+' border-radius '+x[1]);
    }
  }
  assert.ok(seen>=4,'2.979 이후 블록을 실제로 훑었다('+seen+')');
});

test('the 2.981 block is the last stylesheet of the team page',()=>{
  assert.ok(scout.lastIndexOf('<style id="ps-2981-team">')>scout.lastIndexOf('<style id="ps-2979-ck">'));
  assert.ok(scout.lastIndexOf('<style id="ps-2981-team">')>scout.lastIndexOf('ui-grammar.css'));
});

test('squad head: the number strip joins the title row on wide screens, phones keep theirs',()=>{
  const b=css(styleBlock(scout,'ps-2981-team'));
  const wide=between(b,'@media (min-width:901px){','\n}\n');   /* 넓은 화면 구간 하나 */
  assert.ok(wide.includes('#teamView .tm-head>.tm-head-top:not(#_):not(#__){display:contents!important}'),'제목 줄을 풀어 숫자 띠와 한 격자에 놓는다');
  assert.ok(/#teamView \.tm-head>\.tm-hero:not\(#_\):not\(#__\)\{grid-column:2;grid-row:1;/.test(wide),'숫자 띠는 제목과 같은 줄');
  assert.ok(/#teamView \.tm-head \.tm-head-actions:not\(#_\):not\(#__\)\{grid-column:3;grid-row:1;/.test(wide));
  assert.ok(wide.includes('.tm-workbar:not(#_){grid-column:1/-1}'),'컨트롤 줄은 제 줄');
  assert.equal(/#teamView \.tm-head[^{]*\{[^}]*display:contents/.test(b.replace(wide,'')),false,'폰·좁은 화면의 머리는 건드리지 않는다');
});

test('squad head: one fact once, and a zero is not coloured',()=>{
  assert.ok(scout.includes(`return n+"명"+(tmGrpFilter?" · "+tmGrpFilter:"")+((lk<n&&!tmHeroUnlinkShown)?" · 계정 연결 "+lk:"");`),'«IDP 미연결» 버튼이 서 있으면 인원 옆 «계정 연결» 꼬리를 접는다');
  assert.ok(scout.includes('tmHeroUnlinkShown=show; try{ if(tc)tc.textContent=tmCountText(_tcL,_tcN); }catch(_){}'));
  assert.ok(scout.includes('statUnavailable.parentNode.classList.toggle("zero",unavailableN===0)'));
  assert.ok(css(styleBlock(scout,'ps-2981-team')).includes('.tm-hero-sub:not(.tm-unlinked):not(.zero) b:not(#_):not(#__){color:var(--c-warn,#B5762B)!important}'),'못 뛰는 인원이 있을 때만 주의색');
});

test('match list: a row carries one «more» button; delete still goes through matchDelete',()=>{
  const row=between(scout,'function matchRowHTML(m,alive){','function renderMatchList(){');
  assert.equal(row.includes('data-mdel='),false,'줄마다 «삭제»를 세우지 않는다');
  assert.equal(row.includes('data-medit='),false,'줄을 누르면 열린다 — «편집»은 같은 문');
  assert.ok(row.includes('class="mr-more" data-mmore="')&&row.includes('aria-haspopup="menu"'));
  const list=between(scout,'function renderMatchList(){','window.matchSetScore=function(');
  assert.ok(list.includes('psPickOpen(mo,[{v:"open",lb:"열기"},{v:"del",lb:"삭제"}]'));
  assert.ok(list.includes('if(v==="del")matchDelete(_mmid); else matchOpen(_mmid);'),'지우는 길은 확인창·묘비가 있는 matchDelete 하나');
  assert.equal(/mr-more[^}]*\{[^}]*opacity:0/.test(styleBlock(scout,'ps-2981-team')),false,'hover 에만 보이게 숨기지 않는다(2.401)');
});

test('match record: one line per kind, numbers keep their colours, a zero goes quiet',()=>{
  const m={};vm.runInNewContext(
    'var MATCH_KIND_LABEL={official:"정식",friendly:"친선"};var out="";function $(id){return {set innerHTML(v){out=v;}};}'
    +'var store={get:function(){return {};}};function matchDocPending(){return false;}'
    +'function matchKindOf(m){return m.kind==="friendly"?"friendly":"official";}'
    +between(scout,'function matchResultOf(m){','function matchStatusOf(m){')
    +between(scout,'function matchRenderRecord(){','function matchViewApply(){')
    +'this.run=function(list){matchLoad=function(){return {matches:list};};out="";matchRenderRecord();return out;};var matchLoad;',m);
  const h=m.run([{scoreUs:'3',scoreThem:'1'},{scoreUs:'1',scoreThem:'1'},{scoreUs:'',scoreThem:''},{kind:'friendly',scoreUs:'',scoreThem:''}]);
  assert.equal((h.match(/class="mrec-ln /g)||[]).length,2,'정식·친선 한 줄씩');
  assert.equal(h.includes('mrec-b'),false,'카드 두 장은 걷었다');
  assert.ok(h.includes('<i class="w"><span class="v">1</span>승</i>')&&h.includes('<i class="l z"><span class="v">0</span>패</i>'),h);
  assert.ok(h.includes('승률 50% · 4득 2실 · +2'));
  assert.ok(h.includes('<span class="mrec-ln friendly zero"><b class="k">친선</b><em>1경기 · 점수 기록 전</em></span>'),'결과가 없으면 경기 수를 말한다');
  assert.ok(m.run([]).includes('<em>등록된 경기 없음</em>'));
});

function shareHarness(api){
  const host={style:{display:''},innerHTML:'',title:''};
  const c={document:{getElementById:id=>id==='h'?host:null},window:{PSSync:api},PSSafe:{html:s=>String(s).replace(/</g,'&lt;')}};
  vm.runInNewContext(between(scout,'function psSync(){','var PS_EDIT_HOSTS=['),c);
  return {host,run:k=>{c.psShareLine('h',k);return host;}};
}
test('share line: the record stays, the boilerplate moves to the tooltip',()=>{
  const note='편집은 팀 권한에 따릅니다 · 팀 전원이 봅니다';
  let t=shareHarness({shareNote:()=>note,editStamp:()=>({name:'나',when:'10/3 00:07',ago:'2시간 전'})});
  let h=t.run('cs_team_matches_v1');
  assert.equal(h.innerHTML.includes('편집은 팀 권한'),false,'늘 같은 문장은 줄에 적지 않는다');
  assert.ok(h.innerHTML.includes('마지막 수정 <span class="who">나</span> <span class="when">10/3 00:07</span>'),'2.353 의 기록(누가 · 언제)은 그대로');
  assert.equal(h.title,note);assert.equal(h.style.display,'');
  t=shareHarness({shareNote:()=>note,editStamp:()=>null,editLine:()=>''});
  assert.equal(t.run('scout_tool_v1').style.display,'none','기록이 없으면 줄을 그리지 않는다');
  t=shareHarness({shareNote:()=>'임원만 봅니다 · 코칭스태프에게도 안 보입니다',editStamp:()=>null,editLine:()=>''});
  h=t.run('cs_scout_targets_v1');
  assert.ok(h.innerHTML.includes('임원만 봅니다'),'팀보다 좁게 보이는 자료는 알아야 하는 사실이라 그대로 적는다');assert.equal(h.style.display,'');
});

function waitHarness({session=true,unlocked=true,online=true,ws='W',sched=null,schedReady=false,boot=true,age=0}={}){
  const ls={ps_active_ws:ws,process_coach_v1:sched};
  const c={Date:{now:()=>1000000+age},navigator:{onLine:online},KEY:'scout_tool_v1',scoutBootPending:boot,
    localStorage:{getItem:k=>(k in ls&&ls[k]!=null)?ls[k]:null},
    psSync:()=>({session:()=>session?{uid:'U'}:null,dataUnlocked:()=>unlocked,keyReady:k=>k==='process_coach_v1'&&schedReady})};
  vm.runInNewContext('var CK_T0=1000000,_ckWaitT=0;'+between(scout,'function ckDataWait(){','function ckWaitMark(host){')+'this.r=ckDataWait();',c);
  return {s:c.r.s,r:c.r.r};
}
test('today: before the first data lands the page waits instead of saying «none»',()=>{
  assert.deepEqual(waitHarness(),{s:true,r:true},'새 기기: 일정도 명단도 아직');
  assert.deepEqual(waitHarness({sched:'{}',boot:false}),{s:false,r:false},'사본이 있는 기기는 바로 그린다');
  assert.deepEqual(waitHarness({schedReady:true,boot:false}),{s:false,r:false},'서버가 «일정 없음»을 확인했으면 없다고 말한다');
  assert.deepEqual(waitHarness({sched:'{}'}),{s:false,r:true},'명단만 아직');
  assert.deepEqual(waitHarness({age:15001}),{s:false,r:false},'15초가 지나면 있는 그대로');
  assert.deepEqual(waitHarness({online:false}),{s:false,r:false},'오프라인은 기다리지 않는다');
  assert.deepEqual(waitHarness({session:false}),{s:false,r:false},'로그인 없이 쓰는 로컬 명단');
  assert.deepEqual(waitHarness({unlocked:false}),{s:false,r:false},'잠긴 자료는 잠금 안내가 말한다');
  const home=between(scout,'function renderCkHome(){','function renderTeamHome(){');
  assert.ok(home.includes('host.innerHTML=h;\n  try{ ckWaitMark(host); }catch(_){}'),'그린 뒤에 표식을 단다');
  const b=css(styleBlock(scout,'ps-2981-team'));
  assert.ok(/#ckHome\.ck-wait-r \.pn\.avail-pn>\.hd small\{visibility:hidden\}/.test(b),'글자는 가리기만 한다 — 자리는 그대로');
  assert.equal(/ck-wait-[sr][^{]*\{[^}]*display:none/.test(b),false);
});

test('squad and match lists do not claim «empty» while their data is still on the way',()=>{
  const team=between(scout,'function renderTeam(){','function tmLinkedCount(list){');
  assert.ok(team.includes('if(!oursRaw.length){ var _tw=false; try{ _tw=ckDataWait().r; }catch(_){}'));
  assert.ok(team.indexOf('class="tm-wait"')<team.indexOf('<b>아직 선수가 없어요</b>'),'오는 중이면 «첫 선수 추가» 카드보다 먼저 갈린다');
  const list=between(scout,'function renderMatchList(){','window.matchSetScore=function(');
  assert.ok(list.includes("box.innerHTML=_mlw?'':'<div class=\"ml-none\">'"));
});

test('shell: a frame that is still loading shows a skeleton, and it always comes off',()=>{
  assert.ok(app.includes("var _skFrame=ensureAppFrame(app);\n      try{ psFrameSkel(_skFrame); }catch(_){}"));
  const f=between(app,'function psFrameSkel(fr){','/* ══ 2.981 · 새 판으로 다시 열려도 보던 화면으로 ══');
  assert.ok(f.includes('if(!fr||psFrameReady(fr))return;'),'이미 뜬 프레임에는 깔지 않는다');
  assert.ok(f.includes("},140);")&&f.includes("},8000);"),'빨리 뜨면 안 보이고(140ms), 끝내 안 뜨면 걷는다(8초)');
  assert.ok(app.includes('body.ps-frame-wait .frames::before{content:"";position:absolute;inset:0;z-index:6;pointer-events:none;'),'뼈대는 클릭을 받지 않는다');
  assert.ok(app.includes("cover.style.opacity='0'; cover.style.pointerEvents='none';"),'걷히는 시작 화면이 첫 클릭을 삼키지 않는다');
});

test('shell: an automatic reload returns to the screen the coach was on; a manual one does not',()=>{
  const auto=between(app,'function psAutoReloadWhenSafe(manualOnly){','window.__psForceReload=go;');
  assert.ok(auto.includes("sessionStorage.setItem('ps_resume_screen',JSON.stringify({app:document.body.getAttribute('data-ps-app')||''"));
  assert.ok(auto.indexOf('ps_resume_screen')<auto.indexOf('location.reload();return true;'),'다시 열기 직전에 적는다');
  assert.equal((app.match(/setItem\('ps_resume_screen'/g)||[]).length,1,'로고·직접 새로고침은 적지 않는다(2.205 «처음 화면으로»)');
  const boot=between(app,'function finishBoot(force){','window.__psFinishBoot=finishBoot;');
  assert.ok(boot.includes('try{ psResumeScreen(); }catch(_){}'));
  const mk=(raw,appNow='board')=>{
    const opened=[],store={ps_resume_screen:raw};
    const c={Date:{now:()=>5000000},sessionStorage:{getItem:k=>store[k]??null,removeItem:k=>{delete store[k];}},
      document:{body:{getAttribute:()=>appNow}},teamKeyBtn:k=>(k==='match'?{k}:null),openTeamButton:b=>opened.push('team:'+b.k),
      seg:{querySelector:q=>({click:()=>opened.push(q)})},window:{}};
    vm.runInNewContext(between(app,'function psResumeScreen(){','window.__psResumeScreen=psResumeScreen;')+'this.out=psResumeScreen();',c);
    return {out:c.out,opened,left:store.ps_resume_screen};
  };
  const now=5000000;
  assert.deepEqual(mk(JSON.stringify({app:'scout',team:'match',at:now-900})).opened,['team:match']);
  assert.deepEqual(mk(JSON.stringify({app:'idp',team:'',at:now-900})).opened,['button[data-app="idp"]:not([data-team-hub])']);
  assert.deepEqual(mk(JSON.stringify({app:'note',team:'',at:now-900})).opened,['button[data-train]'],'보관함의 하위 영역은 보관함으로');
  assert.deepEqual(mk(JSON.stringify({app:'scout',team:'match',at:now-130000})).opened,[],'2분이 지난 기록은 버린다');
  assert.deepEqual(mk(JSON.stringify({app:'scout',team:'match',at:now-900}),'idp').opened,[],'부팅이 이미 다른 화면을 골랐으면 끼어들지 않는다');
  assert.equal(mk(JSON.stringify({app:'board',team:'',at:now-900})).out,false);
  assert.equal(mk(JSON.stringify({app:'scout',team:'match',at:now-900})).left,undefined,'한 번 읽고 지운다');
});

test('the four meaning colours have dark values, and every page links the stylesheet that carries them',()=>{
  const ug=read('ui-grammar.css');
  const dark=between(ug,'color-scheme:dark;','\n}');
  for(const [k,v] of [['--c-act','#6F94F5'],['--c-ok','#4CC27A'],['--c-warn','#D9A15A'],['--c-bad','#E07470']])
    assert.ok(dark.includes(k+':'+v),k+' 다크 값');
  /* 새 색을 만들지 않는다 — 같은 다크 팔레트의 값 */
  assert.match(dark,/--accent:#6F94F5/);assert.match(dark,/--ok:#4CC27A/);assert.match(dark,/--warm:#D9A15A/);assert.match(dark,/--red:#E07470/);
  /* 링크 파일은 ?v= 가 안 바뀌면 브라우저 캐시가 옛 값을 문다(2.593) */
  let linked=0;
  for(const f of fs.readdirSync(path.join(__dirname,'..','studio')).filter(x=>x.endsWith('.html'))){
    const s=read(f),m=s.match(/ui-grammar\.css\?v=([\d.]+)/);
    if(!m)continue;linked++;
    assert.ok(Number(m[1])>=2.981,f+' ui-grammar ?v='+m[1]);
  }
  assert.ok(linked>=10,'ui-grammar 를 링크한 화면 '+linked);
});

test('dark: the opened match row keeps a dark face (the base rule mixes the team colour into white)',()=>{
  const b=css(styleBlock(scout,'ps-2981-team'));
  const m=b.match(/html\.ps-page-scout body\.fmdark \.match-shell \.mrow\.on\{([^}]*)\}/);
  assert.ok(m,'다크 규칙');
  assert.match(m[1],/background:color-mix\(in srgb,var\(--team-c-dark,#9FB3D6\) 10%,var\(--surface,#1B1E23\)\)/);
  assert.equal(/#fff/i.test(m[1]),false);
});

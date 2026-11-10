'use strict';
/* 3.271 — 팀원(선수 계정 포함)이 동기화로 보내는 문서가 다른 팀원의 화면에서 HTML · JS 로 실행되지 않아야 한다.
   로그인 토큰이 localStorage 에 있어, 남의 화면에서 스크립트가 돌면 계정이 넘어간다.
   ① 선수 IDP 문서(cs_idp_v1_<uid>)의 사진 · 종류 · 숫자 · 영상 주소 → 코치 화면
   ② 일정 문서(process_coach_v1)의 경기 · 세션 · 블록 글 → 주간 · 일간 · 인쇄
   ③ 일정 «시점 복구» 목록의 기준 날짜 · 고친 사람
   ④ onclick="fn('…')" 따옴표 안의 값(&#39; 는 HTML 파서가 먼저 푼다)
   ⑤ 보관함 폴더 이름(aria-label) ⑥ 합치기 알림의 이름
   실제 브라우저 파서로 본 것은 tests/browser/xss-synced-docs.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function cut(src,from,to){const a=src.indexOf(from);assert.ok(a>=0,'start marker: '+from);const b=src.indexOf(to,a+from.length);assert.ok(b>a,'end marker: '+to);return src.slice(a,b);}
const storage=read('studio/storage.js'),idp=read('studio/idp.html'),proc=read('studio/process.html'),app=read('studio/app.html');

/* ── 작은 HTML 읽개: 진짜 태그와 속성만 뽑는다(글로 바뀐 &lt;img 는 태그가 아니다) ── */
function decode(s){return String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);?/gi,(m,e)=>{e=e.toLowerCase();
  if(e[0]==='#')return String.fromCharCode(e[1]==='x'?parseInt(e.slice(2),16):parseInt(e.slice(1),10));return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[e];});}
function tags(html){const out=[];let i=0;const n=html.length;
  while(i<n){const lt=html.indexOf('<',i);if(lt<0)break;if(!/[a-zA-Z]/.test(html[lt+1]||'')){i=lt+1;continue;}
    let j=lt+1;while(j<n&&!/[\s\/>]/.test(html[j]))j++;const tag={name:html.slice(lt+1,j).toLowerCase(),attrs:{}};
    for(;;){while(j<n&&/[\s\/]/.test(html[j]))j++;if(j>=n||html[j]==='>'){j++;break;}
      let k=j;while(k<n&&!/[\s=>\/]/.test(html[k]))k++;const name=html.slice(j,k).toLowerCase();j=k;while(j<n&&/\s/.test(html[j]))j++;let value='';
      if(html[j]==='='){j++;while(j<n&&/\s/.test(html[j]))j++;const q=html[j];
        if(q==='"'||q==="'"){const e=html.indexOf(q,j+1);value=html.slice(j+1,e<0?n:e);j=e<0?n:e+1;}
        else{k=j;while(k<n&&!/[\s>]/.test(html[k]))k++;value=html.slice(j,k);j=k;}}
      if(name)tag.attrs[name]=decode(value);}
    out.push(tag);i=j;}
  return out;}
/* 처리기(on*)를 실제로 돌린다 — 앱 함수는 모두 빈 함수, PWN 만 센다 */
function fire(html){let pwned=0;const seen=[];
  const box=new Proxy({PWN(){pwned++;},event:{stopPropagation(){},preventDefault(){},key:'Enter'}},{has:()=>true,get:(t,k)=>k===Symbol.unscopables?undefined:(k in t?t[k]:(...a)=>{seen.push([k,a]);})});
  for(const t of tags(html))for(const [k,v] of Object.entries(t.attrs))if(/^on/.test(k)){try{new Function('box','with(box){'+v+'\n}')(box);}catch(e){throw new Error('handler does not parse: '+v+' — '+e.message);}}
  return {pwned,seen};}
function inert(html,label,allowed){const ok=new Set(allowed||[]);
  for(const t of tags(html)){
    assert.ok(!/^(script|iframe|object|embed|style|link|meta|base|form)$/.test(t.name),label+': no <'+t.name+'>');
    for(const [k,v] of Object.entries(t.attrs)){
      if(/^on/.test(k))assert.ok(ok.has(k),label+': unexpected handler '+k+'="'+v+'" on <'+t.name+'>');
      if(/^(src|href|xlink:href|srcdoc|action|formaction)$/.test(k))assert.ok(!/^\s*(javascript|vbscript|data:text)/i.test(v.replace(/[\u0000-\u0020]/g,'')),label+': executable address in '+k);
    }
  }
  assert.equal(fire(html).pwned,0,label+': no handler runs the injected code');}
const TAG='<img src=x onerror=PWN()>',ATTR='x" onerror="PWN()" x="',JSQ="');PWN();//",JSDQ='");PWN();//',PAYLOADS=[TAG,ATTR,JSQ,JSDQ,"'-PWN()-'",'\\\');PWN();//','</script><script>PWN()</script>','&#39;);PWN();//','\u2028PWN()\u2028'];

/* ── storage.js 의 공용 규칙 ─────────────────────────────────────────── */
function safeApi(){const c=vm.createContext({});c.window=c;vm.runInContext(cut(storage,'window.PSSafe=window.PSSafe||{};',"var SVG_NS="),c);return c.PSSafe;}
function imgApi(mem){const disk=new Map(Object.entries(mem||{}));
  const c=vm.createContext({Promise,JSON,Math,Date,localStorage:{getItem:()=>null,setItem(){},key:()=>null,length:0},
    storage:{async keys(){return [...disk.keys()];},async get(k){return disk.has(k)?{value:disk.get(k)}:null;},async set(k,v){disk.set(k,v);return true;}}});c.window=c;c.PSSafe={};
  vm.runInContext('(function(){"use strict";'+cut(storage,"var PRE='psimg_', REF='psimg:'",'try{ ready().then(function(){ return migrate(); })')+'})();',c);return c;}

test('① PSImg.src lets only real image bytes through — attribute breakouts, script addresses and outside addresses come back empty',async()=>{
  const junk='psimg_junk',good='psimg_good',picture='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
  const c=imgApi({[junk]:'data:image/png;base64,AAAA" onerror="PWN()',[good]:picture});await c.PSImg.ready();
  const bad=['x" onerror="PWN()','javascript:PWN()','data:image/png;base64,AAAA" onerror="PWN()','data:image/svg+xml,<svg onload=PWN()>','data:text/html;base64,PHNjcmlwdD4=',
    'https://attacker.invalid/track.png','//attacker.invalid/x.png','../assets/x.png','data:image/png;base64,AA\nAA','blob:x" onerror="PWN()','psimg:'+junk,'psimg:missing'];
  for(const v of bad){
    assert.equal(c.PSImg.src(v),'',JSON.stringify(v));
    inert('<img src="'+c.PSImg.src(v)+'" alt="">','img '+JSON.stringify(v));
  }
  assert.equal(c.PSImg.src(['x" onerror="PWN()']),'','an array is not an image');
  assert.equal(c.PSImg.src({toString:()=>ATTR}),'','an object is not an image');
  /* 지금 쓰이는 값은 그대로: 캔버스 · 파일 읽기가 만드는 data URL(작은 파일은 원래 형식 그대로 남는다), 참조, blob: */
  for(const v of [picture,'data:image/png;base64,iVBORw0KGgo=','data:image/webp;base64,UklGRg==','data:image/gif;base64,R0lGODlh','data:image/svg+xml;base64,PHN2Zy8+','data:image/png;base64,SYNTHETIC',
    'blob:https://processstudio.netlify.app/0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d'])assert.equal(c.PSImg.src(v),v,v.slice(0,40));
  assert.equal(c.PSImg.src('psimg:'+good),picture,'a stored reference still resolves');
  assert.equal(c.PSImg.src(''),'');assert.equal(c.PSImg.src(null),'');
  assert.equal(c.PSImg.isData(picture),true);
  assert.equal(c.PSImg.isData('data:image/png;base64,AAAA" onerror="PWN()'),false,'a look-alike prefix is not image data — it is never moved into the image store');
  assert.equal(await c.PSImg.put('data:image/png;base64,AAAA" onerror="PWN()'),'data:image/png;base64,AAAA" onerror="PWN()','put leaves it where it was');
  assert.equal(c.PSSafe.img,c.PSImg.safe,'one rule, also reachable as PSSafe.img');
});

test('① every photo and logo sink asks PSImg.src — and no longer falls back to the raw value when that fails',()=>{
  const ph=vm.createContext({});ph.window=ph;vm.runInContext(cut(idp,'function phSrc(v){','function uid(){')+';this.phSrc=phSrc;',ph);
  assert.equal(ph.phSrc(ATTR),'','IDP phSrc without an image store');
  ph.PSImg={src:()=>{throw new Error('x');}};assert.equal(ph.phSrc(ATTR),'');
  ph.PSImg={src:v=>'safe:'+v};assert.equal(ph.phSrc('a'),'safe:a');
  const pp=vm.createContext({});pp.window=pp;vm.runInContext(cut(proc,'function __psImgSrc(v){','\n')+';this.f=__psImgSrc;',pp);
  assert.equal(pp.f(ATTR),'','schedule logo without an image store');
  pp.PSImg={src:v=>'safe:'+v};assert.equal(pp.f('a'),'safe:a');
});

test('① a foreign IDP document is put into shape once, before anything draws it',()=>{
  const S=safeApi();
  const doc={v:1,profile:{name:TAG,photo:['x'],video:'javascript:PWN()',video2:'youtu.be/abc?t=1'},
    log:{'2026-11-02':{t:'team" onmouseover="PWN()',w:TAG,rpe:'7',sleepq:ATTR,body:3,try:'2',memo:TAG,hours:{a:'6시'},solo:true},'2026-11-03':{t:'match',w:61.5},'2026-11-04':TAG,'2026-11-05':{t:'constructor'}},
    growth:{'2026-11-02':{h:TAG,w:'61.2',at:1},'2026-11-09':'x'}};
  const out=JSON.parse(JSON.stringify(S.idp(doc)));
  assert.deepEqual(out.log['2026-11-02'],{rpe:7,body:3,try:2,memo:TAG,hours:{a:'6시'},solo:true},'kinds outside the table and non-numbers are dropped, numeric text becomes a number, free text stays for esc()');
  assert.deepEqual(out.log['2026-11-03'],{t:'match',w:61.5},'a normal day is untouched');
  assert.equal('2026-11-04' in out.log,false);assert.deepEqual(out.log['2026-11-05'],{});
  assert.deepEqual(out.growth,{'2026-11-02':{w:61.2,at:1}});
  assert.equal(out.profile.video,'');assert.equal(out.profile.video2,'https://youtu.be/abc?t=1');assert.equal('photo' in out.profile,false);
  assert.equal(out.profile.name,TAG,'names are text — the screens escape them');
  assert.doesNotThrow(()=>S.idp(null));assert.doesNotThrow(()=>S.idp({v:1}));
  /* 화면: 남의 문서만 거친다(내 문서의 저장본은 바꾸지 않는다) */
  const load=cut(idp,'function load(key){','o.profile=o.profile||{};');
  assert.match(load,/if\(key!==myKey\(\)\)PSSafe\.idp\(o\);/);
  assert.match(cut(idp,"if(calView==='month'){","var csm=coachStatus(dt,viewedUid());"),/if\(DT_LB\.hasOwnProperty\(lgm\.t\)\) tags\+='<span class="mon-tag '\+lgm\.t\+'">'/);
  assert.doesNotMatch(idp,/\(lgm\.t\?'<span class="typbar /,'the type bar class is checked against the table too');
});

test('① links: only http(s) reaches an href',()=>{
  const S=safeApi();
  for(const v of ['javascript:PWN()',' JaVaScRiPt:PWN()','data:text/html,<script>PWN()</script>','vbscript:x','https://x.invalid/" onclick="PWN()','https://x.invalid/a b','//x.invalid','',null,{},['https://a.invalid']])assert.equal(S.url(v),'',JSON.stringify(v));
  assert.equal(S.url('https://youtu.be/abc?t=10&x=1#k'),'https://youtu.be/abc?t=10&x=1#k');
  assert.equal(S.url(' http://example.com/v '),'http://example.com/v');
  assert.equal(S.url('www.youtube.com/watch?v=1'),'https://www.youtube.com/watch?v=1','an address typed without the scheme still opens');
  assert.equal((idp.match(/href="'\+esc\(p\.video\)/g)||[]).length,0,'IDP video links go through PSSafe.url');
  assert.equal((idp.match(/PSSafe\.url\(p\.video\)/g)||[]).length,6);
  assert.doesNotMatch(read('studio/scout.html'),/href="\$\{esc\(pf\.video\)\}"/);
});

test('① growth chart labels are numbers',()=>{
  const c=vm.createContext({Math,Date});vm.runInContext(cut(idp,'function svgGrowthMeasure(rows,color,gid,unit){','function growthCards(){')+';this.f=svgGrowthMeasure;',c);
  const h=c.f([{v:150,d:new Date(2026,9,5)},{v:TAG,d:new Date(2026,9,12)}],'var(--accent)','g1','cm');
  inert(h,'growth chart');assert.equal(tags(h).some(t=>t.name==='img'),false,h);
  assert.match(c.f([{v:150,d:new Date(2026,9,5)},{v:151.5,d:new Date(2026,9,12)}],'var(--accent)','g1','cm'),/>151\.5cm<\/text>/);
});

/* ── ④ 처리기 문자열 ─────────────────────────────────────────────────── */
test('④ a value inside onclick="fn(\'…\')" comes back as the same text and never as code',()=>{
  const S=safeApi();
  const values=PAYLOADS.concat(['FC <서울> & \'친구\'','A팀','오전 10:30','4v4+3','U-15 (가)','a\\b','줄\n바꿈','탭\t','😀 이모지','100%','x=1;y=2','`${PWN()}`','\u0000\u007f\u00a0']);
  for(const v of values){
    for(const html of ['<button onclick="fn(\''+S.arg(v)+'\')">x</button>','<input onkeydown="fn(1,&quot;'+S.arg(v)+'&quot;)">','<b onclick="a(3,\''+S.arg(v)+'\');b(\''+S.arg(v)+'\')">x</b>']){
      const r=fire(html);assert.equal(r.pwned,0,JSON.stringify(v));
      const got=r.seen.filter(x=>x[0]==='fn'||x[0]==='a'||x[0]==='b').map(x=>x[1][x[1].length-1]);
      assert.ok(got.length>=1&&got.every(x=>x===v),'round trip '+JSON.stringify(v)+' → '+JSON.stringify(got));
    }
    assert.doesNotMatch(S.arg(v),/["'<>&`\n\r\u2028\u2029]/,'nothing HTML or JS can read as structure');
  }
  assert.equal(S.arg(null),'');assert.equal(S.arg(12),'12');assert.equal(S.arg('A팀 1'),'A팀 1','plain names stay readable');
  /* 예전 방식(HTML 로만 바꾸기)은 파서가 &#39; 를 풀어 따옴표가 끊겼다 — 이 시험이 그 차이를 붙잡는다 */
  const old=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  assert.equal(fire('<button onclick="fn(\''+old(JSQ)+'\')">x</button>').pwned,1,'the old encoder really was injectable');
});

test('④ the schedule uses that one encoder wherever a stored name goes into a handler',()=>{
  const c=vm.createContext({PSSafe:safeApi()});vm.runInContext(cut(proc,'function _fillEsc(x){','\n')+';this.f=_fillEsc;',c);
  assert.equal(fire('<button onclick="wksFillGrp(\''+c.f(JSQ)+'\')">x</button>').pwned,0);
  assert.equal((proc.match(/\.replace\(\/'\/g,'&#39;'\)/g)||[]).length,0,'no hand-rolled &#39; replacement is left in process.html');
  assert.doesNotMatch(proc,/\\''\+wkbdEsc\(/,'wkbdEsc is for text, not for a quoted handler argument');
  assert.match(proc,/var esc1=_fillEsc;/);
  assert.match(proc,/onclick="setTplSel\('\$\{_fillEsc\(t\.id\)\}'\)">\$\{wkbdEsc\(t\.name\)\}<span class="tpldel" onclick="event\.stopPropagation\(\);delTpl\('\$\{_fillEsc\(t\.id\)\}'\)">/);
  assert.match(read('studio/schedule-audience.js'),/onclick="wksFillGrp\(\\''\+_fillEsc\(g\)\+'\\'\)"/);
});

/* ── ② 일정 문서 ─────────────────────────────────────────────────────── */
const WKBD=cut(proc,'function wkbdEsc(s){','\n'),PDFESC=cut(proc,'function pdfEsc(s){','\n');
function evilDay(){return {d:'월',md:'',match:{time:TAG,opp:TAG,logo:ATTR},
  trainings:[{_open:true,slot:TAG,time:TAG,players:TAG,aims:TAG,note:TAG,place:TAG,blocks:[{phase:TAG,theme:TAG,fmt:TAG,dur:TAG,desc:TAG,board:true},{phase:'warm',theme:'Rondo',fmt:'4v2',dur:15,desc:'짧게'}]}],
  board:{sched:TAG,theme:TAG,load:TAG,meets:[TAG],meetsData:[{minutes:TAG}],warms:[TAG],warmsData:[{minutes:TAG}],trains:[TAG],trainData:[{minutes:TAG}]}};}
const NICE="FC <서울> & '친구'";
function schedCtx(extra){
  const c=vm.createContext(Object.assign({String,Math,Date,JSON,Array,Object,isNaN,parseInt,OUT:[],wk:0,dayIdx:0,__schedGrp:'',__pBlank:false,TOD:['새벽','오전','오후','저녁'],BOARD_PH:{},
    PHASE_SHORT:{warm:'웜업'},getLoad:()=>null,loadColor:()=>'#000',loadShort:()=>'',distColorAx:()=>'hsl(215 10% 74%)',circNum:i=>'('+(i+1)+')',trMinutes:()=>15,endTime:()=>'',
    mxExtraHtml:()=>'',mxExtraList:()=>[],schedMatchVis:()=>true,schedViewDay:d=>d,wksGroupKind:()=>'',dateOf:()=>new Date(2026,10,9),dayBoard:d=>d.board,bColor:()=>'',todOfTime:()=>'',
    pdfCoachOf:()=>'',pBoardItems:()=>'',wksTopicsOf:()=>[],wksTopicName:v=>v,PSSafe:{svg:()=>''}},extra||{}));
  c.window=c;vm.runInContext(WKBD+'\n'+PDFESC,c);return c;}

test('② weekly rows draw match, session and block text as text',()=>{
  const body=cut(proc,'const noMatch=!week.some(d=>d.match);','const __b=dayBoard(day), __ms=');
  const run=day=>{const c=schedCtx({week:[day],document:{createElement:()=>({})}});vm.runInContext('(function(){'+body+'}OUT.push(cells);});})();',c);return c.OUT[0];};
  const h=run(evilDay());
  inert(h,'weekly rows',['onclick']);
  assert.deepEqual(tags(h).filter(t=>t.name==='img'),[],'no injected element');
  assert.equal((h.match(/&lt;img src=x onerror=PWN\(\)&gt;/g)||[]).length,11,'time · opponent · slot · topic · block phase/theme/format/description · note · session time · headcount are shown, escaped');
  const day=evilDay();day.match={time:'15:00',opp:NICE};day.trainings[0]=Object.assign(day.trainings[0],{time:'10:30',players:18,aims:'빌드업',note:NICE});day.trainings[0].blocks=[{phase:'warm',theme:'Rondo',fmt:'4v2',dur:15,desc:NICE}];
  const ok=run(day);
  assert.match(ok,/경기 · 15:00<\/div><div class="o">FC &lt;서울&gt; &amp; &#39;친구&#39; ›<\/div>/,'an opponent name with special characters reads as typed');
  assert.match(ok,/훈련 · 10:30 · 18명<\/span>/);assert.match(ok,/<span class="bld">15′<\/span>/);assert.match(ok,/<b class="bnum">\(1\)<\/b> 웜업<\/span>/);
});

test('② the day view draws match and board picks as text',()=>{
  const nodes={dayLabel:{},dayView:{}};
  const c=schedCtx({week:[evilDay()],document:{getElementById:id=>nodes[id]}});
  vm.runInContext(cut(proc,'function renderDay(){','function curTr(){')+';renderDay();',c);
  const h=nodes.dayView.innerHTML;assert.ok(h.length>500);
  inert(h,'day view',['onclick','onblur']);
  assert.deepEqual(tags(h).filter(t=>t.name==='img'),[]);
  assert.equal((h.match(/&lt;img src=x onerror=PWN\(\)&gt;/g)||[]).length,8,'time · opponent · schedule/theme/intensity picks · meeting · warm-up · training names');
  assert.match(h,/<span class="dmin">NaN'<\/span>/,'minutes are numbers');
});

test('② the print document draws them as text too',()=>{
  const c=schedCtx({});
  vm.runInContext(cut(proc,'function pSessionBlock(tr,day){','function pGrpTag(){')+';this.day=pDayBody;',c);
  const h=c.day(evilDay(),false);
  inert(h,'print day');assert.deepEqual(tags(h).filter(t=>t.name==='img'),[]);
  assert.equal((h.match(/&lt;img src=x onerror=PWN\(\)&gt;/g)||[]).length,11,'time · opponent · block phase/theme/format/description · session time/place/headcount/topic/note');
  const d=evilDay();d.match={time:'15:00',opp:NICE};d.trainings=[];
  assert.match(c.day(d,false),/<div class="pmatch">경기 · 15:00 · FC &lt;서울&gt; &amp; '친구'<\/div>/);
});

test('② keys, times and ids of a schedule are put into shape when it is read — text is left for the screens to escape',()=>{
  const S=safeApi(),snap={players:[{id:"p'1",x:1}],drawings:[{kind:'<arrow>'}]};
  const doc={version:1,anchorMonday:'2026-11-09',weeks:{0:[{d:'월<i>',n:1,md:'MD-1"',match:{time:'15:00\');PWN();//',opp:NICE,mid:ATTR,kind:'cup'},matchAdd:[{time:TAG,opp:TAG,kind:TAG}],
      trainings:[{slot:"S1a2b');PWN();//",time:'17:00',players:'18',aims:NICE,note:TAG,load:{rpe:TAG},blocks:[{phase:TAG,theme:NICE,fmt:"4v4+3 'GK'",dur:'15',desc:TAG,exp:ATTR,of:ATTR,libId:ATTR},{dur:TAG},{dur:20}]},{slot:'오전',time:'오전 10:30',players:ATTR,load:{rpe:5}}],
      board:{sched:NICE,trains:[NICE],trainSlot:["S1a2b');PWN();//",'오전'],trainData:[{minutes:TAG,snap,thumb:'<svg/>'},{minutes:'12'}],meetSlot:[TAG],gmMoment:ATTR}}]},
    templates:[{id:JSQ,name:NICE}],grpWeeks:{A:{0:[{d:'월',trainings:[{slot:TAG}]}]}}};
  const before=JSON.parse(JSON.stringify(doc)),out=JSON.parse(JSON.stringify(S.sched(doc))),day=out.weeks[0][0],tr=day.trainings[0];
  const flat=JSON.stringify([day.d,day.md,day.match.time,day.match.mid,day.matchAdd[0].time,day.matchAdd[0].kind,tr.slot,tr.blocks[0].phase,tr.blocks[0].exp,tr.blocks[0].of,tr.blocks[0].libId,day.board.trainSlot,day.board.meetSlot,day.board.gmMoment,out.templates[0].id,out.grpWeeks.A[0][0].trainings[0].slot]);
  assert.doesNotMatch(flat.replace(/^\[|\]$/g,'').replace(/","|\["|"\]|",\[|\],"/g,' '),/[<>'&`\\]|\\"/,'no character HTML or JS reads as structure is left in a key field: '+flat);
  assert.equal(tr.slot,'S1a2b);PWN();//');assert.equal(day.board.trainSlot[0],tr.slot,'a session and its board items still share the same key');
  assert.equal(day.d,'월i');assert.equal(day.md,'MD-1');assert.equal(day.match.kind,'cup');
  assert.deepEqual([tr.time,tr.players,tr.blocks[0].dur,tr.blocks[1].dur,tr.blocks[2].dur,tr.load.rpe,day.board.trainData[0].minutes,day.board.trainData[1].minutes,day.trainings[1].players,day.trainings[1].load.rpe],
    ['17:00','18','15','',20,'','','12','',5],'numbers and numeric text keep their stored form; anything else in a number field is emptied');
  assert.equal(day.trainings[1].slot,'오전');assert.equal(day.trainings[1].time,'오전 10:30','ordinary keys and times are unchanged');
  assert.deepEqual([day.match.opp,tr.aims,tr.note,tr.blocks[0].theme,tr.blocks[0].fmt,tr.blocks[0].desc,day.board.sched,day.board.trains[0],out.templates[0].name],[NICE,NICE,TAG,NICE,"4v4+3 'GK'",TAG,NICE,NICE,NICE],'text is not rewritten');
  assert.deepEqual(day.board.trainData[0].snap,before.weeks[0][0].board.trainData[0].snap,'board pictures are left to the board');assert.equal(day.board.trainData[0].thumb,'<svg/>');
  const clean={version:1,weeks:{0:[{d:'화',n:2,rest:false,trainings:[{slot:'Sab12cd',time:'17:00',players:'',aims:'',note:'',load:{rpe:5},blocks:[{phase:'main',theme:'빌드업',fmt:'8v8',dur:20,desc:''}]}],board:{sched:'훈련',theme:'',trainSlot:['Sab12cd'],trainData:[{minutes:12,sets:2}]}}]}};
  assert.equal(JSON.stringify(S.sched(JSON.parse(JSON.stringify(clean)))),JSON.stringify(clean),'a normal schedule comes back byte for byte');
  for(const v of [null,undefined,'x',[],{weeks:null},{weeks:'x'}])assert.doesNotThrow(()=>S.sched(v));
  assert.match(cut(proc,'function loadState(opt){','__syncAnchor(data);'),/const data=PSSafe\.sched\(JSON\.parse\(raw\)\);/,'the schedule screen reads through it');
  assert.match(storage,/function readSched\(\)\{ var v=schedRaw\(\); try\{ return v\?schedSafe\(JSON\.parse\(v\)\):null; \}/,'so do PSSchedule.read · readFor');
  assert.match(cut(storage,'function view(grp){','return viewMemo.by[key];'),/d=schedSafe\(JSON\.parse\(raw\)\)/,'and the shared read-only view');
});

/* ── ③ 시점 복구 목록 ─────────────────────────────────────────────────── */
test('③ the restore list shows the anchor only when it is a date, and the editor name as text',()=>{
  const line=cut(proc,"row.innerHTML='<b style=\"font-size:13px;flex:0 0 auto\">'+lbl+'</b>","\n");
  const draw=(anch,who)=>{const c=vm.createContext({lbl:'11/9 10:00',nMatch:2,anch,who,row:{}});vm.runInContext(WKBD+'\n'+line,c);return c.row.innerHTML;};
  const h=draw(TAG+'-11-09',TAG);
  inert(h,'restore list');assert.deepEqual(tags(h).filter(t=>t.name==='img'),[]);
  assert.match(h,/기준  · &lt;img src=x onerror=PWN\(\)&gt;<\/span>/);
  assert.match(draw('2026-11-09','김 코치'),/경기 2 · 기준 11\/09 · 김 코치<\/span>/,'a normal row reads as before');
  assert.match(draw('2026-11-09',''),/기준 11\/09<\/span>/);
});

/* ── ⑤ 보관함 폴더 ───────────────────────────────────────────────────── */
test('⑤ a folder name never enters the folder card markup',()=>{
  const move=require('../studio/vault-folder-move.js');
  const el=()=>{const kids={},e={style:{},attrs:{},children:[],setAttribute(k,v){e.attrs[k]=String(v);},appendChild(x){e.children.push(x);},addEventListener(){},
    querySelector(sel){return kids[sel]||(kids[sel]=el());}};return e;};
  const host=el();host.ownerDocument={createElement:el,getElementById:()=>({}),head:el()};
  move.appendFolders({host,kids:[ATTR,TAG,'공격'],parent:'',lib:[]});
  assert.equal(host.children.length,3);
  for(const row of host.children){
    inert(row.innerHTML,'folder card');
    assert.equal(row.innerHTML.includes('PWN'),false,'the name is not part of the HTML string');
    assert.equal(row.querySelector('.vf-nm').textContent,row.attrs['data-vault-folder']);
    assert.equal(row.querySelector('.vc-more').attrs['aria-label'],row.attrs['data-vault-folder']+' 폴더 메뉴','the menu button keeps its spoken name');
  }
});

/* ── ⑥ 합치기 알림 ───────────────────────────────────────────────────── */
test('⑥ the merge notice shows another member\'s name, the date and the field as text',()=>{
  const nodes={mb:{style:{},setAttribute(){}},mtx:{},mmine:{style:{}}};
  const c=vm.createContext({String,Date,note:null,mb:nodes.mb,mtx:nodes.mtx,mmine:nodes.mmine});c.window=c;c.PSSafe=safeApi();c.PSSync={merge:{notes:()=>[c.note]}};
  vm.runInContext('var FIELD={match:"경기"};'+cut(app,'function ymdKo(y){','mmine.addEventListener(')+';this.draw=drawMerge;',c);
  c.note={id:'a',by:TAG,ymd:TAG,path:'w1.2.'+TAG.replace(/[.\[]/g,''),mine:null};c.draw();
  inert(nodes.mtx.innerHTML,'merge notice');assert.deepEqual(tags(nodes.mtx.innerHTML).filter(t=>t.name==='img'),[]);
  assert.equal((nodes.mtx.innerHTML.match(/&lt;img src=x onerror=PWN\(\)&gt;/g)||[]).length,3);
  c.note={id:'b',by:'김 코치',ymd:'2026-11-09',path:'w1.0.match',mine:'"x"'};c.draw();
  assert.match(nodes.mtx.innerHTML,/^<b>김 코치\(다른 기기\)가 11\/9 월 «경기»를 먼저 바꿔서 그쪽으로 합쳤어요<\/b>/);
});

/* ── ⑦ 작은 것들 ─────────────────────────────────────────────────────── */
test('⑦ admin scene counts are numbers, board match notes and roster ids are escaped',()=>{
  const admin=read('admin.html'),c=vm.createContext({Array});vm.runInContext(cut(admin,'function sceneInfo(it){','function preview(wid,lidEnc){')+';this.f=sceneInfo;',c);
  assert.deepEqual(JSON.parse(JSON.stringify(c.f({scenes:{length:TAG}}))),{t:1,s:0});
  assert.deepEqual(JSON.parse(JSON.stringify(c.f({snap:{},scenes:[1,2]}))),{t:1,s:3});
  assert.deepEqual(JSON.parse(JSON.stringify(c.f({trainings:[{snap:{},scenes:{length:TAG}}]}))),{t:1,s:0});
  const board=read('studio/board.html'),scout=read('studio/scout.html');
  assert.match(board,/<span class="mn-t">\$\{PSSafe\.html\(n\.t\)\}<\/span>\$\{n\.who\?`<span class="mn-who">\$\{PSSafe\.html\(n\.who\)\}<\/span>`:""\}/);
  assert.doesNotMatch(scout,/onclick="st(NoteModal|Set)\(\\''\+p\.id\+/);
  assert.match(scout,/<option value="'\+esc\(p\.id\)\+'"/);
  assert.ok(read('tests/browser/run-critical.mjs').includes("'xss-synced-docs'"),'the browser probe runs in CI');
});

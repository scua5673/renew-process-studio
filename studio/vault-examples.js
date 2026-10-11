/* PROCESS STUDIO — 3.001 보관함 예시. 사용자 «보관함에 예시로 패턴북 하나 · 예시로 전부 하나씩 — 훈련도 미팅도 세트피스도 전부 · 처음 들어온 사람들이 잘 볼 수 있게 · 제대로 만들어줘 조사해서»
   · «프로세스 폴더를 따로 만들어서 거기에 다 넣어줘 기본으로 있는것 처럼» · «모든 사용자에게 한 번씩».
   board.html 이 모든 사용자의 보관함에 한 번 «프로세스» 폴더로 넣는다(vxSeedRun). 빈 보관함 첫 화면 카드 · ＋ 만들기 창의 «예시 담기»로 다시 담을 수도 있다.
   이 파일은 자료만 만든다 — 보관함에 쓰기 · libId · 만든 사람 도장 · 날짜는 board.html 이 맡는다(make() 는 늘 새 사본을 돌려준다).

   좌표: 작전판 세계 좌표(1m = 10단위, 라인 x 30~1080 · y 30~710, 파랑이 왼쪽 골을 지키며 오른쪽으로 공격, 파랑의 왼쪽 측면이 위).
         여기서는 미터로 적고 m(x,y) 가 바꾼다. 그리드 판(grid20·grid30)은 판 가운데 기준 미터 — g(n,x,y).
   내용: 세션 구성(론도 → 포지셔닝 게임 → 경기형), 압박 신호(센터백→풀백 패스 · 등진 받기 · 무거운 첫 터치), 역압박 5초,
         코너킥 니어 포스트 공략(지역 방어 앞 스크린 · 니어 플릭 · 두 번째 물결), 경기 전 미팅(상대 형태 → 우리 공 → 상대 공 → 세트피스 → 세 가지)
         — FIFA Training Centre · 잉글랜드 축구협회 코칭 자료 · 코칭 세션 플랜에서 되풀이되는 원칙을 따랐다.
   tests/vault-examples-2999.test.cjs 가 모양(보관함 · 패턴북 국면 · 미팅 한 장 분량 · 세트피스 판)을 지킨다. */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSVaultExamples=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var FOLDER='프로세스';
  var YEL='#ffd24a',WHT='#ffffff',RED='#ff5a5f',INK='#1c1c1e',BLU='#3a6df0',DRED='#e23b3b';

  function clone(o){ return JSON.parse(JSON.stringify(o)); }
  function m(x,y){ return {x:Math.round(30+x*10),y:Math.round(30+y*10)}; }                   /* 11인제 미터 → 세계 */
  function g(n,x,y){ var u=1050/n; return {x:Math.round(555+x*u),y:Math.round(370+y*u)}; }   /* 그리드 판(가로 n m) 가운데 기준 미터 → 세계 */
  function P(id,team,num,at,o){ var r={id:id,team:team,num:String(num),pos:'',x:at.x,y:at.y,color:null}; if(o)for(var k in o)r[k]=o[k]; return r; }
  function A(type,color,a,b,c,o){ var r={type:type,color:color,lw:1,op:1,pts:[a,b].concat(c?[c]:[])}; if(o)for(var k in o)r[k]=o[k]; return r; }
  function T(text,at,o){ var r={type:'text',color:WHT,lw:1,op:1,pts:[at],text:text,size:26}; if(o)for(var k in o)r[k]=o[k]; return r; }
  function Z(type,color,a,b,o){ var r={type:type,color:color,lw:1,op:1,pts:[a,b]}; if(o)for(var k in o)r[k]=o[k]; return r; }
  function E(id,kind,at,o){ var r={id:id,team:kind,x:at.x,y:at.y,color:null,src:null}; if(o)for(var k in o)r[k]=o[k]; return r; }

  /* 판 보기 — 모든 장면 스냅에 같은 값(장면을 넘길 때 loadSnap 이 빠진 칸을 기본값으로 되돌린다) */
  var LOOK={label:'num',lines:true,gridType:'off',tokenScale:0.4,tokV:2,tokShape:'circle'};
  var FULL=Object.assign({pitchSpec:'fifa',orientation:'h',area:'full',pitchView:'full',pvSide:'own',fieldMode:'standard',spFlip:false,pitchN:1,pitchTheme:'grass'},LOOK);
  var HALF=Object.assign({},FULL,{area:'half',pitchView:'half'});
  var SETP=Object.assign({},FULL,{orientation:'v',spFlip:true,area:'half',pitchView:'half',fieldMode:'setpiece',pitchTheme:'white',spMark:null,spMarks:null});
  var MEET=Object.assign({},FULL,{orientation:'v',pitchTheme:'white'});
  function grid(n){ return Object.assign({},FULL,{pitchSpec:'grid'+n,pitchTheme:'train'}); }
  function S(view,players,ball,drawings,equipment){ return Object.assign({},view,{players:players,ball:ball?{x:ball.x,y:ball.y}:null,drawings:drawings||[],equipment:equipment||[]}); }
  /* 장면 — 같은 id 의 토큰이 장면 사이를 움직인다 */
  function F(snap,o){ var r={snap:snap,dur:1,hold:0.6}; if(o)for(var k in o)r[k]=o[k]; return r; }

  /* 선수 무리 — 장면마다 자리만 바꿔 다시 만든다(id·번호는 그대로). spec = {id:[team,num,x,y,opts?]} */
  function crew(spec,where){ var out=[]; Object.keys(spec).forEach(function(k){ var s=spec[k],at=where[k]; if(!at)return; out.push(P(+k,s[0],s[1],at,s[2])); }); return out; }
  function M(map){ var r={}; Object.keys(map).forEach(function(k){ r[k]=m(map[k][0],map[k][1]); }); return r; }
  function Gr(n,map){ var r={}; Object.keys(map).forEach(function(k){ r[k]=g(n,map[k][0],map[k][1]); }); return r; }
  function mv(base,changes){ var r={}; Object.keys(base).forEach(function(k){ r[k]=base[k]; }); Object.keys(changes).forEach(function(k){ r[k]=changes[k]; }); return r; }

  /* 우리(파랑) 4-3-3 · 상대(빨강) 4-4-2 — 번호 */
  var US={1:['blue','1',{pos:'GK'}],2:['blue','2'],3:['blue','3'],4:['blue','4'],5:['blue','5'],6:['blue','6'],8:['blue','8'],10:['blue','10'],7:['blue','7'],9:['blue','9'],11:['blue','11']};
  var THEM={21:['red','1',{pos:'GK'}],22:['red','2'],23:['red','3'],24:['red','4'],25:['red','5'],26:['red','6'],28:['red','8'],27:['red','7'],31:['red','11'],29:['red','9'],30:['red','10']};
  function both(us,them){ var spec={},where={}; Object.keys(us).forEach(function(k){ spec[k]=US[k]; where[k]=us[k]; }); Object.keys(them).forEach(function(k){ spec[k]=THEM[k]; where[k]=them[k]; }); return crew(spec,where); }

  /* ══ 1. 패턴북 — 국면마다 시퀀스 하나씩(경합 · 세컨드 볼은 비워 둔다 — 지도의 ＋ 로 채워 보게) ══ */
  function seq(name,mo,ph,grp,call,when,frames){ return {name:name,mo:mo,ph:ph,grp:grp,call:call,when:when,snap:frames[0].snap,thumb:'',anim:{frames:frames,active:0,hold:0.6,title:'',titleColor:''}}; }

  function bookBuildUp(){
    var us0=M({1:[3,34],4:[12,19],5:[12,49],6:[20,34],3:[27,5],2:[27,63],8:[35,23],10:[35,45],11:[50,5],7:[50,63],9:[54,34]});
    var th0=M({29:[25,27],30:[25,41],26:[37,30],28:[37,39],27:[38,12],31:[38,56]});
    var us1=mv(us0,{1:m(3,36),6:m(22,40),10:m(37,47)}), th1=mv(th0,{30:m(17,45),29:m(22,33),28:m(35,40)});
    var us2=mv(us1,{6:m(24,41),10:m(41,49),2:m(32,64),7:m(55,62)}), th2=mv(th1,{30:m(19,43),29:m(21,37),28:m(30,41),31:m(37,58)});
    var us3=mv(us2,{10:m(46,50),2:m(42,65),6:m(28,40),7:m(62,60),9:m(58,40)}), th3=mv(th2,{28:m(36,46),26:m(38,36),31:m(42,60)});
    var f=[
      F(S(FULL,both(us0,th0),m(4.5,34),[A('pass',YEL,m(4.5,34),m(11.5,48))]),{sg:'벌리기',sgn:'센터백은 박스 폭으로 벌리고 풀백은 높이 선다. GK 는 세 번째 선택지.',cap:'GK 가 오른쪽 센터백에게'}),
      F(S(FULL,both(us1,th1),m(12,48.5),[A('pass',YEL,m(12.5,48),m(21.5,40.5)),A('run',WHT,m(20,34),m(21.5,39.5))]),{sg:'6번 경유',sgn:'6번은 상대 공격수 그림자 밖으로 비켜 서서 몸을 열고 받는다.',cap:'10번이 압박하면 6번에게'}),
      F(S(FULL,both(us2,th2),m(24.5,41),[A('pass',YEL,m(24.5,41),m(40.5,48.5)),A('run',WHT,m(37,47),m(40.5,48.5))]),{cap:'6번이 앞을 보고 받아 라인 사이 10번에게'}),
      F(S(FULL,both(us3,th3),m(46,50),[A('pass',YEL,m(46.5,50.5),m(60,62)),A('run',WHT,m(32,64),m(44,65.5))]),{sg:'전진',sgn:'10번이 앞을 보고 받으면 측면 7번이나 오버랩하는 2번으로 바로 전진.',cap:'첫 압박을 넘었다 — 측면으로 전진'})
    ];
    return seq('GK에서 6번으로 — 3-2 빌드업','ao','std_ao_1','공격 조직','짧게','상대 투톱이 센터백까지 압박할 때',f);
  }
  function bookCutback(){
    var us0=M({7:[84,58],2:[73,62],10:[78,46],9:[90,37],11:[86,16],8:[76,30],6:[64,36]});
    var th0=M({21:[103,34],23:[86,56],25:[94,41],24:[94,30],22:[92,18],26:[84,40],28:[82,30]});
    var us1=mv(us0,{7:m(87,51),2:m(87,63)}), th1=mv(th0,{23:m(88,52),26:m(86,44)});
    var us2=mv(us1,{2:m(97,64),9:m(100,38),10:m(91,41),11:m(98,25),8:m(84,32)}), th2=mv(th1,{25:m(99,38),24:m(98,32),23:m(92,55),26:m(90,44),28:m(88,34),21:m(103,36)});
    var us3=mv(us2,{10:m(92,40)}), th3=mv(th2,{26:m(91,43)});
    var f=[
      F(S(FULL,both(us0,th0),m(84,57.5),[A('run',WHT,m(73,62),m(90,64.5),m(82,66)),A('dribble',YEL,m(84,58),m(87,52))]),{sg:'오버랩',sgn:'7번이 안으로 몰고 들어가 상대 풀백을 붙잡아 두고, 2번이 바깥으로 겹쳐 돈다.',cap:'7번 안으로 · 2번 겹쳐 돌기'}),
      F(S(FULL,both(us1,th1),m(87,51.5),[A('pass',YEL,m(87,51.5),m(96,63.5)),A('run',WHT,m(87,63),m(96,64))]),{cap:'풀백이 따라오면 2번에게'}),
      F(S(FULL,both(us2,th2),m(97,63.5),[A('pass',YEL,m(97,63.5),m(91.5,41.5)),A('run',WHT,m(90,37),m(100,37.5))]),{sg:'컷백',sgn:'9번은 니어로 수비를 끌고, 10번은 페널티 지점 쪽으로 늦게 들어온다. 11번은 파 포스트.',cap:'바이라인에서 뒤로 — 컷백'}),
      F(S(FULL,both(us3,th3),m(92,40.5),[A('shot',YEL,m(92.5,40.5),m(105,32))]),{cap:'10번 슛'})
    ];
    return seq('오른쪽 오버랩 → 컷백','ao','std_ao_3','공격 조직','겹쳐','상대 풀백이 우리 윙어에게 붙을 때',f);
  }
  function bookPress(){
    var us0=M({9:[84,34],11:[82,17],7:[82,50],8:[74,27],10:[74,42],6:[66,34],3:[60,11],4:[56,28],5:[56,41],2:[60,57]});
    var th0=M({21:[102,34],24:[93,24],25:[93,44],22:[85,7],23:[85,61],26:[80,30],28:[80,40],27:[70,9],31:[70,59]});
    var us1=mv(us0,{7:m(83,58),10:m(79,43),2:m(70,60),9:m(89,44),6:m(71,40),8:m(76,34),5:m(60,46),4:m(60,34),3:m(63,18)}), th1=mv(th0,{23:m(85,63),31:m(71,62),28:m(81,42)});
    var us2=mv(us1,{2:m(73,64),7:m(82,61),10:m(79,48)}), th2=mv(th1,{23:m(83,64),31:m(73,65)});
    var f=[
      F(S(FULL,both(us0,th0),m(92.5,44),[A('pass',RED,m(92.5,44.5),m(85.5,61),null,{dash:1}),A('run',WHT,m(82,50),m(83,57.5),m(80,55))]),{sg:'신호',sgn:'상대 센터백이 풀백에게 패스하는 순간이 신호. 공이 굴러가는 동안 모두 함께 출발한다.',cap:'센터백 → 풀백 패스 = 출발'}),
      F(S(FULL,both(us1,th1),m(85,62),[A('run',WHT,m(79,43),m(80.5,42.5)),A('run',WHT,m(70,60),m(72.5,63.5)),Z('rectdash',RED,m(68,48),m(90,68))]),{sg:'가두기',sgn:'7번은 안쪽에서 바깥으로 달려 안쪽 패스 길을 지운다. 10번은 가까운 미드필더, 2번은 윙어에게. 9번은 센터백으로 돌아가는 길을 막는다.',cap:'측면에 가둔다 — 안쪽 길은 없다'}),
      F(S(FULL,both(us2,th2),m(73,64.5),[]),{sg:'탈취',sgn:'긴 볼이나 줄 밖 — 2번이 먼저 닿는다. 뺏으면 곧바로 안쪽 10번에게.',cap:'뺏었다 — 바로 공격'})
    ];
    return seq('풀백 패스가 신호 — 측면에 가두기','do','std_do_1','수비 조직','가둬','상대 센터백이 풀백에게 패스할 때',f);
  }
  function bookCounterpress(){
    var us0=M({10:[71,42],8:[68,29],6:[61,36],9:[80,34],7:[80,56],11:[80,12],2:[66,60],3:[66,9]});
    var th0=M({28:[70,40],26:[75,31],31:[71,54],29:[58,39],30:[59,28],25:[86,42],24:[86,28]});
    var us1=mv(us0,{10:m(68.5,41),6:m(65,39),8:m(72,34),9:m(75,37),7:m(75,48)}), th1=mv(th0,{28:m(69,40.5)});
    var us2=mv(us1,{6:m(67,40),10:m(69,43)}), th2=mv(th1,{28:m(70,39)});
    var f=[
      F(S(FULL,both(us0,th0),m(70,40.5),[]),{sg:'상실',sgn:'공을 잃은 자리에서 가장 가까운 세 명이 곧바로 간다. 나머지는 간격을 좁힌다.',cap:'잃었다 — 지금!'}),
      F(S(FULL,both(us1,th1),m(69.5,40.5),[A('run',WHT,m(71,42),m(69.5,41.5)),A('run',WHT,m(61,36),m(65,39)),A('run',WHT,m(68,29),m(72,33.5)),A('run',WHT,m(80,34),m(75.5,37))]),{sg:'세 명 압박',sgn:'10번은 공을 가진 사람, 6번은 앞쪽 패스 길, 8번은 옆 패스 길. 9번은 뒤에서 덮친다.',cap:'세 명이 앞 · 옆 · 뒤를 막는다'}),
      F(S(FULL,both(us2,th2),m(67,40),[A('pass',YEL,m(67.5,40),m(79.5,35))]),{sg:'다시 공격',sgn:'5초 안에 뺏으면 그 자리에서 바로 공격. 못 뺏으면 내려서서 블록을 만든다.',cap:'5초 안에 뺏으면 곧바로 9번에게'})
    ];
    return seq('잃으면 5초 — 역압박','dt','std_dt_1','공격 → 수비 전환','지금','상대 진영 가운데에서 공을 잃은 직후',f);
  }
  function bookCounter(){
    var us0=M({6:[38,34],9:[52,34],7:[48,58],11:[48,10],8:[40,24],10:[42,44]});
    var th0=M({30:[39,36],29:[46,30],24:[62,28],25:[62,41],22:[60,12],23:[60,57],26:[50,40]});
    var us1=mv(us0,{9:m(54,34),7:m(62,52),11:m(62,16),10:m(48,42)}), th1=mv(th0,{24:m(60,30),25:m(60,40),26:m(48,38)});
    var us2=mv(us1,{7:m(76,48),9:m(78,36),11:m(78,20)}), th2=mv(th1,{24:m(80,30),25:m(79,40),22:m(72,16),23:m(74,54)});
    var us3=mv(us2,{11:m(89,24),9:m(84,36)}), th3=mv(th2,{24:m(86,31),25:m(83,40)});
    var f=[
      F(S(FULL,both(us0,th0),m(38.5,34),[A('pass',YEL,m(39,34),m(53,34))]),{sg:'탈취',sgn:'뺏은 사람은 고개를 들고 첫 패스를 앞으로.',cap:'6번이 뺏었다 — 첫 패스는 앞으로'}),
      F(S(FULL,both(us1,th1),m(54,34),[A('pass',YEL,m(54.5,34.5),m(71,49)),A('run',WHT,m(62,52),m(71,49.5)),A('run',WHT,m(62,16),m(76,20))]),{sg:'전진',sgn:'윙어 둘은 상대 풀백 뒤로 대각선 침투. 9번은 한 번에 내준다.',cap:'9번이 한 번에 7번에게'}),
      F(S(FULL,both(us2,th2),m(76,48),[A('pass',YEL,m(76.5,47.5),m(88.5,24.5)),A('run',WHT,m(78,20),m(88.5,24))]),{sg:'3v2 마무리',sgn:'공을 가진 사람이 수비 한 명을 끌고, 반대편이 비면 그쪽으로.',cap:'3v2 — 반대편 11번에게'}),
      F(S(FULL,both(us3,th3),m(89,24.5),[A('shot',YEL,m(89.5,25),m(105,35.5))]),{cap:'8초 안에 슛까지'})
    ];
    return seq('뺏으면 첫 패스는 앞으로 — 역습','at','std_at_1','수비 → 공격 전환','가!','우리 진영 가운데에서 공을 뺏었을 때',f);
  }
  function bookCornerDefence(){
    var us0=M({1:[1.5,34],4:[5.5,30],5:[5.5,34],6:[5.5,38],2:[9,27],3:[9,42],8:[11,34],10:[17,40],11:[0.8,29.6],9:[50,34],7:[40,58]});
    var th0=M({24:[11,28],25:[11,40],29:[10,34],30:[14,31],26:[19,36],27:[0.5,67.5]});
    var us1=mv(us0,{4:m(4.5,32),2:m(9,29),3:m(9,41)}), th1=mv(th0,{29:m(5.5,32),24:m(8,29),25:m(9,38),30:m(9,33)});
    var us2=mv(us1,{7:m(46,56),9:m(54,36),10:m(22,46)}), th2=th1;
    var f=[
      F(S(FULL,both(us0,th0),m(0.7,67.3),[Z('rectdash',WHT,m(0,26),m(6.5,42))]),{sg:'자리',sgn:'골 에어리어 앞 세 명은 지역, 상대 헤더 셋은 대인. 8번은 박스 앞 세컨드 볼, 9번 · 7번은 역습을 위해 남는다.',cap:'지역 3 + 대인 3 · 두 명은 앞에 남는다'}),
      F(S(FULL,both(us1,th1),m(5,32),[A('pass',RED,m(0.7,67.3),m(5,32.5),m(14,50),{dash:1}),A('pass',YEL,m(5,32),m(18,46),null,{lob:1})]),{sg:'니어 걷어내기',sgn:'니어로 오는 공은 지역 수비가 먼저 머리로 — 멀리, 바깥으로.',cap:'니어 지역 수비가 먼저 걷어낸다'}),
      F(S(FULL,both(us2,th2),m(22,46),[A('pass',YEL,m(22.5,46.5),m(45.5,56)),A('run',WHT,m(50,34),m(56,38))]),{sg:'역습',sgn:'걷어낸 공은 10번 · 7번으로 이어서 곧바로 역습.',cap:'두 번째 공을 잡으면 역습'})
    ];
    return seq('코너킥 수비 — 지역 3 + 대인 3','set','std_set_2','세트피스','존','상대 코너킥',f);
  }
  function exBook(){
    var pages=[bookBuildUp(),bookCutback(),bookPress(),bookCounterpress(),bookCounter(),bookCornerDefence()];
    var f0=pages[0].anim.frames.map(function(fr,i){ var c=clone(fr); if(i===0){ c.__t=''; c.__tc='#e23b3b'; c.__hold=0.6; } return c; });
    return {type:'board',book:1,name:'우리 팀 패턴북 — 4-3-3',tags:['예시','패턴북'],thumb:'',snap:clone(pages[0].snap),frames:f0,pages:pages,
      overview:'국면마다 시퀀스 하나 — 빌드업 · 컷백 · 전방 압박 · 역압박 · 역습 · 코너킥 수비. 시퀀스를 열어 ▶ 로 단계마다 재생해 보세요.'};
  }

  /* ══ 2. 훈련 카드 — 세션 하나에 훈련 셋(론도 → 포지셔닝 게임 → 경기형) ══ */
  function training(o){ return Object.assign({type:'train',name:'',minutes:15,sets:1,rpe:5,focus:'bp',gmPhases:[],gmPhaseNames:[],method:'',coaching:'',memoQuick:'',overview:'',spDesc:'',setup:'',func:'',prog:'',tags:[],sp:null,spCall:'',thumb:'',animIdx:0},o); }
  function trRondo(){
    var V=grid(20),C=[E(101,'cone',g(20,-5,-5)),E(102,'cone',g(20,5,-5)),E(103,'cone',g(20,5,5)),E(104,'cone',g(20,-5,5))];
    var zone=Z('rectline','#3d4654',g(20,-5,-5),g(20,5,5),{label:'10×10m'});
    var sp={1:['blue','2'],2:['blue','3'],3:['blue','4'],4:['blue','5'],11:['red','6'],12:['red','8']};
    var w0=Gr(20,{1:[-5.6,0],2:[0,-5.6],3:[5.6,0],4:[0,5.6],11:[-1.5,-1],12:[1,1.5]});
    var w1=mv(w0,{1:g(20,-5.6,1.2),2:g(20,-1.4,-5.6),11:g(20,-1.6,-3),12:g(20,0.5,-0.5)});
    var w2=mv(w1,{4:g(20,1.2,5.6),11:g(20,-0.5,-3.6),12:g(20,1.8,-1.2)});
    var w3=mv(w2,{3:g(20,5.6,-1.4),11:g(20,1.5,1.5),12:g(20,1.2,3.2)});
    var f=[
      F(S(V,crew(sp,w0),g(20,-5.2,0),[zone,A('pass',INK,g(20,-5.2,0),g(20,-0.4,-5.2))],C),{cap:'받기 전에 어깨 너머로 확인'}),
      F(S(V,crew(sp,w1),g(20,-1.4,-5.2),[zone,A('pass',DRED,g(20,-1.4,-5.2),g(20,1.2,5.2))],C),{cap:'수비 둘 사이로 가르는 패스'}),
      F(S(V,crew(sp,w2),g(20,1.2,5.2),[zone,A('pass',INK,g(20,1.2,5.2),g(20,5.2,-1.4))],C),{cap:'몸을 열고 반대쪽으로'}),
      F(S(V,crew(sp,w3),g(20,5.2,-1.4),[zone],C),{cap:'두 터치 안에 — 2분 × 6세트'})
    ];
    return training({name:'4v2 론도 — 두 터치',minutes:15,rpe:4,focus:'poss',gmPhases:['std_ao_1'],gmPhaseNames:['공격 조직 › 빌드업'],
      overview:'좁은 공간에서 받기 전 확인 · 몸 열기 · 패스 각도를 깨운다.',setup:'10×10m · 콘 4 · 공격 4 수비 2 · 공 여러 개',
      method:'10×10m 사각형. 바깥 4명이 두 터치 안에 패스를 이어 가고, 가운데 2명이 뺏는다.\n수비 둘 사이를 가르는 패스가 통하면 1점. 수비가 공을 건드리거나 공이 밖으로 나가면 실수한 사람이 가운데로 들어간다.\n2분 × 6세트, 세트 사이 30초.',
      coaching:'1. 받기 전에 어깨 너머로 확인한다\n2. 공에서 먼 발(반대 발)로 받아 몸을 연다\n3. 공을 가진 사람 양옆에 패스 각도를 만든다\n4. 틈이 보이면 수비 둘 사이로 가른다',
      prog:'쉽게: 5v2 · 어렵게: 한 터치, 또는 8×8m',snap:f[0].snap,frames:f});
  }
  function trPositional(){
    var V=grid(30),C=[E(101,'cone',g(30,-11,-9)),E(102,'cone',g(30,11,-9)),E(103,'cone',g(30,11,9)),E(104,'cone',g(30,-11,9)),E(105,'cone',g(30,0,-9)),E(106,'cone',g(30,0,9))];
    var zone=Z('rectline','#3d4654',g(30,-11,-9),g(30,11,9),{label:'22×18m'});
    var sp={1:['blue','6'],2:['blue','8'],3:['blue','10'],4:['blue','4'],11:['red','6'],12:['red','8'],13:['red','9'],14:['red','10'],21:['yellow','1'],22:['yellow','2'],23:['yellow','3']};
    var w0=Gr(30,{21:[-11.6,0],22:[11.6,0],23:[0,0.5],1:[-6,-6.5],2:[-5,6.5],3:[4,-6.5],4:[5,6],11:[-4.5,-2],12:[-3.5,3],13:[2.5,-2],14:[4,2.5]});
    var w1=mv(w0,{1:g(30,-6.5,-4.5),11:g(30,-5.5,-3),12:g(30,-3,0.5),23:g(30,-0.5,-0.8)});
    var w2=mv(w1,{11:g(30,-3,-2.5),13:g(30,1,-1.8),14:g(30,2.5,1.2),23:g(30,-0.6,-1),3:g(30,5,-5.5)});
    var w3=mv(w2,{13:g(30,4.5,-1),14:g(30,6,1)});
    var f=[
      F(S(V,crew(sp,w0),g(30,-11.1,0),[zone,A('pass',INK,g(30,-11.1,0),g(30,-6.4,-4.8))],C),{cap:'끝 중립에서 시작'}),
      F(S(V,crew(sp,w1),g(30,-6.4,-4.4),[zone,A('pass',DRED,g(30,-6.4,-4.4),g(30,-0.9,-0.9))],C),{cap:'세 번째 사람 — 가운데 중립에게'}),
      F(S(V,crew(sp,w2),g(30,-0.6,-1),[zone,A('pass',INK,g(30,-0.2,-0.8),g(30,11.1,0))],C),{cap:'가운데를 거쳐 반대쪽 끝까지 — 2점'}),
      F(S(V,crew(sp,w3),g(30,11.1,0),[zone],C),{cap:'끝에서 끝 1점 · 가운데 경유 2점'})
    ];
    return training({name:'포지셔닝 게임 4v4+3',minutes:20,rpe:6,focus:'poss',gmPhases:['std_ao_1','std_ao_2'],gmPhaseNames:['공격 조직 › 빌드업','공격 조직 › 전진 · 전개'],
      overview:'수적 우위(7v4)로 압박을 풀고 한쪽 끝에서 반대쪽 끝까지 전진한다.',setup:'22×18m · 4v4 + 중립 3(양 끝 1명씩 · 가운데 1명) · 조끼 3색',
      method:'공을 가진 팀은 중립 셋과 함께 7v4로 공을 지킨다.\n한쪽 끝 중립에서 반대쪽 끝 중립까지 이으면 1점, 가운데 중립을 거치면 2점. 뺏기면 곧바로 역할을 바꾼다.\n3분 × 5세트, 세트 사이 1분.',
      coaching:'1. 서로 다른 높이와 폭에 서서 패스 길이 겹치지 않게\n2. 세 번째 사람 — 다음 다음 패스를 보고 움직인다\n3. 가운데 중립은 몸을 반쯤 열고 받는다\n4. 뺏기면 5초 안에 다시 압박한다',
      prog:'중립은 한 터치만 · 점수를 낸 팀이 공을 계속 가진다',snap:f[0].snap,frames:f});
  }
  function trGame(){
    var V=HALF,G=[E(201,'minigoalV',m(52.5,18)),E(202,'minigoalV',m(52.5,50))];
    var sp={1:['blue','1',{pos:'GK'}],2:['blue','2'],3:['blue','3'],4:['blue','4'],5:['blue','5'],6:['blue','6'],8:['blue','8'],10:['blue','10'],29:['red','9'],30:['red','10'],27:['red','7'],31:['red','11'],26:['red','6'],28:['red','8']};
    var w0=M({1:[3,34],4:[12,19],5:[12,49],6:[20,34],3:[26,6],2:[26,62],8:[33,24],10:[33,45],29:[25,27],30:[25,41],27:[34,12],31:[34,56],26:[36,30],28:[36,40]});
    var w1=mv(w0,{6:m(21,24),8:m(33,20),30:m(18,24),29:m(22,32)});
    var w2=mv(w1,{6:m(23,22),8:m(40,17),26:m(30,26),27:m(30,16)});
    var w3=mv(w2,{8:m(50,18),27:m(36,18)});
    var f=[
      F(S(V,crew(sp,w0),m(4.5,34),[A('pass',INK,m(4.5,34),m(11.5,20))],G),{cap:'GK 에서 시작 — 센터백은 넓게'}),
      F(S(V,crew(sp,w1),m(12,19.5),[A('pass',INK,m(12.5,19.5),m(20.5,24)),A('run',DRED,m(20,34),m(21,24.5))],G),{cap:'6번이 그림자 밖으로 — 2점 길'}),
      F(S(V,crew(sp,w2),m(23,22),[A('pass',INK,m(23.5,21.5),m(39.5,17.5))],G),{cap:'6번이 앞을 보고 8번에게'}),
      F(S(V,crew(sp,w3),m(51,18),[],G),{cap:'미니골 통과 — 6번 경유라 2점'})
    ];
    return training({name:'하이 프레스를 풀어라 — 8v6',minutes:25,rpe:7,focus:'bp',gmPhases:['std_ao_1'],gmPhaseNames:['공격 조직 › 빌드업'],
      overview:'경기와 같은 압박 속에서 GK 부터 하프라인까지 공을 가지고 나간다.',setup:'하프라인까지(52×68m) · 파랑 GK + 7명 · 빨강 6명 · 하프라인 미니골 2',
      method:'GK 에서 시작. 파랑은 하프라인의 미니골 두 곳 중 하나로 패스하거나 몰고 지나가면 1점, 6번을 거쳐 넣으면 2점.\n빨강은 뺏으면 8초 안에 큰 골에 슛. 공이 나가면 다시 GK 부터.\n4분 × 4세트, 세트 사이 1분 30초.',
      coaching:'1. 센터백은 박스 폭까지 벌리고 GK 는 세 번째 선택지\n2. 6번은 상대 공격수 그림자 밖에서 받는다\n3. 막히면 GK 로 돌려 반대쪽으로 — 서두르지 않는다\n4. 전진 패스 뒤에는 바로 받쳐 준다',
      prog:'빨강 한 명 추가(8v7) · 파랑 수비수는 두 터치까지',snap:f[0].snap,frames:f});
  }
  function exTrain(){
    var t=[trRondo(),trPositional(),trGame()];
    return {type:'train',name:'빌드업 세션 — 압박을 풀고 전진',tags:['예시','빌드업'],thumb:'',snap:clone(t[0].snap),frames:clone(t[0].frames),trainings:t,
      minutes:t.reduce(function(a,x){ return a+x.minutes; },0),sets:1,focus:'poss',rpe:4,
      gmPhases:['std_ao_1','std_ao_2'],gmPhaseNames:['공격 조직 › 빌드업','공격 조직 › 전진 · 전개'],roster:{gk:2,field:16,rehab:0,out:0},
      overview:'론도 15분 → 포지셔닝 게임 20분 → 경기형 25분. 같은 주제(받기 전 확인 · 몸 열기 · 6번 경유)를 점점 경기에 가깝게.'};
  }

  /* ══ 3. 세트피스 — 코너킥 공격, 지역 방어 앞 스크린 + 니어 플릭 + 두 번째 물결 ══
     세트피스 판은 왼쪽 골이 화면 위(spFlip) — 이 예시는 파랑이 그 골을 공격한다. 코너는 세계 (0,0) 쪽 = 화면 오른쪽 위(spot R). */
  function exSetpiece(){
    var sp={7:['blue','7'],9:['blue','9'],4:['blue','4'],5:['blue','5'],10:['blue','10'],11:['blue','11'],8:['blue','8'],6:['blue','6'],2:['blue','2'],
      21:['red','1',{pos:'GK'}],22:['red','2'],23:['red','3'],24:['red','4'],25:['red','5'],26:['red','6'],28:['red','8'],29:['red','9'],27:['red','7'],31:['red','11']};
    var w0=M({7:[0.6,0.6],9:[12,30],4:[10.5,33],5:[11.5,36],10:[12.5,39.5],11:[14,42],8:[19,32],6:[30,26],2:[31,44],
      21:[1.2,34],22:[5.5,30],23:[5.5,34],24:[5.5,38],25:[1.2,30.8],26:[10.5,31],28:[11.5,38],29:[12.5,41.5],27:[16,34],31:[22,40]});
    var w1=mv(w0,{9:m(5,31),4:m(6.5,31.2),5:m(6.8,34.4),10:m(7,39.5),11:m(6,43),26:m(7,32),28:m(8,37.5),29:m(9,41.5)});
    var w2=mv(w1,{9:m(2.6,30.6),10:m(3,40.5),11:m(4.5,42.5),22:m(5,31.5),29:m(6.5,41.5),28:m(6.5,37.5)});
    var w3=mv(w2,{10:m(1.8,39.2),8:m(14,35),21:m(1,36)});
    var f=[
      F(S(SETP,crew(sp,w0),m(0.6,0.6),[]),{cap:'네 명이 페널티 지점 근처에 뭉쳐 선다'}),
      F(S(SETP,crew(sp,w1),m(0.6,0.6),[A('pass',DRED,m(0.6,0.6),m(2.8,30.4),m(8,14)),A('run',INK,m(12,30),m(5,31)),A('run',INK,m(12.5,39.5),m(7,39.5)),A('run',INK,m(14,42),m(6,43))]),{cap:'키커가 손을 들면 출발 — 4 · 5번은 니어 지역 수비 앞에 선다'}),
      F(S(SETP,crew(sp,w2),m(2.6,30.4),[A('pass',DRED,m(2.6,30.4),m(2.4,39.4),null,{lob:1})]),{cap:'9번이 니어에서 머리로 뒤로 흘린다(플릭)',hl:[9]}),
      F(S(SETP,crew(sp,w3),m(2,39.2),[A('shot',DRED,m(2,39.2),m(0,35.5))]),{cap:'10번 파 포스트 마무리 · 8번은 세컨드 볼',hl:[10]})
    ];
    var tr=training({type:'setpiece',name:'코너킥 공격 — 니어 포스트 플릭',minutes:10,rpe:5,focus:'set',gmPhases:['std_set_1'],gmPhaseNames:['세트피스 › 공격 세트피스'],
      sp:{side:'for',kind:'corner',spot:'R'},spCall:'니어',
      spDesc:'지역 방어로 니어를 지키는 상대에게. 공격 네 명이 페널티 지점 근처에 뭉쳤다가 키커 신호에 흩어진다.\n9번 니어 포스트 침투 → 머리로 뒤로 흘림(플릭) → 10번 · 11번이 파 포스트에서 마무리.\n4 · 5번은 니어 지역 수비 앞에 서서 9번의 길을 연다. 8번은 박스 앞 세컨드 볼, 6 · 2번은 역습 대비.\n배달: 니어 포스트 앞, 머리 높이로 빠르게.',
      coaching:'1. 일찍 뛰면 막힌다 — 공이 떠나는 순간에 맞춰 도착한다\n2. 스크린은 서서 길을 막는 것까지. 밀거나 잡으면 반칙\n3. 상대가 니어에 두 명을 두면 — 10번에게 짧은 코너 뒤 크로스\n4. 6 · 2번은 하프라인 쪽에 남아 역습을 먼저 끊는다',
      snap:f[0].snap,frames:f});
    return {type:'setpiece',name:'코너킥 공격 — 니어 포스트 플릭',tags:['예시','코너킥'],thumb:'',snap:clone(f[0].snap),frames:clone(f),trainings:[tr],
      minutes:10,sets:1,focus:'set',rpe:5,gmPhases:['std_set_1'],gmPhaseNames:['세트피스 › 공격 세트피스'],
      overview:'지역 방어 앞 스크린 → 니어 플릭 → 파 포스트 마무리. ▶ 로 움직임을 차례로 볼 수 있어요.'};
  }

  /* ══ 4. 작전판 — 페이지 둘: 공격할 때 3-2-5(애니메이션) · 수비할 때 4-1-4-1 미드 블록 ══ */
  function exBoard(){
    var base=M({1:[4,34],3:[30,9],4:[18,24],5:[18,44],2:[30,59],6:[32,34],8:[44,24],10:[44,44],11:[62,8],9:[66,34],7:[62,60]});
    var b1=mv(base,{3:m(38,26),4:m(22,20),5:m(22,48),2:m(26,58),6:m(38,40),8:m(56,24),10:m(56,44),11:m(70,6),7:m(70,62),9:m(74,34)});
    var V=FULL,pick=function(w){ var spec={}; Object.keys(w).forEach(function(k){ spec[k]=US[k]; }); return crew(spec,w); };
    var p1=[
      F(S(V,pick(base),m(18,44.5),[]),{cap:'기본 4-3-3'}),
      F(S(V,pick(b1),m(22,48.5),[A('run',WHT,m(30,9),m(37.5,25.5)),A('run',WHT,m(30,59),m(26.5,58))]),{cap:'3번이 안으로 들어와 6번 옆에 — 3-2-5'}),
      F(S(V,pick(b1),m(22,48.5),[Z('rectdash',YEL,m(17,14),m(43,54),{label:'레스트 디펜스 3 + 2'}),Z('rectdash',WHT,m(52,2),m(78,66),{label:'앞 다섯 — 폭과 깊이'}),T('잃으면 다섯이 바로 막는다',m(18,64),{size:24})]),{cap:'앞에 다섯, 뒤에 다섯 — 잃어도 곧바로 막는다'})
    ];
    var blk=M({1:[4,34],3:[26,12],4:[24,27],5:[24,41],2:[26,56],6:[32,34],11:[38,10],8:[40,26],10:[40,42],7:[38,58],9:[50,34]});
    var opp=M({21:[101,34],24:[70,26],25:[70,42],22:[64,8],23:[64,60],26:[58,30],28:[58,40],27:[48,14],31:[48,54],29:[34,30],30:[36,40]});
    var p2s=S(V,both(blk,opp),m(70,42.5),[Z('rectdash',YEL,m(22,6),m(52,62),{label:'미드 블록 — 30m 안에'}),A('line',WHT,m(24,2),m(24,66),null,{dash:1}),T('라인 사이 10~12m',m(31,66),{size:22}),T('가운데를 닫고 측면으로 보낸다',m(30,3),{size:22})]);
    var pages=[
      {name:'공격할 때 — 3-2-5',snap:p1[0].snap,thumb:'',anim:{frames:p1,active:0,hold:0.6,title:'',titleColor:''}},
      {name:'수비할 때 — 4-1-4-1 미드 블록',snap:p2s,thumb:''}   /* 장면이 하나뿐인 페이지는 앱도 anim 없이 둔다 */
    ];
    var f0=p1.map(function(fr,i){ var c=clone(fr); if(i===0){ c.__t=''; c.__tc='#e23b3b'; c.__hold=0.6; } return c; });
    return {type:'board',name:'4-3-3 — 공격 형태와 수비 블록',tags:['예시','4-3-3'],thumb:'',snap:clone(p1[0].snap),frames:f0,pages:pages,
      overview:'페이지 1: 공격할 때 3-2-5로 바뀌는 움직임(▶ 재생). 페이지 2: 수비할 때 4-1-4-1 미드 블록과 간격.'};
  }

  /* ══ 5. 미팅 자료 — 경기 전 미팅 5장(세로 A4 한 장에 제목 + 두 줄) ══ */
  function slide(title,points,frames){ var s={pdfOrientation:'portrait',thumb:'',title:title,points:points,snap:clone(frames[0].snap)}; if(frames.length>1){ s.frames=frames.map(function(fr,i){ var c=clone(fr); if(i===0)c.__hold=0.6; return c; }); } return s; }
  function exMeeting(){
    var V=MEET;
    var opp=M({21:[101,34],22:[80,10],24:[84,27],25:[84,41],23:[80,58],27:[64,10],26:[66,28],28:[66,40],31:[64,58],29:[50,30],30:[50,40]});
    var s1=S(V,both({},opp),null,[Z('rectdash',DRED,m(84,0),m(103,16),{label:'풀백 뒤'}),Z('rectdash',DRED,m(72,25),m(81,43),{label:'라인 사이'}),A('run',DRED,m(50,30),m(38,24)),A('run',DRED,m(50,40),m(38,46))]);
    var b0=M({1:[3,34],4:[12,19],5:[12,49],6:[20,34],3:[27,5],2:[27,63],8:[35,23],10:[35,45]}), r0=M({29:[25,27],30:[25,41],26:[37,30],28:[37,39]});
    var b1=mv(b0,{6:m(22,40)}), r1=mv(r0,{30:m(17,45),29:m(22,33)});
    var b2=mv(b1,{6:m(24,41),10:m(41,49)}), r2=mv(r1,{28:m(31,41)});
    var bu=[
      F(S(V,both(b0,r0),m(4.5,34),[A('pass',BLU,m(4.5,34),m(11.5,48))]),{cap:'GK → 오른쪽 센터백'}),
      F(S(V,both(b1,r1),m(12,48.5),[A('pass',BLU,m(12.5,48),m(21.5,40.5))]),{cap:'압박이 오면 6번에게'}),
      F(S(V,both(b2,r2),m(24.5,41),[A('pass',BLU,m(24.5,41),m(40.5,48.5))]),{cap:'6번이 앞을 보고 10번에게'})
    ];
    var pu=M({9:[84,34],11:[82,17],7:[82,50],8:[74,27],10:[74,42],6:[66,34]}), po=M({21:[102,34],24:[93,24],25:[93,44],23:[85,61],26:[80,30],28:[80,40],31:[70,59]});
    var pu1=mv(pu,{7:m(83,58),10:m(79,43),9:m(89,44)}), po1=mv(po,{23:m(85,63),28:m(81,42)});
    var pr=[
      F(S(V,both(pu,po),m(92.5,44),[A('pass',DRED,m(92.5,44.5),m(85.5,61),null,{dash:1})]),{cap:'센터백 → 풀백 패스가 신호'}),
      F(S(V,both(pu1,po1),m(85,62),[A('run',BLU,m(82,50),m(83,57.5),m(80,55)),A('run',BLU,m(74,42),m(78.5,43))]),{cap:'7번은 안쪽에서 바깥으로 · 10번은 가까운 미드필더'})
    ];
    var ck=S(V,crew({7:US[7],9:US[9],4:US[4],5:US[5],10:US[10],8:US[8],21:THEM[21],22:THEM[22],23:THEM[23],24:THEM[24]},
      M({7:[104.4,0.6],9:[100,31],4:[98.5,31.5],5:[98.2,34.5],10:[101.5,39.5],8:[89,35],21:[103.8,34],22:[99.5,30],23:[99.5,34],24:[99.5,38]})),
      m(104.4,0.6),[A('pass',DRED,m(104.4,0.6),m(102.4,30.4),m(97,14)),A('pass',DRED,m(102.4,30.6),m(102.6,39.4),null,{lob:1}),Z('ellipse',DRED,m(100.5,28.5),m(104.5,32.5),{op:0.25})]);
    var xi=S(V,crew(US,M({1:[4,34],3:[30,9],4:[18,24],5:[18,44],2:[30,59],6:[32,34],8:[44,24],10:[44,44],11:[62,8],9:[66,34],7:[62,60]})),null,[]);
    var slides=[
      slide('상대 — 4-4-2 · 높은 압박',['투톱이 센터백까지 압박한다','약점: 풀백 뒤 · 미드필드와 수비 라인 사이'],[F(s1)]),
      slide('우리 공 — 6번을 거쳐 전진',['센터백은 넓게, GK 는 세 번째 선택지','6번은 그림자 밖에서 몸을 열고 받는다'],bu),
      slide('상대 공 — 풀백 패스가 신호',['7번은 안쪽에서 바깥으로 막는다','10번은 가까운 미드필더, 2번은 윙어'],pr),
      slide('세트피스 — 니어 포스트 플릭',['4 · 5번이 니어 지역 수비 앞에 선다','9번 니어 → 10번 파 포스트'],[F(ck)]),
      slide('오늘 꼭 지킬 세 가지',['6번 경유 빌드업 · 풀백 패스 = 압박','잃으면 5초 안에 다시 뺏는다'],[F(xi)])
    ];
    return {type:'meeting',name:'경기 전 미팅 — 상대 4-4-2',tags:['예시','미팅'],thumb:'',snap:clone(slides[0].snap),slides:slides,
      overview:'상대 형태 → 우리 공 → 상대 공 → 세트피스 → 오늘의 세 가지. 슬라이드 2 · 3 은 ▶ 로 움직임을 보여 줍니다.'};
  }

  /* 첫 화면 카드의 작은 그림 — 그 예시의 첫 장면을 84×56 에 점으로(템플릿 카드와 같은 크기) */
  function pic(snap,box){
    var b=box||{x0:0,x1:105,y0:0,y1:68},W=84,H=56,sx=W/(b.x1-b.x0),sy=H/(b.y1-b.y0);
    function X(v){ return ((v-30)/10-b.x0)*sx; } function Y(v){ return ((v-30)/10-b.y0)*sy; }
    var out='<svg class="vs-pic" width="84" height="56" viewBox="0 0 84 56" aria-hidden="true"><rect x="1.5" y="1.5" width="81" height="53" rx="4" fill="#eef1ee" stroke="#c9cfd4"/>';
    var gridBoard=/^grid/.test(snap.pitchSpec||'');
    if(!gridBoard&&b.x0<=52.5&&b.x1>=52.5)out+='<line x1="'+X(555).toFixed(1)+'" y1="2" x2="'+X(555).toFixed(1)+'" y2="54" stroke="#c9cfd4"/>';
    (snap.drawings||[]).forEach(function(d){ if(!d.pts||d.pts.length<2||d.type==='text')return; var a=d.pts[0],c=d.pts[1];
      if(d.type==='rectline'&&gridBoard){ var x0=Math.min(X(a.x),X(c.x)),y0=Math.min(Y(a.y),Y(c.y)); out+='<rect x="'+x0.toFixed(1)+'" y="'+y0.toFixed(1)+'" width="'+Math.abs(X(c.x)-X(a.x)).toFixed(1)+'" height="'+Math.abs(Y(c.y)-Y(a.y)).toFixed(1)+'" fill="none" stroke="#3d4654" stroke-width="1"/>'; return; }
      if(/rect|ellipse/.test(d.type))return; out+='<line x1="'+X(a.x).toFixed(1)+'" y1="'+Y(a.y).toFixed(1)+'" x2="'+X(c.x).toFixed(1)+'" y2="'+Y(c.y).toFixed(1)+'" stroke="#f59e0b" stroke-width="1.4"'+(d.type==='run'?' stroke-dasharray="3 2"':'')+'/>'; });
    (snap.players||[]).forEach(function(p){ var x=X(p.x),y=Y(p.y); if(x<1||x>83||y<1||y>55)return; out+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="2.2" fill="'+(p.team==='red'?'#d24b4b':(p.team==='yellow'?'#d8a42a':'#1a2f5c'))+'"/>'; });
    if(snap.ball){ var bx=X(snap.ball.x),by=Y(snap.ball.y); if(bx>=1&&bx<=83&&by>=1&&by<=55)out+='<circle cx="'+bx.toFixed(1)+'" cy="'+by.toFixed(1)+'" r="1.6" fill="#fff" stroke="#111" stroke-width=".6"/>'; }
    return out+'</svg>';
  }

  /* 첫 화면에 서는 차례 — 처음 온 사람이 가장 먼저 보면 좋은 것부터 */
  var DEFS=[
    {key:'book',kind:'book',label:'패턴북',tag:'국면별 시퀀스 6개',build:exBook,box:null},
    {key:'train',kind:'train',label:'훈련 세션',tag:'훈련 3개 · 60분',build:exTrain,box:null},
    {key:'setpiece',kind:'setpiece',label:'세트피스',tag:'코너킥 니어 플릭',build:exSetpiece,box:{x0:0,x1:27,y0:24.5,y1:42.5}},
    {key:'board',kind:'board',label:'작전판',tag:'공격 형태 · 수비 블록',build:exBoard,box:null},
    {key:'meeting',kind:'meeting',label:'미팅 자료',tag:'경기 전 미팅 5장',build:exMeeting,box:null}
  ];
  function find(key){ for(var i=0;i<DEFS.length;i++){ if(DEFS[i].key===key)return DEFS[i]; } return null; }
  /* 훈련 카드의 그림은 판 전체(그리드 판)라 점을 판 기준으로 다시 잰다 */
  function picFor(d){ var it=d.build(),s=it.snap; if(d.key==='train'){ var b={x0:-0.5,x1:105.5,y0:-0.5,y1:68.5}; return pic(s,b); } return pic(s,d.box||undefined); }

  return {
    FOLDER:FOLDER,
    keys:function(){ return DEFS.map(function(d){ return d.key; }); },
    list:function(){ return DEFS.map(function(d){ var it=d.build(); return {key:d.key,kind:d.kind,label:d.label,tag:d.tag,name:it.name,pic:picFor(d)}; }); },
    /* 늘 새 사본 — 보관함이 고쳐도 다음 사본에 번지지 않는다. libId · savedAt · 도장은 부르는 쪽이 */
    make:function(key){ var d=find(key); if(!d)return null; var it=clone(d.build()); it.ex=d.key; it.folder=FOLDER; return it; }
  };
});

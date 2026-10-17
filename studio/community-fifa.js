/* PROCESS STUDIO — 커뮤니티 «FIFA» 칸(3.071 · 3.072 애니메이션 시범).
   사용자 «fifatrainingcentre.com 에 있는 훈련들 커뮤니티 안에 넣어줘».
   FIFA 훈련센터(FIFA Training Centre)가 공개한 훈련 세션을 링크 카드로 모은다. 설명 · 그림 · 영상은 옮기지 않는다(FIFA 저작물).
   카드에는 우리말 제목 · 원래 영어 제목 · 지도자 · 주제만 적고, 누르면 FIFA 사이트(영어)가 새 탭에서 열린다.
   · 서버(ps_community)를 읽지도 쓰지도 않는다. 목록은 이 파일 안의 표(ROWS)다 — 2026-10-17 에 FIFA 사이트의 Practice 메뉴(엘리트 · 유소년 · 풋살)에서 받았다.
   · 주소는 표의 경로를 BASE 뒤에 붙여서만 만든다(다른 사이트로 가는 링크는 생기지 않는다).
   · 화면(community.html)은 render · aside · chips 만 부른다. 시험은 require 로 본다(tests/community-fifa-3071.test.cjs). */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSCommFifa=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var BASE='https://www.fifatrainingcentre.com/en/practice/';
  var HOME='https://www.fifatrainingcentre.com/en/';
  /* 주제 — [키, 이름, 묶음, 칩 이름(없으면 이름)]. 묶음은 엘리트 · 유소년 · 풋살(FIFA 사이트의 Practice 메뉴와 같다) */
  var GROUPS=[
    ['att','공격','엘리트'],['def','수비','엘리트'],['tra','공격 전환','엘리트'],['trd','수비 전환','엘리트'],['gk','골키퍼','엘리트'],
    ['club','클럽·대표팀','엘리트'],['view','지도자 관점','엘리트'],['phys','피지컬·기술','엘리트'],
    ['u8','4–8세','유소년','유소년 4–8세'],['u12','8–12세','유소년','유소년 8–12세'],['u15','12–15세','유소년','유소년 12–15세'],['yb','유소년 지도 기본','유소년'],['yc','세계 유소년 사례','유소년'],
    ['fs','풋살','풋살']
  ];
  var PATH_RE=/^[a-z0-9][a-z0-9_\-]*(\/[a-z0-9_\-]+)*\.php$/;
  /* [주제, 경로(BASE 뒤), 우리말 제목, 원래 제목, 지도자 · 팀] */
  var ROWS=[
    ["att","elite-sessions/in-possession/john-peacock-passing-and-receiving.php","패스와 받기의 구조","A structure for passing and receiving","John Peacock"],
    ["att","elite-sessions/in-possession/movement_of_the_front-three_johnson.php","전방 세 명의 움직임","Movement of the front three","Michael Johnson"],
    ["att","elite-sessions/in-possession/diagonal-and-vertical-passing.php","대각선 패스와 세로 패스","Diagonal and vertical passing","Anouschka Bernhard"],
    ["att","elite-sessions/in-possession/creating-chances-and-finishing.php","기회 만들기와 마무리","Creating chances and finishing","Jonas Urias"],
    ["att","elite-sessions/in-possession/mauricio-marques-ball-manipulation-and-control.php","볼 다루기와 컨트롤","Ball manipulation and control","Mauricio Marques"],
    ["att","elite-sessions/in-possession/duenker-passing-under-pressure.php","압박 속에서 패스하기","Passing under pressure","Jacqueline Dünker"],
    ["att","elite-sessions/in-possession/mastering-ball-control.php","볼 컨트롤 익히기","Mastering ball control","Branimir Ujević"],
    ["att","elite-sessions/in-possession/nils-nielsen-solutions-in-the-final-third.php","마지막 3분의 1 지역에서 답 찾기","Solutions in the final third","Nils Nielsen"],
    ["att","elite-sessions/in-possession/improving-the-ability-to-play-forward-centrally.php","가운데로 전진 패스하는 힘 키우기","Improving the ability to play forward centrally","Sean Douglas"],
    ["att","elite-sessions/in-possession/breaking-lines.php","라인 깨기","Breaking lines","Jonas Urias"],
    ["att","elite-sessions/in-possession/directing-the-ball-with-the-first-touch.php","첫 터치로 방향 잡기","Directing the ball with the first touch","Jacqueline Dünker"],
    ["att","elite-sessions/in-possession/turning-to-exploit-space-in-central-area-nielsen.php","돌아서서 가운데 공간 쓰기","Turning to exploit space in central areas","Nils Nielsen"],
    ["att","elite-sessions/in-possession/switching_play.php","반대쪽으로 넘기는 패스의 기술 기초","Technical foundations for switching play","Lamia Boumehdi"],
    ["att","elite-sessions/in-possession/building_from_the_back_skinner.php","골키퍼를 쓰는 빌드업","Using the goalkeeper for successful build-up","Rehanne Skinner"],
    ["def","elite-sessions/out-of-possession/defending-as-a-unit.php","한 덩어리로 수비하기","Defending as a unit","Belinda Wilson"],
    ["def","elite-sessions/out-of-possession/bernhard-forward-defending.php","전환과 앞에서 수비하기","Transitioning and forward defending","Anouschka Bernhard"],
    ["def","elite-sessions/out-of-possession/collective-ball-recovery-in-a-low-block.php","낮은 블록에서 함께 공 되찾기","Collective ball recovery in a low block","Oumarou Diabaté"],
    ["def","elite-sessions/out-of-possession/chiba_said-defending-in-a-mid-block.php","미드 블록 수비의 기초","Foundations for defending in a mid-block","Saïd Chiba"],
    ["def","elite-sessions/out-of-possession/defending-with-a-back-four.php","포백 수비의 기초","Foundations for a back four","Jens Lehmann"],
    ["def","elite-sessions/out-of-possession/johnson-defending-principles.php","개인·소그룹 수비 원칙","Defending principles for individuals and small groups","Michael Johnson"],
    ["tra","elite-sessions/transition-to-attacking/recognising-opportunities-for-attacking-transitions.php","역습 기회 알아채기","Recognising opportunities for attacking transitions","Nils Nielsen"],
    ["tra","elite-sessions/transition-to-attacking/opening-space-on-the-counter-attack.php","역습에서 공간 열기","Opening space on the counter-attack","Jonas Urias"],
    ["tra","elite-sessions/transition-to-attacking/transition-into-attack.php","간격을 좁혀 지키고 공격으로 바꾸기","Keeping it compact and transitioning into attack","Simon Jennings"],
    ["tra","elite-sessions/transition-to-attacking/counter-attacking.php","역습 패턴","Counter-attacking patterns","Lamia Boumehdi"],
    ["tra","elite-sessions/transition-to-attacking/transitions.php","공격 전환과 수비 전환","Attacking and defensive transitions","Adrian Boothroyd"],
    ["trd","elite-sessions/transition-to-defending/fast-recapture.php","빠르게 다시 빼앗기","Fast recapture","Jacqueline Dünker"],
    ["trd","elite-sessions/transition-to-defending/defensive-transitions.php","수비 전환에서 대형 되찾기","Recovering shape in defensive transitions","Abdallah Idrissi"],
    ["trd","elite-sessions/transition-to-defending/counter-pressing.php","카운터프레스하는 마음가짐","Instilling a counter-pressing mind","Noureddine Boubou"],
    ["trd","elite-sessions/transition-to-defending/regaining-possession-high-up-the-pitch.php","높은 곳에서 공 되찾기","Regaining possession high up the pitch",""],
    ["gk","elite-sessions/goalkeeper/in_and_out_of_possession.php","1대1 상황의 골키퍼 위치 잡기","Keeper positioning in 1v1 scenarios","Tim Dittmer"],
    ["gk","elite-sessions/goalkeeper/goalkeepersbuildup.php","골키퍼 빌드업 — 받쳐 주고, 받고, 패스하기","Goalkeeper's build-up - supporting, receiving and passing","Dean Santangelo"],
    ["gk","elite-sessions/goalkeeper/defending_the_goal_or_the_space.php","골문을 지킬까, 공간을 지킬까","Defending the goal or defending the space","Tim Dittmer"],
    ["club","elite-sessions/clubs-and-academies/sydney-fc-embedding-individual-challenges-team-training.php","팀 훈련 안에 개인 과제 넣기","Embedding individual challenges in training","Sydney FC"],
    ["club","elite-sessions/clubs-and-academies/german-academies/training-methods-for-the-playing-style-of-the-bvb-u17-ii.php","도르트문트 플레이 스타일을 위한 훈련","Training exercises for the BVB playing style","Borussia Dortmund U-17"],
    ["club","elite-sessions/national-teams/spain-u23/spain-u23-womens-defensive-shape-and-press-after-losing-possession.php","공 잃은 뒤 수비 대형과 압박","Defensive shape after losing possession","스페인 U-23 여자 대표팀"],
    ["club","elite-sessions/clubs-and-academies/english-academies/newcastle-u-18-attacking-patterns.php","박스 주변 콤비네이션 플레이","Combination play around the box","Newcastle United U-18"],
    ["club","elite-sessions/youth-national-teams/u15-boys-tournament/landing-page.php","청소년 대표팀 대회 안에서","Inside a youth national team tournament","U-15 대표팀"],
    ["club","elite-sessions/national-teams/spain-u23/landing-page.php","카운터프레스 원칙","Counter-pressing principles","스페인 U-23 여자 대표팀"],
    ["club","elite-sessions/national-teams/costa-rica-w/landing-page.php","빠른 템포의 플레이와 압박","Playing at pace and pressing","코스타리카 여자 대표팀"],
    ["club","elite-sessions/youth-national-teams/south-africa-u15/landing-page.php","가치와 경기 스타일 심기","Instilling values and a style of play","남아공 U-15 대표팀"],
    ["club","elite-sessions/youth-national-teams/france-u17-men/landing-page.php","경기 준비 훈련","Match-preparation training","프랑스 U-17 대표팀"],
    ["club","elite-sessions/youth-national-teams/mexico-u15-boys-/landing-page-combined.php","남녀 대표팀 훈련 캠프","Coverage of boys and girls camps","멕시코 U-15 대표팀"],
    ["club","elite-sessions/clubs-and-academies/dutch-academies/nec-nijmegen-home.php","가운데 전진 막기","Denying central progression","NEC Nijmegen"],
    ["club","elite-sessions/clubs-and-academies/dutch-academies/fc-twente-heracles-home.php","두 클럽, 하나의 아카데미","Two clubs, one academy","FC Twente · Heracles Almelo"],
    ["club","elite-sessions/clubs-and-academies/english-academies/newcastle-united-home.php","엘리트 아카데미의 훈련","An elite academy in action","Newcastle United"],
    ["club","elite-sessions/clubs-and-academies/sydney-fc-home.php","경기 중심 훈련 방식","Sydney FC’s game-based approach","Sydney FC"],
    ["club","elite-sessions/clubs-and-academies/german-academies/landing-pages/schalke-04-u19-landing-page.php","골키퍼가 시작하는 역습","Goalkeepers initiating counter-attacks","Schalke 04 U-19"],
    ["club","elite-sessions/clubs-and-academies/german-academies/landing-pages/borussia-dortmund-u17-landing-page.php","핵심 경기 원칙 훈련","Training key game principles","Borussia Dortmund U-17"],
    ["club","elite-sessions/clubs-and-academies/german-academies/landing-pages/tsg-hoffenheim-u19-landing-page.php","게임 모델을 훈련으로","Showcasing the game model","TSG Hoffenheim U-19"],
    ["club","elite-sessions/clubs-and-academies/german-academies/landing-pages/grasshoppers-club-zurich-women-landing-page.php","카운터프레스 다듬기","Refining the counter-press","GC Zürich 여자팀"],
    ["view","training-perspectives/on-the-training-ground-with/roger-schmidt/on-the-training-ground-with-roger-schmidt-part-3.php","결정적인 전진 플레이","Executing decisive forward play","Roger Schmidt"],
    ["view","training-perspectives/session-design-tool/-simon-jennings.php","선수 중심 세션 설계 모델","Simon Jennings reveals his player-centred model","Simon Jennings"],
    ["view","training-perspectives/outplaying-the-opponent-with-michael-beale/outplaying-the-opponent-with-michael-beale-home.php","기초에서 경기력까지 — 상대를 벗겨내기","From foundations to performance with Michael Beale","Michael Beale"],
    ["view","training-perspectives/designing-games-for-development/landing-page.php","경기 중심 훈련의 디테일","Arne Barez explores the nuances of game-based training","Arne Barez"],
    ["view","training-perspectives/on-the-training-ground-with/gilberto-silva/landing-page.php","경기를 읽는 눈 키우기","Gilberto Silva coaches game awareness","Gilberto Silva"],
    ["view","training-perspectives/on-the-training-ground-with/roger-schmidt/landing-page.php","강한 전방 압박 원칙","Roger Schmidt instils his high-pressing principles","Roger Schmidt"],
    ["view","training-perspectives/trajectory/anticipating-ball-trajectories-landing-page-1.php","공의 궤적 미리 읽기","Thierry Barnerat’s ball-flight series","Thierry Barnerat"],
    ["phys","speed-technical-coordination/speed-technical-coordination-circuit-6.php","빠른 템포의 기술 훈련","High-tempo technique development","Tony Colbert"],
    ["phys","training-perspectives/athleticism-for-young-players/athleticism-for-young-players-landing-page.php","어린 선수를 위한 똑똑한 피지컬 훈련","Tony Colbert introduces smart physical exercises for players","Tony Colbert"],
    ["phys","technical-activation/landing-page.php","기술 워밍업 시리즈","Tony Colbert’s technical warm-up series","Tony Colbert"],
    ["phys","speed-technical-coordination/speed-technical-coordination-landing-page.php","스피드·기술 서킷","Tony Colbert’s speed and technique circuits","Tony Colbert"],
    ["phys","returning-from-injury/returning-from-injury-landing-page.php","부상 복귀 프로그램","Tony Colbert’s injury recovery programme","Tony Colbert"],
    ["u8","grassroots/4-to-8/tag-and-small-sided-finishing-games.php","술래잡기와 작은 경기로 마무리","Tag and small-sided finishing games",""],
    ["u8","grassroots/4-to-8/agility-training-for-better-ball-control.php","민첩성으로 볼 컨트롤 높이기","Agility training for better ball control",""],
    ["u8","grassroots/4-to-8/decide-and-deliver.php","판단하고 해내기","Decide and deliver",""],
    ["u8","grassroots/4-to-8/perfect-the-pass.php","정확한 패스","Perfect the pass",""],
    ["u8","grassroots/4-to-8/team-bonding.php","팀워크 다지기","Team bonding",""],
    ["u8","grassroots/4-to-8/protect-the-ball.php","공 지키기","Protect the ball",""],
    ["u8","grassroots/4-to-8/defending-outnumbered.php","수가 적을 때 수비하기","Defending outnumbered",""],
    ["u8","grassroots/4-to-8/shooting.php","슈팅","Shooting",""],
    ["u8","grassroots/4-to-8/ball-movement.php","공 움직이기","Ball movement",""],
    ["u8","grassroots/4-to-8/different-field-sizes.php","경기장 크기를 바꿔 가며","Different field sizes",""],
    ["u8","grassroots/4-to-8/trolley-races-and-small-sided-games.php","수레 달리기와 작은 경기","Trolley races and small-sided games",""],
    ["u8","grassroots/4-to-8/lead-and-play.php","이끌고 놀기","Lead and play",""],
    ["u8","grassroots/4-to-8/small-team-exercises.php","작은 팀 연습","Small team exercises",""],
    ["u8","grassroots/4-to-8/controlled-possession.php","침착하게 공 갖고 있기","Controlled possession",""],
    ["u8","grassroots/4-to-8/relays-end-zones-and-3v3s.php","릴레이, 엔드존, 3대3","Relays, end zones and 3v3s",""],
    ["u8","grassroots/4-to-8/compete-from-the-off.php","처음부터 겨루기","Compete from the off",""],
    ["u8","grassroots/4-to-8/bring-all-the-elements-into-the-game.php","모든 요소를 경기에 담기","Bring all the elements into the game",""],
    ["u12","grassroots/8-to-12/playing-the-final-pass.php","마지막 패스 넣어 주기","Playing the final pass",""],
    ["u12","grassroots/8-to-12/the-art-of-keeping-the-ball.php","공을 지키는 기술","The art of keeping the ball",""],
    ["u12","grassroots/8-to-12/give-and-go.php","주고 나가기 (원투)","Give and go",""],
    ["u12","grassroots/8-to-12/speed-and-control.php","스피드와 컨트롤","Speed and control",""],
    ["u12","grassroots/8-to-12/dribble-with-control.php","컨트롤하며 드리블","Dribble with control",""],
    ["u12","grassroots/8-to-12/non-verbal-communication.php","말 없이 소통하기","Non-verbal communication",""],
    ["u12","grassroots/8-to-12/different-pitches.php","여러 가지 경기장","Different pitches",""],
    ["u12","grassroots/8-to-12/communication-is-key.php","소통이 열쇠","Communication is key",""],
    ["u12","grassroots/8-to-12/possession-versus-attacking.php","점유 대 공격","Possession versus attacking",""],
    ["u12","grassroots/8-to-12/the-final-pass.php","마지막 패스","The final pass",""],
    ["u12","grassroots/8-to-12/find-the-gap.php","빈틈 찾기","Find the gap",""],
    ["u12","grassroots/8-to-12/switch-of-play.php","반대쪽으로 넘기기","Switch of play",""],
    ["u12","grassroots/8-to-12/street-football.php","스트리트 축구","Street football",""],
    ["u12","grassroots/8-to-12/volley-technique.php","발리 기술","Volley technique",""],
    ["u12","grassroots/8-to-12/with-accuracy-into-space.php","공간으로 정확하게","With accuracy into space",""],
    ["u12","grassroots/8-to-12/hows-your-touch.php","터치 점검","How's your touch?",""],
    ["u12","grassroots/8-to-12/towards-goal-as-a-team-and-alone.php","골을 향해 — 함께, 그리고 혼자","Towards goal: As a team and alone",""],
    ["u15","grassroots/12-to-15/multi-team-passing-and-small-sided-game-exercises.php","여러 팀 패스와 작은 경기","Multi-team passing and small-sided game exercises",""],
    ["u15","grassroots/12-to-15/dynamicrondos-and-numerical-advantages.php","움직이는 론도와 수적 우위","Dynamic rondos and numerical advantages",""],
    ["u15","grassroots/12-to-15/experimenting-with-positional-freedom.php","포지션을 자유롭게 바꿔 보기","Experimenting with positional freedom",""],
    ["u15","grassroots/12-to-15/stay-calm.php","침착하게","Stay calm",""],
    ["u15","grassroots/12-to-15/finish-your-chances.php","기회를 골로","Finish your chances",""],
    ["u15","grassroots/12-to-15/dominate-possession.php","점유를 지배하기","Dominate possession",""],
    ["u15","grassroots/12-to-15/pass-and-offer-pass-and-move.php","주고 받으러 가기, 주고 움직이기","Pass and offer, pass and move",""],
    ["u15","grassroots/12-to-15/accuracy-and-duels.php","정확성과 경합","Accuracy and duels",""],
    ["u15","grassroots/12-to-15/defending-outnumbered.php","수가 적을 때 수비하기","Defending outnumbered",""],
    ["u15","grassroots/12-to-15/wing-play.php","측면 플레이","Wing play",""],
    ["u15","grassroots/12-to-15/recognise-the-situation.php","상황 알아채기","Recognise the situation",""],
    ["u15","grassroots/12-to-15/towards-the-goal-with-pace.php","속도를 붙여 골로","Towards the goal with pace",""],
    ["u15","grassroots/12-to-15/use-your-head.php","헤더","Use your head",""],
    ["u15","grassroots/12-to-15/transition.php","전환","Transition",""],
    ["u15","grassroots/12-to-15/offensive-advantage.php","공격 수적 우위","Offensive advantage",""],
    ["u15","grassroots/12-to-15/breaking-lines.php","라인 깨기","Breaking lines",""],
    ["yb","grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/an-introduction-to-play-practice-play.php","4–8세 · 놀이-연습-놀이 입문","An introduction to Play-Practice-Play",""],
    ["yb","grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/coaching-children-to-master-ball-control.php","4–8세 · 볼 컨트롤 익히게 돕기","Coaching children to master ball control",""],
    ["yb","grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/creating-different-ways-to-score.php","4–8세 · 골 넣는 방법을 여러 가지로","Creating different ways to score",""],
    ["yb","grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/developing-shooting-skills.php","4–8세 · 슈팅 기술 키우기","Developing shooting skills",""],
    ["yb","grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/jene-3-dribbling-as-a-positive-start.php","4–8세 · 드리블로 즐겁게 시작하기","Dribbling as a positive start",""],
    ["yb","grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/building-spatial-awareness-in-young-players.php","4–8세 · 공간 감각 키우기","Building spatial awareness in young players",""],
    ["yb","grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/creating-fun-and-effective-warm-ups.php","4–8세 · 재미있고 효과적인 워밍업","Creating fun and effective warm-ups",""],
    ["yb","grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/jene-general-principles-2.php","기본 원칙 · 모두가 뛰는 경기 중심 세션","Creating inclusive, game-based and actively engaging sessions",""],
    ["yb","grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/jene-general-principles-1.php","기본 원칙 · 즐겁고 안전한 환경","Creating a fun and safe playing environment",""],
    ["yb","grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/sessions-for-once-a-week-training.php","8–12세 · 주 1회 훈련용 세션","Sessions for once-a-week training",""],
    ["yb","grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/learning-through-numeric-progression-games.php","8–12세 · 인원을 늘려 가는 게임으로 배우기","Learning through numeric progression games",""],
    ["yb","grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/coaching-with-the-global-analytical-global-model.php","8–12세 · 전체-부분-전체 모델로 지도하기","Coaching with the Global-Analytical-Global model",""],
    ["yb","grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/stanley-2-focusing-on-technical-skills-in-unopposed-warm-ups.php","8–12세 · 수비 없는 워밍업에서 기술 다지기","Focusing on technical skills in unopposed warm-ups",""],
    ["yb","grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/stanley-gardiner-making-warm-ups-fun-and-impactful.php","8–12세 · 재미있고 남는 워밍업","Making warm-ups fun and impactful",""],
    ["yb","grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/optimising-game-application.php","12–15세 · 배운 것을 경기로 옮기기","Optimising game application",""],
    ["yb","grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/optimising-skill-development-u12-u15.php","12–15세 · 기술 발달 끌어올리기","Optimising skill development",""],
    ["yb","grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/optimising-warm-ups-u12-to-u15.php","12–15세 · 워밍업 끌어올리기","Optimising warm-ups",""],
    ["yb","grassroots/grassroots-and-youth-football-essentials/grassroots-coaching-essentials/introduction-to-the-progressive-methodology.php","12–15세 · 단계적 지도법 입문","Introduction to the progressive methodology",""],
    ["yc","grassroots/global-grassroots-insights/legia-warsaw-the-decision-makers-of-tomorrow.php","내일의 판단하는 선수들","The decision-makers of tomorrow","Legia Warsaw"],
    ["yc","grassroots/global-grassroots-insights/polonia-warsaw-quiet-coaching-joy-and-1v1-development.php","조용한 코칭, 즐거움, 1대1","Quiet coaching, joy and 1v1 development","Polonia Warsaw"],
    ["yc","grassroots/global-grassroots-insights/gent-u8.php","보석을 키우는 U-8","Producing gems","KRC Gent"],
    ["yc","grassroots/global-grassroots-insights/u-8-and-u-9-royal-fc-mandelunited-where-many-eyes-see-more-clearly.php","여러 눈이 더 잘 본다","Where many eyes see more clearly","Royal FC Mandel United"],
    ["yc","grassroots/global-grassroots-insights/football-girls-leuven-dribble-with-confidence.php","자신 있게 드리블하기","Dribble with confidence","Football Girls Leuven"],
    ["yc","grassroots/global-grassroots-insights/u-12-clearwater-instilling-a-combinative-style-of-play.php","콤비네이션 스타일 심기 (U-12)","Instilling a combinative style","Chargers Soccer Club"],
    ["yc","grassroots/global-grassroots-insights/u-10-clearwater-core-skills-1v1.php","핵심 기술과 1대1 (U-10)","Developing core skills","Chargers Soccer Club"],
    ["yc","grassroots/global-grassroots-insights/christchurch-united.php","살피고 앞으로 플레이하기","Scan to play forward","Christchurch United"],
    ["yc","grassroots/global-grassroots-insights/anton-corneal-building-relationships-between-the-surfaces-of-the-boot.php","발의 여러 면과 친해지기","Building relationships between the surfaces of the boot","Anton Corneal"],
    ["yc","grassroots/global-grassroots-insights/cefor-jilo-u13-fundamental-technical-skills-and-attacking.php","기본 기술과 공격 (U-13)","Fundamental technical skills and attacking","Cefor Jilo"],
    ["yc","grassroots/global-grassroots-insights/cefor-jilo-u15-attacking-technique.php","공격 기술 (U-15)","Attacking technique","Cefor Jilo"],
    ["fs","futsal/block-1/control-under-pressure.php","압박 속 컨트롤","Control under pressure",""],
    ["fs","futsal/block-1/passing-to-keep-possession.php","점유를 지키는 패스","Passing to keep possession",""],
    ["fs","futsal/block-1/passing-to-progress-play.php","전진하는 패스","Passing to progress play",""],
    ["fs","futsal/block-1/dribbling-to-beat-an-opponent.php","상대를 벗겨내는 드리블","Dribbling to beat an opponent",""],
    ["fs","futsal/block-1/running-with-the-ball-with-awareness-and-speed.php","보면서 빠르게 몰고 가기","Running with the ball with awareness and speed",""],
    ["fs","futsal/block-1/progressive-shooting.php","단계별 슈팅","Progressive shooting",""],
    ["fs","futsal/block-1/shooting-in-tight-spaces.php","좁은 공간 슈팅","Shooting in tight spaces",""],
    ["fs","futsal/block-2/playing-into-the-pivot-in-the-final-third.php","공격 지역에서 피보에게 넣기","Playing into the pivot in the final third",""],
    ["fs","futsal/block-2/playing-out-from-the-back-1.php","뒤에서부터 풀어 나오기","Playing out from the back",""],
    ["fs","futsal/block-2/using-width-to-create-space-in-attack.php","폭을 써서 공격 공간 만들기","Using width to create space in attack",""],
    ["fs","futsal/block-2/creating-chances-in-the-final-third.php","공격 지역에서 기회 만들기","Creating chances in the final third",""],
    ["fs","futsal/block-2/using-the-pivot-to-overcome-the-press.php","피보로 압박 넘기","Using the pivot to overcome the press",""],
    ["fs","futsal/block-2/playing-through-the-thirds.php","세 구역을 지나 전진하기","Playing through the thirds",""],
    ["fs","futsal/block-2/possession-and-ball-control.php","점유와 볼 컨트롤","Possession and ball control",""],
    ["fs","futsal/block-2/building-an-attack.php","공격 만들기","Building an attack",""],
    ["fs","futsal/block-2/playing-out-from-the-back-under-pressure.php","압박 속에서 뒤에서부터 풀어 나오기","Playing out from the back under pressure",""],
    ["fs","futsal/block-2/passing-and-directional-play.php","패스와 방향 있는 플레이","Passing and directional play",""],
    ["fs","futsal/block-2/power-play.php","파워 플레이","Power play",""],
    ["fs","futsal/block-3/defensive-low-block.php","낮은 블록의 다이아몬드 대형","Diamond formation in a low block",""],
    ["fs","futsal/block-3/low-block-press.php","낮은 블록 압박","Low-block press",""],
    ["fs","futsal/block-3/press-with-a-numerical-disadvantage.php","수가 적을 때 압박하기","Pressing with a numerical disadvantage",""],
    ["fs","futsal/block-3/defending-in-a-mid-block.php","미드 블록 수비","Defending in a mid-block",""],
    ["fs","futsal/block-4/progressive-attacking-waves.php","단계별 공격 웨이브","Progressive attacking waves",""],
    ["fs","futsal/block-4/exploiting-overloads-on-the-counter-attack.php","역습에서 수적 우위 살리기","Exploiting overloads on the counter-attack",""],
    ["fs","futsal/block-4/counter-attacking-with-speed.php","빠른 역습","Counter-attacking with speed",""],
    ["fs","futsal/block-4/defending-the-counter-outnumbered.php","수가 적을 때 역습 막기","Defending the counter outnumbered",""],
    ["fs","futsal/block-4/delay-dictate-and-deny-the-opposition.php","늦추고, 몰고, 막기","Delay, dictate and deny the opposition",""],
    ["fs","futsal/block-5/4-0-system-creating-space-in-behind.php","4-0 시스템 — 뒷공간 만들기","4-0 system: Creating space in behind",""],
    ["fs","futsal/block-5/3-1-system-role-of-the-pivot.php","3-1 시스템 — 피보의 역할","3-1 system: Role of the pivot",""],
    ["fs","futsal/block-5/1-3-system-space-and-verticality.php","1-3 시스템 — 공간과 세로 움직임","1-3 system: Space and verticality",""],
    ["fs","futsal/block-5/2-2-system-1v1-situations.php","2-2 시스템 — 1대1 상황","2-2 system: 1v1 situations",""],
    ["fs","futsal/gk-skills/goalkeeper-techniques.php","골키퍼 기술","Goalkeeper techniques",""],
    ["fs","futsal/block-6/defending-from-the-goal-line.php","골키퍼 · 골라인에서 막기","Defending from the goal-line",""],
    ["fs","futsal/block-6/saving-frontal-shots.php","골키퍼 · 정면 슈팅 막기","Saving frontal shots",""],
    ["fs","futsal/block-6/blocking-and-continuing-play.php","골키퍼 · 막고 이어 가기","Blocking and continuing play",""],
    ["fs","futsal/block-6/defending-shots-from-out-wide.php","골키퍼 · 측면 슈팅 막기","Defending shots from out wide",""],
    ["fs","futsal/block-6/defending-the-edge-of-the-penalty-area.php","골키퍼 · 페널티 박스 끝 막기","Defending the edge of the penalty area",""],
    ["fs","futsal/block-6/defending-mid-range-shots.php","골키퍼 · 중거리 슈팅 막기","Defending mid-range shots",""],
    ["fs","futsal/block-6/close-range-finishing-and-quick-restarts.php","골키퍼 · 가까운 슈팅과 빠른 재시작","Close-range finishing and quick restarts",""],
    ["fs","futsal/block-6/restarts-keeping-play-going-and-aerial-balls.php","골키퍼 · 재시작, 플레이 잇기, 공중볼","Restarts, keeping play going and aerial balls",""],
    ["fs","futsal/block-6/throw-outs-and-1v1s-from-out-wide.php","골키퍼 · 스로 아웃과 측면 1대1","Throw-outs and 1v1s from out wide",""],
    ["fs","futsal/block-6/using-the-goalkeeper-to-create-overloads.php","골키퍼로 수적 우위 만들기","Using the goalkeeper to create overloads",""],
    ["fs","futsal/fitness/agility-speed-activation.php","피지컬 · 민첩성·스피드 활성화","Agility & speed activation",""],
    ["fs","futsal/fitness/mulitball-passing.php","피지컬 · 여러 공으로 패스","Multiball passing",""],
    ["fs","futsal/fitness/pressing-4v4plus-4.php","피지컬 · 4대4+4 압박","Pressing 4v4 plus",""],
    ["fs","futsal/fitness/warm-up-progression.php","피지컬 · 단계별 워밍업","Warm-up progression",""],
    ["fs","futsal/fitness/aerobic-power-through-3v3-small-sided-game.php","피지컬 · 3대3 경기로 유산소 파워","Aerobic power through 3v3 small-sided game",""],
    ["fs","futsal/fitness/anaerobic-training-using-a-possession-game.php","피지컬 · 점유 게임으로 무산소 훈련","Anaerobic training using a possession game",""],
    ["fs","futsal/fitness/transition-and-pressing-from-4v2-to-4v6.php","피지컬 · 4대2에서 4대6까지 전환과 압박","Transition and pressing from 4v2 to 4v6",""],
    ["fs","futsal/fitness/strength-through-shielding.php","피지컬 · 몸으로 지키며 힘 기르기","Strength through shielding",""],
    ["fs","futsal/fitness/recovery-runs.php","피지컬 · 회복 달리기","Recovery runs",""],
    ["fs","futsal/fitness/high-speed-transitions.php","피지컬 · 고속 전환","High-speed transitions",""]
  ];
  var GMAP={}; GROUPS.forEach(function(g){ GMAP[g[0]]=g; });
  function str(v,n){ return (typeof v==='string'?v:'').trim().slice(0,n); }
  function url(path){ return (typeof path==='string'&&PATH_RE.test(path)&&path.indexOf('..')<0)?BASE+path:''; }
  /* 표 → 카드들. 주제를 모르거나 주소를 지을 수 없거나 같은 주소가 두 번이면 버린다 */
  function read(rows){
    var out=[],seen={};
    (Array.isArray(rows)?rows:[]).forEach(function(r){
      if(!Array.isArray(r))return;
      var g=GMAP[r[0]],u=url(r[1]),ko=str(r[2],80);
      if(!g||!u||!ko||seen[u])return; seen[u]=1;
      out.push({g:g[0],label:g[1],sec:g[2],url:u,ko:ko,en:str(r[3],120),by:str(r[4],60)});
    });
    return out;
  }
  var LIST=null;
  function list(){ if(!LIST)LIST=read(ROWS); return LIST; }
  /* ── 3.072 · 애니메이션(시범) — studio/fifa-packs/index.json(scripts/fifa-scenes.mjs 가 짓는다)에 있는 세션은 카드를 누르면 작전판 뷰어로 연다 ──
     목록 줄: {id:'001'(세 자리), path(ROWS 의 경로), rev, trainings:[{name,minutes,scenes}]}. 표에 없는 경로 · 이상한 줄은 버린다 */
  var ANIM={},ANIM_N=0,PACK_DIR='fifa-packs/',PACK_MAX=4*1024*1024;
  function readIndex(j){
    var m={},n=0; if(!j||j.type!=='process-studio-fifa-index'||!Array.isArray(j.sessions))return null;
    var known={}; list().forEach(function(e){ known[e.url]=1; });
    j.sessions.slice(0,400).forEach(function(r){ if(!r||typeof r!=='object')return;
      var u=url(r.path),id=str(r.id,3); if(!u||!known[u]||m[u]||!/^\d{3}$/.test(id)||!Array.isArray(r.trainings)||r.trainings.length<1||r.trainings.length>6)return;
      var pl=Array.isArray(r.players)?r.players.map(function(v){ return Math.max(0,Math.min(99,Math.floor(+v||0))); }).slice(0,2):null;
      m[u]={id:id,rev:/^[0-9a-f]{6,12}$/.test(r.rev)?r.rev:'',focus:str(r.focus,8),players:pl&&pl.length===2?pl:null,trainings:r.trainings.map(function(t,k){ t=(t&&typeof t==='object')?t:{};
        return {name:str(t.name,60)||('훈련 '+(k+1)),minutes:Math.max(0,Math.min(600,Math.floor(+t.minutes||0))),scenes:Math.max(0,Math.min(40,Math.floor(+t.scenes||0)))}; })}; n++; });
    return {m:m,n:n};
  }
  function setIndex(j){ var r=readIndex(j); if(!r)return false; ANIM=r.m; ANIM_N=r.n; return true; }
  function animOf(e){ return (e&&Object.prototype.hasOwnProperty.call(ANIM,e.url))?ANIM[e.url]:null; }
  function packUrl(a){ return PACK_DIR+a.id+'.json'+(a.rev?('?v='+a.rev):''); }
  /* 3.074 — 카드 미리보기: 훈련 k(1부터)의 첫 장면 그림(scripts/fifa-thumbs.mjs). 그림은 <img> 로만 그린다 */
  function thumbUrl(a,k){ k=Math.max(1,Math.min(a.trainings.length,Math.floor(+k||1))); return PACK_DIR+'thumbs/'+a.id+'-'+k+'.svg'+(a.rev?('?v='+a.rev):''); }
  /* 팩 → 뷰어가 받는 글(item) — 프로세스 칸 procItem 과 같은 정리(dep = {fields, snap, trainings, frames}). 목록의 그 세션이 아니면 받지 않는다 */
  function item(pack,e,dep){
    var a=animOf(e); if(!a||!pack||pack.type!=='process-studio-drillpack'||!Array.isArray(pack.drills)||pack.drills.length!==1)return null;
    var d=pack.drills[0]; if(!d||typeof d!=='object'||!Array.isArray(d.trainings)||d.trainings.length!==a.trainings.length)return null;
    if(!d.fifa||typeof d.fifa!=='object'||url(d.fifa.path)!==e.url)return null;
    for(var i=0;i<d.trainings.length;i++){ var t=d.trainings[i]; if(!t||typeof t!=='object'||!t.snap||typeof t.snap!=='object'||!Array.isArray(t.snap.players))return null; }
    var it={}; dep.fields.forEach(function(k){ if(d[k]!=null)it[k]=d[k]; });
    it.type='train'; it.name=str(d.name,60)||e.ko; delete it.scenes;
    it.snap=dep.snap(it.snap);
    var trs=dep.trainings(d); if(!trs||trs.length!==a.trainings.length)return null;
    trs.forEach(function(t){ t.thumb=''; delete t.scenes; var tf=dep.frames(t.frames); if(tf)t.frames=tf; else{ delete t.frames; delete t.animIdx; } });
    it.trainings=trs;
    var fr=dep.frames(it.frames); if(fr)it.frames=fr; else delete it.frames;
    return it;
  }
  /* 뷰어 · 담기가 쓰는 글. 서버 글이 아니다(id 가 fifa- 로 시작) — 조회 · 담김 숫자 · 신고가 없다 */
  function post(e,it){ var a=animOf(e); return {id:'fifa-'+a.id,fifa:true,title:e.ko,owner_name:'FIFA Training Centre 참고',cat:'',age:'',players:'',summary:'',thumb:'',item:it,src:e.url}; }
  function get(fetcher,u){ return fetcher(u,{credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'}).then(function(r){ if(!r.ok)throw new Error('http '+r.status); return r.text(); })
    .then(function(t){ if(t.length>PACK_MAX)throw new Error('big'); return JSON.parse(t); }); }
  function loadIndex(fetcher){ return get(fetcher,PACK_DIR+'index.json').then(function(j){ if(!setIndex(j))throw new Error('shape'); return ANIM_N; }); }
  function loadPost(e,dep,fetcher){ var a=animOf(e); if(!a)return Promise.reject(new Error('none'));
    return get(fetcher,packUrl(a)).then(function(pk){ var it=item(pk,e,dep); if(!it)throw new Error('shape'); return post(e,it); }); }
  function match(e,group,q){
    if(group==='anim'){ if(!animOf(e))return false; }
    else if(group&&group!=='all'&&e.g!==group)return false;
    if(q){ var hay=[e.ko,e.en,e.by,e.label,e.sec].join(' ').toLowerCase(); if(hay.indexOf(String(q).toLowerCase())<0)return false; }
    return true;
  }
  function counts(l){ var c={}; (l||list()).forEach(function(e){ c[e.g]=(c[e.g]||0)+1; }); return c; }
  function el(doc,tag,cls,text){ var x=doc.createElement(tag); if(cls)x.className=cls; if(text!=null)x.textContent=text; return x; }
  function animCard(doc,e,an,onOpen,o2){
    var c=el(doc,'div','fi-card fi-anim'); c.setAttribute('role','button'); c.tabIndex=0;
    c.setAttribute('aria-label',e.ko+' — 애니메이션 · 훈련 '+an.trainings.length+'개 열기');
    /* 3.074 — 미리보기 그림 한 장(프로세스 카드와 같은 자리 · 같은 3:2) + 1·2·3 으로 훈련 그림 바꾸기. 고른 훈련부터 뷰어를 연다 */
    var k=0,nt=Math.min(3,an.trainings.length),hero=el(doc,'div','pr-hero fi-hero-img'),img=el(doc,'img');
    img.alt=''; img.loading='lazy'; img.decoding='async'; img.referrerPolicy='no-referrer'; img.src=thumbUrl(an,1);
    hero.appendChild(img); c.appendChild(hero);
    var bar=el(doc,'div','pr-bar fi-bar'),pick=el(doc,'div','pr-pick'),sc=el(doc,'span','pr-sc');
    var show=function(i){ k=i; img.src=thumbUrl(an,i+1);
      [].forEach.call(pick.children,function(b,j){ b.setAttribute('aria-pressed',j===i?'true':'false'); });
      [].forEach.call(ol.children,function(li,j){ li.className=j===i?'on':''; });
      sc.textContent='훈련 '+(i+1)+' · 장면 '+(an.trainings[i].scenes||0); };
    for(var j=0;j<nt&&nt>1;j++)(function(j){ var b=el(doc,'button',null,String(j+1)); b.type='button'; b.setAttribute('aria-pressed',j?'false':'true');
      b.setAttribute('aria-label','훈련 '+(j+1)+' 그림 · '+an.trainings[j].name); b.onclick=function(ev){ ev.stopPropagation(); show(j); }; pick.appendChild(b); })(j);
    if(nt>1)bar.appendChild(pick); bar.appendChild(sc); c.appendChild(bar);
    var bd=el(doc,'div','fi-bd'); c.appendChild(bd);
    var top=el(doc,'div','fi-top');
    top.appendChild(el(doc,'span','fi-badge fi-badge-anim','▶ 애니메이션'));
    top.appendChild(el(doc,'span','fi-badge',e.sec===e.label?e.label:(e.sec+' · '+e.label)));
    bd.appendChild(top);
    bd.appendChild(el(doc,'div','fi-tt',e.ko));
    var ol=el(doc,'ol','fi-trs');
    an.trainings.forEach(function(t,i){ var li=el(doc,'li'); if(!i)li.className='on'; li.onclick=function(ev){ if(i<nt){ ev.stopPropagation(); show(i); if(onOpen)onOpen(e,c,i); } }; li.appendChild(el(doc,'span','fi-i',String(i+1))); li.appendChild(el(doc,'span','fi-nm',t.name)); li.appendChild(el(doc,'span','fi-mn',t.minutes?(t.minutes+'분'):'')); ol.appendChild(li); });
    bd.appendChild(ol);
    if(o2&&o2.badge)o2.badge(bd,e);
    sc.textContent='훈련 1 · 장면 '+(an.trainings[0].scenes||0);
    var ft=el(doc,'div','fi-foot');
    ft.appendChild(el(doc,'span','fi-by','FIFA Training Centre 참고'+(e.by?' · '+e.by:'')));
    var src=el(doc,'a','fi-go','원문 ↗'); src.href=e.url; src.target='_blank'; src.rel='noopener noreferrer'; src.setAttribute('aria-label','FIFA 원문 — 새 탭에서 열기');
    src.onclick=function(ev){ ev.stopPropagation(); };
    ft.appendChild(src); bd.appendChild(ft);
    c.onclick=function(){ if(onOpen)onOpen(e,c,k); };
    c.onkeydown=function(ev){ if(ev.target!==c)return; if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); if(onOpen)onOpen(e,c,k); } };
    return c;
  }
  function card(doc,e,onOpen,o2){
    var an=animOf(e); if(an)return animCard(doc,e,an,onOpen,o2);
    var a=el(doc,'a','fi-card');
    a.href=e.url; a.target='_blank'; a.rel='noopener noreferrer';
    a.setAttribute('aria-label',e.ko+(e.by?' · '+e.by:'')+' — FIFA 훈련센터에서 열기(새 탭)');
    var top=el(doc,'div','fi-top');
    top.appendChild(el(doc,'span','fi-badge',e.sec===e.label?e.label:(e.sec+' · '+e.label)));
    top.appendChild(el(doc,'span','fi-src','FIFA'));
    a.appendChild(top);
    a.appendChild(el(doc,'div','fi-tt',e.ko));
    if(e.en)a.appendChild(el(doc,'div','fi-en',e.en));
    var ft=el(doc,'div','fi-foot');
    ft.appendChild(el(doc,'span','fi-by',e.by||'FIFA Training Centre'));
    ft.appendChild(el(doc,'span','fi-go','FIFA에서 보기 ↗'));
    a.appendChild(ft);
    return a;
  }
  /* 목록 — grid 를 비우고 머리 띠 + 카드. 개수는 count 칸에. 고른 주제가 비면(없는 키) 전체로 본다 */
  function render(grid,o){
    o=o||{}; var doc=grid.ownerDocument,group=GMAP[o.group]?o.group:'all',q=str(o.q,80);
    if(group==='anim'&&!ANIM_N)group='all';
    var l=list().filter(function(e){ return match(e,group,q)&&(!o.ok||o.ok(e)); });   /* 3.075 — 커뮤니티 공통 분류(o.ok) */
    l=l.filter(animOf).concat(l.filter(function(e){ return !animOf(e); }));   /* 3.072 — 애니메이션이 있는 세션을 앞에 */
    grid.textContent='';
    var hero=el(doc,'div','fi-hero'),tx=el(doc,'div','fi-hero-tx');
    tx.appendChild(el(doc,'b',null,'FIFA 훈련센터'));
    tx.appendChild(el(doc,'span',null,'FIFA가 공개한 훈련 세션 모음이에요. ▶ 애니메이션 카드는 FIFA 훈련을 참고해 작전판으로 다시 그린 것으로, 눌러서 움직임을 보고 보관함에 담을 수 있어요. 나머지 카드는 FIFA 사이트(영어)에서 열려요.'));
    hero.appendChild(tx);
    var go=el(doc,'a','fi-home','사이트 열기 ↗'); go.href=HOME; go.target='_blank'; go.rel='noopener noreferrer'; go.setAttribute('aria-label','FIFA 훈련센터 사이트 — 새 탭에서 열기');
    hero.appendChild(go);
    grid.appendChild(hero);
    if(o.count)o.count.textContent='훈련 '+l.length+'개';
    if(!l.length){ var em=el(doc,'div','empty'); em.appendChild(el(doc,'b',null,'이 조건의 훈련은 0개예요')); em.appendChild(doc.createTextNode('검색어나 주제를 바꿔 보세요.')); grid.appendChild(em); return l.length; }
    l.forEach(function(e){ grid.appendChild(card(doc,e,o.onOpen,o)); });
    return l.length;
  }
  /* 컴퓨터의 오른쪽 칸 — 고를 글이 없다(카드는 바로 FIFA 로 간다). 묶음별 개수와 안내 */
  function aside(box){
    if(!box)return; var doc=box.ownerDocument,c={},l=list();
    l.forEach(function(e){ c[e.sec]=(c[e.sec]||0)+1; });
    box.textContent='';
    var w=el(doc,'div','fi-aside');
    w.appendChild(el(doc,'b',null,'FIFA 훈련센터 · 훈련 '+l.length+'개'));
    var ul=el(doc,'ul');
    ['엘리트','유소년','풋살'].forEach(function(s){ if(c[s])ul.appendChild(el(doc,'li',null,s+' '+c[s]+'개')); });
    w.appendChild(ul);
    w.appendChild(el(doc,'p',null,'카드를 누르면 FIFA 사이트가 새 탭에서 열려요. 마음에 드는 훈련은 작전판에 직접 그려 보관함에 저장해 보세요.'));
    w.appendChild(el(doc,'small',null,'출처: FIFA Training Centre (fifatrainingcentre.com) · 모든 권리는 FIFA에 있어요.'));
    box.appendChild(w);
  }
  /* 왼쪽 «훈련 주제» 칩 — 전체 + 훈련이 있는 주제만 */
  function chips(box,group,onPick){
    if(!box)return; var doc=box.ownerDocument,c=counts(),cur=(GMAP[group]||(group==='anim'&&ANIM_N))?group:'all';
    box.textContent='';
    var mk=function(key,label,n){ var on=cur===key,b=el(doc,'button','chip'+(on?' on':''),label); b.type='button'; b.setAttribute('aria-pressed',on?'true':'false');
      var s=el(doc,'span','pr-cn',String(n)); b.appendChild(s); b.onclick=function(){ onPick(key); }; box.appendChild(b); };
    mk('all','전체',list().length);
    if(ANIM_N)mk('anim','▶ 애니메이션',ANIM_N);
    GROUPS.forEach(function(g){ if(c[g[0]])mk(g[0],g[3]||g[1],c[g[0]]); });
  }
  return {BASE:BASE,HOME:HOME,GROUPS:GROUPS,ROWS:ROWS,read:read,list:list,url:url,match:match,counts:counts,render:render,aside:aside,chips:chips,
    readIndex:readIndex,setIndex:setIndex,animOf:animOf,packUrl:packUrl,thumbUrl:thumbUrl,item:item,post:post,loadIndex:loadIndex,loadPost:loadPost,animCount:function(){ return ANIM_N; }};
});

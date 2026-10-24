// 공식 135훈련 편집 기준. 원문과 운영 보완을 분리해 반복 빌드해도 설명이 누적되지 않는다.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const read=name=>fs.readFileSync(fileURLToPath(new URL(name,import.meta.url)),'utf8');
const source=JSON.parse(read('./proc-practices-source.json')).practices;
export const profiles=Object.fromEntries(read('./proc-coaching.tsv').split('\n').filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{
  const [id,observe,question,change,check,operation,...extra]=l.split('|');
  if(extra.length||![id,observe,question,change,check,operation].every(Boolean))throw Error('코칭 원고 열 오류: '+id);
  return [id,{observe,question,change,check,operation}];
}));
if(Object.keys(profiles).length!==135)throw Error('공식 코칭 원고는 135개여야 합니다');
const clone=o=>JSON.parse(JSON.stringify(o));
const r=v=>Math.round(v*100)/100;
export const metre=s=>/^grid\d+$/.test(s.pitchSpec)?1050/+s.pitchSpec.slice(4):10;
const fifaEnds={'02-3':555,'06-3':430,'07-3':360,'08-3':555,'09-3':555,'11-3':555,'12-2':380,'12-3':555,'13-2':310,'13-3':555,'20-3':555,'24-3':555,'28-3':555,'40-3':555,'45-3':555};
export function fieldBounds(s,id){
  if(s.pitchSpec==='fifa')return [30,30,fifaEnds[id]||555,710];
  const rects=(s.drawings||[]).filter(d=>d.type==='rectline'&&d.pts?.length===2&&d.pts.every(p=>p.y>=10));
  rects.sort((a,b)=>Math.abs((b.pts[1].x-b.pts[0].x)*(b.pts[1].y-b.pts[0].y))-Math.abs((a.pts[1].x-a.pts[0].x)*(a.pts[1].y-a.pts[0].y)));
  const q=rects[0]?.pts;
  return q?[Math.min(q[0].x,q[1].x),Math.min(q[0].y,q[1].y),Math.max(q[0].x,q[1].x),Math.max(q[0].y,q[1].y)]:null;
}
export function qualitySnap(input,id){
  const s=clone(input),m=metre(s),bounds=fieldBounds(s,id);
  s.ball.scale=Math.min(s.ball.scale||.62,.46);
  // 실제 보드의 네이티브 반 코트 보기. 기존 선수·세트피스 위치는 바꾸지 않는다.
  if(s.pitchSpec==='fifa'){s.pitchView='half';s.pvSide='own';}
  for(const g of s.equipment||[]){
    if(!['goalV','minigoalV'].includes(g.team))continue;
    if(!bounds)throw Error(id+': 골라인을 확인할 수 없습니다');
    const left=Math.abs(g.x-bounds[0])<Math.abs(g.x-bounds[2]);
    const mini=g.team==='minigoalV';
    const width=mini?2:id==='04-3'?5:id==='23-3'?3:7.32;
    g.anchor='mouth';g.mouthWidth=r(width*m);g.mouthDepth=r((mini?1:id==='23-3'?1:2)*m);
    g.x=left?bounds[0]:bounds[2];g.rot=left?180:0;g.scale=1;
  }
  // 수비·중립도 개체를 구별한다. 원래 번호와 GK 표기는 유지한다.
  const teams=[...new Set(s.players.map(p=>p.team))];
  for(const team of teams){let n=0;const used=new Set(s.players.filter(p=>p.team===team).map(p=>String(p.num||'')));
    for(const p of s.players.filter(p=>p.team===team))if(!String(p.num||'').trim()){
      const prefix=p.pos==='GK'?'GK':team==='yellow'?'J':team==='red'?'D':'P';
      let label;do{label=prefix+(++n);}while(used.has(label));p.num=label;used.add(label);
    }
  }
  if(id==='27-2'){
    s.drawings=s.drawings.filter(d=>!(d.pts||[]).some(p=>p.y<10)&&!String(d.text||'').startsWith('병렬 운영'));
    s.drawings.push({type:'text',text:'병렬 운영  4v4 · 3v3 · 2v2  /  아래 판은 3v3 예시',pts:[{x:555,y:47}],size:19,color:'#dfe3ea',lw:1,op:.9});
  }
  if(id.startsWith('41-')){
    const plot=id==='41-1'?[30,210,260,320,350,250,.6]:id==='41-2'?[385,230,340,280,450,55,.55]:[335,210,440,320,470,55,.4];
    const [x,y,w,h,px,py,k]=plot;
    s.equipment=s.equipment.filter(g=>g.team!=='marker');
    for(const e of source[id].recordingExample)s.equipment.push({...e,x:r(px+(e.x-x)*k),y:r(py+(e.y-y)*k),scale:.32});
    s.drawings=s.drawings.filter(d=>!d.qualityRecordPlot);
    s.drawings.push(
      {type:'rect',color:'#9ca9bd',op:.09,pts:[{x:px-10,y:py-35},{x:px+w*k+10,y:py+h*k+30}],lw:1,qualityRecordPlot:1},
      {type:'rectline',color:'#aab6ca',op:.6,pts:[{x:px,y:py},{x:px+w*k,y:py+h*k}],lw:.7,qualityRecordPlot:1},
      {type:'text',text:'슛 기록 예시',color:'#dfe3ea',op:.9,pts:[{x:px+w*k/2,y:id==='41-1'?py-18:py+15}],size:10,qualityRecordPlot:1}
    );
    s.players.filter(p=>p.team==='yellow').forEach((p,i)=>{p.num='R'+(i+1);});
  }
  return s;
}

// 득점 예시의 공은 골 입구를 통과하고 포스트 안에 전부 들어간다.
// 세이브·빗나감·차단은 고치지 않는다. 원래 shot 플래그의 전이만 다룬다.
export function qualitySpec(input,snap,id){
  const sp=clone(input),m=metre(snap),goals=(snap.equipment||[]).filter(g=>g.anchor==='mouth');
  const len=/^grid/.test(snap.pitchSpec)?+snap.pitchSpec.slice(4):snap.pitchSpec==='u12'?65:105;
  const radius=14*(1.18*42/(28*226/240))*snap.ball.scale*(snap.tokenScale||1)*Math.pow(len/105,.6);
  if(snap.pitchSpec==='fifa')goals.push({x:30,y:370,rot:180,mouthWidth:73.2,mouthDepth:20});
  for(let i=0;i<sp.scenes.length-1;i++){
    const sc=sp.scenes[i],to=sp.scenes[i+1];
    if(!sc.shot||!to.ball||/막|빗|선방|튕|차단|세이브/.test(to.cap||''))continue;
    const [x,y]=to.ball;
    const g=goals.filter(g=>Math.abs(x-g.x)<Math.max(3*m,35)&&Math.abs(y-g.y)<g.mouthWidth*.8).sort((a,b)=>Math.hypot(x-a.x,y-a.y)-Math.hypot(x-b.x,y-b.y))[0];
    if(!g)continue;
    const margin=radius+1.5,half=Math.max(0,g.mouthWidth/2-margin);
    to.ball=[r(g.x+(g.rot===180?-1:1)*Math.max(radius+1.5,Math.min(g.mouthDepth*.45,m*.35))),r(Math.max(g.y-half,Math.min(g.y+half,y)))];
  }
  // 기록 담당은 공이 살아 있을 때 운동장으로 들어가지 않는다.
  if(id==='41-1')for(const sc of sp.scenes){sc.pos={...sc.pos,301:[330,170]};sc.hl=(sc.hl||[]).filter(n=>n!==301);if(/기록|마커/.test(sc.cap||''))sc.cap='플레이 종료 뒤 선 밖 기록에 슛 자리를 남깁니다.';}
  return sp;
}

function corrected(id,key){
  let text=source[id][key];
  if(key==='method'){
    if(id==='02-2')text=text.replace(/넘긴 뒤[^\n]*다섯 걸음[^\n]*/g,'넘긴 뒤에는 구역별 기본 인원을 유지한 채 가까운 선수만 다음 받침을 만듭니다.');
    if(id==='03-1')text=text.replace('9번이 손가락으로 숫자를 들고, 6번은 받기 전에 그 숫자를 외칩니다.','수비가 패스 출발 뒤 붙거나 남기를 스스로 고릅니다. 6번은 실제 압박을 읽어 내주기와 돌아서기를 고릅니다.');
    if(id==='03-2')text=text.replace('끝 조커가 손으로 든 숫자를 받기 전에 외치면 1점을 더 줍니다.','수비가 가운데 띠의 수신자를 따라가거나 남기를 스스로 고릅니다. 받는 선수는 압박이 붙으면 한 번 내주고 빈 길을 다시 찾습니다.');
    if(id==='08-2')text=text.replace('4v4 + 조커 + GK (네 명씩 세 조)','4v4 + 조커 1 + GK 2 (활동 11명 · 대기 4명 포함 15명)');
    if(id==='11-2')text=text.replace('규칙 오프사이드 적용','규칙 훈련용 라인 제한 적용');
    if(id==='22-1')text=text.replace('조커가 줄 길을','조커의 패스 길을');
    if(id==='11-2')text=text.replace(/오프사이드/g,'훈련용 라인 위반').replace('훈련용 라인 위반의 기준은','이 연습에서 출발 위치의 기준은');
    if(id==='18-1')text=text.replace('처음 다섯 판은 8번이 공만 보고 받아 등 뒤를 말로만 알아냅니다. 뒤의 다섯 판은 눈과 귀를 함께 씁니다.','처음에는 수비가 걸어오는 짧은 시범으로 말의 뜻을 맞춥니다. 실제 압박을 넣은 판에서는 처음부터 눈과 귀를 함께 써 확인하고 선택합니다.');
    if(id==='20-2')text=text.replace(/오프사이드/g,'훈련 출발선 위반').replace('규칙 훈련 출발선 위반 적용','규칙 패스 전 출발선 통과 금지').replace('한 조 3명 · 골대 둘','필드 3명 + GK 1명 · 두 골에서 각각 운영');
    if(id==='25-1')text=text.replace('짧아서 공격도 수비도 끝까지 경기의 빠르기로 뛸 수 있고','짧은 구간에 경기의 빠르기를 유지하는 것을 목표로 하며');
    if(id==='27-3')text=text.replace('뛰는 판의 수가 그 선수의 오늘 세기가 됩니다.','판별 역할과 실제 수행·체감 강도를 함께 기록해 그날의 참여량을 조절합니다.');
    if(id==='41-1')text=text.replace('기록 담당은 공격을 뒤따라가다가 슛이 나온 자리에 마커를 놓습니다.','기록 담당은 선 밖에서 슛 위치를 도식에 적습니다. 플레이가 끝난 뒤에만 평평한 마커를 놓고, 확인 후 다음 시작 전에 치웁니다.').replace('여섯 판이면 한 조 여섯 명이 모두 공격을 세 번 합니다.','GK를 제외한 여섯 명을 A–F로 정해 공격 3·수비 2·기록 1 역할을 한 칸씩 순환하면 여섯 판에 각자 공격 세 번, 수비 두 번, 기록 한 번을 맡습니다.').replace('두 판이 끝날 때마다 마커 앞에 모여 색깔별로 셉니다.','두 판이 끝날 때마다 선 밖 누적 도식에 모여 위치별 시도와 득점을 셉니다.').replace('«흰 마커는 어디에 모였나»','«득점 표시는 어디에 모였나»');
    if(id==='41-2')text=text.replace('다시 시작하기 전에 찬 자리에 마커를 놓습니다.','선 밖 도식에 찬 자리를 적습니다. 중단 때 평평한 마커로 보여 주었다면 다음 시작 전에 치웁니다.').replace('구역 안팎의 흰 마커와 주황 마커를 셉니다.','도식에서 구역 안팎의 시도와 득점을 셉니다.');
    if(id==='41-3')text=text.replace('다시 시작하기 전에 찬 자리에 마커를 놓습니다.','선 밖 도식에 찬 자리와 결과를 적습니다. 구간이 끝났을 때만 평평한 마커로 보여 주고 다음 시작 전에 치웁니다.').replace('자기 마커 앞에 모입니다.','자기 팀의 누적 도식 앞에 모입니다.').replace('마커는 경기 내내 쌓아 두어 구간마다 그림이 또렷해지게 합니다.','선 밖 도식에는 구간별 기록을 쌓되 운동장에는 마커를 남겨 두지 않습니다.');
    if(id==='44-2')text=text.replace('옆줄 칸에 공격 3명과 수비 3명, 가운데 구역에 8번과 수비 1명이 섭니다.','던지는 3번은 옆줄 밖, 옆줄 칸에는 공격 세 명(11·9·6번)과 수비 세 명, 가운데 구역에는 8번과 수비 한 명이 섭니다. 3번은 던진 뒤 합류하므로 공격은 총 다섯 명입니다.');
  }else{
    text=text.replace('부리가 뒤를 향했다가','몸 방향 표시가 뒤를 향했다가');
    if(id==='02-2')text=text.replace(/넘긴 뒤[^\n]*다섯 걸음[^\n]*/g,'넘긴 뒤에는 모두 선을 넘지 않습니다. 구역별 인원을 지키며 가까운 선수만 다음 받침을 만듭니다.');
    if(id==='25-1')text=text.replace('60초 구간이라 마지막 판까지 달려서 조일 수 있습니다.','마지막 판에도 같은 접근을 유지하는지 보며 무너지면 구간이나 휴식을 조절합니다.');
    if(id==='41-1')text=text.replace('기록 담당이 그 자리에 서서 흰 마커를 놓습니다.','기록 담당은 선 밖 도식에 슛 위치와 득점을 표시합니다.');
  }
  return text;
}
export function qualityText(t,id){
  const p=profiles[id],src=source[id];if(!p||src?.name!==t.name)throw Error(id+': 원고와 훈련이 다릅니다');
  let method=corrected(id,'method'),[body,...progress]=method.split(/\n\n(?=쉽게 —)/);
  body=body.replace(/\n\n크기 /,'\n\n준비\n크기 ').replace(/\n진행\n/,'\n진행·득점\n');
  const s=t.snap,gs=(s.equipment||[]).filter(g=>g.anchor==='mouth');
  const width=[...new Set(gs.map(g=>r(g.mouthWidth/metre(s))))];
  const goalNote=gs.length?'\n도식의 골 입구 폭: '+width.map(w=>w+'m').join(' · ')+'. '+(['04-3','23-3'].includes(id)?'원문에 명시된 폭을 사용했다.':'원문에 폭이 없으면 큰 골 7.32m·미니 골 2m를 도식용 예시로 사용했다.')+' 실제 장비와 선수 수준에 맞춰 조절한다.':'';
  const recordNote=id.startsWith('41-')?'\n도식의 노랑 R은 기록 담당이다. 별도 기록 칸은 흰색=골, 주황=그 밖의 슛을 뜻하는 이전 시도의 예시이며 운동장에 놓아 둔 장비가 아니다.':'';
  t.method='목적\n'+body+'\n\n재시작·교대 · 운영 보완\n'+p.operation+goalNote+recordNote+(progress.length?'\n\n난이도 조절\n'+progress.join('\n\n'):'');
  const independent=/^(15-3|16-1|26-2|26-3|34-[123])$/.test(id);
  const timing=independent?'판 도중에는 해답을 주지 않는다. 차례가 끝나거나 정해진 휴식에 해당 장면을 되짚는다.':['36-2','46-2'].includes(id)?'진행에 정한 판당 한 번의 멈춤 때 20초 안으로 개입한다. 현재 공·수비·동료 위치를 먼저 짚고, 추가 설명은 판 사이로 미룬다.':'같은 문제가 두 번 반복되면 다음 아웃·공격 종료에 20초 안으로 개입한다. 현재 공·수비·동료 위치를 먼저 짚는다.';
  t.coaching='관찰 단서\n'+p.observe+'\n\n핵심 지도\n'+corrected(id,'coaching')+'\n\n현장 개입 · 운영 보완\n'+timing+'\n질문 — «'+p.question+'»\n한 가지 조정 — '+p.change+'\n재시도 — '+(independent?'다음 판에서 선수가 선택해 시험하게 하고 코치는 관찰한다.':'문제가 생기기 직전 위치로 돌아가 같은 수비 선택을 한 번 재현한 뒤, 수비를 다시 자유롭게 풀어 준다.')+'\n\n다시 확인\n'+p.check;
  if(t.method.length>4000||t.coaching.length>4000)throw Error(id+': 보관함의 글자 제한 초과');
  t.practiceQuality={version:1,id,basis:'기존 프로세스 공식 세션 원문과 장면',supplement:'재시작·교대 및 현장 개입은 프로세스 스튜디오 운영 보완',sourceIssue:+id.split('-')[0]};
}

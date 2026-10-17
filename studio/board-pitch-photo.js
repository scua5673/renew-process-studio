/* 운동장 사진(제보 553c06ac «운동장 화면을 사진 이미지로 첨부» — TacticalPad 의 배경 그림). 경기 화면 캡처 같은 사진을 운동장 자리에 깔고
   그 위에 선수 · 화살표를 그린다. 보드 설정 › 운동장 › 바탕 › «사진» 줄(사진 고르기 · 사진 빼기)이 이 모듈 것이다.
   ⚠ 사진은 이 기기에만 — IndexedDB(window.storage) 'ps_pitch_photo:<id>' 한 벌. 판(state.pitchImg)에는 '@photo:<id>-<가로>x<세로>' 참조(30자 남짓)만 들어간다.
     그래서 장면 · 페이지 · 되돌리기 · 개인 보드 · 보관함 · 팀 공유 어디에도 사진 원본이 실리지 않는다(장면 N개면 N벌 · 되돌리기마다 한 벌이 되던 것).
     참조만 간 다른 기기 · 팀원 화면에는 사진이 없어 고른 피치(네이비 등)가 보이고, 설정 줄이 «이 기기에는 없어요»라고 말한다.
     3.083 이하 판은 '@' 프리셋 길(renderPitchImg)에서 모르는 키라 같은 피치를 그린다. 커뮤니티에 올릴 때는 참조도 뺀다(community.html dropMedia).
   사진은 판 좌표(#world)에 운동장 틀(규격 경계 + 런오프)을 덮게, 제 비율 그대로 가운데에 깐다(16:9 캡처면 틀 양옆으로 조금 더 — 넓은 화면 · 16:9 영상에는 사진 전체,
   PNG 는 판 틀만큼). 창 크기 · 내보내기(PNG · 영상 · GIF)와 상관없이 선수 · 화살표와 늘 같은 자리.
   판을 돌리면 같이 돈다. 고를 때 사진 방향에 맞춰 판을 가로/세로로 돌리고(가로 사진 → 가로 판), 세로 판이면 사진을 돌려 담아 바로 서 보이게 한다.
   라인 · 구역 위, 분석 그래픽 · 그림 · 선수 아래. 3D 보기에서는 숨는다(board.html 의 #ps-pitchimg 규칙 — 썸네일에서도 빠진다). */
(function(root,factory){var api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSPitchPhoto=api;})(typeof window!=='undefined'?window:null,function(W){
'use strict';
var PREFIX='ps_pitch_photo:',REF='@photo:',RE=/^@photo:([0-9a-f]{16})(?:-(\d{1,5})x(\d{1,5}))?$/,MAX_BYTES=10*1024*1024,EDGE=1600,QUALITY=0.82,TYPES=/^image\/(png|jpeg|jpg|webp)$/i;
var T={
  ok:'운동장 사진을 깔았어요 · 이 기기에만 저장돼요',type:'PNG · JPEG · WebP 사진만 넣을 수 있어요',big:'10MB 이하 사진만 넣을 수 있어요',
  read:'사진을 읽지 못했어요 — 다른 사진으로 해 주세요',save:'사진을 이 기기에 저장하지 못했어요 — 저장 공간을 확인해 주세요',
  off:'운동장 사진을 뺐어요',miss:'운동장 사진은 넣은 기기에만 있어요 — 여기서는 운동장으로 보여요',
  tilt:'3D 보기에서는 운동장 사진이 보이지 않아요 · 평면 보기에서 보여요',ro:'보기 전용이라 바꿀 수 없어요'
};
/* ── 셈(DOM 없이 — tests/board-pitch-photo.test.cjs) ── */
function isRef(v){return typeof v==='string'&&RE.test(v);}
function idOf(v){var m=RE.exec(typeof v==='string'?v:'');return m?m[1]:'';}
/* 내용 주소: 같은 사진을 두 번 골라도 한 벌. FNV-1a 두 갈래(32비트 × 2) → 16자 */
function hash(s){s=String(s);var a=0x811c9dc5,b=0x9747b28c;
  for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,0x5bd1e995);b^=b>>>15;}
  return ('0000000'+(a>>>0).toString(16)).slice(-8)+('0000000'+(b>>>0).toString(16)).slice(-8);}
/* 참조에 담긴 그림 크기도 적는다 — 이 기기에 사진이 오기 전에도 자리를 셀 수 있게 */
function refOf(dataUrl,w,h){return REF+hash(dataUrl)+((w>0&&h>0)?'-'+Math.round(w)+'x'+Math.round(h):'');}
function dimsOf(v){var m=RE.exec(typeof v==='string'?v:'');return (m&&+m[2]>0&&+m[3]>0)?{w:+m[2],h:+m[3]}:null;}
/* 고른 파일 — 문제가 있으면 코치에게 보일 말, 없으면 '' */
function check(file){if(!file)return T.read;var t=String(file.type||'');if(!(TYPES.test(t)||(!t&&/\.(png|jpe?g|webp)$/i.test(String(file.name||'')))))return T.type;if(+file.size>MAX_BYTES)return T.big;return '';}
/* 긴 변 edge 이하로 줄인 크기(키우지 않는다) */
function fit(w,h,edge){w=+w||0;h=+h||0;edge=edge||EDGE;var k=Math.min(1,edge/Math.max(w,h,1));return {w:Math.max(1,Math.round(w*k)),h:Math.max(1,Math.round(h*k))};}
/* 사진에 맞는 판 방향 — 가로 사진은 가로 판, 세로 사진은 세로 판 */
function want(w,h){return (+w||0)>=(+h||0)?'h':'v';}
/* 판 좌표에 바로 서 보이도록 담을 때 돌릴 각도. 세로 판은 #world 를 -90°(spFlip 이면 +90°) 돌려 그리므로 그 반대로 돌려 담는다 */
function turn(o){return (o&&o.orientation==='v')?((o.spFlip)?-90:90):0;}
/* 운동장 틀(판 좌표) — 규격 경계 + 런오프 m. 11인제는 판 전체(0 0 1110 740), 작은 규격 · 그리드 판도 제 틀(applyView 의 _spSmall 과 같은 셈) */
function frame(pr,m){m=+m||0;return [pr.L-m,pr.T-m,pr.PW+2*m,pr.PH+2*m];}
/* 사진 자리 — 틀을 다 덮는 가장 작은 크기로, 제 비율 그대로 틀 가운데에(넘치는 쪽은 틀 밖으로). 크기를 모르면 틀 그대로(slice 로 잘라 채운다) */
function place(f,w,h){if(!(w>0&&h>0))return f.slice();var ar=w/h,fw=f[2],fh=f[3],pw=fw,ph=fh;if(ar>fw/fh)pw=fh*ar;else ph=fw/ar;
  var r=function(v){return Math.round(v*100)/100;};return [r(f[0]+(fw-pw)/2),r(f[1]+(fh-ph)/2),r(pw),r(ph)];}
/* 설정 줄 아래 안내 — st: none | here | missing */
function note(st,tilt){
  var s=st==='here'?'이 기기에만 저장돼요 · 다른 기기 · 팀 · 커뮤니티에는 운동장으로 보여요':st==='missing'?'다른 기기에서 넣은 사진이라 이 기기에는 없어요 — 운동장으로 보여요':'경기 화면 캡처를 깔고 그 위에 그려요 · 사진은 이 기기에만 저장돼요';
  return (tilt&&st!=='none')?s+' · 3D 보기에서는 보이지 않아요':s;}
/* 장면 · 페이지 묶음에서 사진 참조를 모은다(겹치지 않게) */
function refsIn(o,out,depth){out=out||[];if(!o||typeof o!=='object'||(depth|0)>6)return out;
  Object.keys(o).forEach(function(k){var v=o[k];if(k==='pitchImg'&&isRef(v)){if(out.indexOf(v)<0)out.push(v);}else if(v&&typeof v==='object')refsIn(v,out,(depth|0)+1);});return out;}

/* ── 이 기기 사진 보관(IndexedDB) ── */
var mem={},order=[],miss={},pend={},tries={},hinted={},MEM_MAX=24;
/* 메모리에는 최근 사진 24장까지(여러 페이지 영상이 페이지마다 다른 사진을 써도 넉넉하게) */
function remember(id,v){mem[id]=v;var i=order.indexOf(id);if(i>=0)order.splice(i,1);order.push(id);while(order.length>MEM_MAX)delete mem[order.shift()];}
function store(){return W&&W.storage&&W.storage.get&&W.storage.set?W.storage:null;}
function say(msg){try{if(W&&typeof W.toast==='function')W.toast(msg);}catch(_){}}
function busyBoard(){try{var d=W.document;return !!(W.__animExport||W.__psThumbCapturing||d.body.classList.contains('comm-viewing'));}catch(_){return false;}}
function load(id,redo){
  if(pend[id])return pend[id];
  var st=store();if(!st){miss[id]=1;return Promise.resolve('');}
  pend[id]=Promise.resolve().then(function(){return st.get(PREFIX+id);}).then(function(r){
    var v=r&&typeof r.value==='string'&&r.value.indexOf('data:image/')===0?r.value:'';
    delete pend[id];if(v)remember(id,v);else miss[id]=1;
    try{if(redo)redo();}catch(_){}
    if(!v&&!hinted['m'+id]&&!busyBoard()){hinted['m'+id]=1;say(T.miss);}
    return v;
  },function(){delete pend[id];   /* 저장소가 잠깐 막힘(계정 확인 중 등) — 조금 뒤 세 번까지 */
    if((tries[id]=(tries[id]|0)+1)<=3)setTimeout(function(){try{if(redo)redo();}catch(_){}},1200*tries[id]);return '';});
  return pend[id];
}
function save(id,dataUrl){var st=store();if(!st)return Promise.reject(Error('storage'));
  return Promise.resolve(st.set(PREFIX+id,dataUrl)).then(function(){return st.get(PREFIX+id);}).then(function(r){
    if(!r||r.value!==dataUrl)throw Error('verify');remember(id,dataUrl);delete miss[id];return id;});}
/* 지금 그릴 사진 주소 — 메모리에 없으면 불러오기를 걸고 '' (다 읽으면 redo 로 다시 그린다) */
function href(u,redo){var id=idOf(u);if(!id)return '';if(mem[id])return mem[id];if(!miss[id])load(id,redo);return '';}

/* ── 그리기(board.html renderPitchImg 맨 앞에서 부른다) — 사진 참조면 여기서 다 그리고 true, 아니면 false(원래 길로) ── */
function render(u,svg,world,pr,m,redo){
  sync(u);
  if(!isRef(u)||!svg||!world)return false;
  var doc=svg.ownerDocument,ex=svg.querySelector('#ps-pitchimg'),tg=world.querySelector('#ps-pitchtile'),src=href(u,redo);
  if(tg)tg.remove();
  try{doc.body.classList.remove('ps-custompitch');}catch(_){}   /* 옛 업로드(뷰 전체를 덮던 data URI) 표시 · 내보내기 재배치 규칙은 쓰지 않는다 */
  if(ex&&(ex.parentNode!==world||!src)){ex.remove();ex=null;}
  if(!src)return true;
  if(!ex){ex=doc.createElementNS('http://www.w3.org/2000/svg','image');ex.setAttribute('id','ps-pitchimg');ex.setAttribute('preserveAspectRatio','xMidYMid slice');}
  var d=dimsOf(u),f=place(frame(pr,m),d&&d.w,d&&d.h);['x','y','width','height'].forEach(function(k,i){if(ex.getAttribute(k)!==String(f[i]))ex.setAttribute(k,f[i]);});
  if(ex.getAttribute('href')!==src)ex.setAttribute('href',src);
  var at=world.querySelector('#analysisLayer')||world.querySelector('#drawLayer');
  if(ex.parentNode!==world||ex.nextElementSibling!==at)world.insertBefore(ex,at||null);
  return true;
}

/* ── 판에 넣기 · 빼기 ── */
function S(){try{return (typeof state!=='undefined'&&state&&typeof state==='object')?state:null;}catch(_){return null;}}
function readOnly(){try{return !!(W.__vaultReadOnly||W.document.body.classList.contains('comm-viewing'));}catch(_){return false;}}
function settle(){try{W.__syncPitchSeg&&W.__syncPitchSeg();}catch(_){}try{W._viewScenesMatch&&W._viewScenesMatch('pitch');}catch(_){}try{W.boardSaveLive&&W.boardSaveLive();}catch(_){}}
function use(ref){var s=S();if(!s||!isRef(ref))return false;
  try{if(typeof animPlaying!=='undefined'&&animPlaying&&W.stopAnim)W.stopAnim();}catch(_){}
  try{W.pushUndo&&W.pushUndo();}catch(_){}
  s.pitchImg=ref;
  try{W.applyView();}catch(_){}
  settle();say(T.ok);return true;}
function clear(){var s=S();if(!s||!isRef(s.pitchImg))return false;
  try{W.pushUndo&&W.pushUndo();}catch(_){}
  try{W.__clearPitchImg();}catch(_){s.pitchImg=null;}
  settle();say(T.off);return true;}   /* 사진 자체는 지우지 않는다 — ⌘Z · 보관함의 다른 작업이 그 사진을 다시 쓸 수 있다 */
/* 고른 파일 → 그림. blob 주소로 못 읽으면 FileReader 로 한 번 더(웹킷 CI 에서 고른 파일의 blob 주소를 못 읽은 일 — team-photos 와 같은 길) */
function decode(file,doc){
  function load2(src){return new Promise(function(res,rej){var img=new doc.defaultView.Image();img.onload=function(){(img.naturalWidth&&img.naturalHeight)?res(img):rej(Error('empty'));};img.onerror=function(){rej(Error('decode'));};img.src=src;});}
  function viaUrl(){var U=doc.defaultView.URL,url;try{url=U.createObjectURL(file);}catch(e){return Promise.reject(e);}
    return load2(url).then(function(v){U.revokeObjectURL(url);return v;},function(e){U.revokeObjectURL(url);throw e;});}
  function viaReader(){return new Promise(function(res,rej){var r=new doc.defaultView.FileReader();r.onload=function(){res(String(r.result||''));};r.onerror=function(){rej(r.error||Error('read'));};r.readAsDataURL(file);}).then(load2);}
  return viaUrl().catch(function(){return viaReader();});
}
/* 줄이고(긴 변 1600) 판 방향에 맞춰 돌려 JPEG(0.82)로. 투명한 곳은 흰색 */
function encode(img,rot,doc){
  var s=fit(img.naturalWidth,img.naturalHeight,EDGE),side=rot?1:0,cw=side?s.h:s.w,ch=side?s.w:s.h,c=doc.createElement('canvas');c.width=cw;c.height=ch;
  var g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,cw,ch);
  if(rot===90){g.translate(cw,0);g.rotate(Math.PI/2);}else if(rot===-90){g.translate(0,ch);g.rotate(-Math.PI/2);}
  g.drawImage(img,0,0,s.w,s.h);return {url:c.toDataURL('image/jpeg',QUALITY),w:cw,h:ch};
}
var busy=false;
function take(file){
  var msg=check(file);if(msg){say(msg);return Promise.resolve(false);}
  if(busy)return Promise.resolve(false);busy=true;
  var doc=W.document;
  return decode(file,doc).then(function(img){
    var s=S();if(!s)throw Error('board');
    /* 가로 사진은 가로 판에서 바로 선다 — 판을 사진 방향으로(훈련 편집기 · 미팅은 판 방향을 그대로 두고 사진을 돌려 담는다) */
    var to=want(img.naturalWidth,img.naturalHeight),b=doc.body.classList;
    if(to!==(s.orientation==='v'?'v':'h')&&!b.contains('editing')&&!b.contains('meet-mode')&&typeof W.__setBoardOrient==='function'){try{W.__setBoardOrient(to);}catch(_){}}
    var e=encode(img,turn(s),doc),url=e.url,ref=refOf(url,e.w,e.h);
    return save(idOf(ref),url).then(function(){return use(ref);},function(){say(T.save);return false;});
  },function(){say(T.read);return false;}).then(function(v){busy=false;return v;},function(){busy=false;say(T.read);return false;});
}
var input=null;
function pick(){if(readOnly()){say(T.ro);return;}var d=W.document;
  if(!input){input=d.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.id='pitchPhotoInput';input.hidden=true;input.setAttribute('aria-hidden','true');
    input.addEventListener('change',function(){var f=input.files&&input.files[0];input.value='';if(f)take(f);});
    (d.getElementById('pitchPhotoRow')||d.body).appendChild(input);}
  input.click();}

/* ── 설정 줄(보드 설정 › 운동장 › 바탕 — board.html PLAN 이 «피치» 묶음에 세운다) ── */
var row=null,hint=null,lastTilt=null;
function stateOf(u){var id=idOf(u);return !id?'none':(mem[id]?'here':(miss[id]?'missing':'here'));}
function sync(u){if(!row)return;try{
  var st=stateOf(u===undefined?(S()||{}).pitchImg:u),tilt=W.document.body.classList.contains('bc-tilt3d'),pb=row.querySelector('[data-pp="pick"]'),cb=row.querySelector('[data-pp="clear"]');
  row.setAttribute('data-pp-state',st);
  var t1=st==='none'?'사진 고르기':'다른 사진';if(pb.textContent!==t1)pb.textContent=t1;
  cb.disabled=st==='none';pb.classList.toggle('on',st!=='none');
  var t2=note(st,tilt);if(hint&&hint.textContent!==t2)hint.textContent=t2;
}catch(_){}}
function mount(doc){
  doc=doc||(W&&W.document);if(!doc||row)return;
  var seg=doc.getElementById('pitchSeg'),pr=seg&&seg.closest('.menurow');if(!pr)return;
  row=doc.createElement('div');row.className='menurow';row.id='pitchPhotoRow';row.setAttribute('data-bs-tab','pitch');
  row.innerHTML='<span class="menulbl">사진</span><div class="seg" role="group" aria-label="운동장 사진"><button type="button" data-pp="pick" title="경기 화면 캡처 같은 사진을 운동장 자리에 깔아요 — PNG · JPEG · WebP, 10MB 이하">사진 고르기</button><button type="button" data-pp="clear" title="사진을 빼고 운동장으로" disabled>사진 빼기</button></div>';
  hint=doc.createElement('div');hint.id='pitchPhotoHint';hint.className='bs-hint';hint.setAttribute('data-bs-tab','pitch');
  pr.after(row);row.after(hint);
  row.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('button[data-pp]');if(!b||b.disabled)return;e.stopPropagation();if(b.getAttribute('data-pp')==='pick')pick();else clear();});
  sync(null);
  /* 3D 를 켜면 사진이 숨는다 — 켠 순간 알려 준다(3D 토스트 뒤에) */
  try{new W.MutationObserver(function(){var on=doc.body.classList.contains('bc-tilt3d');if(on===lastTilt)return;lastTilt=on;sync();
    var s=S();if(on&&s&&mem[idOf(s.pitchImg)]&&!busyBoard())say(T.tilt);}).observe(doc.body,{attributes:true,attributeFilter:['class']});lastTilt=doc.body.classList.contains('bc-tilt3d');}catch(_){}
}
if(W&&W.document&&W.document.getElementById)try{mount(W.document);}catch(_){}
return {REF:REF,PREFIX:PREFIX,EDGE:EDGE,QUALITY:QUALITY,MAX_BYTES:MAX_BYTES,T:T,
  isRef:isRef,idOf:idOf,dimsOf:dimsOf,hash:hash,refOf:refOf,check:check,fit:fit,want:want,turn:turn,frame:frame,place:place,note:note,refsIn:refsIn,
  render:render,href:href,pick:pick,take:take,use:use,clear:clear,mount:mount,sync:sync};
});

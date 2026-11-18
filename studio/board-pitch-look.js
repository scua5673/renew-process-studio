/* 3.316 — 미팅 11/18 작전판 셋(순수 셈 — board.html 은 한 줄씩 부른다 · tests/board-pitch-look-3316).
   ① 3D 잔디 색은 평면에서 고른 피치를 따른다(«3d 모드에서 다양한 운동장 색상 평면보드에서 처럼»). 예전엔 분위기(TILT_MOOD)의 초록 두 색 · 실사 사진이
      늘 깔려 보드 설정 › 피치(잔디 · 딥그린 · 네이비 · 화이트 · 훈련 · 직접 색)와 실사 잔디의 밝기 · 연하기(2.978)가 3D 에서 보이지 않았다.
      pitchLook: key real(사진 + 톤 행렬은 사진 타일에 filter) · calm · navy · white · train · custom. ga · gb 는 평면 줄무늬와 같은 CSS 값(--grass-a · --grass-b),
      직접 색은 그 색과 조금 어두운 색(shade .9). 사진을 못 그리는 기기의 실사는 예전처럼 분위기의 초록. grass(닳은 자국 · 누런 기)는 real · calm 만.
      분위기(낮 · 해질녘 · 야간)의 빛 · 색조 · 비네트는 그대로 위에 덮인다. 3D 영상의 판 그림은 화이트 · 훈련 피치의 선을 흰색으로 바꾸지 않는다(흰 잔디에서 사라진다).
   ② 4K(2160p) · 60fps 영상 · 4K PNG(«프레임이나 영상 고화질로 — 4k 60프레임으로도»). codecs: H.264 Baseline 레벨은 한 장의 매크로블록 수(w/16 × h/16)와
      초당 매크로블록 수를 제한한다 — 4.0(42E028) 1080p30 · 4.2(42E02A) 1080p60 · 5.1(42E033) 4K30 · 5.2(42E034) 4K60. 예전엔 4.0 → 4.2 → 3.1 만 물어
      4K · 1080p60 이면 WebCodecs 가 «지원 안 함»이라 옛 녹화 길(MediaRecorder)로 떨어졌다. 1080p30 이하는 예전 순서 그대로. 비트레이트 4K 36Mbps · 60fps 1.5배.
      pngScale: 긴 변 3840(2 이상 4 이하 — 운동장 여러 개의 넓은 판은 2배가 이미 4K 를 넘는다). 아이폰 · 아이패드(blocked4k — 터치 맥 UA 포함)는 4K 를 막고 PNG 는 2배(캔버스 메모리).
   ③ cloneLean: 저장 · 초안 · 보관함 열기로 나가는 페이지 사본은 장면 썸네일(장면 1부터)을 복사하지 않는다(«빨리 빨리 하다보면 렉이 걸리고»).
      3.288 은 깊은 사본을 뜬 뒤 떼어 냈다(PSLibDiet). 실측(10페이지 × 30장면 · 썸네일 74KB · 맥 크롬): 사본 한 번에 25.7MB 글자를 복사해 2.5MB 만 남기는 데 77ms —
      손댈 때마다(기기 초안 0.7초 · 라이브 기록) 되풀이돼 큰 작전판의 빠른 편집에서 끊김(GC)과 메모리 봉우리가 됐다. 얕은 틀만 새로 만들고 썸네일 자리를 비운 채
      깊은 사본을 뜬다 — 결과는 PSLibDiet.strip 뒤와 같다(장면 0 · 페이지 그림은 그대로). */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSBoardLook=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
function pitchKey(pitchImg,pitch){ if(pitchImg==='@real')return 'real'; var d=String(pitch||''); if(d==='grass')return 'real'; return d||'navy'; }
function shade(hex,k){ try{ var h=String(hex||'').trim().replace('#',''); if(h.length===3)h=h.replace(/./g,function(c){return c+c;}); if(!/^[0-9a-f]{6}$/i.test(h))return hex;
  return '#'+[0,2,4].map(function(i){ var v=Math.round(parseInt(h.slice(i,i+2),16)*k); v=Math.max(0,Math.min(255,v)); return (v<16?'0':'')+v.toString(16); }).join(''); }catch(_){ return hex; } }
/* md: 분위기 {ga,gb} · turf: 실사 사진 타일('' 이면 없음) · env: {key, css(name), tone('밝기|연하기'), matrix(key → 20 값)} */
function pitchLook(md,turf,env){ env=env||{}; md=md||{}; var key=env.key||'navy',css=typeof env.css==='function'?env.css:function(){return '';},ga,gb,tone='';
  if(key==='real'){ ga=md.ga; gb=md.gb; try{ var tk=String(env.tone||'0|0'); if(turf&&tk!=='0|0'&&typeof env.matrix==='function')tone=env.matrix(tk).map(function(n){return +(+n).toFixed(4);}).join(' '); }catch(_){ tone=''; } }
  else if(key==='custom'){ ga=String(css('--pitchbg')||'').trim()||md.ga; gb=shade(ga,.9); }
  else { ga=String(css('--grass-a')||'').trim()||md.ga; gb=String(css('--grass-b')||'').trim()||md.gb; }
  return {key:key,ga:ga,gb:gb,tone:tone,grass:(key==='real'||key==='calm'),sig:key+'|'+ga+'|'+gb+'|'+tone}; }
function cloneLean(arr){ return JSON.parse(JSON.stringify((arr||[]).map(function(p){ if(!p||!p.anim||!Array.isArray(p.anim.frames))return p;
  var fr=p.anim.frames.map(function(f,i){ if(i===0||!f||typeof f.thumb!=='string'||!f.thumb)return f; var c={}; for(var k in f)if(k!=='thumb')c[k]=f[k]; return c; });
  var a={}; for(var k in p.anim)a[k]=p.anim[k]; a.frames=fr; var q={}; for(var k2 in p)q[k2]=p[k2]; q.anim=a; return q; }))); }
var LEVELS=[['avc1.42E01F',3600,108000],['avc1.42E028',8192,245760],['avc1.42E02A',8704,522240],['avc1.42E032',22080,589824],['avc1.42E033',36864,983040],['avc1.42E034',36864,2073600]];
function codecs(w,h,fps){ var mbs=Math.ceil((+w||0)/16)*Math.ceil((+h||0)/16),mbps=mbs*(+fps||30);
  if(mbs<=8192&&mbps<=245760)return ['avc1.42E028','avc1.42E02A','avc1.42E01F','avc1.42001F'];
  var ok=LEVELS.filter(function(l){ return mbs<=l[1]&&mbps<=l[2]; }).map(function(l){ return l[0]; });
  return ok.length?ok:['avc1.42E034']; }
function bitrate(h,fps){ return Math.round((h>=2000?36000000:h>=1000?10000000:(h>=760?7000000:5000000))*(fps>=50?1.5:1)); }
function blocked4k(nav){ try{ nav=nav||navigator; var ua=String(nav.userAgent||''); return /iPhone|iPad|iPod/.test(ua)||((nav.maxTouchPoints||0)>1&&/Macintosh/.test(ua)); }catch(_){ return false; } }
function pngScale(w,h,blocked){ var e=Math.max(+w||1,+h||1); if(blocked)return 2; return Math.max(2,Math.min(4,Math.round(3840/e*100)/100)); }
return {pitchKey:pitchKey,shade:shade,pitchLook:pitchLook,cloneLean:cloneLean,codecs:codecs,bitrate:bitrate,blocked4k:blocked4k,pngScale:pngScale,LEVELS:LEVELS};
});

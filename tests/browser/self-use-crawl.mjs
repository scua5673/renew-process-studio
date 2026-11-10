import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,ready,SIZES,root,WT,A} from '../fixtures/team-app.mjs';
/* 3.273 — «직접 써 보기» 탐침. 시험 묶음(run-critical)에 넣지 않는다 — 문지기가 아니라 찾는 도구다.
   코치(팀 주인)와 선수로, 데스크톱 1440×900 과 폰 390×844 에서 한 주를 산다: 메뉴 · 팀 화면을 다 열고, 보이는 단추를 눌러 보고,
   작전판(선수 · 장면 3개 · 재생) → 보관함 저장 → 다시 열기, 일정 세션 · 경기, 여러 명 추가, 가용인원, 선수 IDP 기록, 영어 ↔ 한국어,
   중간에 새로고침해 만든 것이 남았는지 본다. 첫 문제에서 멈추지 않고 모은다:
     pageerror(잡히지 않은 오류 · 거부) · console.error · 실패한 요청 · 눌러도 아무 일 없는 단추 · 가로 넘침(폰) · 고정 막대에 가린 것 ·
     undefined/null/NaN/[object Object] 글 · 영어 셸에 남은 한글 · 새로고침 뒤 사라진 자료 · 끝까지 못 간 흐름.
   결과: test-results/self-use/<역할>-<크기>.json · summary.md (커밋하지 않는다).
   고르기: PS_SELF_ROLE=coach|player · PS_SELF_SIZE=desktop|phone · PS_SELF_ONLY=board,vault,…(흐름 이름) · PS_SELF_CRAWL=0(단추 훑기 끔)
          PS_SELF_SELFTEST=1(죽은 단추 · undefined 글을 심어 탐침이 찾는지 확인) · PS_SELF_SEED=<수>(단추 차례 섞기, 0 = 화면 차례) · PS_SELF_BUDGET_MS(역할 · 크기마다, 기본 350000) · PS_SELF_SHOTS=1(화면마다 그림).
          PS_SELF_HANG_MS(흐름 하나가 이보다 길면 «멈춤» — 디버거로 세워 돌고 있는 자리를 적는다, 기본 150000).
   읽는 법: flow-failed 는 먼저 탐침의 길(선택자)을 의심한다 · dead-button 은 후보(손으로 확인) · leave-prompt 는 저장할 것이 없는데 «나가시겠어요?»를 막은 처리기.
   합성 팀 · 합성 계정 · 루프백 서버만 쓴다(tests/fixtures/team-app.mjs). */

const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const ROLES=(process.env.PS_SELF_ROLE||'coach,player').split(','),SIZES_RUN=(process.env.PS_SELF_SIZE||'desktop,phone').split(',');
const ONLY=process.env.PS_SELF_ONLY?new Set(process.env.PS_SELF_ONLY.split(',')):null;
const CRAWL=process.env.PS_SELF_CRAWL!=='0',SEED=+(process.env.PS_SELF_SEED||0),BUDGET=+(process.env.PS_SELF_BUDGET_MS||350000),SHOTS=!!process.env.PS_SELF_SHOTS;
const OUT=path.join(root,'test-results/self-use');fs.mkdirSync(OUT,{recursive:true});
SIZES.su_desktop={engine,ctx:{viewport:{width:1440,height:900},deviceScaleFactor:1}};
SIZES.su_phone={engine,ctx:{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:SIZES.phone.ctx.userAgent}};

/* 누르지 않는 것 — 지우기 · 나가기 · 파일 창 · 인쇄 · 바깥으로 보내기 */
const SKIP=/로그아웃|log ?out|sign ?out|삭제|지우|탈퇴|팀 나가기|초기화|비우기|reset|delete|remove|내보내기|내려받기|다운로드|인쇄|print|공유|업데이트|새로고침|가져오기|불러오기|파일|사진|이미지|PDF|PNG|GIF|영상|보내기|제출|설치|export|import|upload|share/i;
/* 시험 틀이 만든 소리 — 앱 문제가 아니다 */
const NOISE=[/sw-manifest\.json/,/ERR_BLOCKED_BY_CLIENT/,/api\.open-meteo\.com/,/ResizeObserver loop/,/net::ERR_ABORTED/,/Failed to load resource: net::ERR_FAILED/];
const noise=t=>NOISE.some(r=>r.test(t));

function rng(seed){let s=seed>>>0||1;return ()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};}

/* 모든 틀에서 앱보다 먼저: 바뀜 세기 · 곁길(새 창 · 인쇄 · 파일 창 · 복사) 세기 · 잡히지 않은 거부의 까닭 */
function instrument(){
  if(window.__su)return;
  const su=window.__su={mut:0,side:0,rej:[]};
  const hook=()=>{try{new MutationObserver(l=>{for(const m of l){if(m.type==='attributes'&&/^data-su-/.test(m.attributeName||''))continue;su.mut++;}}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,characterData:true});}catch(_){}};
  if(document.documentElement)hook();else document.addEventListener('readystatechange',function f(){if(document.documentElement){document.removeEventListener('readystatechange',f);hook();}});
  addEventListener('unhandledrejection',e=>{try{const r=e.reason;su.rej.push(String(r&&r.stack||r&&r.message||r).slice(0,600));}catch(_){}});
  const bump=()=>{su.side++;};
  try{const o=window.open;window.open=function(){bump();return null;};}catch(_){}
  try{window.print=bump;}catch(_){}
  try{const c=HTMLInputElement.prototype.click;HTMLInputElement.prototype.click=function(){if(this.type==='file'||this.type==='color'||this.type==='date'){bump();return;}return c.apply(this,arguments);};}catch(_){}
  try{const c=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.hasAttribute('download')||/^blob:|^data:/.test(this.href)){bump();return;}return c.apply(this,arguments);};}catch(_){}
  try{if(navigator.clipboard){const w=navigator.clipboard.writeText;navigator.clipboard.writeText=function(){bump();return Promise.resolve();};}}catch(_){}
  try{for(const k of ['showSaveFilePicker','showOpenFilePicker','showDirectoryPicker'])if(window[k])window[k]=function(){bump();return Promise.reject(new DOMException('self-use','AbortError'));};}catch(_){}
  try{if(navigator.share)navigator.share=function(){bump();return Promise.reject(new DOMException('self-use','AbortError'));};}catch(_){}
  try{for(const k of ['scrollTo','scrollBy'])if(Element.prototype[k]){const o=Element.prototype[k];Element.prototype[k]=function(){bump();return o.apply(this,arguments);};}}catch(_){}
  try{const o=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(){su.side++;return o.apply(this,arguments);};}catch(_){}
  try{const o=HTMLElement.prototype.focus;HTMLElement.prototype.focus=function(){su.side++;return o.apply(this,arguments);};}catch(_){}
  /* «나가시겠어요?»를 누가 띄웠는지 — 처리기를 감싸 막은 쪽의 틀 · 코드 첫머리를 sessionStorage 에 남긴다(새로고침 뒤 읽는다) */
  try{const o=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(t,fn,opt){
    if(t==='beforeunload'&&typeof fn==='function'){const w=function(e){const before=e.defaultPrevented;const r=fn.apply(this,arguments);
      try{if(!before&&e.defaultPrevented)sessionStorage.setItem('__su_bu',(sessionStorage.getItem('__su_bu')||'')+location.pathname.split('/').pop()+' :: '+String(fn).replace(/\s+/g,' ').slice(0,160)+'\n');}catch(_){}
      return r;};return o.call(this,t,w,opt);}
    return o.apply(this,arguments);};}catch(_){}
  try{const o=Element.prototype.requestFullscreen;if(o)Element.prototype.requestFullscreen=function(){bump();return Promise.reject(new Error('self-use'));};}catch(_){}
}

async function run(role,sizeName){
  const phone=sizeName==='phone',tag=role+'/'+sizeName,t0=Date.now(),deadline=t0+BUDGET;
  const fx=await startFixture(role==='player'?{teamRole:'member'}:{}),browsers={};
  if(role==='player'){
    fx.db.set(WT+'|cs_perms_v1',{workspace_id:WT,k:'cs_perms_v1',v:JSON.stringify({members:{[A]:{role:'player',playerId:'vp01'}},defaultRole:'player'}),cupd:2000,updated_by:'99999999-9999-4999-8999-999999999999'});
  }
  const findings=[],seen=new Set(),flows=[],screens=[],made={};
  let action='boot',clicks=0,netN=0;
  const add=(kind,detail,extra={})=>{const key=kind+'|'+String(detail).replace(/\d{6,}/g,'#').slice(0,220);if(seen.has(key))return;seen.add(key);findings.push({kind,role,size:sizeName,action,detail:String(detail).slice(0,900),...extra});};
  const left=()=>deadline-Date.now();
  let app;
  try{
    app=await openApp(fx,'su_'+sizeName,{browsers,phoneStart:true,init:{fn:instrument}});
  }catch(e){add('boot-failed',String(e&&e.message||e));return finish();}
  const {page,context}=app;page.setDefaultTimeout(8000);
  page.on('pageerror',e=>{const m=String(e&&e.message||e);if(noise(m))return;add('pageerror',m,{stack:String(e&&e.stack||'').split('\n').slice(0,6).join('\n')});});
  page.on('console',m=>{if(m.type()!=='error')return;const t=m.text();if(noise(t))return;const u=(m.location()||{}).url||'';if(noise(u))return;add('console.error',t.slice(0,400),{at:u.replace(fx.base,'')+':'+((m.location()||{}).lineNumber||'')});});
  page.on('response',r=>{const u=r.url();if(!u.startsWith(fx.base))return;netN++;if(r.status()>=400&&!noise(u))add('http-'+r.status(),r.request().method()+' '+u.replace(fx.base,'').slice(0,200));});
  page.on('request',()=>{netN++;});
  page.on('requestfailed',r=>{const u=r.url(),f=(r.failure()||{}).errorText||'';if(!u.startsWith(fx.base)||/ERR_ABORTED|cancel/i.test(f))return;add('request-failed',r.method()+' '+u.replace(fx.base,'').slice(0,200)+' '+f);});
  const natives=[];page.on('dialog',d=>{dialogs++;if(d.type()!=='beforeunload'&&natives.length<40)natives.push({type:d.type(),text:d.message().slice(0,120),action});});

  const settle=(ms=400)=>page.waitForTimeout(ms);
  const shot=async n=>{if(SHOTS)await page.screenshot({path:path.join(OUT,role+'-'+sizeName+'-'+n.replace(/[^\w가-힣]+/g,'_').slice(0,50)+'.png')}).catch(()=>{});};
  /* 보이는 틀들(맨 위 + 보이는 iframe) */
  const liveFrames=async()=>{const out=[{id:'top',frame:page.mainFrame()}];
    for(const f of page.frames()){if(f===page.mainFrame())continue;const fe=await f.frameElement().catch(()=>null);if(!fe)continue;
      const info=await fe.evaluate(e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return {id:e.id||e.className||'iframe',v:r.width>50&&r.height>50&&cs.display!=='none'&&cs.visibility!=='hidden'&&r.left<innerWidth&&r.right>0};}).catch(()=>null);
      if(info&&info.v)out.push({id:info.id,frame:f});}
    return out;};
  const frameById=async id=>{const h=await page.$('#'+id);return h?h.contentFrame():null;};
  const visFrame=async()=>{const l=await liveFrames();return l[1]||null;};

  /* ── 검사: 이상한 글 · 거부 까닭 ─────────────────────────── */
  async function auditText(label){
    for(const {id,frame} of await liveFrames()){
      const r=await frame.evaluate(()=>{
        const bad=/(^|[^A-Za-z가-힣_.$#-])(undefined|NaN|\[object Object\])(?![A-Za-z_-])|(^|[\s(·:])null($|[\s)·,])/,out=[];
        const shown=el=>{if(!el||!el.getClientRects().length)return false;if(el.checkVisibility&&!el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))return false;return true;};
        const where=p=>{let s='';for(let e=p,i=0;e&&e!==document.body&&i<3;e=e.parentElement,i++)s=(e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(typeof e.className==='string'&&e.className?'.'+e.className.trim().split(/\s+/).slice(0,2).join('.'):''))+(s?' > '+s:'');return s;};
        if(!document.body)return {out,rej:[]};
        const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
        while((n=w.nextNode())){const t=n.nodeValue;if(!t||!bad.test(t))continue;const p=n.parentElement;if(!p||p.closest('script,style,noscript,template,textarea,[contenteditable="true"],code,pre')||!shown(p))continue;out.push({t:t.replace(/\s+/g,' ').trim().slice(0,90),w:where(p)});}
        for(const el of document.querySelectorAll('input,[placeholder],[title],[aria-label],option')){if(!shown(el)&&el.tagName!=='OPTION')continue;
          for(const a of ['placeholder','title','aria-label']){const v=el.getAttribute(a);if(v&&bad.test(v))out.push({t:a+'="'+v.slice(0,80)+'"',w:where(el)});}
          if(el.tagName==='INPUT'&&!/password|file|checkbox|radio|color|range/.test(el.type)&&el.defaultValue===el.value&&el.value&&bad.test(el.value))out.push({t:'value="'+el.value.slice(0,80)+'"',w:where(el)});
          if(el.tagName==='OPTION'&&bad.test(el.textContent||'')&&shown(el.parentElement))out.push({t:'option "'+el.textContent.trim().slice(0,60)+'"',w:where(el.parentElement)});}
        const rej=(window.__su&&window.__su.rej.splice(0))||[];
        return {out:out.slice(0,12),rej};}).catch(()=>null);
      if(!r)continue;
      for(const o of r.out)add('garbled-text','['+id+'] «'+o.t+'» @ '+o.w,{screen:label});
      for(const j of r.rej)if(!noise(j))add('unhandled-rejection','['+id+'] '+j.split('\n')[0],{stack:j,screen:label});
    }
  }
  /* ── 검사: 가로 넘침 · 고정 막대에 가린 것(끝까지 내려도 못 누르는 것) ── */
  async function auditLayout(label){
    for(const {id,frame} of await liveFrames()){
      const r=await frame.evaluate(({phone,top})=>{
        const out={overflow:null,covered:[]},de=document.documentElement,W=innerWidth,H=innerHeight;
        const shown=el=>{if(!el.getClientRects().length)return false;if(el.checkVisibility&&!el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))return false;const r=el.getBoundingClientRect();return r.width>4&&r.height>4;};
        const lab=el=>el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/).slice(0,2).join('.'):'')+' «'+(el.innerText||el.value||el.getAttribute('aria-label')||el.title||'').replace(/\s+/g,' ').trim().slice(0,24)+'»';
        if(phone){
          const sw=Math.max(de.scrollWidth,document.body?document.body.scrollWidth:0);
          if(sw>de.clientWidth+1&&getComputedStyle(de).overflowX!=='hidden'&&(!document.body||getComputedStyle(document.body).overflowX!=='hidden')){
            /* 넘친 쪽의 잎 요소(스크롤 상자 안은 뺀다) */
            const who=[];for(const el of document.body.querySelectorAll('*')){if(!shown(el))continue;const r=el.getBoundingClientRect();if(r.right<=de.clientWidth+1)continue;let clip=false;for(let a=el.parentElement;a&&a!==document.body;a=a.parentElement){const ox=getComputedStyle(a).overflowX;if(ox!=='visible'){clip=true;break;}}if(!clip&&getComputedStyle(el).position!=='fixed')who.push(lab(el)+' right='+Math.round(r.right));if(who.length>=4)break;}
            out.overflow={sw,cw:de.clientWidth,who};
          }
        }
        /* 스크롤을 끝까지 내린 채, 누를 수 있는 것의 한가운데를 다른 고정 요소가 덮는가 */
        const sc=document.scrollingElement||de,keep=sc.scrollTop;
        const check=()=>{for(const el of document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=button],[role=tab]')){
          if(!shown(el)||el.disabled)continue;const r=el.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;if(cx<0||cx>W||cy<0||cy>H)continue;
          /* 안쪽 스크롤 상자에 있는 것은 그 상자를 굴리면 된다 */
          let inner=false;for(let a=el.parentElement;a&&a!==document.body&&a!==de;a=a.parentElement){const cs=getComputedStyle(a);if(/(auto|scroll)/.test(cs.overflowY)&&a.scrollHeight>a.clientHeight+2){inner=true;break;}if(cs.position==='fixed'||cs.position==='sticky'){inner=cs.position==='sticky';break;}}
          if(inner)continue;
          const hit=document.elementFromPoint(cx,cy);if(!hit||hit===el||el.contains(hit)||hit.contains(el))continue;
          /* 가린 것이 고정 · 붙박이일 때만(겹쳐 그린 장식 · label 은 뺀다) */
          let fx=null;for(let a=hit;a&&a!==document.body;a=a.parentElement){const p=getComputedStyle(a).position;if(p==='fixed'||p==='sticky'){fx=a;break;}}
          if(!fx||fx.contains(el))continue;
          if(getComputedStyle(hit).pointerEvents==='none')continue;
          /* 창 · 시트 · 가림막이 뒤를 덮는 것은 정상 — 작은 고정 막대만(화면의 35% 미만, 창 안이 아님) */
          if(getComputedStyle(fx).position!=='fixed')continue;
          const fr=fx.getBoundingClientRect();if(fr.width*fr.height>W*H*.35)continue;
          if(fx.closest('dialog,[role="dialog"],[aria-modal="true"],.sheet,#sheet,.modal,.overlay,[class*="overlay"],[class*="-ov"],[id$="Ov"],[class*="backdrop"]'))continue;
          let big=false;for(let a=fx.parentElement;a&&a!==document.body;a=a.parentElement){const ar=a.getBoundingClientRect();if(getComputedStyle(a).position==='fixed'&&ar.width*ar.height>W*H*.35){big=true;break;}}
          if(big)continue;
          if(document.querySelector('dialog[open]'))continue;
          let elFixed=false;for(let a=el;a&&a!==document.body;a=a.parentElement){if(getComputedStyle(a).position==='fixed'){elFixed=true;break;}}
          out.covered.push({el:lab(el),by:lab(fx),at:[Math.round(cx),Math.round(cy)],fixed:elFixed});if(out.covered.length>=6)return;}};
        sc.scrollTop=sc.scrollHeight;check();
        /* 맨 위 틀: 보이는 iframe 의 아래쪽을 고정 막대가 덮는가(틀 안 요소는 틀이 따로 잰다 — 여기서는 막대와 틀의 겹침만) */
        if(top){for(const f of document.querySelectorAll('iframe')){if(!shown(f))continue;const fr=f.getBoundingClientRect();
          for(const bar of document.querySelectorAll('#teamBottom,#appSeg,.appbar,nav')){if(!shown(bar))continue;const cs=getComputedStyle(bar);if(cs.position!=='fixed'&&cs.position!=='sticky')continue;const br=bar.getBoundingClientRect();
            const ov=Math.min(fr.bottom,br.bottom)-Math.max(fr.top,br.top),ox=Math.min(fr.right,br.right)-Math.max(fr.left,br.left);
            if(ov>6&&ox>40&&br.top>H/2){let pad=0;try{const d=f.contentDocument;pad=parseFloat(getComputedStyle(d.body).paddingBottom)||0;const last=d.body.lastElementChild;}catch(_){}
              out.covered.push({el:'iframe#'+f.id+' bottom '+Math.round(ov)+'px',by:lab(bar),pad,frameUnderBar:true});}}}}
        sc.scrollTop=keep;
        return out;},{phone,top:id==='top'}).catch(()=>null);
      if(!r)continue;
      if(r.overflow)add('overflow-x','['+id+'] '+label+' scrollWidth '+r.overflow.sw+' > '+r.overflow.cw+' — '+r.overflow.who.join(' ; '),{screen:label});
      for(const c of r.covered){
        if(c.frameUnderBar){
          /* 틀이 막대 밑으로 들어가 있으면, 틀 안에서 끝까지 내린 마지막 누를 것이 막대 위로 올라오는지 본다 */
          const fid=/iframe#(\w+)/.exec(c.el);const fr=fid&&await frameById(fid[1]);if(!fr)continue;
          const hid=await fr.evaluate(ov=>{const sc=document.scrollingElement||document.documentElement,keep=sc.scrollTop;sc.scrollTop=sc.scrollHeight;const H=innerHeight,out=[];
            for(const el of document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=button]')){if(!el.getClientRects().length||(el.checkVisibility&&!el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})))continue;const r=el.getBoundingClientRect();if(r.height<4||r.width<4)continue;
              let inner=false;for(let a=el.parentElement;a&&a!==document.body;a=a.parentElement){const cs=getComputedStyle(a);if(/(auto|scroll)/.test(cs.overflowY)&&a.scrollHeight>a.clientHeight+2){inner=true;break;}}
              if(inner)continue;const cy=r.top+r.height/2;if(cy>H-ov&&cy<H)out.push(el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+' «'+(el.innerText||el.value||el.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim().slice(0,24)+'» y='+Math.round(cy)+'/'+H);if(out.length>=4)break;}
            sc.scrollTop=keep;return out;},parseFloat(/bottom (\d+)px/.exec(c.el)[1])).catch(()=>[]);
          if(hid.length)add('covered-by-bar','['+fid[1]+'] '+label+' — '+c.by+' 가 틀 아래 '+/bottom (\d+)px/.exec(c.el)[1]+'px 를 덮고, 끝까지 내려도 그 밑에: '+hid.join(' ; '),{screen:label});
        }else add('covered','['+id+'] '+label+' — '+c.el+' ← '+c.by+' @'+c.at.join(','),{screen:label});
      }
    }
  }
  const audit=async label=>{await auditText(label);await auditLayout(label);await shot(label);};

  async function closeAll(){
    await page.keyboard.press('Escape').catch(()=>{});
    await Promise.all((await liveFrames()).map(({frame})=>frame.evaluate(()=>{
      for(const fn of ['closeSheet','closeModal','psFormClose','closeDialog'])try{if(typeof window[fn]==='function')window[fn]();}catch(_){}
      for(const b of document.querySelectorAll('[data-close],.sheet-x,.modal-x,.pw-close,[aria-label="닫기"],[aria-label="Close"],.dlg-x,.psf-x,.sheet-close,#ehClose,.eh-x,.mf-skip,[data-cancel],[data-av-cancel],[data-act="cancel"],.wf-x,dialog[open] [value="cancel"]'))try{if(b.getClientRects().length)b.click();}catch(_){}
      for(const d of document.querySelectorAll('dialog[open]'))try{d.close();}catch(_){}
      /* 떠 있는 창 안의 «× · 닫기 · 취소» — 창마다 닫는 단추 이름이 달라서 글로 찾는다 */
      for(const b of document.querySelectorAll('button,[role="button"]')){if(!b.getClientRects().length)continue;const t=(b.innerText||b.getAttribute('aria-label')||'').trim();if(!/^(×|✕|✖|닫기|취소|Close|Cancel)$/.test(t))continue;
        let fx=false;for(let a=b.parentElement;a&&a!==document.body;a=a.parentElement){const p=getComputedStyle(a).position;if(p==='fixed'||(p==='absolute'&&+getComputedStyle(a).zIndex>=50)){fx=true;break;}}
        if(fx)try{b.click();}catch(_){}}
    }).catch(()=>{})));
  }

  /* ── 단추 훑기 ───────────────────────────────────────── */
  const SEL='button,[role="button"],[role="tab"],summary,[onclick]';
  const listBtns=frame=>frame.evaluate(({sel,skip})=>{
    const re=new RegExp(skip,'i'),seen=new Set(),out=[];let i=0;
    for(const e of document.querySelectorAll('[data-su-i]'))e.removeAttribute('data-su-i');
    for(const e of document.querySelectorAll(sel)){
      if(!e.getClientRects().length||e.disabled)continue;if(e.checkVisibility&&!e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))continue;
      const r=e.getBoundingClientRect();if(r.width<6||r.height<6)continue;
      const t=(e.innerText||e.value||e.getAttribute('aria-label')||e.title||'').replace(/\s+/g,' ').trim().slice(0,28);
      if(re.test(t)||re.test(e.id||'')||re.test(e.getAttribute('onclick')||'')||re.test(e.title||'')||re.test(e.getAttribute('aria-label')||''))continue;
      const data=[...e.attributes].filter(a=>/^data-/.test(a.name)&&!/^data-su-/.test(a.name)).map(a=>a.name+'='+a.value.replace(/[a-z0-9]{12,}/gi,'#').slice(0,18)).join(',');
      const sig=e.tagName+'|'+(e.id||'')+'|'+(typeof e.className==='string'?e.className.replace(/\b(on|is-on|active|open|sel|hover)\b/g,'').trim():'')+'|'+t.replace(/\d+/g,'#')+'|'+data.replace(/\d+/g,'#');
      if(seen.has(sig))continue;seen.add(sig);
      const on=e.matches('.on,.is-on,.active,.sel,.selected,[aria-pressed="true"],[aria-selected="true"],[aria-current],[aria-expanded="true"]');
      e.setAttribute('data-su-i',String(i));out.push({i:i++,sig,t,on,tag:e.tagName,real:e.tagName==='BUTTON'||e.getAttribute('role')==='button'});
    }return out;},{sel:SEL,skip:SKIP.source}).catch(()=>[]);
  let dialogs=0;
  const snap=async()=>{const rs=await Promise.all(page.frames().map(f=>f.evaluate(()=>window.__su?[window.__su.mut,window.__su.side]:[0,0]).catch(()=>[0,0])));let mut=0,side=dialogs;for(const r of rs){mut+=r[0];side+=r[1];}
    /* 화면의 모양(보이는 요소 수 · 글 길이 · 누를 것들의 class/aria/값 · 그림 요소 수) — 메뉴가 열리거나 단추가 켜지면 달라진다 */
    const shape=(await Promise.all((await liveFrames()).map(({frame})=>frame.evaluate(()=>{let v=0,h=0;const all=document.body?document.body.getElementsByTagName('*'):[];
      for(const e of all){if(e.id==='suInert')continue;if(e.getClientRects().length)v++;}
      for(const e of document.querySelectorAll('button,[role],input,select,textarea,summary,details,[aria-expanded],[aria-pressed],[hidden],.on,.is-on,.active,.sel')){const t=(typeof e.className==='string'?e.className:'')+'|'+(e.getAttribute('aria-pressed')||'')+(e.getAttribute('aria-expanded')||'')+(e.getAttribute('aria-selected')||'')+(e.getAttribute('aria-checked')||'')+(e.hidden?'h':'')+(e.open?'o':'')+(e.checked?'c':'')+(e.disabled?'d':'')+('value' in e?String(e.value).length:'');for(let i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))|0;}
      return v+':'+(document.body?document.body.innerText.length:0)+':'+h+':'+document.querySelectorAll('svg *,canvas').length+':'+Math.round((document.scrollingElement||{}).scrollTop||0);}).catch(()=>'x')))).join(' ');
    const focus=await page.evaluate(()=>{let a=document.activeElement;try{while(a&&a.tagName==='IFRAME'&&a.contentDocument)a=a.contentDocument.activeElement;}catch(_){}return a?a.tagName+'#'+a.id+'.'+(typeof a.className==='string'?a.className:''):'';}).catch(()=>'');
    return {mut,side,net:netN,focus,shape,url:page.url(),frames:page.frames().length,finds:findings.length};};
  const changed=(a,b)=>a.mut!==b.mut||a.side!==b.side||a.net!==b.net||a.url!==b.url||a.frames!==b.frames||a.finds!==b.finds;
  async function crawl(label,frame,{max=30,reopen=null,until=Infinity}={}){
    if(!CRAWL||!frame)return 0;
    if(process.env.PS_SELF_SELFTEST&&!made.selftest){made.selftest=true;   /* 탐침 스스로 재기: 죽은 단추 · 이상한 글을 심고 찾는지 본다 */
      await frame.evaluate(()=>{const b=document.createElement('button');b.id='suSelfDead';b.textContent='self-test dead';b.style.cssText='position:fixed;left:8px;top:8px;z-index:2147483600;padding:8px';document.body.insertBefore(b,document.body.firstChild);const t=document.createElement('div');t.id='suSelfText';t.textContent='등번호 undefined';t.style.cssText='position:fixed;left:8px;top:60px;z-index:2147483600;background:#fff';document.body.appendChild(t);});}
    const rnd=SEED?rng(SEED+label.length):null;
    /* 이 화면은 «아무 데나 눌러도» 얼마나 바뀌나 — 아무 일도 안 하는 단추를 심어 눌러 본다(전역 click 처리기 · 다시 그리기의 몫).
       진짜 단추의 바뀜이 이 몫을 넘지 않으면 그 단추는 아무 일도 안 한 것이다 */
    const inert=async()=>{const s0=await snap();await frame.evaluate(()=>{let b=document.getElementById('suInert');if(!b){b=document.createElement('button');b.id='suInert';b.type='button';b.style.cssText='position:fixed;left:-99px;top:-99px;width:10px;height:10px;opacity:0';document.body.appendChild(b);}
        for(const t of ['pointerdown','mousedown','pointerup','mouseup'])b.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window}));b.click();}).catch(()=>{});await settle(300);const s1=await snap();return {mut:s1.mut-s0.mut,net:s1.net-s0.net};};
    await inert();let noise=await inert();{const n2=await inert();noise={mut:Math.max(noise.mut,n2.mut),net:Math.max(noise.net,n2.net)};}
    let base=await listBtns(frame);const baseSigs=new Set(base.map(b=>b.sig)),done=new Set();let n=0,lost=0;
    if(rnd)base=base.map(b=>[rnd(),b]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
    for(const b0 of base){
      if(n>=max||left()<45000||Date.now()>until)break;if(done.has(b0.sig))continue;done.add(b0.sig);
      let now=await listBtns(frame);let b=now.find(x=>x.sig===b0.sig);
      if(!b){if(reopen&&lost<2){await reopen().catch(()=>{});await settle(700);now=await listBtns(frame);b=now.find(x=>x.sig===b0.sig);}if(!b){/* 화면이 돌아오지 않는다 — 두 번 되돌려 보고도 없으면 그 단추는 건너뛴다(되돌리기는 비싸다) */lost++;continue;}lost=0;}
      n++;clicks++;action=label+' › '+b.tag.toLowerCase()+' «'+b.t+'» ['+b.sig.split('|').slice(1,3).join('|').slice(0,60)+']';
      const loc=frame.locator('[data-su-i="'+b.i+'"]').first();
      const idle=b.real&&!b.on?noise:null;
      const before=await snap();let how='click';
      try{await loc.click({timeout:800});}
      catch(e){const m=String(e&&e.message||e);
        if(/intercepts pointer events/.test(m)){
          /* 진짜 손가락은 못 누른다 — 가린 것이 작은 고정 막대일 때만 적는다(창 · 가림막이 뒤를 덮는 것은 정상). 흐름은 JS click 으로 잇는다 */
          const by=await loc.evaluate(el=>{
            const lab=e=>e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(typeof e.className==='string'&&e.className?'.'+e.className.trim().split(/\s+/).slice(0,2).join('.'):'');
            const small=(doc,win,hit,self)=>{if(!hit||hit===self||(self&&(self.contains(hit)||hit.contains(self))))return null;let fx=null;for(let a=hit;a&&a!==doc.body;a=a.parentElement){const p=win.getComputedStyle(a).position;if(p==='fixed'||p==='sticky'){fx=a;break;}}
              if(!fx)return null;const r=fx.getBoundingClientRect();if(r.width*r.height>win.innerWidth*win.innerHeight*.35)return null;
              if(fx.closest('dialog,[role="dialog"],[aria-modal="true"],.sheet,#sheet,[class*="modal"],[class*="overlay"],[class*="-ov"],[id$="Ov"],[class*="backdrop"],[class*="pop"],[class*="menu"]')||doc.querySelector('dialog[open]'))return null;
              for(let a=fx.parentElement;a&&a!==doc.body;a=a.parentElement){const ar=a.getBoundingClientRect();if(win.getComputedStyle(a).position==='fixed'&&ar.width*ar.height>win.innerWidth*win.innerHeight*.35)return null;}
              return lab(fx)+' ('+win.getComputedStyle(fx).position+' '+Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'×'+Math.round(r.height)+')';};
            el.scrollIntoView({block:'center',inline:'center'});const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
            const inner=small(document,window,document.elementFromPoint(cx,cy),el);if(inner)return inner+' @'+Math.round(cx)+','+Math.round(cy);
            try{if(window.frameElement&&window.parent!==window){const fr=window.frameElement.getBoundingClientRect(),pd=window.parent.document,hit=pd.elementFromPoint(fr.left+cx,fr.top+cy);if(hit&&hit!==window.frameElement){const o=small(pd,window.parent,hit,null);if(o)return 'shell '+o+' @'+Math.round(fr.left+cx)+','+Math.round(fr.top+cy);}}}catch(_){}
            return null;}).catch(()=>null);
          if(by)add('click-intercepted','['+label+'] «'+b.t+'» ['+b.sig.split('|').slice(0,3).join('|').slice(0,70)+'] ← '+by);}
        how='js';await loc.evaluate(e=>e.click()).catch(()=>{});}
      await settle(300);
      let after=await snap();
      const quiet=(x,y,k)=>idle&&x.shape===y.shape&&x.side===y.side&&x.url===y.url&&x.frames===y.frames&&x.finds===y.finds&&(y.mut-x.mut)<=idle.mut*k+2&&(y.net-x.net)<=idle.net*k+(k>1?1:0);
      if(process.env.PS_SELF_DEBUG&&/suSelf/.test(b.sig))console.error('[selftest]',JSON.stringify({idle,how,before,after,real:b.real,on:b.on}));
      if(idle&&how==='click'&&quiet(before,after,1)){
        /* 한 번 더(더 길게) — 그래도 가만히 있을 때만큼만 바뀌면 «죽은 단추»(확실한 것만: 진짜 button · 켜진 탭 아님 · 가려지지 않음) */
        const still=await loc.count().catch(()=>0);
        if(still){const b2=await snap();await loc.click({timeout:800}).catch(()=>{});await settle(900);const a2=await snap();
          if(quiet(b2,a2,1.5))add('dead-button','['+label+'] «'+b.t+'» ['+b.sig.split('|').slice(0,3).join('|').slice(0,90)+']');}
      }
      await auditText(action);
      await closeAll();await settle(140);
      const cur=await listBtns(frame);
      if(reopen&&!cur.some(x=>baseSigs.has(x.sig))){await reopen().catch(()=>{});await settle(900);}
    }
    return n;
  }

  /* ── 가는 길 ─────────────────────────────────────────── */
  const jsClick=(frame,sel)=>frame.evaluate(sel=>{const b=[...document.querySelectorAll(sel)].find(b=>b.getClientRects().length&&(!b.checkVisibility||b.checkVisibility({checkVisibilityCSS:true})));if(!b)return false;b.click();return true;},sel).catch(()=>false);
  const goApp=async app=>{   /* 셸의 앱 단추: board · design(보관함) · community · idp · note … */
    await closeAll();
    if(app==='design'){if(await jsClick(page.mainFrame(),'#psTrainBtn')){await settle(1500);return true;}return false;}
    let ok=await jsClick(page.mainFrame(),app==='board'?'#appSeg [data-app="board"]:not([data-train])':'#appSeg button[data-app="'+app+'"]');
    if(!ok){/* 폰: 더보기 시트 안 */
      if(await jsClick(page.mainFrame(),'#psMoreBtn')){await settle(500);ok=await jsClick(page.mainFrame(),'[data-app="'+app+'"],[data-more-app="'+app+'"],[data-tb-app="'+app+'"]');}}
    await settle(1500);return ok;};
  const goTeam=async key=>{
    await closeAll();
    const open=await page.evaluate(()=>document.body.classList.contains('ps-team-open'));
    if(!open){await jsClick(page.mainFrame(),'#appSeg [data-team-hub]');await settle(700);}
    let ok=await jsClick(page.mainFrame(),'#teamNav [data-team-key="'+key+'"],#teamBottom [data-tb="'+key+'"]');
    if(!ok&&await jsClick(page.mainFrame(),'#teamBottom [data-tb="more"]')){await settle(500);ok=await jsClick(page.mainFrame(),'#teamMoreSheet [data-team-key="'+key+'"],#teamMoreSheet [data-tb="'+key+'"],#teamMoreSheet [data-tb-go="'+key+'"]');
      if(!ok){const keys=await page.evaluate(()=>[...document.querySelectorAll('#teamMoreSheet button')].map(b=>b.outerHTML.slice(0,160)));made['teamMore:'+key]=keys.slice(0,12);await closeAll();}}
    await settle(1700);return ok;};
  /* 멈춤 감시 — 한 흐름이 HANG_MS 를 넘으면(화면이 얼었다) 디버거로 세워 어디를 돌고 있는지 적고 다음으로 간다 */
  const HANG_MS=+(process.env.PS_SELF_HANG_MS||150000);let hung=false;
  const guard=(work,name)=>{let t;work.catch(()=>{});return Promise.race([work,new Promise((_,rej)=>{t=setTimeout(async()=>{
    let where='';try{const cdp=await context.newCDPSession(page);const paused=new Promise(r=>cdp.once('Debugger.paused',r));await cdp.send('Debugger.enable');await cdp.send('Debugger.pause');
      const ev=await Promise.race([paused,new Promise(r=>setTimeout(()=>r(null),5000))]);
      if(ev)where=ev.callFrames.slice(0,8).map(f=>(f.functionName||'(anonymous)')+' @'+String(f.url).replace(fx.base,'').replace(/\?v=[\d.]+/,'')+':'+(f.location.lineNumber+1)+':'+(f.location.columnNumber+1)).join(' < ');
      else where='main thread did not pause in 5s (idle or blocked outside script)';
      await cdp.send('Debugger.resume').catch(()=>{});await cdp.send('Debugger.disable').catch(()=>{});}catch(e){where='(could not pause: '+String(e&&e.message||e).slice(0,80)+')';}
    hung=true;add('hang','flow «'+name+'» did not finish in '+Math.round(HANG_MS/1000)+'s — last action: '+action+' — main thread at: '+where);rej(new Error('hang: '+name));},HANG_MS);})]).finally(()=>clearTimeout(t));};
  const flow=async(name,fn)=>{
    if(ONLY&&!ONLY.has(name))return;if(hung){flows.push({name,ok:false,skipped:'after a hang'});return;}if(left()<20000){flows.push({name,ok:false,skipped:'time'});return;}
    action='flow '+name;const s=Date.now();
    try{const r=await guard(fn(),name);flows.push({name,ok:r!==false&&!(r&&r.skip),ms:Date.now()-s,...(r&&typeof r==='object'?r:{})});}
    catch(e){const m=String(e&&e.message||e).split('\n').slice(0,3).join(' | ').slice(0,400);flows.push({name,ok:false,ms:Date.now()-s,error:m});if(!/^hang:/.test(m))add('flow-failed',name+' — '+m);await Promise.race([shot('fail-'+name),new Promise(r=>setTimeout(r,4000))]);}
    await Promise.race([closeAll().catch(()=>{}),new Promise(r=>setTimeout(r,6000))]);
  };
  const queue=[];
  const screen=async(label,{crawlMax=phone?18:28,reopen=null}={})=>{
    action='screen '+label;await settle(300);await audit(label);
    if(reopen)queue.push({label,reopen,crawlMax});
  };
  const board=async()=>{const f=await frameById('fBoard');if(!f)throw new Error('no #fBoard');return f;};
  const boardReady=async f=>f.waitForFunction(()=>typeof renderTokens==='function'&&window.__boardReady&&window.__boardRestoreDone,null,{timeout:20000}).catch(()=>{});

  /* ══ 한 주 ══════════════════════════════════════════════ */
  await audit('boot');

  if(role==='coach'){
    await flow('board',async()=>{
      await goApp('board');const f=await board();await boardReady(f);await settle(800);await audit('board');
      const ro=await f.evaluate(()=>!!(window.PSPhoneBoardView&&PSPhoneBoardView.readOnly&&PSPhoneBoardView.readOnly(window)));
      if(ro){made.boardReadOnly=true;return {skip:'phone board is read-only (by design 3.232)'};}
      /* 포메이션으로 시작 → 선수들 */
      await f.locator('#ehDoor').click();await settle(500);await auditText('board formation door');
      await f.locator('.eh-f[data-f="433"]:visible').first().click();
      await f.locator('#ehGo').click();await settle(900);
      let n=await f.evaluate(()=>state.players.length);if(n<5)throw new Error('formation start put '+n+' players');
      /* 장면 줄 열고 장면 3개: 장면마다 한 선수를 끈다 */
      await f.locator('#ps-df-anim').click();await settle(600);
      const drag=async k=>{const box=await f.evaluate(k=>{const g=document.querySelectorAll('g.token[data-id]')[k];if(!g)return null;const r=g.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];},k);if(!box)throw new Error('no token '+k);
        const fe=await (await page.$('#fBoard')).boundingBox();const x=fe.x+box[0],y=fe.y+box[1];await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+40,y-30,{steps:5});await page.mouse.move(x+80,y-50,{steps:5});await page.mouse.up();await settle(250);};
      for(let k=0;k<3;k++){await drag(3+k);await f.locator('#animAdd').click();await settle(350);}
      const frames=await f.evaluate(()=>anim.frames.length);if(frames<3)throw new Error('scenes '+frames);
      await auditText('board scenes');
      await f.locator('#animPlay').click();await settle(600);
      const playing=await f.evaluate(()=>typeof animPlaying!=='undefined'?!!animPlaying:null);
      await settle(2600);await auditText('board playing');
      await f.evaluate(()=>{try{if(typeof stopAnim==='function')stopAnim();}catch(_){}});
      made.board={players:n,frames,playing};
      /* 페이지 하나 더 */
      await f.locator('#bpAddPage').click().catch(()=>{});await settle(600);
      made.board.pages=await f.evaluate(()=>window.__psPages&&__psPages.pg?__psPages.pg().length:null);
      await f.evaluate(()=>{const t=document.querySelectorAll('.bp-tab')[0];if(t)t.click();});await settle(600);
      return {players:n,frames,playing};
    });
    await flow('vault',async()=>{
      if(made.boardReadOnly)return {skip:'read-only board'};
      const f=await board();
      await f.locator('#boardManualSave').click();
      await f.locator('#psSaveOv').waitFor({timeout:6000});await auditText('vault save sheet');await auditLayout('vault save sheet');
      await f.locator('#pssName').fill('직접 써 보기 전술');await f.locator('#pssOk').click();
      await f.waitForFunction(async()=>((await boardStore.get('cs_drill_lib_v1'))||[]).some(d=>d.name==='직접 써 보기 전술'),null,{timeout:8000,polling:200});
      made.vault='직접 써 보기 전술';
      /* 보관함에서 다시 열기 */
      await goApp('design');await settle(1200);await audit('vault list');
      const hit=await f.evaluate(()=>{const els=[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&(e.textContent||'').trim()==='직접 써 보기 전술'&&e.getClientRects().length);if(!els.length)return false;const c=els[0].closest('[data-vx-id],[data-id],.vx-card,button,li,article')||els[0];c.click();return true;});
      if(!hit)throw new Error('saved item not shown in the vault list');
      await settle(1200);await audit('vault item open');
      const view=await jsClick(f,'[data-vx-view]');await settle(1500);
      if(view){await audit('vault item view');const cnt=await f.evaluate(()=>({players:state.players.length,frames:anim.frames.length}));made.vaultView=cnt;
        if(cnt.players!==made.board.players)add('data-mismatch','vault view shows '+cnt.players+' players, saved '+made.board.players);
        if(cnt.frames!==made.board.frames)add('data-mismatch','vault view shows '+cnt.frames+' scenes, saved '+made.board.frames);
        await jsClick(f,'#vCreateCancel,#vCreateBack,[data-vv-close]');await settle(800);}
      return {view};
    });
    await flow('vault-screen',async()=>{await goApp('design');await screen('vault',{reopen:()=>goApp('design')});});
    await flow('schedule',async()=>{
      if(!await goTeam('training'))throw new Error('team › 일정 not reachable');
      const f=await frameById('fProcess');await f.waitForFunction(()=>typeof week!=='undefined'&&document.querySelectorAll('.wks-day').length>=7,null,{timeout:15000});
      await audit('schedule');
      /* 빈 날에 세션 하나: 조를 고르고 만든다 */
      if(phone){await jsClick(f,'#vtoggle [data-v="week"]');await settle(900);await audit('schedule week (phone)');}
      const di=await f.evaluate(()=>week.findIndex(d=>!(d.trainings||[]).length&&!(d.board&&d.board.sched==='경기')));
      if(di<0)throw new Error('no empty day');
      const total=()=>f.evaluate(()=>week.reduce((n,d)=>n+(d.trainings||[]).length,0));const before=await total();
      const day=f.locator('.wks-day').nth(di);
      const addBtn=day.getByRole('button',{name:'＋ 세션 추가',exact:true}).first();
      if(await addBtn.isVisible().catch(()=>false))await addBtn.click();
      else{/* 폰: 날을 고른 뒤 보이는 «＋ 세션 추가» */const any=f.getByRole('button',{name:'＋ 세션 추가',exact:true}).first();
        if(!await any.isVisible().catch(()=>false)&&await jsClick(f,'.schedule-fab')){   /* 폰 월간: «＋ 오늘에 추가» → 날짜 창에서 시간대를 고르면 세션이 생긴다 */
          await settle(800);await auditText('schedule phone day popup');await auditLayout('schedule phone day popup');made.schedFab=true;
          const slot=f.locator('.mpop button:visible',{hasText:/^저녁$/}).first();await slot.click({timeout:3000});await settle(700);await auditText('schedule phone slot picked');
          await f.evaluate(()=>{try{closeMonthPop();}catch(_){}});await settle(400);}
        else if(!await any.isVisible().catch(()=>false)){made.schedPhoneBtns=await f.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length).map(b=>(b.id?'#'+b.id:'')+'.'+b.className+'«'+b.innerText.trim().slice(0,12)+'»').slice(0,60));throw new Error('no visible «＋ 세션 추가»');}
        if(!made.schedFab)await any.click();}
      const sheet=f.locator('#sheet');
      if(!made.schedFab){
      await settle(500);await auditText('schedule session team picker');await auditLayout('schedule session team picker');
      /* 조는 미리 골라져 있다(다시 누르면 꺼진다) */
      if(!made.schedFab||await sheet.getByRole('button',{name:'세션 만들기',exact:true}).isVisible().catch(()=>false))await sheet.getByRole('button',{name:'세션 만들기',exact:true}).click({timeout:3000});
      await settle(700);await auditText('schedule session fill sheet');await auditLayout('schedule session fill sheet');
      await sheet.getByRole('button',{name:'닫기',exact:true}).first().click().catch(()=>closeAll());await settle(500);
      }
      const made1=(await total())-before;if(made1<1)throw new Error('session was not created (trainings '+before+' → '+(before+made1)+')');
      const diMade=await f.evaluate(()=>week.findIndex(d=>(d.trainings||[]).some(t=>!/가상/.test(t.note||''))));
      made.session={di:diMade>=0?diMade:di,abs:await f.evaluate(()=>typeof wk!=='undefined'?wk:0)};
      /* 다른 빈 날에 경기: 일정 ＋ → 리그 */
      const dm=await f.evaluate(di=>week.findIndex((d,i)=>i!==di&&!(d.trainings||[]).length&&!(d.board&&d.board.sched==='경기')),di);
      if(dm>=0&&!made.schedFab){await f.locator('.wks-day').nth(dm).locator('.wks-kbtn').first().click();await sheet.locator('#wfSec-kind').waitFor({timeout:5000});await auditText('schedule kind sheet');
        const lg=sheet.locator('#wfSec-kind').getByRole('button',{name:'리그',exact:true});await lg.click();await settle(600);await auditText('schedule match sheet');
        const opp=sheet.locator('input[placeholder*="상대"],#wfOpp,[data-wf="opp"]').first();if(await opp.isVisible().catch(()=>false)){await opp.fill('프로세스FC');await opp.blur();}
        await settle(400);await sheet.getByRole('button',{name:'닫기',exact:true}).first().click().catch(()=>closeAll());await settle(600);
        const kind=await f.evaluate(dm=>week[dm].board&&week[dm].board.sched,dm);made.match={dm,kind,opp:await f.evaluate(dm=>(week[dm].board||{}).opp||((week[dm].match||{}).opp)||'',dm)};
        if(kind!=='경기')add('flow-failed','schedule — «일정 ＋ › 리그» did not make day '+dm+' a match day (sched='+kind+')');}
      await f.waitForFunction(()=>{try{return !window.parent.PSSync.pending().count;}catch(_){return true;}},null,{timeout:10000}).catch(()=>{});
      for(const v of ['month','year','day','week']){if(await jsClick(f,'#vtoggle [data-v="'+v+'"]')){await settle(700);await audit('schedule view '+v);}}
      return made.session;
    });
    await flow('schedule-screen',async()=>{await goTeam('training');await screen('team 일정',{reopen:()=>goTeam('training')});});
    await flow('match',async()=>{
      if(!await goTeam('match'))throw new Error('team › 경기 not reachable');
      const f=await frameById('fScout');await f.locator('#matchAdd').waitFor({timeout:10000});await audit('match list');
      const before=await f.locator('.mr-hit').count();
      await f.locator('#matchAdd').click();await settle(700);await auditText('match add form');await auditLayout('match add form');
      const form=f.locator('.psf-card,.psf,#psForm,.ps-form,dialog[open],.sheet.on,.modal.on').first();
      const inputs=await f.evaluate(()=>[...document.querySelectorAll('input,select,textarea')].filter(e=>e.getClientRects().length&&!e.closest('.match-list,#matchList')).map(e=>({tag:e.tagName,id:e.id,name:e.name,type:e.type,ph:e.placeholder,v:(e.value||'').slice(0,20),data:[...e.attributes].filter(a=>/^data-/.test(a.name)).map(a=>a.name).join(',')})).slice(0,14));
      made.matchForm=inputs;
      const opp=f.locator('input[data-k][type="text"]:visible').first();
      await opp.fill('프로세스FC');
      await f.locator('[data-act="ok"]:visible').last().click({timeout:3000});await settle(1500);
      const after=await f.locator('.mr-hit').count();
      const inside=await f.evaluate(()=>!!document.querySelector('.match-shell')&&!!document.querySelector('.match-shell').getClientRects().length);
      if(after<=before&&!inside)throw new Error('match was not added (rows '+before+' → '+after+')');
      made.matchAdded=true;await audit('match after add');
      return {before,after,inside};
    });
    await flow('match-screen',async()=>{await goTeam('match');
      const f=await frameById('fScout');if(await jsClick(f,'.mr-hit')){await settle(1200);await screen('team 경기 › 열린 경기',{crawlMax:phone?22:34,reopen:async()=>{await goTeam('match');await jsClick(f,'.mr-hit');await settle(900);}});}
      await goTeam('match');const back=async()=>{await goTeam('match');if(!await f.locator('#matchAdd').isVisible().catch(()=>false)){await f.evaluate(()=>{try{if(typeof matchBackToList==='function')matchBackToList();else{const b=[...document.querySelectorAll('button')].find(b=>b.getClientRects().length&&/목록|‹|←/.test(b.innerText||b.getAttribute('aria-label')||''));if(b)b.click();}}catch(_){}});await settle(700);}};await back();await screen('team 경기',{reopen:back});});
    await flow('squad',async()=>{
      if(!await goTeam('players'))throw new Error('team › 선수단 not reachable');
      const f=await frameById('fScout');await f.locator('#pwTeam').first().waitFor({timeout:12000}).catch(()=>{});await settle(900);await audit('squad');
      const before=await f.evaluate(()=>data.players.filter(p=>p.type!=='target').length);
      if(!await f.locator('[data-pw-action="bulk"]:visible').first().isVisible().catch(()=>false)){/* 폰: «편집 도구»를 펼친다(3.218) */await f.getByRole('button',{name:'편집 도구',exact:true}).first().click();await settle(400);await auditText('squad edit tools');}
      await f.locator('[data-pw-action="bulk"]:visible').first().click();
      const sheet=f.locator('.pw-bulk-overlay');await sheet.waitFor({timeout:6000});await auditText('bulk add sheet');await auditLayout('bulk add sheet');
      const names=['직접 선수 하나','직접 선수 둘','직접 선수 셋'];
      for(let i=0;i<3;i++){const row=sheet.locator('.pw-bulk-row').nth(i);await row.locator('[data-f="name"]').fill(names[i]);await row.locator('[data-f="num"]').fill(String(71+i)).catch(()=>{});}
      await settle(300);await auditText('bulk add filled');
      await sheet.locator('[data-ok]').click();await sheet.waitFor({state:'detached',timeout:8000});await settle(900);
      const after=await f.evaluate(()=>data.players.filter(p=>p.type!=='target').length);
      if(after!==before+3)throw new Error('bulk add: '+before+' → '+after);
      made.bulk=names;await audit('squad after bulk');
      for(const v of ['list','edit','depth']){if(await jsClick(f,'[data-pw-view="'+v+'"]')){await settle(800);await audit('squad view '+v);}}
      return {before,after};
    });
    await flow('squad-screen',async()=>{await goTeam('players');await screen('team 선수단',{reopen:()=>goTeam('players'),crawlMax:phone?22:34});});
    await flow('availability',async()=>{
      await goTeam('players');
      let ok=await jsClick(page.mainFrame(),'#teamNav [data-team-key="avail"]');
      const f=await frameById('fScout');
      if(!ok){/* 폰: 오늘 화면의 «상태 수정 →» */await goTeam('today');ok=await jsClick(f,'[data-ck="status"],[data-ck="avail"]');}
      if(!ok)throw new Error('availability not reachable');
      await settle(1500);await audit('availability');
      const st=f.locator('#avDailyCard [data-av-st]:not([disabled]):visible').first();
      if(!await st.isVisible().catch(()=>false)){const d=f.locator('[data-av-date]:visible').last();if(await d.isVisible().catch(()=>false)){await d.click();await settle(700);}}
      const pid=await st.getAttribute('data-av-st',{timeout:5000});
      await st.click();await f.locator('.av-pick').waitFor({timeout:5000});await auditText('availability picker');await auditLayout('availability picker');
      await f.locator('.av-pick [data-k="rest"]').click();await f.locator('.av-pick [data-av-note]').fill('직접 써 보기 휴식').catch(()=>{});
      await f.locator('.av-pick [data-av-save]').click();await f.locator('.av-pick').waitFor({state:'hidden',timeout:6000});await settle(900);
      made.avail={pid};await audit('availability after mark');
      for(const m of ['players','days']){if(await jsClick(f,'[data-av-mode="'+m+'"]')){await settle(700);await audit('availability mode '+m);}}
      return {pid};
    });
    await flow('availability-screen',async()=>{const f=await frameById('fScout');const re=async()=>{await goTeam('players');if(!await jsClick(page.mainFrame(),'#teamNav [data-team-key="avail"]')){await goTeam('today');await jsClick(f,'[data-ck="avail"]');}await settle(1200);};await re();await screen('team 가용인원',{reopen:re});});
    for(const [k,name] of [['today','오늘'],['scouting','스카우팅'],['idp','IDP'],['playbook','팀 기준']]){
      await flow('team-'+k,async()=>{if(!await goTeam(k))throw new Error('team › '+name+' not reachable');await screen('team '+name,{reopen:()=>goTeam(k)});
        if(k==='playbook'&&await jsClick(page.mainFrame(),'#teamNav [data-team-key="attrs"]')){await settle(1500);await screen('team 선수 기준',{reopen:async()=>{await goTeam('playbook');await jsClick(page.mainFrame(),'#teamNav [data-team-key="attrs"]');}});}});
    }
  }else{
    /* 선수의 한 주 */
    await flow('player-idp',async()=>{
      await goApp('idp');const f=await frameById('fIdp');if(!f)throw new Error('no #fIdp');
      await f.waitForFunction(()=>[...document.querySelectorAll('#layers [data-l]')].filter(b=>b.getClientRects().length).length>=4,null,{timeout:30000});
      await settle(1200);await audit('player idp home');
      /* 시도 단추는 «다음 행동»을 정한 뒤에 켜진다(3.213) — 행동 → 장면 → 시도 차례 */
      await f.locator('#wg-next').fill('직접 써 보기 — 다음엔 받기 전에 어깨 너머 보기');
      await f.locator('[data-wg-save="next"]').click();await settle(1200);await auditText('player idp next saved');
      await f.locator('#wg-scene').fill('직접 써 보기 — 전환 순간 한 번 앞으로 받았다');
      await f.locator('[data-wg-save="memo"]').click();await settle(900);await auditText('player idp memo saved');
      const att=f.locator('[data-wg-attempt="1"]');
      if(await att.isEnabled().catch(()=>false)){await att.click();await settle(700);made.idpAttempt=true;}
      else made.idpAttempt='disabled (needs a goal action — by design 3.213)';
      made.idp={ok:true};
      const layers=await f.evaluate(()=>[...document.querySelectorAll('#layers [data-l]')].filter(b=>b.getClientRects().length).map(b=>b.dataset.l));
      for(const l of layers){await jsClick(f,'#layers [data-l="'+l+'"]');await settle(800);await screen('player idp › '+l,{reopen:async()=>{await goApp('idp');await jsClick(f,'#layers [data-l="'+l+'"]');},crawlMax:phone?12:18});}
      await jsClick(f,'#layers [data-l="home"]');
      return made.idp;
    });
    const idpOnly=phone&&await page.evaluate(()=>document.body.classList.contains('ps-player-idp-only'));made.idpOnlyShell=idpOnly;
    if(!idpOnly){
    await flow('player-schedule',async()=>{await jsClick(page.mainFrame(),'#appSeg [data-team-hub]');await settle(1800);await screen('player 팀 일정',{reopen:async()=>{await jsClick(page.mainFrame(),'#appSeg [data-team-hub]');}});});
    await flow('player-board',async()=>{await goApp('board');const f=await board();await boardReady(f);await settle(800);await screen('player board',{reopen:()=>goApp('board'),crawlMax:phone?14:22});});
    await flow('player-vault',async()=>{await goApp('design');await screen('player vault',{reopen:()=>goApp('design')});});
    }
  }

  /* 둘 다: 커뮤니티 · 노트 · 더보기 · 셸의 창들 */
  const idpOnlyShell=!!made.idpOnlyShell;   /* 폰의 선수는 IDP 만 있는 셸(메뉴 없음) — 일부러 */
  if(!idpOnlyShell)await flow('community',async()=>{if(!await goApp('community'))throw new Error('community not reachable');await screen('community',{reopen:()=>goApp('community'),crawlMax:phone?14:20});});
  /* 보관함의 다른 영역: 팀 등록 · 게임모델 · 개인 노트(1.976 — 셸 메뉴가 아니라 보관함 머리의 탭) */
  const vaultTab=async name=>{await goApp('design');await settle(600);for(const f of page.frames()){const ok=await f.evaluate(name=>{const b=[...document.querySelectorAll('button,[role="tab"],a')].find(b=>b.getClientRects().length&&(b.textContent||'').trim()===name);if(!b)return false;b.click();return true;},name).catch(()=>false);if(ok){await settle(1800);return true;}}return false;};
  if(!idpOnlyShell)for(const [key,name] of [['note','개인 노트'],['vault-team','팀 등록'],['vault-gamemodel','게임모델']]){
    await flow(key,async()=>{if(!await vaultTab(name))return {skip:'vault tab «'+name+'» not visible'};await screen('보관함 › '+name,{reopen:()=>vaultTab(name),crawlMax:phone?12:18});});
  }
  if(role==='coach')await flow('board-screen',async()=>{await goApp('board');const f=await board();await boardReady(f);await screen('board',{reopen:()=>goApp('board'),crawlMax:phone?24:44});});
  /* 새로고침 — 만든 것이 남았는가(서버 흉내 + 다시 연 화면) */
  await flow('reload',async()=>{
    await page.waitForFunction(()=>window.PSSync&&!PSSync.pending().count,null,{timeout:15000}).catch(()=>add('pending-before-reload','PSSync.pending() did not drain in 15s: '+'see state'));
    const pend=await page.evaluate(()=>({state:PSSync.state(),pending:PSSync.pending()})).catch(()=>null);made.syncBeforeReload=pend;
    await settle(1200);action='reload';
    await page.reload({waitUntil:'domcontentloaded'});await ready(page);await settle(1500);
    const bu=await page.evaluate(()=>{const v=sessionStorage.getItem('__su_bu')||'';sessionStorage.removeItem('__su_bu');return v;}).catch(()=>'');
    if(bu)add('leave-prompt','saved state «'+((pend&&pend.state&&pend.state.text)||'?')+'», pending '+((pend&&pend.pending&&pend.pending.count)||0)+' — beforeunload blocked by: '+bu.trim().split('\n').join(' ;; '));
    await audit('after reload');
    const srv=k=>{const r=fx.db.get(WT+'|'+k);try{return r?JSON.parse(r.v):null;}catch(_){return null;}};
    if(role==='coach'){
      if(made.board){await goApp('board');const f=await board();await boardReady(f);await f.waitForFunction(()=>typeof _boardPrivateLoaded!=='undefined'&&_boardPrivateLoaded,null,{timeout:15000}).catch(()=>{});await settle(1200);
        const now=await f.evaluate(()=>({pages:window.__psPages&&__psPages.pg?__psPages.pg().length:null,players:state.players.length,frames:anim.frames.length}));made.boardAfter=now;
        if(now.players!==made.board.players)add('lost-after-reload','work board players '+made.board.players+' → '+now.players+' (pages '+now.pages+')');
        if(now.frames!==made.board.frames)add('lost-after-reload','work board scenes '+made.board.frames+' → '+now.frames);
        if(made.board.pages&&now.pages!==made.board.pages)add('lost-after-reload','work board pages '+made.board.pages+' → '+now.pages);}
      if(made.vault){const inLib=[...fx.lib.values()].some(r=>r.item&&r.item.name===made.vault);if(!inLib)add('lost-after-reload','vault item «'+made.vault+'» never reached the server');
        await goApp('design');await settle(1500);const f=await board();const shown=await f.evaluate(n=>[...document.querySelectorAll('*')].some(e=>e.children.length===0&&(e.textContent||'').trim()===n&&e.getClientRects().length),made.vault);if(!shown)add('lost-after-reload','vault item «'+made.vault+'» not listed after reload');}
      const sc=srv('process_coach_v1');
      if(made.session){const d=sc&&sc.weeks&&sc.weeks[0]&&sc.weeks[0][made.session.di];if(!d||!(d.trainings||[]).length)add('lost-after-reload','schedule session on day '+made.session.di+' not on the server');
        await goTeam('training');const f=await frameById('fProcess');const n=await f.waitForFunction(di=>typeof week!=='undefined'&&(week[di].trainings||[]).length>0,made.session.di,{timeout:8000}).then(()=>1,()=>0);if(!n)add('lost-after-reload','schedule session on day '+made.session.di+' not shown after reload');}
      if(made.match&&made.match.kind==='경기'){const d=sc&&sc.weeks&&sc.weeks[0]&&sc.weeks[0][made.match.dm];if(!d||!d.board||d.board.sched!=='경기')add('lost-after-reload','schedule match day '+made.match.dm+' not on the server');}
      const ro=srv('scout_tool_v1');
      if(made.bulk){const names=new Set((ro&&ro.players||[]).map(p=>p.name));const sq=[...fx.db.values()].filter(r=>r.k.startsWith('sq:')).map(r=>{try{return JSON.parse(r.v).name;}catch(_){return '';}});for(const n of sq)names.add(n);
        for(const n of made.bulk)if(!names.has(n))add('lost-after-reload','bulk-added player «'+n+'» not on the server');
        await goTeam('players');const f=await frameById('fScout');const ok=await f.waitForFunction(ns=>typeof data!=='undefined'&&ns.every(n=>data.players.some(p=>p.name===n)),made.bulk,{timeout:10000}).then(()=>1,()=>0);if(!ok)add('lost-after-reload','bulk-added players not shown after reload');}
      if(made.avail){await goTeam('players');const f=await frameById('fScout');const st=await f.evaluate(pid=>{try{const p=data.players.find(p=>p.id===pid);return JSON.stringify({status:p&&p.status,avail:p&&(p.avail||p.availLog||p.health||null)}).slice(0,300);}catch(e){return String(e);}},made.avail.pid);made.availAfter=st;
        if(!/rest|휴식/.test(st))add('lost-after-reload','availability mark (rest) for '+made.avail.pid+' not found after reload: '+st);}
      if(made.matchAdded){const m=srv('cs_team_matches_v1');const has=m&&JSON.stringify(m).includes('프로세스FC');made.matchOnServer=!!has;if(!m)add('lost-after-reload','cs_team_matches_v1 not on the server after adding a match');}
    }else{
      if(made.idp&&!made.idp.err){const doc=srv('cs_idp_v1_'+A);const s=JSON.stringify(doc||{});
        if(!/전환 순간/.test(s))add('lost-after-reload','player IDP memo not on the server (cs_idp_v1_<uid>)');
        if(!/어깨 너머/.test(s))add('lost-after-reload','player IDP next action not on the server');
        await goApp('idp');const f=await frameById('fIdp');await f.waitForFunction(()=>[...document.querySelectorAll('#layers [data-l]')].filter(b=>b.getClientRects().length).length>=4,null,{timeout:30000}).catch(()=>{});await settle(1500);
        const txt=await f.evaluate(()=>document.body.innerText+' '+[...document.querySelectorAll('textarea,input')].map(e=>e.value).join(' '));
        if(!/전환 순간/.test(txt))add('lost-after-reload','player IDP memo not shown on the home card after reload');
        await audit('player idp after reload');}
    }
  });
  /* 단추 훑기 — 만든 것을 확인한 뒤에(훑기는 화면 상태를 흩뜨린다). 남은 시간을 화면 수로 나눠 쓴다 */
  if(CRAWL&&(!ONLY||ONLY.has('crawl'))){
    for(let i=0;i<queue.length;i++){
      const q=queue[i],room=left()-50000;if(room<8000){screens.push({label:q.label,crawled:0,skipped:'time'});continue;}
      const until=Date.now()+Math.max(8000,room/(queue.length-i));action='crawl '+q.label;
      if(hung){screens.push({label:q.label,crawled:0,skipped:'after a hang'});continue;}
      try{await guard((async()=>{await closeAll();await q.reopen();await settle(900);const v=await visFrame();const n=v?await crawl(q.label,v.frame,{max:q.crawlMax,reopen:q.reopen,until}):0;screens.push({label:q.label,frame:v&&v.id,crawled:n});})(),'crawl '+q.label);}
      catch(e){screens.push({label:q.label,crawled:0,error:String(e&&e.message||e).slice(0,160)});}
    }
  }
  await flow('shell',async()=>{
    await goApp('board');action='screen shell';
    /* 셸의 단추(계정 · 설정 · 새 기능 · 오류 제보 · 더보기) — 앱 이동 단추는 위에서 다 눌렀다 */
    for(const sel of ['#psAcctWrap .acct-btn','#gearBtn','#psUpdRail','#psSupportOpen','#psMoreBtn','#teamBottom [data-tb="more"]']){
      if(left()<25000)break;
      if(!await jsClick(page.mainFrame(),sel))continue;
      await settle(700);action='shell '+sel;await audit('shell '+sel);
      if(sel==='#gearBtn'){const tabs=await page.evaluate(()=>[...document.querySelectorAll('#gearPop [data-gp-go]')].filter(b=>b.getClientRects().length).map(b=>b.getAttribute('data-gp-go')));
        for(const t of tabs){await jsClick(page.mainFrame(),'#gearPop [data-gp-go="'+t+'"]');await settle(450);await audit('settings › '+t);}}
      await closeAll();await page.mouse.click(phone?195:720,phone?60:450).catch(()=>{});await settle(300);
    }
    screens.push({label:'shell',crawled:0});
  });

  /* 영어로 바꿨다 돌아오기 — 셸(맨 위 문서)에 한글이 남는가 */
  await flow('english',async()=>{
    await goApp('board');
    const sw=async l=>{await jsClick(page.mainFrame(),'#gearBtn');await settle(500);await jsClick(page.mainFrame(),'#gearPop [data-gp-go="general"]');await settle(300);if(!await jsClick(page.mainFrame(),'#langSw [data-lang="'+l+'"]'))throw new Error('language switch '+l+' not found');await settle(1500);};
    await sw('en');
    const lang=await page.evaluate(()=>document.documentElement.lang);if(lang!=='en')throw new Error('html lang is '+lang+' after switching to English');
    const leftover=async where=>{const l=await page.evaluate(()=>{const H=/[ㄱ-ㆎ가-힣]/,out=[];const shown=el=>{if(!el||!el.getClientRects().length)return false;if(el.checkVisibility&&!el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth;};
        const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){const t=n.nodeValue.replace(/\s+/g,' ').trim(),p=n.parentElement;if(!t||!H.test(t)||!p||p.closest('script,style,noscript,template')||!shown(p))continue;out.push(t.slice(0,60)+' @'+(p.id?'#'+p.id:p.tagName.toLowerCase()+(typeof p.className==='string'&&p.className?'.'+p.className.split(' ')[0]:'')));}
        for(const el of document.body.querySelectorAll('[placeholder],[title],[aria-label]')){if(!shown(el))continue;for(const a of ['placeholder','title','aria-label']){const v=el.getAttribute(a);if(v&&H.test(v))out.push(a+'="'+v.slice(0,50)+'" @'+(el.id?'#'+el.id:el.tagName.toLowerCase()));}}
        return out;});
      for(const t of l){if(/가상|[AB]팀|v\d\.\d{3} ·|직접 써 보기|직접 선수|프로세스FC|\.ava$|@span\.wi$/.test(t))continue;add('korean-in-english','['+where+'] '+t);}};
    await leftover('settings');await closeAll();await settle(300);await leftover('board');await auditLayout('english board');
    for(const [k,fn] of [['vault',()=>goApp('design')],['team',()=>role==='coach'?goTeam('today'):jsClick(page.mainFrame(),'#appSeg [data-team-hub]')],['idp',()=>goApp('idp')],['community',()=>goApp('community')]]){if(left()<25000)break;await fn();await settle(900);await leftover(k);await auditText('english '+k);await auditLayout('english '+k);}
    for(const sel of ['#psAcctWrap .acct-btn','#psMoreBtn']){if(await jsClick(page.mainFrame(),sel)){await settle(500);await leftover('shell '+sel);await closeAll();await page.mouse.click(phone?195:720,phone?60:450).catch(()=>{});}}
    await goApp('board');await sw('ko');
    const back=await page.evaluate(()=>document.documentElement.lang);if(back!=='ko')throw new Error('html lang is '+back+' after switching back');
    await closeAll();
  });

  return finish();

  async function finishBrowser(){for(const b of Object.values(browsers))await Promise.race([b.close().catch(()=>{}),new Promise(r=>setTimeout(r,8000))]);await Promise.race([fx.close?.(),new Promise(r=>setTimeout(r,3000))]);}
  async function finish(){
    await finishBrowser();
    const res={tag,role,size:sizeName,engine,seed:SEED,ms:Date.now()-t0,clicks,flows,screens,made,findings,nativeDialogs:typeof natives==='undefined'?[]:natives,serverWrites:fx.writes.length};
    fs.writeFileSync(path.join(OUT,role+'-'+sizeName+'.json'),JSON.stringify(res,null,1));
    return res;
  }
}

const results=[];
for(const role of ROLES)for(const size of SIZES_RUN){
  const r=await run(role,size).catch(e=>({tag:role+'/'+size,role,size,crashed:String(e&&e.stack||e).slice(0,800),findings:[],flows:[],screens:[]}));
  results.push(r);
  console.error('[self-use] '+r.tag+' '+Math.round((r.ms||0)/1000)+'s clicks='+(r.clicks||0)+' findings='+r.findings.length+(r.crashed?' CRASHED '+r.crashed:''));
}
/* 요약 — 남아 있는 다른 역할 · 크기 결과도 함께 */
const all=fs.readdirSync(OUT).filter(f=>/^(coach|player)-(desktop|phone)\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(path.join(OUT,f),'utf8')));
const byKind={};for(const r of all)for(const f of r.findings)(byKind[f.kind]=byKind[f.kind]||[]).push(f);
let md='# self-use crawl\n\n| 역할/크기 | 초 | 누름 | 흐름(성공/전체) | 찾은 것 |\n|---|---|---|---|---|\n';
for(const r of all)md+='| '+r.tag+' | '+Math.round(r.ms/1000)+' | '+r.clicks+' | '+r.flows.filter(f=>f.ok).length+'/'+r.flows.length+' | '+r.findings.length+' |\n';
md+='\n## 흐름\n';for(const r of all)for(const f of r.flows)if(!f.ok)md+='- '+r.tag+' **'+f.name+'** '+(f.skip||f.skipped||f.error||'')+'\n';
for(const [k,list] of Object.entries(byKind).sort((a,b)=>b[1].length-a[1].length)){md+='\n## '+k+' ('+list.length+')\n';for(const f of list.slice(0,60))md+='- `'+f.role+'/'+f.size+'` '+f.detail.replace(/\n/g,' ').slice(0,300)+(f.action?'  — _'+f.action.slice(0,110)+'_':'')+'\n';}
fs.writeFileSync(path.join(OUT,'summary.md'),md);
console.log(JSON.stringify({engine,test:'self-use-crawl',runs:results.map(r=>({tag:r.tag,ms:r.ms,clicks:r.clicks,flowsOk:r.flows.filter(f=>f.ok).length,flows:r.flows.length,findings:r.findings.length})),out:path.relative(root,OUT)}));
process.exit(0);   /* 얼어 버린 화면의 브라우저가 닫히지 않아도 끝낸다 */

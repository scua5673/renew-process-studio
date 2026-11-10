// i18n 뽑기 · 재기 공통 코드(배포 묶음에 들지 않는다 — scripts/ 와 tests/ 에서만 쓴다).
// 뽑는 것: HTML 글 노드 · 번역기(i18n.js)가 보는 속성 · JS 글 리터럴(' " `)에서 화면에 닿을 한글 글.
//   · `${…}` · '…'+값+'…' 은 구멍({})이 든 «틀»로 적는다 — 틀은 규칙(PS_I18N_RULES_EXTRA)이 있어야 번역된다.
//   · JS 글 안의 HTML 조각은 태그로 잘라 글 노드와 같은 단위로 만든다.
// 안 뽑는 것: 주석 · 정규식 · 객체 키 · 비교(=== 'x' · case 'x') · <style> · app.html 의 사전 블록.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const HANGUL=/[\u3131-\u318E\uAC00-\uD7A3]/;
export const ATTRS=['placeholder','title','aria-label','aria-description','aria-placeholder','aria-valuetext','aria-roledescription','alt','data-tip','data-ph','data-title','data-short','data-df-label','data-sel-note','label'];
export const AREAS=['shell','board','team','schedule','idp','gamemodel','community','note','common'];
/* 앱 번역기가 닿지 않는 곳 — 재되 래칫의 «앱 영역»과 따로 본다 */
export const OTHER_AREAS=['site','admin','content'];
const HOLE='\u0001',SEP='\u0002';

/* 파일 → 영역. 먼저 맞는 줄이 이긴다 */
const AREA_RULES=[
  [/^(admin\.html|studio\/admin-)/,'admin'],
  [/^(index\.html|landing\.html|start\/|guide\/|studio\/index\.html|privacy\.html|terms\.html|security\.html)/,'site'],
  [/^studio\/(learning\.html|learn-|textbook-|release-notes\.js|vault-examples\.js|community-training-catalog\.js|football-language\.js|req-baseline\.js|storage-keys\.js|first-work\.js|eval-anchors\.js|eval-standard\.js|archetypes\.js|admin-content-data\.js)/,'content'],
  [/^studio\/(app\.html|sync[.-]|storage\.js|update-|support|crash-breadcrumb\.js|autosave-|mobile-navigation\.js|install-door\.js|learning-off\.js|i18n\.js|popover-dismiss\.js|perms\.js|permissions-filter\.js|team-files\.js|idp-pub-wipe\.js)/,'shell'],
  [/^studio\/(board\.html|analysis\.html|board-|balls\.js|pitches\.js|vault-|team-load\.js|team-library\.js|team-photos\.js|photo-crop\.js|player-eye)/,'board'],
  [/^studio\/(process\.html|schedule-|year-plan\.js|training-intensity\.js|session-focus\.js|weather-request\.js|review-training|pdf-export\.js)/,'schedule'],
  [/^studio\/(scout\.html|scouting\.html|scouting-|match-|player-|roster-|avail-|profile-sheet\.js|team-|participation\.js|rpt-i18n\.js)/,'team'],
  [/^studio\/(idp\.html|idp-|daily-effort\.js|shared-view-observation\.js)/,'idp'],
  [/^studio\/(gamemodel\.html|playbook\.html|terms\.html|playbook-)/,'gamemodel'],
  [/^studio\/(community\.html|community-|letter-)/,'community'],
  [/^studio\/(note\.html|note-)/,'note']
];
export function areaOf(rel){
  for(const [re,a] of AREA_RULES)if(re.test(rel))return a;
  return 'common';
}
export function sourceFiles(){
  const out=[];
  const add=(dir,re)=>{const abs=path.join(root,dir);if(!fs.existsSync(abs))return;for(const f of fs.readdirSync(abs).sort()){if(re.test(f))out.push(path.posix.join(dir,f));}};
  add('studio',/\.(html|js)$/);
  for(const f of ['admin.html','index.html','landing.html'])if(fs.existsSync(path.join(root,f)))out.push(f);
  add('start',/\.html$/);add('guide',/\.html$/);
  return out;
}

const ENT={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0',middot:'·',hellip:'…',times:'×',laquo:'«',raquo:'»',rarr:'→',larr:'←',uarr:'↑',darr:'↓',ndash:'–',mdash:'—',bull:'•',copy:'©',check:'✓',rsaquo:'›',lsaquo:'‹',ldquo:'“',rdquo:'”',lsquo:'‘',rsquo:'’',minus:'−',deg:'°',zwj:'\u200d',thinsp:'\u2009',ensp:'\u2002',emsp:'\u2003'};
export function decodeEntities(s){
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,e)=>{
    if(e[0]==='#'){const n=e[1]==='x'||e[1]==='X'?parseInt(e.slice(2),16):parseInt(e.slice(1),10);return Number.isFinite(n)&&n>0&&n<0x110000?String.fromCodePoint(n):m;}
    return Object.prototype.hasOwnProperty.call(ENT,e)?ENT[e]:m;
  });
}
export const norm=s=>String(s).replace(/\s+/g,' ').trim();

/* 글 리터럴(또는 틀) 하나 → 화면 글 단위들 */
function chunksOf(pattern){
  const out=[];
  let p=pattern;
  if(/[<>]/.test(p)){
    const re=new RegExp('(?:^|[\\s"\'])('+ATTRS.join('|')+')\\s*=\\s*(["\'])([^"\'<>]*)\\2','g');
    let m;while((m=re.exec(p)))out.push(m[3]);
    p=p.replace(/<[^<>]*>/g,SEP);
    p=p.replace(/^[^<>\u0002]*>/,SEP).replace(/<[^<>]*$/,SEP);
  }
  for(const c of p.split(SEP))out.push(c);
  const res=[];
  for(let c of out){
    c=norm(decodeEntities(c));
    if(!c||!HANGUL.test(c))continue;
    /* 구멍만 남은 앞뒤는 뗀다: «{} 저장됨»은 틀, «{}»는 버린다 */
    res.push(c.split(HOLE).join('{}'));
  }
  return res;
}

function unescapeJs(s){
  return s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r?\n|[\s\S])/g,(m,e)=>{
    if(e[0]==='u'&&e[1]==='{')return String.fromCodePoint(parseInt(e.slice(2,-1),16));
    if(e[0]==='u'&&e.length===5)return String.fromCharCode(parseInt(e.slice(1),16));
    if(e[0]==='x'&&e.length===3)return String.fromCharCode(parseInt(e.slice(1),16));
    if(e==='n')return '\n';if(e==='t')return '\t';if(e==='r')return '\r';if(e==='b'||e==='f'||e==='v'||e==='0')return ' ';
    if(e==='\n'||e==='\r\n')return '';
    return e;
  });
}
const isId=c=>/[A-Za-z0-9_$\u00a0-\uffff]/.test(c);
const REGEX_PREV=new Set(['','(',',','=',':','[','!','&','|','?','{','}',';','+','-','*','%','<','>','~','^','\n']);
const REGEX_WORDS=new Set(['return','typeof','instanceof','in','of','new','delete','void','throw','case','do','else','yield','await']);

/* JS 글에서 한글 리터럴 · 틀을 모은다 */
export function scanJs(code,add){
  const n=code.length;
  let i=0,prev='',word='',prevWord='';
  const skipWs=k=>{for(;;){while(k<n&&/\s/.test(code[k]))k++;if(code[k]==='/'&&code[k+1]==='/'){while(k<n&&code[k]!=='\n')k++;continue;}if(code[k]==='/'&&code[k+1]==='*'){const e=code.indexOf('*/',k+2);k=e<0?n:e+2;continue;}return k;}};
  function readString(k){
    const q=code[k];let j=k+1;
    while(j<n&&code[j]!==q){if(code[j]==='\\')j++;else if(code[j]==='\n')break;j++;}
    return [unescapeJs(code.slice(k+1,j)).split(HOLE).join(''),Math.min(j+1,n)];
  }
  function readTemplate(k){
    let j=k+1,pat='',raw='';
    while(j<n&&code[j]!=='`'){
      if(code[j]==='\\'){raw+=code[j]+(code[j+1]||'');j+=2;continue;}
      if(code[j]==='$'&&code[j+1]==='{'){
        pat+=unescapeJs(raw)+HOLE;raw='';
        let d=1,s=j+2,e=s;
        while(e<n&&d>0){
          const c=code[e];
          if(c==='\''||c==='"'){e=readString(e)[1];continue;}
          if(c==='`'){e=skipTemplate(e);continue;}
          if(c==='{')d++;else if(c==='}')d--;
          e++;
        }
        scanJs(code.slice(s,e-1),add);
        j=e;continue;
      }
      raw+=code[j];j++;
    }
    pat+=unescapeJs(raw);
    return [pat,Math.min(j+1,n)];
  }
  function skipTemplate(k){
    let j=k+1;
    while(j<n&&code[j]!=='`'){
      if(code[j]==='\\'){j+=2;continue;}
      if(code[j]==='$'&&code[j+1]==='{'){let d=1;j+=2;while(j<n&&d>0){const c=code[j];if(c==='\''||c==='"'){j=readString(j)[1];continue;}if(c==='`'){j=skipTemplate(j);continue;}if(c==='{')d++;else if(c==='}')d--;j++;}continue;}
      j++;
    }
    return Math.min(j+1,n);
  }
  function readLiteral(k){return code[k]==='`'?readTemplate(k):readString(k);}
  /* '+' 뒤의 값 하나(구멍)를 건너뛴다. 끝 자리를 돌려주고, 안의 리터럴은 따로 모은다 */
  function skipOperand(k){
    let j=k,d=0;
    while(j<n){
      const c=code[j];
      if(c==='\''||c==='"'){j=readString(j)[1];continue;}
      if(c==='`'){j=skipTemplate(j);continue;}
      if(c==='('||c==='['||c==='{'){d++;j++;continue;}
      if(c===')'||c===']'||c==='}'){if(d===0)break;d--;j++;continue;}
      if(d===0&&/[+;,:?<>=&|\n]/.test(c))break;
      j++;
    }
    if(j>k)scanJs(code.slice(k,j),add);
    return j;
  }
  while(i<n){
    const c=code[i];
    if(/\s/.test(c)){if(c==='\n'&&word){prevWord=word;word='';}i++;continue;}
    if(c==='/'&&code[i+1]==='/'){while(i<n&&code[i]!=='\n')i++;continue;}
    if(c==='/'&&code[i+1]==='*'){const e=code.indexOf('*/',i+2);i=e<0?n:e+2;continue;}
    if(c==='\''||c==='"'||c==='`'){
      const lastWord=word||prevWord;
      const before=prev;
      let [pat,j]=readLiteral(i);
      const parts=[before==='+'?HOLE:'',pat];
      /* 이어 붙이기 사슬 */
      for(;;){
        let m=skipWs(j);
        if(code[m]!=='+'||code[m+1]==='+'||code[m+1]==='=')break;
        m=skipWs(m+1);
        if(code[m]==='\''||code[m]==='"'||code[m]==='`'){const r=readLiteral(m);parts.push(r[0]);j=r[1];continue;}
        const e=skipOperand(m);
        if(e<=m)break;
        parts.push(HOLE);j=e;
      }
      const after=code[skipWs(j)]||'';
      const isKey=after===':'&&(before==='{'||before===',')&&parts.length===2;
      const isCmp=(before==='='&&/[=!]=$/.test(code.slice(Math.max(0,i-3),i).replace(/\s+$/,'')))||lastWord==='case'&&before!=='+'&&/^\s*$/.test(code.slice(code.lastIndexOf('case',i)+4,i))||(after==='='&&code[skipWs(j)+1]==='=')||(after==='!'&&code[skipWs(j)+1]==='=');
      if(!isKey&&!isCmp){
        const whole=parts.join('');
        if(HANGUL.test(whole))for(const ch of chunksOf(whole))add(ch);
      }
      i=j;prev='"';word='';prevWord='';continue;
    }
    if(c==='/'){
      const w=word||'';
      if((!w&&REGEX_PREV.has(prev))||(w&&REGEX_WORDS.has(w))){
        let j=i+1,cls=false;
        while(j<n&&(cls||code[j]!=='/')){if(code[j]==='\\')j++;else if(code[j]==='[')cls=true;else if(code[j]===']')cls=false;else if(code[j]==='\n')break;j++;}
        j++;while(j<n&&/[a-z]/i.test(code[j]))j++;
        i=j;prev='r';word='';continue;
      }
      prev='/';word='';i++;continue;
    }
    if(isId(c)){word=(isId(prev)&&word?word:'')+c;prev=c;i++;continue;}
    if(word){prevWord=word;word='';}
    prev=c;i++;
  }
}

/* HTML 파일 하나에서 글 · 속성 · 안쪽 스크립트를 모은다 */
export function scanHtml(html,add){
  const n=html.length;let i=0,text='';
  const flush=()=>{const t=norm(decodeEntities(text));if(t&&HANGUL.test(t))add(t);text='';};
  while(i<n){
    if(html[i]!=='<'){text+=html[i++];continue;}
    if(html.startsWith('<!--',i)){const e=html.indexOf('-->',i+4);i=e<0?n:e+3;continue;}
    const m=/^<(\/?)([A-Za-z][A-Za-z0-9:-]*)/.exec(html.slice(i,i+80));
    if(!m){if(html[i+1]==='!'||html[i+1]==='?'){const e=html.indexOf('>',i);i=e<0?n:e+1;continue;}text+=html[i++];continue;}
    flush();
    let j=i+m[0].length,q='';
    while(j<n){const c=html[j];if(q){if(c===q)q='';}else if(c==='"'||c==='\'')q=c;else if(c==='>')break;j++;}
    const tag=html.slice(i,j+1),name=m[2].toLowerCase();
    if(!m[1]){
      const re=/([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;let a;
      while((a=re.exec(tag))){
        const an=a[1].toLowerCase(),v=a[2]!=null?a[2]:a[3];
        if(!HANGUL.test(v))continue;
        if(ATTRS.includes(an)){const t=norm(decodeEntities(v));if(t)add(t);}
        else if(/^on[a-z]+$/.test(an))scanJs(decodeEntities(v),add);
      }
    }
    i=j+1;
    if(!m[1]&&(name==='script'||name==='style')){
      const close=new RegExp('</'+name+'\\s*>','i'),rest=html.slice(i),e=rest.search(close);
      const body=e<0?rest:rest.slice(0,e);
      if(name==='script'&&!/\bsrc\s*=/.test(tag)&&!/type\s*=\s*["']?(application\/(ld\+)?json|text\/template)/i.test(tag)){
        /* app.html 의 번역 사전 블록은 원문이 아니라 사전이다 */
        if(!/var DICT = \{/.test(body))scanJs(body,add);
      }
      i=e<0?n:i+e;
    }
  }
  flush();
}

/* {파일 → [글]} · 글은 그 파일 안에서 한 번씩 */
export function extractAll(){
  const files={};
  for(const rel of sourceFiles()){
    const src=fs.readFileSync(path.join(root,rel),'utf8'),set=new Set();
    const add=s=>{if(s.length<=400)set.add(s);};
    if(rel.endsWith('.html'))scanHtml(src,add);else scanJs(src,add);
    if(set.size)files[rel]=[...set];
  }
  return files;
}
export function byArea(files){
  const areas={};
  for(const [rel,list] of Object.entries(files)){
    const a=areaOf(rel);(areas[a]||(areas[a]=new Set()));
    for(const s of list)areas[a].add(s);
  }
  return areas;
}

/* 사전 읽기: app.html 의 DICT · RULES + studio/i18n/en-*.js */
export function loadDictionaries({packs:usePacks=true}={}){
  const app=fs.readFileSync(path.join(root,'studio/app.html'),'utf8');
  const a=app.indexOf('var DICT = {'),b=app.indexOf('window.PS_I18N_BASE',a);
  if(a<0||b<0)throw new Error('app.html DICT block not found');
  const ctx={};vm.createContext(ctx);
  vm.runInContext(app.slice(a,b)+';this.D=DICT;this.R=RULES;',ctx);
  const win={};const packs={};
  const dir=path.join(root,'studio/i18n');
  for(const f of usePacks&&fs.existsSync(dir)?fs.readdirSync(dir).sort():[]){
    const m=/^en-([a-z]+)\.js$/.exec(f);if(!m)continue;
    const before=new Set(Object.keys(win.PS_I18N_EXTRA||{})),rb=(win.PS_I18N_RULES_EXTRA||[]).length;
    const c={window:win};vm.createContext(c);
    vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),c,{filename:f});
    packs[m[1]]={file:'studio/i18n/'+f,keys:Object.keys(win.PS_I18N_EXTRA||{}).filter(k=>!before.has(k)),rules:(win.PS_I18N_RULES_EXTRA||[]).slice(rb)};
  }
  /* 찾기는 앱과 같은 코드(studio/i18n.js)로 한다 — 가짜 창에 사전을 싣고 PSI18n.has 를 부른다 */
  const store={cs_lang:'en'};
  Object.assign(win,{PS_I18N_BASE:{D:ctx.D,R:ctx.R},navigator:{language:'en'},setTimeout(){return 0;},clearTimeout(){},addEventListener(){},
    localStorage:{getItem:k=>store[k]??null,setItem(k,v){store[k]=String(v);},key:()=>null,length:0},
    document:{readyState:'loading',currentScript:{src:''},addEventListener(){},documentElement:{setAttribute(){},getAttribute(){return null;}},getElementById(){return null;},createElement(){return {setAttribute(){}};},head:{appendChild(){}}}});
  win.window=win;
  const mod={window:win,Promise,Map,WeakMap,Object,String,RegExp};vm.createContext(mod);
  vm.runInContext(fs.readFileSync(path.join(root,'studio/i18n.js'),'utf8'),mod,{filename:'i18n.js'});
  const XR=win.PS_I18N_RULES_EXTRA||[];
  const en=t=>win.PSI18n.has(t,'en');
  /* 틀({})은 구멍에 보기 값을 넣어 규칙이 받는지 본다 */
  function covered(s){
    if(!s.includes('{}'))return en(s);
    for(const sample of ['3','Kim','12:30'])if(en(s.split('{}').join(sample)))return true;
    return false;
  }
  return {base:ctx,extra:win.PS_I18N_EXTRA||{},rules:XR,packs,en,covered};
}

export function coverage(files=extractAll(),dict=loadDictionaries()){
  const areas=byArea(files),out={areas:{},app:{total:0,translated:0},all:{total:0,translated:0}};
  for(const a of [...AREAS,...OTHER_AREAS]){
    const set=areas[a]||new Set();let t=0;const missing=[];
    for(const s of set){if(dict.covered(s))t++;else missing.push(s);}
    out.areas[a]={total:set.size,translated:t,untranslated:set.size-t,pct:set.size?Math.round(t/set.size*1000)/10:100,missing};
    out.all.total+=set.size;out.all.translated+=t;
    if(AREAS.includes(a)){out.app.total+=set.size;out.app.translated+=t;}
  }
  for(const k of ['app','all'])out[k].pct=out[k].total?Math.round(out[k].translated/out[k].total*1000)/10:100;
  return out;
}

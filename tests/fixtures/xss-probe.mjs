/* 3.272 — 동기화 문서 XSS 탐침의 공통 부분(tests/browser/xss-synced-docs*.mjs). 합성 값만 쓴다.
   POLY 하나가 글 자리 · 큰따옴표 속성 · 작은따옴표 속성 · onclick="fn('…')" 따옴표 · document.write 문서의 <script> 를 모두 끊는다:
     · 글 자리(esc 없음)            → <img src=x class=xss-probe onerror> 가 생기고 돈다
     · 속성(esc 없음)               → class="xss-probe" · onerror="…" 속성이 붙는다
     · 처리기 문자열(esc 만 한 곳)  → HTML 파서가 &#39; 를 풀어 `');top.__xss…` 가 실행문이 된다(scan 이 처리기를 실제로 돌려 본다)
   JSURL 은 <a href> · <iframe src> 자리. NUM 은 숫자 칸에 글이 온 경우. */
export const HIT='top.__xss=(top.__xss||0)+1';
export const POLY="x');"+HIT+';//" class="xss-probe" onerror="'+HIT+'" x=\'><img src=x class=xss-probe onerror="'+HIT+'"></script><script>'+HIT+'</script>';
export const JSURL='javascript:'+HIT;
export const NICE="FC <서울> & '친구'";
export const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/* 문서의 모든 글 잎을 나쁜 값으로 바꾼다. keep: 그대로 둘 키(연결에 쓰는 id · 날짜 …), url: 주소 칸, nums: 숫자 잎도 바꾼다 */
export function poison(value,{keep=/^$/,url=/^(?:url|link|href|video\d*|src|logo|emblem|photo|img|image|thumb)$/i,nums=false,text=POLY}={},key=''){
  if(Array.isArray(value))return value.map(v=>poison(v,{keep,url,nums,text},key));
  if(value&&typeof value==='object'){const out={};for(const [k,v] of Object.entries(value))out[k]=keep.test(k)?v:poison(v,{keep,url,nums,text},k);return out;}
  if(typeof value==='string')return url.test(key)?JSURL:text;
  if(typeof value==='number'&&nums)return text;
  return value;
}

/* 지금 열린 모든 창 · 틀을 훑는다 → 찾은 것의 목록(빈 배열이면 깨끗하다).
   ① 끼어든 요소(.xss-probe · img[src=x] · javascript: 주소 · 우리 값이 든 <script>) ② 우리 값이 만든 속성(on* · href · src)
   ③ 앱의 처리기(onclick …) 안에 우리 값이 글자로 들어간 곳은 앱 함수를 빈 함수로 바꿔 실제로 돌려 본다 — 따옴표가 끊겼으면 top.__xss 가 오른다 */
export async function scan(page){
  const found=[];
  const pages=page.context?page.context().pages():[page];
  for(const pg of pages){
    for(const f of pg.frames()){
      const hits=await f.evaluate(()=>{
        const any=new Proxy(function(){},{get:(t,k)=>k===Symbol.toPrimitive?()=>'':any,apply:()=>any,construct:()=>any});
        const out=[],own=/^on(click|blur|keydown|keyup|change|input|focus|pointerdown|mousedown|touchstart|submit|dblclick)$/;
        const where=e=>{let s='';for(let p=e,i=0;p&&p.nodeType===1&&i<4;p=p.parentElement,i++)s=p.tagName.toLowerCase()+(p.id?'#'+p.id:'')+(typeof p.className==='string'&&p.className&&!/xss-probe/.test(p.className)?'.'+p.className.trim().split(/\s+/).slice(0,2).join('.'):'')+(s?' > '+s:'');return s;};
        for(const e of document.querySelectorAll('*')){
          let bad='';
          if(e.matches('.xss-probe,img[src="x"]'))bad='element';
          else if(e.matches('a[href^="javascript:" i],iframe[src^="javascript:" i],form[action^="javascript:" i]'))bad='js-url';
          else if(e.tagName==='SCRIPT'&&/__xss/.test(e.textContent||'')&&!e.src)bad='script';
          for(const a of e.attributes){
            if(!/__xss/.test(a.value))continue;
            if(own.test(a.name)){
              let ran=0;const top={get __xss(){return 0;},set __xss(v){ran=1;}};
              const box=new Proxy({},{has:()=>true,get:(t,k)=>k===Symbol.unscopables?undefined:(k==='top'?top:any)});
              try{new Function('box','with(box){'+a.value+'\n}').call(any,box);}catch(_){ran=2;}
              if(ran)bad=bad||('handler '+a.name+(ran===2?' (broken)':' (runs)'));
            }else if(/^(on|href$|src$|srcdoc$|action$|formaction$|xlink:href$)/i.test(a.name)&&(/^on/i.test(a.name)||/^\s*javascript:/i.test(a.value)))bad=bad||('attr '+a.name);
          }
          if(bad)out.push(bad+' @ '+where(e)+' :: '+e.outerHTML.replace(/\s+/g,' ').slice(0,160));
        }
        return out;}).catch(()=>[]);
      const name=f.url().replace(/^.*\/studio\//,'').replace(/[?#].*$/,'')||f.url().slice(0,40);
      for(const h of hits)found.push(name+' '+h);
    }
    const ran=await pg.evaluate(()=>{const n=window.__xss||0;window.__xss=0;return n;}).catch(()=>0);
    if(ran)found.push((pg.url().replace(/^.*\/studio\//,'')||'page')+' SCRIPT RAN ×'+ran);
  }
  return [...new Set(found)];
}

/* 단계마다 scan 을 돌려 모은다. strict 면 그 자리에서 멈추고, 아니면 끝에서 한꺼번에 본다(구멍 목록을 한 번에 보려고) */
export function collector(page,{strict=false,log=()=>{}}={}){
  const all=[],seen=new Set();
  return {
    all,
    async check(label){
      const found=await scan(page);
      /* 숨은 틀에 남은 같은 구멍은 처음 본 단계에만 적는다 */
      for(const h of found){if(seen.has(h))continue;seen.add(h);const row=label+' — '+h;all.push(row);log(row);}
      if(strict&&found.length)throw new Error(label+': injected element or handler\n'+found.join('\n'));
      return found;
    }
  };
}

'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const notes=require('../studio/release-notes.js');
const entries=[{id:'one',date:'2026-09-15',title:'저장 안내 개선',changes:['선택 화면을 간결하게 정리했습니다.']}];
const START=Date.UTC(2026,8,15);

test('seven-day hiding ends exactly at its deadline',()=>{
  const hidden=notes.makeHidden({entries,now:START});
  assert.equal(notes.shouldShow({entries,now:START}),true);
  assert.equal(notes.shouldShow({entries,hidden,now:START}),false);
  assert.equal(notes.shouldShow({entries,hidden,now:START+notes.WEEK_MS-1}),false);
  assert.equal(notes.shouldShow({entries,hidden,now:START+notes.WEEK_MS}),true);
  assert.equal(notes.shouldShow({entries,hidden,now:START+notes.WEEK_MS+1}),true);
});

test('adding or changing any displayed note invalidates the existing seven-day hide',()=>{
  const hidden=notes.makeHidden({entries,now:START});
  const variants=[
    [...entries,{id:'two',date:'2026-09-16',title:'새 안내',changes:['내용']}],
    [{...entries[0],id:'new-id'}],
    [{...entries[0],date:'2026-09-16'}],
    [{...entries[0],title:'새 제목'}],
    [{...entries[0],changes:['다른 내용']}],
    [{...entries[0],changes:[...entries[0].changes,'추가 내용']}],
  ];
  for(const updated of variants)assert.equal(notes.shouldShow({entries:updated,hidden,now:START+1}),true);
  assert.equal(notes.revision(entries),notes.revision([{changes:entries[0].changes,title:entries[0].title,date:entries[0].date,id:entries[0].id}]),'Object property order is not a content change');
});

test('malformed or future hiding records cannot make an announcement disappear',()=>{
  const hidden=notes.makeHidden({entries,now:START});
  for(const record of [null,{},'broken',[],{...hidden,until:Infinity},{...hidden,from:String(START)},{...hidden,until:hidden.until+1},{...hidden,revision:'old'},{...hidden,from:START+1,until:hidden.until+1}]){
    assert.equal(notes.shouldShow({entries,hidden:record,now:START}),true);
  }
  assert.equal(notes.shouldShow({entries,hidden,now:START-1}),true,'Moving the device clock backwards fails visible');
  assert.equal(notes.makeHidden({entries,now:NaN}),null);
  assert.equal(notes.makeHidden({entries:[],now:START}),null);
  assert.equal(notes.shouldShow({entries:[],hidden,now:START}),false);
});

// Minimal event/element fixtures execute the real module without a browser,
// network, application account, update controller or player storage.
function harness(options={}){
  const stored=options.stored||new Map(),writes=[],timers=new Map();let at=START,nextTimer=0;
  const faults={read:false,write:false,ignoreWrite:false};
  class Events {
    constructor(){this.events=new Map();}
    addEventListener(type,handler){if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(handler);}
    removeEventListener(type,handler){this.events.get(type)?.delete(handler);}
    dispatch(type,event={}){for(const handler of this.events.get(type)||[])handler(event);}
  }
  class Element extends Events {
    constructor(tag){super();this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.hidden=false;this.id='';this.className='';this.value='';this._text='';this.classList={add:name=>{this.className=[this.className,name].filter(Boolean).join(' ');}};}
    appendChild(child){this.children.push(child);return child;}
    replaceChildren(...children){this.children=children;this._text='';}
    set textContent(value){this._text=String(value);this.children=[];}
    get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
    setAttribute(key,value){this.attributes[key]=String(value);}
    getAttribute(key){return this.attributes[key]??null;}
    click(){this.dispatch('click');}
  }
  const win=new Events(),doc=new Events(),host=new Element('div');host.id='psReleaseNotes';
  doc.head=new Element('head');doc.body=new Element('body');doc.body.appendChild(host);doc.hidden=false;
  doc.createElement=tag=>new Element(tag);
  function find(root,predicate){if(predicate(root))return root;for(const child of root.children){const result=find(child,predicate);if(result)return result;}return null;}
  doc.getElementById=id=>find(doc.head,node=>node.id===id)||find(doc.body,node=>node.id===id);
  Object.assign(win,{document:doc,PS_BUILD:'2.814',
    localStorage:{getItem(key){if(faults.read)throw Error('read denied');return stored.get(key)??null;},setItem(key,value){if(faults.write)throw Error('quota');writes.push([key,value]);if(!faults.ignoreWrite)stored.set(key,value);}},
    setTimeout(fn,delay){const id=++nextTimer;timers.set(id,{fn,at:at+delay});return id;},clearTimeout(id){timers.delete(id);},
    location:{reload(){assert.fail('Release notes must not reload the application');}},
    fetch(){assert.fail('Release notes must not send network requests');},
  });
  const mount=()=>notes.mount({window:win,host,entries:options.entries||entries,now:()=>at});
  return {win,doc,host,writes,stored,timers,faults,mount,
    get button(){return find(host,node=>node.tagName==='BUTTON'&&node.textContent==='일주일간 안 보기');},
    get toggle(){return find(host,node=>node.tagName==='BUTTON'&&node.getAttribute('aria-expanded')!==null);},
    get detail(){return find(host,node=>node.className==='psrn-details');},
    get notice(){return find(host,node=>node.getAttribute('role')==='status');},
    advance(milliseconds){at+=milliseconds;for(const [id,timer] of Array.from(timers))if(timer.at<=at){timers.delete(id);timer.fn();}},
  };
}

test('mount shows the running build and summary without opening details or writing storage',()=>{
  const h=harness();h.mount();
  assert.equal(h.host.hidden,false);assert.match(h.host.textContent,/v2\.814/);assert.match(h.host.textContent,/2026-09-15/);
  assert.match(h.host.textContent,/저장 안내 개선/);assert.equal(h.detail.hidden,true);assert.equal(h.toggle.getAttribute('aria-expanded'),'false');
  assert.deepEqual(h.writes,[]);assert.equal(h.timers.size,0);
  h.toggle.click();assert.equal(h.detail.hidden,false);assert.equal(h.toggle.getAttribute('aria-expanded'),'true');
  h.toggle.click();assert.equal(h.detail.hidden,true);assert.deepEqual(h.writes,[]);
});

test('confirmed hide survives remount and expires while the tab remains open',()=>{
  const h=harness();h.mount();h.button.click();
  assert.equal(h.host.hidden,true);assert.equal(h.writes.length,1);assert.equal(h.timers.size,1);
  assert.equal(h.writes[0][0],notes.STORAGE_KEY);
  h.advance(notes.WEEK_MS-1);assert.equal(h.host.hidden,true);
  h.mount();assert.equal(h.host.hidden,true);assert.equal(h.timers.size,1,'Remount replaces the previous expiry timer');
  h.advance(1);assert.equal(h.host.hidden,false);assert.equal(h.timers.size,0);
  assert.equal(h.writes.length,1,'Expiry is read-only');
});

test('new release content appears immediately even inside the previous hidden week',()=>{
  const h=harness(),controller=h.mount();h.button.click();h.advance(1000);
  assert.equal(h.host.hidden,true);
  controller.refresh([{id:'new',date:'2026-09-16',title:'새 문의 기능',changes:['답변 보기']},...entries]);
  assert.equal(h.host.hidden,false);assert.match(h.host.textContent,/새 문의 기능/);assert.equal(h.timers.size,0);
  assert.equal(h.writes.length,1,'A new revision does not remove the prior record or write user data');
});

for(const fault of ['read','write','ignoreWrite']){
  test(`${fault} storage failure keeps the banner visible rather than claiming a saved hide`,()=>{
    const h=harness();h.mount();h.faults[fault]=true;h.button.click();
    assert.equal(h.host.hidden,false);assert.equal(h.notice.hidden,false);assert.match(h.notice.textContent,/저장하지 못했어요/);
    assert.equal(h.timers.size,0);
    h.faults[fault]=false;h.button.click();assert.equal(h.host.hidden,true,'The same action can be retried after storage recovers');
  });
}

test('unreadable or malformed persisted values fail visible on initial mount',()=>{
  const h=harness({stored:new Map([[notes.STORAGE_KEY,'not-json']])});h.mount();assert.equal(h.host.hidden,false);assert.deepEqual(h.writes,[]);
  const valid=notes.makeHidden({entries,now:START});h.stored.set(notes.STORAGE_KEY,JSON.stringify(valid));h.faults.read=true;h.mount();
  assert.equal(h.host.hidden,false);assert.deepEqual(h.writes,[]);
});

test('storage events honor another tab hide and clearing it restores visibility',()=>{
  const h=harness();h.mount();
  h.stored.set(notes.STORAGE_KEY,JSON.stringify(notes.makeHidden({entries,now:START})));
  h.win.dispatch('storage',{key:'unrelated-team-data'});assert.equal(h.host.hidden,false);
  h.win.dispatch('storage',{key:notes.STORAGE_KEY});assert.equal(h.host.hidden,true);
  h.stored.clear();h.win.dispatch('storage',{key:null});assert.equal(h.host.hidden,false);assert.deepEqual(h.writes,[]);
});

test('announcement content is literal text and cannot insert markup or event handlers',()=>{
  const h=harness({entries:[{id:'literal',date:'2026-09-15',title:'<img src=x onerror=alert(1)>',changes:['<script>fetch("secret")</script>']} ]});h.mount();
  assert.match(h.host.textContent,/<img src=x onerror=alert\(1\)>/);assert.match(h.host.textContent,/<script>fetch\("secret"\)<\/script>/);
  function tags(node){return [node.tagName,...node.children.flatMap(tags)];}
  assert.equal(tags(h.host).includes('IMG'),false);assert.equal(tags(h.host).includes('SCRIPT'),false);
});

test('destroy removes listeners and expiry work without modifying the saved choice',()=>{
  const h=harness(),controller=h.mount();h.button.click();const before=Array.from(h.stored);
  controller.destroy();assert.equal(h.host.hidden,true);assert.equal(h.host.children.length,0);assert.equal(h.timers.size,0);
  assert.equal(h.win.events.get('storage').size,0);assert.equal(h.win.events.get('focus').size,0);assert.equal(h.doc.events.get('visibilitychange').size,0);
  assert.deepEqual(Array.from(h.stored),before);controller.refresh(entries);assert.equal(h.host.children.length,0);
});

test('missing host or empty notes mounts without errors or a blank banner',()=>{
  assert.equal(notes.mount({}),null);const h=harness({entries:[]});h.mount();assert.equal(h.host.hidden,true);assert.deepEqual(h.writes,[]);
});

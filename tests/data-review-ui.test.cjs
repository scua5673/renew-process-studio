'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the shipped list, modal builder, event handlers and public review API.
// Storage and the DOM are in-memory fixtures; choice application is a spy so
// rendering or dismissing a dialog can never resolve a real data conflict.
const source = fs.readFileSync(path.join(__dirname, '../studio/sync.js'), 'utf8');
function fn(name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start, `Can extract ${name}`);
  return source.slice(start, end);
}
const code = [fn('dataReviewList'), fn('dataReviewOpen'), fn('syncState')].join('\n');
const copy = value => JSON.parse(JSON.stringify(value));
const activeSources = ['personal', 'team', 'item-delete', 'hold'];
const records = {
  personal: [{k:'personal-notes',at:100,localHash:'phone-version',serverHash:'cloud-version'}],
  holds: [
    {kind:'conflict',k:'team-matches',at:99,c:90,after:4,before:3},
    {kind:'item-delete',k:'sq:changed-player',at:98,reviewContext:{uid:'coach',wid:'team'}},
    {kind:'hold',k:'team-schedule',at:97,after:2,before:12},
  ],
  rescues: [{k:'archived-roster',at:80,before:44,after:44}],
  conflicts: [{k:'archived-analysis',at:70}],
};

function harness(options = {}) {
  const data = copy(options.records || records);
  const stored = new Map(data.rescues.map(x => ['ps_rescue_'+x.k,'SYNTHETIC_ARCHIVED_BODY']));
  const writes = [], applied = [], modals = [], timers = [], syncs = [], advancedCalls = [];
  let elements = [], ids = new Map(), unlocked = options.unlocked !== false, deletionReads = 0;
  function element(attrs = {}, text = '') {
    const handlers = {};
    return {
      attrs, textContent:text, disabled:false, innerHTML:'', value:'scout_tool_v1',
      getAttribute:name => attrs[name] === undefined ? null : attrs[name],
      addEventListener(name, handler){handlers[name]=handler;},
      click(){if(!this.disabled && handlers.click)handlers.click();},
      querySelectorAll(){return [];},
    };
  }
  function show(options) {
    elements=[];ids=new Map([['psWsBody',element()]]);
    for(const match of String(options.body || '').matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g))ids.set(match[1],element({id:match[1]}));
    for(const match of String(options.body || '').matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)){
      const attrs=Object.fromEntries(Array.from(match[1].matchAll(/([\w-]+)="([^"]*)"/g), x=>[x[1],x[2]]));
      const button=element(attrs,match[2].replace(/<[^>]*>/g,''));elements.push(button);
      if(attrs.id)ids.set(attrs.id,button);
    }
    const modal={...options,closed:false,close(){this.closed=true;elements=[];ids.clear();}};
    modals.push(modal);return modal;
  }
  const ctx=vm.createContext({
    Promise, console,
    dataUnlocked:()=>unlocked,renderDataLock:()=>advancedCalls.push('locked'),
    personalReviewList:()=>data.personal,holdList:()=>data.holds,
    holdConflictView:x=>copy(x),itemsDeleteReviewView:x=>copy(x),
    rescueList:()=>data.rescues,conflictList:()=>data.conflicts,COPIES_OFF:false,
    isTeamWs:()=>options.team!==false,ITEMS_ACTIVE:options.itemsActive!==false,HIST_KEYS:['scout_tool_v1'],
    itemsHoldList:()=>{deletionReads++;return options.itemsHold||{ids:[]};},itemsHoldOpen:()=>advancedCalls.push('delete-hold'),itemsLostSnapshot:()=>({n:2,raw:'SYNTHETIC_LEGACY_COPY'}),
    itemsDeleteReviewLabel:x=>x.k,keyLabel:k=>k,
    esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    localStorage:{getItem:k=>stored.get(k)||null,setItem(k,v){writes.push(['set',k,v]);stored.set(k,String(v));},removeItem(k){writes.push(['remove',k]);stored.delete(k);}},
    document:{getElementById:id=>ids.get(id)||null,querySelectorAll:selector=>elements.filter(el=>Object.hasOwn(el.attrs,selector.slice(1,-1)))},
    psModal:show,
    histReadView:()=>({current:()=>true,stop(){},require(){}}),
    itemsAudit:()=>{advancedCalls.push('audit');return Promise.resolve({});},
    histLoad:()=>{advancedCalls.push('history');return Promise.resolve([]);},
    itemsLostExport:()=>{advancedCalls.push('legacy-export');return true;},
    itemsDeleteReviewExport:()=>advancedCalls.push('delete-export'),
    dataReviewApply(src,k,keepMine,shown){applied.push({src,k,keepMine,shown:copy(shown)});return Promise.resolve({pending:true});},
    getSess:()=>({uid:'synthetic-coach'}),activeWs:()=>options.team===false?'personal':'team',visiblePendingInfo:()=>({count:0}),meta:()=>({last:100}),
    navigator:{onLine:true},personalIssue:null,lastIssue:null,busy:false,agoText:()=>'',rtConnected:()=>false,rtLast:0,rtHits:0,
    syncNow:reason=>{syncs.push(reason);return Promise.resolve({});},renderUI(){},chip(){},syncDiagnostic(){},
    setTimeout(fn){timers.push(fn);return timers.length;},
  });
  ctx.window=ctx;vm.runInContext(code,ctx,{filename:'sync.js data review UI'});
  return {
    ctx, data, writes, applied, modals, timers, syncs, advancedCalls,
    snapshot:()=>copy({data,stored:Array.from(stored)}),
    get modal(){return modals.at(-1);},
    get deletionReads(){return deletionReads;},
    choices:()=>elements.filter(el=>Object.hasOwn(el.attrs,'data-dr')),
    byId:id=>ids.get(id),
    button(src,keepMine){
      const listed=ctx.PSDataReview.pending(),index=Array.from(listed).findIndex(x=>x.src===src);
      return elements.find(el=>el.attrs['data-dr']===String(index)&&el.attrs['data-keep']===(keepMine?'1':'0'));
    },
    async click(button){assert.ok(button,'Expected choice button exists');button.click();await new Promise(resolve=>setImmediate(resolve));},
  };
}

test('ordinary choices expose unresolved work and keep diagnostic recovery tools out of the dialog',()=>{
  const h=harness(),before=h.snapshot();h.ctx.PSDataReview.open();
  assert.match(h.modal.title,/저장할 내용 선택/);
  assert.equal(h.choices().length,8,'Each of the four unresolved records has two choices');
  for(const key of ['personal-notes','team-matches','sq:changed-player','team-schedule'])assert.ok(h.modal.body.includes(key));
  for(const key of ['archived-roster','archived-analysis','drHistKey','drItemsRun','drItemsLegacyExport'])assert.ok(!h.modal.body.includes(key),key+' stays out of ordinary choices');
  assert.deepEqual(copy(h.ctx.PSDataReview.pending()).map(x=>x.src),activeSources);
  assert.equal(h.ctx.PSDataReview.list().length,6,'The full recovery list remains intact');
  assert.deepEqual(h.snapshot(),before);
  assert.deepEqual(h.writes,[]);assert.deepEqual(h.applied,[]);assert.deepEqual(h.advancedCalls,[]);
});

test('archived copies alone do not become required choices, but remain available in recovery',()=>{
  const h=harness({records:{...records,personal:[],holds:[]}}),before=h.snapshot();
  h.ctx.PSDataReview.open();
  assert.equal(h.choices().length,0);assert.equal(h.ctx.PSDataReview.pending().length,0);
  assert.match(h.modal.body,/선택이 필요한 변경은 없습니다/);
  h.modal.close();h.ctx.PSDataReview.recovery();
  assert.equal(h.choices().length,4);
  for(const key of ['archived-roster','archived-analysis','drHistKey','drItemsRun','drItemsLegacyExport'])assert.ok(h.modal.body.includes(key),key+' remains recoverable');
  assert.deepEqual(h.snapshot(),before);assert.deepEqual(h.writes,[]);assert.deepEqual(h.applied,[]);
});

test('pending mass deletion remains explicitly reviewable in the ordinary dialog',async()=>{
  const h=harness({records:{...records,personal:[],holds:[]},itemsHold:{ids:['synthetic-player'],before:44,after:43}}),before=h.snapshot();
  assert.deepEqual(copy(h.ctx.PSDataReview.pending()),[{src:'item-hold',k:'scout_tool_v1'}],'Deletion-only work keeps the normal review entry reachable');
  const state=h.ctx.syncState();
  assert.equal(state.kind,'ask');assert.equal(state.review,1);assert.equal(state.n,0);
  assert.match(state.text,/저장할 내용 선택/);
  h.ctx.PSDataReview.open();
  assert.equal(h.choices().length,0,'The routing sentinel must not turn into a document overwrite choice');
  assert.ok(h.byId('drItemsHold'),'An unresolved deletion must not disappear with archived recovery controls');
  assert.ok(!h.byId('drItemsRun'),'Unrelated server diagnostics remain in recovery');
  assert.deepEqual(h.advancedCalls,[]);await h.click(h.byId('drItemsHold'));
  assert.deepEqual(h.advancedCalls,['delete-hold']);assert.deepEqual(h.applied,[]);
  assert.deepEqual(h.snapshot(),before);assert.deepEqual(h.writes,[]);
});

for(const [name,options] of [['locked',{unlocked:false}],['personal workspace',{team:false}],['inactive item storage',{itemsActive:false}]]){
  test(`${name} neither reads nor counts a pending team deletion`,()=>{
    const h=harness({...options,records:{...records,personal:[],holds:[]},itemsHold:{ids:['synthetic-player'],before:44,after:43}}),before=h.snapshot();
    assert.equal(h.ctx.PSDataReview.pending().length,0);
    const state=h.ctx.syncState();assert.equal(state.kind,'ok');assert.equal(state.review,0);
    assert.equal(h.deletionReads,0,'The team deletion snapshot is not read outside its unlocked active scope');
    assert.deepEqual(h.snapshot(),before);assert.deepEqual(h.writes,[]);assert.deepEqual(h.applied,[]);
  });
}

for(const mode of ['ordinary','recovery']){
  test(`opening and dismissing ${mode} mode never changes stored bodies or resolves a choice`,()=>{
    const h=harness(),before=h.snapshot();
    if(mode==='recovery')h.ctx.PSDataReview.recovery();else h.ctx.PSDataReview.open();
    h.modal.close();
    assert.deepEqual(h.snapshot(),before);assert.deepEqual(h.writes,[]);assert.deepEqual(h.applied,[]);
    assert.deepEqual(h.syncs,[]);assert.deepEqual(h.advancedCalls,[]);assert.deepEqual(h.timers,[]);
  });
}

for(const src of activeSources){
  for(const keepMine of [true,false]){
    test(`${src} ${keepMine?'local':'other'} choice delegates the exact displayed record`,async()=>{
      const h=harness(),before=h.snapshot();h.ctx.PSDataReview.open();
      const shown=copy(h.ctx.PSDataReview.pending()).find(x=>x.src===src);
      await h.click(h.button(src,keepMine));
      if(src==='item-delete'&&keepMine){
        assert.equal(h.applied.length,0,'Deleting a changed player still requires explicit confirmation');
        assert.equal(h.modal.danger,true);h.modal.onOk();await new Promise(resolve=>setImmediate(resolve));
      }
      assert.deepEqual(h.applied,[{src,k:shown.k,keepMine,shown}]);
      assert.deepEqual(h.syncs,['data-review']);
      assert.deepEqual(h.snapshot(),before,'The UI delegates application instead of rewriting storage itself');
      assert.deepEqual(h.writes,[]);
    });
  }
}

test('locked data exposes neither ordinary choices nor recovery bodies',()=>{
  const h=harness({unlocked:false});h.ctx.PSDataReview.open();h.ctx.PSDataReview.recovery();
  assert.equal(h.modals.length,0);assert.equal(h.ctx.PSDataReview.list().length,0);assert.equal(h.ctx.PSDataReview.pending().length,0);
  assert.deepEqual(h.writes,[]);assert.deepEqual(h.applied,[]);
});

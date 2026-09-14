/* Coordinate automatic reconciliation inside the existing per-workspace sync
   lock. The original CAS transport remains the only writer to the server. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSAutosaveRuntime=api;})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  function create(o){
    var running=false;
    function same(a,b){return !!a&&!!b&&a.uid===b.uid&&a.wid===b.wid&&a.seal===b.seal&&a.epoch===b.epoch;}
    function owner(ctx){return function(){if(!same(ctx,o.context(ctx.wid)))throw new Error('autosave_owner_changed');return true;};}
    async function capture(){
      var records=o.confirmed();
      for(var i=0;i<records.length;i++){
        var r=records[i],ctx=o.context(r.wid);if(!ctx)continue;
        var current=owner(ctx),raw=await o.read(r.k);current();
        var now=o.version(r.wid,r.k);
        if(typeof raw!=='string'||o.hash(raw)!==r.h||now.h!==r.h||now.c!==r.c)continue;
        await o.journal(r.wid).remember(ctx,r.k,raw,r.h,r.c);current();
      }
    }
    async function reconcile(){
      var reviews=o.pending(),groups=Object.create(null),changed=0,archived=0;
      reviews.forEach(function(r){(groups[r.wid]||(groups[r.wid]=[])).push(r);});
      for(var wid of Object.keys(groups)){
        var ctx=o.context(wid);if(!ctx)continue;
        var current=owner(ctx),journal=o.journal(wid),rows=await o.remote(wid,groups[wid].map(function(r){return r.k;}));current();
        if(!Array.isArray(rows))throw new Error('autosave_remote_shape');
        var map=Object.create(null);
        rows.forEach(function(r){if(!r||typeof r.k!=='string'||map[r.k])throw new Error('autosave_remote_shape');map[r.k]=r;});
        for(var review of groups[wid]){
          current();if(!o.reviewCurrent(review))continue;
          var row=map[review.k];
          // RLS-hidden/missing rows and invalid bodies are never empty documents.
          if(!row||typeof row.v!=='string'||!Number.isFinite(row.cupd)||row.cupd<0)continue;
          var local=await o.read(review.k);current();
          if(typeof local!=='string'||o.hash(local)!==review.h||!o.reviewCurrent(review))continue;
          var version=o.version(wid,review.k),base=version.h?await journal.base(ctx,review.k,version.h,version.c):null;current();
          if(base==null&&o.legacyBase)base=o.legacyBase(wid,review.k,version);
          var plan=o.plan({key:review.k,base:base,local:local,remote:row.v});
          if(!plan||typeof plan.raw!=='string')throw new Error('autosave_plan_shape');
          if(/^remote-/.test(plan.reason||''))continue;
          // Previously approved exact choices still apply only to the reviewed pair.
          if(review.choice&&(row.cupd!==review.c||o.hash(row.v)!==review.sh))continue;
          if(review.choice==='local')plan={raw:local,needsArchive:local!==row.v,reason:'reviewed-local'};
          if(review.choice==='server')plan={raw:row.v,needsArchive:local!==row.v,reason:'reviewed-server'};
          if(o.prepare)plan=o.prepare(review,plan,base,local,row);
          if(!plan||typeof plan.raw!=='string')continue;
          if(plan.needsArchive){await journal.archive(ctx,review.k,local,row.v,row.cupd,plan.reason||'concurrent-edit');current();archived++;}
          // Every async boundary is followed by a fresh source/review/version check.
          var latest=await o.read(review.k);current();var check=o.version(wid,review.k);
          if(latest!==local||check.h!==version.h||check.c!==version.c||!o.reviewCurrent(review))continue;
          await journal.remember(ctx,review.k,row.v,o.hash(row.v),row.cupd);current();
          if(await o.apply(review,local,plan.raw,row,current,version))changed++;
        }
      }
      return {changed:changed,archived:archived};
    }
    async function run(reason){
      if(running)return {skip:1,autosaveBusy:1};
      running=true;var result,rebased=0,archived=0,initial=o.context(),still=initial?owner(initial):function(){return true;};
      try{
        // A clean, already acknowledged value may become dirty during core().
        // Remember its ancestor before receiving the next server version.
        await capture();still();
        for(var pass=0;pass<3;pass++){
          still();result=await o.core(pass? 'autosave-rebase':reason);still();
          if(!result||result.skip||result.offline||result.noauth||result.locked||result.nows)return result;
          if(result.error&&result.code!=='sync_conflict')return result;
          await capture();still();
          if(pass===2)break;
          var next=await reconcile();still();rebased+=next.changed;archived+=next.archived;
          if(!next.changed)break;
        }
        return Object.assign({},result,{rebased:rebased,archived:archived});
      }catch(e){return o.fail(e);}
      finally{running=false;if(o.notify)o.notify();}
    }
    return {run:run,capture:capture,reconcile:reconcile,busy:function(){return running;}};
  }
  return {create:create};
});

/* Adaptive quality is viewer-local. No storage, timers or device-name sniffing. */
(function(root,factory){
  'use strict';var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSPlayerEyeQuality=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var profiles=[
    {name:'선명',detail:'full',dpr:1.5,pixels:1800000,fps:30},
    {name:'균형',detail:'light',dpr:1,pixels:1100000,fps:30},
    {name:'경량',detail:'light',dpr:.75,pixels:600000,fps:24}
  ].map(Object.freeze);
  function pixelRatio(profile,w,h,dpr){
    return Math.min(Number(dpr)>0?Number(dpr):1,profile.dpr,Math.sqrt(profile.pixels/Math.max(1,w*h)));
  }
  function create(hints){
    hints=hints||{};
    var initial=(hints.memory>0&&hints.memory<=4)||(hints.cores>0&&hints.cores<=4)?1:0;
    var mode='auto',level=initial,slow=0,warmup=4;
    function reset(){slow=0;warmup=4;}
    function setMode(value){mode=value==='light'||value==='full'?value:'auto';level=mode==='light'?2:mode==='full'?0:initial;reset();return profiles[level];}
    function observe(work,interval){
      // Only continuous visible playback is measured. Idle/hidden gaps and initial
      // shader compilation must not label a capable device as slow.
      if(mode!=='auto'||level===2||!Number.isFinite(work)||!Number.isFinite(interval)||interval<=0||interval>1000){reset();return false;}
      if(warmup>0){warmup--;return false;}
      var step=Math.min(120,interval),late=interval>50||work>28;
      slow=late?slow+step:Math.max(0,slow-step*2);
      if(slow<1600)return false;
      level++;reset();return true;
    }
    return {setMode:setMode,observe:observe,reset:reset,profile:function(){return profiles[level];},mode:function(){return mode;}};
  }
  return {create:create,pixelRatio:pixelRatio,profiles:Object.freeze(profiles)};
});

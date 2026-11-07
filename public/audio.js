/* SPIN//BREAK ARENA V10.5 - original, locally bundled one-shot PCM effects.
 * No oscillator beeps, no sequenced music, no third-party CDN dependency.
 * Samples were digitally modelled for this game; they are NOT field recordings.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.SPINBREAK_AUDIO=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const SOUND_NAMES=['hit_light','hit_heavy','hit_critical','wall','counter','charge','skill','ko','warning','anomaly','start','win'];
 const MIN_GAP={hit:105,wall:250,counter:250,charge:260,skill:330,ko:400,warning:650,anomaly:650,start:500,win:550};
 function create(options={}){
  const AudioCtor=options.AudioCtor||(typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext));
  const fetcher=options.fetch||(typeof fetch==='function'?fetch:null);
  const now=options.now||(()=>Date.now());
  let context=null,output=null,compressor=null,enabled=false,userVolume=.50,loading=null;
  const samples=new Map(),last=Object.create(null);
  function setVolume(value){
   userVolume=Math.max(0,Math.min(1,Number.isFinite(Number(value))?Number(value):.5));
   if(output){const gain=enabled?.55*userVolume*userVolume:0;
     if(output.gain.setTargetAtTime)output.gain.setTargetAtTime(gain,context.currentTime,.014);else output.gain.value=gain;}
   return userVolume;
  }
  function setup(){
   if(!AudioCtor)return false;
   if(!context){
    context=new AudioCtor();compressor=context.createDynamicsCompressor();output=context.createGain();
    compressor.threshold.setValueAtTime(-16,context.currentTime);compressor.knee.setValueAtTime(14,context.currentTime);
    compressor.ratio.setValueAtTime(3,context.currentTime);compressor.attack.setValueAtTime(.003,context.currentTime);
    compressor.release.setValueAtTime(.16,context.currentTime);
    compressor.connect(output);output.connect(context.destination);
   }
   if(context.state==='suspended')context.resume()?.catch?.(()=>{});
   return true;
  }
  async function load(){
   if(!context||!fetcher)return;
   await Promise.all(SOUND_NAMES.map(async name=>{
    if(samples.has(name))return;
    try{
     const response=await fetcher(`/sfx/${name}.wav?v=10.5`);
     if(!response.ok)throw Error('Audio HTTP '+response.status);
     const data=await response.arrayBuffer();
     const decoded=await context.decodeAudioData(data);
     samples.set(name,decoded);
    }catch(err){console.warn('[SpinBreak] SFX unavailable:',name,err?.message||err);}
   }));
  }
  function enable(){if(!setup())return false;enabled=true;setVolume(userVolume);if(!loading)loading=load();return true;}
  function disable(){enabled=false;setVolume(userVolume);}
  function ready(){return loading||Promise.resolve();}
  function pick(kind,details){
   if(kind==='hit'){const amount=Number(details.amount)||0;return amount>=190?'hit_critical':amount>=100?'hit_heavy':'hit_light';}
   if(kind==='counter_success')return 'counter';
   if(kind==='anomaly_warning')return 'warning';
   if(kind==='anomaly_start')return 'anomaly';
   if(kind==='rail'||kind==='return')return 'charge';
   return SOUND_NAMES.includes(kind)?kind:null;
  }
  function play(kind,details={}){
   if(!enabled||!context)return false;
   const file=pick(kind,details),clip=samples.get(file);if(!clip)return false;
   const category=kind==='hit'?kind:file;
   const stamp=now(),gap=MIN_GAP[category]??200;
   if(stamp-(last[category]??-Infinity)<gap)return false;
   last[category]=stamp;
   const source=context.createBufferSource();source.buffer=clip;
   const gain=context.createGain(),t=context.currentTime;
   const intensity=kind==='hit'?Math.min(1.0,Math.max(.32,(Number(details.amount)||100)/230)):1;
   const baseline=kind==='wall'?.55:kind==='warning'?.50:kind==='hit'?.68:.66;
   const level=baseline*intensity;
   gain.gain.setValueAtTime(Math.max(.001,level),t);
   const pitch=1+(Math.random()-.5)*.09;
   source.playbackRate.value=pitch;
   source.connect(gain);gain.connect(compressor);
   source.start(t);return true;
  }
  return {enable,disable,ready,play,setVolume,isEnabled:()=>enabled,loadedCount:()=>samples.size};
 }
 return {create,SOUND_NAMES};
});

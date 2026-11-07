/* SPIN//BREAK V10.4 - restrained, event-driven procedural SFX.
 * No music loop, sound is opt-in, no external audio assets or network requests.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.SPINBREAK_AUDIO=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 function create(options={}){
  const AudioCtor=options.AudioCtor||(typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext));
  const clock=options.now||(()=>Date.now());
  let ctx=null,master=null,noiseBuffer=null,enabled=false;
  const last=Object.create(null),minGap={hit:110,wall:260,charge:260,skill:360,counter:250,ko:260,warning:900,anomaly:800,start:800,win:900};
  function setup(){
   if(!AudioCtor)return false;
   if(!ctx){
    ctx=new AudioCtor();master=ctx.createDynamicsCompressor();
    master.threshold.setValueAtTime(-22,ctx.currentTime);master.knee.setValueAtTime(22,ctx.currentTime);
    master.ratio.setValueAtTime(5,ctx.currentTime);master.attack.setValueAtTime(.003,ctx.currentTime);
    master.release.setValueAtTime(.12,ctx.currentTime);
    const output=ctx.createGain();output.gain.value=.34;master.connect(output);output.connect(ctx.destination);
    const n=Math.floor(ctx.sampleRate*.6);noiseBuffer=ctx.createBuffer(1,n,ctx.sampleRate);
    const buf=noiseBuffer.getChannelData(0);for(let i=0;i<n;i++)buf[i]=Math.random()*2-1;
   }
   if(ctx.state==='suspended')ctx.resume().catch(()=>{});
   return true;
  }
  function enable(){enabled=setup();return enabled;}
  function disable(){enabled=false;}
  function envelope(g,t,amp,duration){g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(Math.max(.0002,amp),t+.003);g.gain.exponentialRampToValueAtTime(.0001,t+duration);}
  function partial(freq,duration,amp,{type='sine',slide=1,detune=0}={}){
   if(!ctx)return;const t=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;
   osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(Math.max(30,freq*slide),t+duration);osc.detune.value=detune;
   envelope(gain,t,amp,duration);osc.connect(gain);gain.connect(master);osc.start(t);osc.stop(t+duration+.015);
  }
  function texture(duration,amount,{center=1550,q=.7}={}){
   if(!ctx||!noiseBuffer)return;const t=ctx.currentTime,src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
   src.buffer=noiseBuffer;filter.type='bandpass';filter.frequency.setValueAtTime(center,t);filter.Q.value=q;
   envelope(gain,t,amount,duration);src.connect(filter);filter.connect(gain);gain.connect(master);src.start(t);src.stop(t+duration+.015);
  }
  function play(kind,details={}){
   if(!enabled||!ctx)return false;
   const current=clock(),gap=minGap[kind]||200;if(current-(last[kind]??-Infinity)<gap)return false;last[kind]=current;
   const energy=Math.max(.38,Math.min(1.5,(Number(details.amount)||140)/190));
   switch(kind){
    case 'hit':{
     const seed=(Number(details.amount)||0)*.03;const low=65+energy*32;
     partial(low,.105,.22*energy,{slide:.58});
     partial(365+seed,.19,.11*energy,{slide:.78});
     partial(730+seed*1.75,.135,.071*energy,{slide:.88});
     texture(.105,.083*energy,{center:1400+energy*550,q:1.0});break;
    }
    case 'wall':partial(108,.11,.17,{slide:.66});partial(440,.115,.06,{slide:.75});texture(.065,.045,{center:870,q:.8});break;
    case 'counter':partial(130,.17,.20,{slide:.53});partial(660,.25,.11,{slide:1.02});partial(1040,.17,.05);texture(.09,.09,{center:2400,q:.9});break;
    case 'charge':texture(.24,.095,{center:1100,q:.45});partial(115,.24,.14,{slide:1.3});break;
    case 'skill':texture(.22,.10,{center:2000,q:.48});partial(175,.28,.10,{slide:1.6});partial(560,.26,.038,{slide:.85});break;
    case 'ko':partial(135,.30,.21,{slide:.42});partial(490,.50,.10,{slide:.70});texture(.18,.05,{center:1000,q:.8});break;
    case 'warning':partial(360,.19,.065,{slide:.90});partial(540,.12,.035,{slide:1.01});break;
    case 'anomaly':texture(.26,.08,{center:640,q:.42});partial(102,.33,.12,{slide:.74});break;
    case 'start':texture(.18,.05,{center:900,q:.55});partial(150,.15,.08,{slide:1.35});break;
    case 'win':partial(390,.26,.09,{slide:1.06});partial(605,.36,.055,{slide:1.02});break;
    default:return false;
   }
   return true;
  }
  return {enable,disable,play,isEnabled:()=>enabled};
 }
 return {create};
});

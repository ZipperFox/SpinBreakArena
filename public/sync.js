/* SPIN//BREAK — client presentation timeline. All browsers render the same server timestamp. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SPINBREAK_SYNC = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const clamp = (x,a,b) => Math.min(b,Math.max(a,x));
  const interpolate = (a,b,t) => a+(b-a)*t;
  const byId = (items) => new Map((items||[]).map(x=>[x.id,x]));
  function axis(q){
    if(!Array.isArray(q)||q.length!==4)return [0,1,0];
    const [x,y,z,w]=q;
    return [2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w)];
  }
  function mixActor(a,b,t){
    const base = t>=1?b:a;
    return {...base,
      x:interpolate(a.x,b.x,t), y:interpolate(a.y,b.y,t), h:interpolate(a.h,b.h,t),
      spin:interpolate(a.spin,b.spin,t), wobble:interpolate(a.wobble,b.wobble,t),
      spinPhase:Number.isFinite(a.spinPhase)&&Number.isFinite(b.spinPhase)?interpolate(a.spinPhase,b.spinPhase,t):undefined,
      // Interpolate the tilt axis, never the aliased high-frequency yaw quaternion.
      axis:axis(a.q).map((v,i)=>interpolate(v,axis(b.q)[i],t)),
      q:a.q
    };
  }
  function mixFrame(a,b,t){
    const others=byId(b.fighters);
    const fighters=(a.fighters||[]).map(f=>others.has(f.id)?mixActor(f,others.get(f.id),t):f);
    for(const f of (b.fighters||[]))if(!fighters.some(x=>x.id===f.id))fighters.push(f);
    const hazardsB=byId(b.hazards);
    const hazards=(a.hazards||[]).map(x=>{
      const y=hazardsB.get(x.id);return y?{...x,x:interpolate(x.x,y.x,t),y:interpolate(x.y,y.y,t),z:interpolate(x.z,y.z,t)}:x;
    });
    if(t>=1)for(const x of b.hazards||[])if(!hazards.some(y=>y.id===x.id))hazards.push(x);
    const current=t>=1?b:a;
    return {...current,time:interpolate(a.time,b.time,t),fighters,hazards,serverNow:interpolate(a.serverNow,b.serverNow,t)};
  }
  class Timeline{
    constructor(delayMs=160){this.delayMs=delayMs;this.reset();}
    reset(){this.frames=[];this.round=null;this.lastSeq=-1;this.offset=null;this.bestRtt=Infinity;this.visualTime=0;this.latest=null;}
    receive(s,localNow=Date.now()){
      if(!s||!Number.isFinite(s.seq)||!Number.isFinite(s.serverNow))return false;
      if(this.round!==s.round){const offset=this.offset,bestRtt=this.bestRtt;this.reset();this.offset=offset;this.bestRtt=bestRtt;this.round=s.round;}
      if(s.seq<=this.lastSeq)return false;
      this.lastSeq=s.seq;
      if(this.offset===null)this.offset=s.serverNow-localNow+20; // estimate only until an RTT clock sample arrives
      this.frames.push(s);
      if(this.frames.length>36)this.frames.shift();
      this.latest=s;
      return true;
    }
    pong(p,localNow=Date.now()){
      if(!Number.isFinite(p?.sentAt)||!Number.isFinite(p?.serverNow))return false;
      const rtt=localNow-p.sentAt;
      if(rtt<0||rtt>1500)return false;
      const estimate=p.serverNow-(localNow+p.sentAt)*.5;
      if(this.offset===null||rtt<=this.bestRtt+10){this.offset=this.offset===null?estimate:this.offset*.80+estimate*.20;this.bestRtt=Math.min(this.bestRtt,rtt);return true;}
      return false;
    }
    sample(localNow=Date.now()){
      const frames=this.frames;if(!frames.length)return null;
      const time=localNow+(this.offset??0)-this.delayMs;
      if(frames.length===1||time<=frames[0].serverNow){this.visualTime=frames[0].time;return frames[0];}
      for(let i=1;i<frames.length;i++){
        const b=frames[i];if(time<=b.serverNow){const a=frames[i-1];
          const alpha=clamp((time-a.serverNow)/Math.max(1,b.serverNow-a.serverNow),0,1);
          const state=mixFrame(a,b,alpha);this.visualTime=state.time;return state;
        }
      }
      this.visualTime=frames[frames.length-1].time;
      return frames[frames.length-1]; // never simulate future motion without authoritative state
    }
  }
  return {Timeline,mixFrame};
});

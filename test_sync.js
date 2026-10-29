'use strict';
const assert=require('node:assert/strict');
const {Timeline,mixFrame}=require('./public/sync.js');
const run=()=>{
 const f=(seq,t,now,x)=>({t:'tick',round:1,seq,serverNow:now,time:t,arena:'colosseum',fighters:[{id:'A',x,y:0,h:15,spin:80,wobble:0,q:[0,0,0,1],spinPhase:seq*4.1,alive:true}],hazards:[]});
 const simA=new Timeline(160),simB=new Timeline(160);
 // Two devices have different local wall clock, fluctuating delay and different display FPS.
 // Ping samples align their local clocks to the same server clock.
 assert(simA.pong({sentAt:10000,serverNow:10050},10100));
 assert(simB.pong({sentAt:20000,serverNow:10050},20100));
 for(let seq=0;seq<=20;seq++){
   const stamp=10080+seq*33.333,time=seq/30;
   const state=f(seq,time,stamp,seq*6);
   assert(simA.receive(state,stamp+8));
   assert(simB.receive(state,stamp+15+(seq%5)*4));
 }
 const a=simA.sample(10800),b=simB.sample(20800);
 assert.equal(a.seq,b.seq);assert(Math.abs(a.fighters[0].x-b.fighters[0].x)<.001);
 assert(Math.abs(a.time-b.time)<1e-9);
 assert(a.fighters[0].spinPhase>0);
 assert(simA.visualTime>0.45);
 assert.equal(simA.receive(f(1,0.03,11000,20)),false,'out of order frame ignored');
 const frame=simA.sample(20000);assert.equal(frame.seq,20,'Never extrapolate motion past latest server frame');
 assert.equal(simA.receive({...f(0,0,21000,0),round:2}),true,'New round resets timeline');
 assert.equal(simA.lastSeq,0);
 const impact=mixFrame(f(0,0,200,0),f(1,0.033,233,10),.5);
 assert.equal(impact.fighters[0].x,5);
 assert.equal(impact.fighters[0].spinPhase,2.05);
 console.log('SYNC_TIMELINE_PASS identicalPose=true variedFPS=true clockSkew=true noExtrapolation=true roundReset=true continuousSpin=true');
};
run();

/** Checks the V3 physical win conditions without opening network sockets. */
'use strict';
const assert=require('node:assert/strict');
const {fightersFor,tickRoom,skill,snapshot,TOPS}=require('./server');
function make(topA='phoenix',topB='behemoth'){
 const r={code:'TEST',round:1,host:'p1',arena:'colosseum',status:'playing',bots:0,players:[{id:'p1',name:'A',top:topA,bot:false},{id:'p2',name:'B',top:topB,bot:false}],age:0,fighters:[],events:[],results:null,hitPairs:new Map(),updated:Date.now()};
 r.fighters=fightersFor(r);
 return r;
}
{
 const r=make();const f=r.fighters;
 assert(f.every(p=>!Object.hasOwn(p,'hp')),'No player may have health');
 assert(snapshot(r).fighters.every(p=>!Object.hasOwn(p,'hp')),'Network state must not expose health');
 f[0].x=-20;f[0].y=0;f[1].x=20;f[1].y=0;
 f[0].vx=185;f[1].vx=-175;const before=f.map(p=>p.spin);
 tickRoom(r,1/30);
 assert(f[0].vx<185&&f[1].vx>-175,'Contact must physically alter velocities');
 assert(f.some((p,i)=>p.spin<before[i]),'Contact must dissipate spin');
 console.log('✓ Impact transfers momentum, loses rotational energy; no HP');
}
{
 const r=make();let [a,b]=r.fighters;
 a.x=0;a.y=0;a.vx=0;a.vy=0;
 b.x=212;b.y=0;b.vx=300;b.vy=0;b.edgeKick=220;
 tickRoom(r,1/30);
 assert.equal(b.alive,false,'Strong outward collision at the rim must cause ring-out');
 assert.equal(b.koReason,'擊出場外');
 assert.equal(r.status,'results');
 assert.equal(r.results[0].id,'p1');
 console.log('✓ Strong knockback ejects a top and ends the match');
}
{
 const r=make();let [a,b]=r.fighters;
 a.x=0;a.y=0;a.vx=0;a.vy=0;
 b.x=211;b.y=0;b.vx=100;b.vy=0;b.edgeKick=0;
 tickRoom(r,1/30);
 assert.equal(b.alive,true,'Steering into the bowl wall without an enemy hit should rebound');
 assert(b.x<=235-22+.01,'Rim bounce must hold top in the arena');
 console.log('✓ Low-impact bowl contact rebounds without arbitrary ring-out');
}
{
 const r=make();const b=r.fighters[1];b.spin=1.51;
 tickRoom(r,1/30);
 assert.equal(b.alive,false,'A top must stop spinning from physical drag');
 assert.equal(b.koReason,'停止轉動');
 assert.equal(r.results[0].id,'p1');
 console.log('✓ Spin stops from drag and terminates the round');
}
{
 const r=make();const a=r.fighters[0];a.spin=70;
 skill(r,a);assert.equal(a.skillCount,1);assert(a.spin<70);
 assert(snapshot(r).fighters.every(p=>Number.isFinite(p.spin)&&Number.isFinite(p.wobble)));
 console.log('✓ Burst uses spin energy; state includes wobble and no health');
}
console.log(`ALL PHYSICS TESTS PASS (${TOPS.length} tops)`);

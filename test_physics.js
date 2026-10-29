/** V4 physical acceptance tests: knockback, exits, rails, real obstacles and customizable builds. */
'use strict';
const assert=require('node:assert/strict');
const {fightersFor,tickRoom,snapshot,TOPS,PARTS,arenaFeatures,validBuild,massOf}=require('./server');
function make(arena='colosseum'){
 const r={code:'TEST',round:1,host:'p1',arena,status:'playing',bots:0,players:[{id:'p1',name:'A',top:'phoenix',build:{ratchet:'swift2',bit:'flat'},bot:false},{id:'p2',name:'B',top:'behemoth',build:{ratchet:'heavy5',bit:'rubber'},bot:false}],age:0,fighters:[],events:[],results:null,hitPairs:new Map(),updated:Date.now()};
 r.fighters=fightersFor(r);return r;
}
function simulate(r,ticks=1){for(let i=0;i<ticks&&r.status==='playing';i++)tickRoom(r,1/30);}
{
 const r=make();let [a,b]=r.fighters;
 assert(!('hp' in a));assert(!('hp' in snapshot(r).fighters[0]));
 a.x=-21;a.y=0;b.x=21;b.y=0;a.vx=235;b.vx=-205;a.vy=b.vy=0;
 const vxBefore=a.vx+b.vx;
 simulate(r,1);
 assert(a.knockX < -100 && b.knockX>100,'Contact has lasting opposite-direction impulses');
 assert(a.spin<100&&b.spin<100,'Contact dissipates spin');
 simulate(r,5);
 assert(a.knockX<0&&b.knockX>0,'Post-contact impulses survive multiple steering ticks');
 assert(snapshot(r).fighters.every(p=>Number.isFinite(p.vx)));
 console.log('✓ Heavy physical rebound persists past player steering, without HP');
}
{
 const r=make();const b=r.fighters[1];b.x=210;b.y=0;b.vx=180;b.vy=0;b.edgeKick=190;
 simulate(r,1);
 assert(b.railTimer>0,'Right rail must catch fast outward-moving top');
 assert(b.alive);simulate(r,31);
 assert.equal(b.railTimer,0);assert(b.alive,'A recovered top continues to fight');
 assert(r.events.some(e=>e.kind==='return'));
 console.log('✓ External acceleration corridor catches and returns a top');
}
{
 const r=make();const b=r.fighters[1];b.x=0;b.y=214;b.vx=0;b.vy=360;b.edgeKick=180;
 simulate(r,1);
 assert(!b.alive,'Danger pocket under powerful knockback must ring out');
 assert.equal(b.koReason,'擊出場外');
 console.log('✓ Dangerous north/south opening still permits decisive ring-out');
}
{
 const r=make();const b=r.fighters[1];b.x=210;b.y=0;b.vx=25;b.vy=0;b.edgeKick=0;
 simulate(r,1);
 assert(b.alive);assert(b.x<=235-22+.01);assert(b.railTimer===0);
 console.log('✓ Ordinary rim contact rebounds instead of arbitrary ring-out');
}
{
 const r=make();const a=r.fighters[0];a.x=0;a.y=-123;a.vx=0;a.vy=100;
 simulate(r,1);assert(a.y> -123+0||a.knockY!==0);
 assert(arenaFeatures(r).pillars.length===2);
 console.log('✓ Physical bumper obstacles included in authoritative geometry');
}
{
 const r=make();r.fighters[1].spin=1.51;simulate(r,1);
 assert.equal(r.fighters[1].alive,false);assert.equal(r.fighters[1].koReason,'停止轉動');
 console.log('✓ Spin finish when rotational energy runs out');
}
{
 assert.equal(PARTS.ratchets.length,6);assert.equal(PARTS.bits.length,8);
 assert.equal(TOPS.length*PARTS.ratchets.length*PARTS.bits.length,576);
 const a=validBuild({ratchet:'swift2',bit:'flat'});
 const b=validBuild({ratchet:'heavy5',bit:'rubber'});
 const unknown=validBuild({ratchet:'__proto__',bit:'invalid'});
 assert.equal(unknown.bit,'taper');
 assert.notEqual(massOf({...make().fighters[0],build:a}),massOf({...make().fighters[0],build:b}));
 console.log('✓ 576 valid component combinations and server-side input validation');
}
console.log('ALL LEGACY PHYSICS TESTS PASS');

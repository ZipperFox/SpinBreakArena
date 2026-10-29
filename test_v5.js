'use strict';
const assert=require('node:assert/strict');
const {fightersFor,tickRoom,collide,charge,snapshot}=require('./server');
function mk(){const r={code:'V5',round:1,host:'a',arena:'colosseum',status:'playing',bots:0,players:[{id:'a',name:'Alpha',top:'raptor',build:{ratchet:'swift2',bit:'flat'}},{id:'b',name:'Beta',top:'behemoth',build:{ratchet:'heavy5',bit:'rubber'}}],age:1,fighters:[],events:[],hitPairs:new Map(),contactPairs:new Map(),results:null};r.fighters=fightersFor(r);return r;}
function step(r,n=1){for(let i=0;i<n&&r.status==='playing';i++)tickRoom(r,1/30);}
{
 const r=mk(),[a,b]=r.fighters;
 // Autonomous motion with zero player commands.
 const init={x:a.x,y:a.y};step(r,30);assert(Math.hypot(a.x-init.x,a.y-init.y)>15,'top must cruise autonomously');
 console.log('✓ Tops cruise autonomously without joystick input');
}
{
 const r=mk(),[a,b]=r.fighters;
 a.x=-90;a.y=0;b.x=90;b.y=0;a.vx=b.vx=0;a.vy=b.vy=0;
 assert(charge(r,a,b.id),'charge activates');
 const initialSpeed=Math.hypot(a.vx+a.knockX,a.vy+a.knockY);
 assert(initialSpeed>300,'charge should cause visible speed spike');
 assert(!charge(r,a,b.id),'charge cannot be spammed');
 assert(a.spin<100,'charge burns spin');
 step(r,5);assert(Math.hypot(a.vx+a.knockX,a.vy+a.knockY)>initialSpeed*.7,'charge retains momentum for a meaningful duration');
 assert(snapshot(r).fighters[0].chargeCd>3,'charge cooldown shown');
 console.log('✓ One-shot charge causes fast persistent momentum, consumes spin, enforces cooldown');
}
{
 const r=mk(),[a,b]=r.fighters;a.x=-21;a.y=0;b.x=21;b.y=0;a.vx=245;b.vx=-245;a.vy=b.vy=0;
 collide(r,a,b);
 assert(a.knockX<-230&&b.knockX>190,'heavy contact must violently separate');
 assert(b.x-a.x>44,'penetration corrected and contact skin left');
 const momentum=a.knockX+b.knockX;
 collide(r,a,b);assert.equal(a.knockX+b.knockX,momentum,'one contact does not double impulse');
 step(r,6);assert(b.x-a.x>44,'opponents do not stick together after 6 frames');
 assert(Math.hypot(a.vx+a.knockX,a.vy+a.knockY)>40,'rebound survives');
 console.log('✓ Hard collision separates and rebounds; no repeated contact impulse');
}
{
 const r=mk(),[a,b]=r.fighters;a.x=-21;a.y=0;b.x=21;b.y=0;a.vx=310;b.vx=-130;a.vy=b.vy=0;a.chargeUntil=r.age+1;
 collide(r,a,b);assert(r.events.some(e=>e.kind==='hit'&&e.critical===true),'charged impact emits critical event');
 assert(b.knockX>200,'charged hit creates large rebound');
 console.log('✓ Charge-enabled critical impact changes real physics and effects');
}
console.log('ALL V5 TACTICAL PHYSICS TESTS PASS');

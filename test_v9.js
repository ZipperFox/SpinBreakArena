'use strict';
// Physics/launch/garage contracts, executed during Render builds before public deployment.
const assert=require('node:assert/strict');
const {TOPS,PARTS,BLADE_FORMS,validLaunch,validBuild}=require('./server');
const {init,makeEngine}=require('./physics3d');
(async()=>{
 assert.equal(TOPS.length,12);assert.equal(PARTS.ratchets.length*PARTS.bits.length*TOPS.length,576);
 assert(new Set(TOPS.map(t=>t.blade.lobes+':'+t.blade.reach+':'+t.blade.tip)).size>=10,'distinct blade geometries');
 assert.deepEqual(validLaunch({angle:400,power:-5,lane:9}),{angle:40,power:55,lane:0});
 assert.equal(validBuild({paint:'<invalid>'}).paint,null);
 assert.equal(validBuild({paint:'#ff00a0'}).paint,'#ff00a0');
 await init();let hits=0;const engine=makeEngine(TOPS,PARTS,{event:(r,k)=>{if(k==='hit')hits++;},ko:(r,p,why)=>{p.alive=false;p.koReason=why},finish:r=>{r.status='results'}});
 const players=[
  {id:'A',name:'三爪攻擊',top:'phoenix',build:{ratchet:'heavy5',bit:'flat',paint:'#ff3366'},launch:{power:100,angle:35,lane:-1}},
  {id:'B',name:'圓盾防禦',top:'glacier',build:{ratchet:'wide7',bit:'needle'},launch:{power:55,angle:-30,lane:1}},
  {id:'C',name:'偏心重擊',top:'mantis',build:{ratchet:'tall4',bit:'rush'},launch:{power:90,angle:0,lane:0}},
  {id:'D',name:'穩定型',top:'behemoth',build:{ratchet:'dense9',bit:'ball'},launch:{power:70,angle:10,lane:0}}
 ];
 const r={arena:'colosseum',age:0,status:'playing',fighters:[],players};
 r.fighters=engine.create(r,players);
 assert.equal(r.fighters.length,4);
 const colliderCount=r.physics.byCollider.size;
 assert(colliderCount>45,`expected compound asymmetric collision geometry, got ${colliderCount}`);
 const speed=(p)=>Math.hypot(p.body.linvel().x,p.body.linvel().z);
 assert(speed(r.fighters[0])>speed(r.fighters[1]),'launch power must change real velocity');
 assert.notEqual(Math.sign(r.fighters[0].body.linvel().x),Math.sign(r.fighters[1].body.linvel().x),'launching direction differs');
 assert.notEqual(r.fighters[0].body.mass(),r.fighters[1].body.mass(),'parts alter physical mass');
 assert(engine.charge(r,r.fighters[0],'B'),'charge works');
 for(let i=0;i<210;i++){engine.tick(r,1/30);if(r.status!=='playing')break;}
 const snap=engine.snapshot(r);
 assert(snap.fighters.every(f=>Number.isFinite(f.x)&&Number.isFinite(f.h)&&f.q.every(Number.isFinite)));
 assert.equal(snap.fighters[0].build.paint,'#ff3366');
 assert.equal(snap.fighters[0].launch.power,100);
 console.log(`V9_PHYSICS_PASS bladeTypes=12 buildVariants=576 colliders=${colliderCount} contactEvents=${hits} frames=210 launchValidated=true`);
 engine.free(r);
})().catch(e=>{console.error('V9_PHYSICS_FAIL',e.stack||e);process.exit(1)});

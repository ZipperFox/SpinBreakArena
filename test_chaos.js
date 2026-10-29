
'use strict';
const assert=require('node:assert/strict');
const {TOPS,PARTS}=require('./server');
const {init,makeEngine}=require('./physics3d');
(async()=>{
 await init();let eventKinds=[];
 const engine=makeEngine(TOPS,PARTS,{event:(r,k)=>eventKinds.push(k),ko:(r,p,why)=>{p.alive=false;p.koReason=why;},finish:r=>r.status='results'});
 const members=[{id:'A',name:'A',top:'phoenix',build:{ratchet:'wide7',bit:'taper'}},{id:'B',name:'B',top:'glacier',build:{ratchet:'wide7',bit:'ball'}}];
 const make=chaos=>{const r={arena:'colosseum',chaos,age:0,status:'playing',fighters:[],players:members};r.fighters=engine.create(r,members);return r;};
 let r=make(true);r.nextAnomalyAt=.05;
 for(let i=0;i<8;i++)engine.tick(r,1/30);
 assert.equal(r.anomaly.phase,'warning');assert(eventKinds.includes('anomaly_warning'));
 for(let i=0;i<70;i++)engine.tick(r,1/30);
 assert.equal(r.anomaly.phase,'active');assert(eventKinds.includes('anomaly_start'));
 assert(engine.snapshot(r).anomaly.kind);
 assert.equal(engine.counter(r,r.fighters[0]),true);assert.equal(engine.counter(r,r.fighters[0]),false);
 assert(engine.snapshot(r).fighters[0].counterCd>0);
 engine.free(r);
 r=make(false);r.nextAnomalyAt=0;for(let i=0;i<160;i++)engine.tick(r,1/30);
 assert.equal(r.anomaly.phase,'idle');assert.equal(engine.snapshot(r).chaos,false);engine.free(r);
 for(const kind of ['blackhole','meteor','cyclone','magnet','shockwave']){
  r=make(true);r.nextAnomalyAt=.001;r.lastAnomaly=kind==='blackhole'?'meteor':'blackhole';
  // force a specific active hazard using the server phase machine
  r.anomaly={kind,phase:'warning',x:0,z:0,until:.01};
  engine.tick(r,1/30);assert.equal(r.anomaly.phase,'active');
  if(kind==='meteor')assert.equal(engine.snapshot(r).hazards.length,5);
  for(let i=0;i<25;i++)engine.tick(r,1/30);
  const snap=engine.snapshot(r);assert(snap.fighters.every(f=>Number.isFinite(f.h)&&Number.isFinite(f.x)&&Number.isFinite(f.spin)));engine.free(r);
 }
 console.log('CHAOS_ARENA_PASS warning=1 active=5 debrisPhysics=5 counterCooldown=1 pureMode=1');
})().catch(e=>{console.error('CHAOS_ARENA_FAIL',e.stack||e);process.exit(1)});

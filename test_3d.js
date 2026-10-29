'use strict';
const assert = require('node:assert/strict');
const {TOPS,PARTS}=require('./server');
const {init,makeEngine}=require('./physics3d');
(async()=>{
 await init();
 let hits=0,koCount=0; const koReasons=[];
 const engine=makeEngine(TOPS,PARTS,{event:(r,k)=>{if(k==='hit')hits++;},ko:(r,p,reason)=>{p.alive=false;p.koReason=reason;koCount++;koReasons.push(`${p.id}:${reason}@${r.age.toFixed(1)}`);},finish:r=>{r.status='results';}});
 const members=[{id:'A',top:'phoenix',name:'A',build:{ratchet:'heavy5',bit:'flat'}},{id:'B',top:'golem',name:'B',build:{ratchet:'wide7',bit:'ball'}},{id:'C',top:'raptor',name:'C',build:{ratchet:'tall4',bit:'gear'}},{id:'D',top:'cobra',name:'D',build:{ratchet:'swift2',bit:'rush'}}];
 const r={arena:'colosseum',age:0,status:'playing',fighters:[],players:members};
 r.fighters=engine.create(r,members);
 assert.equal(r.fighters.length,4);
 assert.equal(r.fighters[0].body.isDynamic(),true);
 const initial=engine.snapshot(r);assert.equal(initial.physics,'rapier3d');
 assert(Array.isArray(initial.fighters[0].q));assert(Number.isFinite(initial.fighters[0].h));
 assert.equal(engine.charge(r,r.fighters[0],'B'),true,'charge should impart real 3D impulse');
 assert(r.fighters[0].body.linvel().x !== 0);
 assert.equal(engine.charge(r,r.fighters[0],'B'),false,'charge cooldown must be authoritative');
 for(let i=0;i<500;i++){engine.tick(r,1/30);if(i%150===149)console.log(`SIM t=${r.age.toFixed(1)}s events=${hits} alive=${r.fighters.filter(x=>x.alive).length} tops=${r.fighters.map(x=>`${x.id}[${Math.round(x.x)},${Math.round(x.y)},h${Math.round(x.h)},spin${Math.round(x.spin)}]`).join(' ')}`);if(r.status!=='playing')break;}
 const snap=engine.snapshot(r);
 assert(snap.fighters.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.h)&&p.q.every(Number.isFinite)));
 assert(snap.fighters.some(p=>p.h!==initial.fighters.find(f=>f.id===p.id).h),'three-dimensional vertical position should evolve');
 assert(snap.fighters.some(p=>p.q[0]!==0||p.q[2]!==0),'top orientation should change in 3D');
 console.log(`3D_PHYSICS_PASS players=${snap.fighters.length} events=${hits} KO=${koCount} reasons=${koReasons.join(',')} world=Rapier3D time=${snap.time}`);
 engine.free(r);
})().catch(e=>{console.error('3D_PHYSICS_FAIL',e?.stack||e);process.exit(1)});

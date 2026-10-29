'use strict';
// Regression: ordinary guard impact must rebound, E/W gate must return, N/S pockets must KO.
// This test is run during Render build; a failure prevents deployment.
const assert=require('node:assert/strict');
const {TOPS,PARTS}=require('./server');
const {init,makeEngine}=require('./physics3d');
const vec=(x,y,z)=>({x,y,z});
async function run(){
 await init();let checks=0;
 for(const arena of ['colosseum','vortex','tempest','volcano','eclipse']){
  const events=[];const engine=makeEngine(TOPS,PARTS,{event:(r,kind,msg)=>events.push(kind),ko:(r,p,why)=>{p.alive=false;p.koReason=why;},finish:r=>{r.status='results';}});
  const people=[{id:'A',name:'Wall test',top:'phoenix',build:{ratchet:'heavy5',bit:'flat'},launch:{power:100,angle:0,lane:0}},{id:'B',name:'Observer',top:'behemoth',build:{ratchet:'wide7',bit:'ball'},launch:{power:55,angle:0,lane:0}}];
  function reset(){const r={arena,age:0,status:'playing',fighters:[],players:people};r.fighters=engine.create(r,people);const other=r.fighters[1];other.body.setTranslation(vec(-1,.39,0),true);other.body.setLinvel(vec(0,0,0),true);other.bot=false;return {r,p:r.fighters[0]};}
  for(const a of [Math.PI/4,5*Math.PI/4]){
   const {r,p}=reset();const n=vec(Math.cos(a),0,Math.sin(a));
   p.body.setTranslation(vec(n.x*4.65,.40,n.z*4.65),true);p.body.setLinvel(vec(n.x*13,0,n.z*13),true);
   let maxDist=0, maxHeight=0, rebounded=false;
   for(let step=0;step<27&&r.status==='playing';step++){
    engine.tick(r,1/30);
    const pos=p.body.translation(),vel=p.body.linvel(),dist=Math.hypot(pos.x,pos.z);
    maxDist=Math.max(maxDist,dist);maxHeight=Math.max(maxHeight,pos.y);
    if(vel.x*n.x+vel.z*n.z<-.7)rebounded=true;
    assert(p.alive,`unexpected wall KO arena=${arena} angle=${a.toFixed(2)} step=${step} maxR=${maxDist.toFixed(2)} reason=${p.koReason}`);
    assert(maxDist<6.75,`escaped protected wall arena=${arena} maxR=${maxDist.toFixed(2)}`);
    assert(maxHeight<2.7,`ramp-launched over guard arena=${arena} height=${maxHeight.toFixed(2)}`);
   }
   assert(rebounded,`ordinary wall never reversed velocity arena=${arena} angle=${a}`);
   engine.free(r);checks++;
  }
  {const {r,p}=reset();p.body.setTranslation(vec(0,.39,5.08),true);p.body.setLinvel(vec(0,0,13),true);p.lastHitAt=.01;p.lastHitSpeed=13;for(let i=0;i<38&&r.status==='playing';i++)engine.tick(r,1/30);
   assert(!p.alive&&p.koReason==='擊出場外',`intentional pocket should KO in ${arena}: ${p.koReason||'alive'}`);
   engine.free(r);checks++;
  }
  {const {r,p}=reset();p.body.setTranslation(vec(5.08,.39,0),true);p.body.setLinvel(vec(13,0,0),true);
   let rail=false,maxRadius=0;
   for(let i=0;i<54&&r.status==='playing';i++){
    engine.tick(r,1/30);rail ||= p.railTimer>0;
    const pos=p.body.translation();maxRadius=Math.max(maxRadius,Math.hypot(pos.x,pos.z));
    assert(p.alive,`E/W return lane escaped in ${arena} step=${i} maxR=${maxRadius.toFixed(2)} reason=${p.koReason}`);
   }
   assert(rail,`return lane failed to engage in ${arena}`);assert(maxRadius<7.6,`return lane left outer guard in ${arena} maxR=${maxRadius}`);
   engine.free(r);checks++;
  }
 }
 console.log(`GUARDRAIL_REGRESSION_PASS checks=${checks} 5arenas protectedRebound=10 truePocketKO=5 railReturn=5`);
}
run().catch(e=>{console.error('GUARDRAIL_REGRESSION_FAIL',e.stack||e);process.exitCode=1});

'use strict';
// Regression for V9.2 gate behaviour: normal passage must return, an opponent
// knockback can still KO. Includes all five arena definitions.
const assert=require('node:assert/strict');
const {TOPS,PARTS}=require('./server');
const {init,makeEngine}=require('./physics3d');
const V=(x,y,z)=>({x,y,z});
async function run(){
  await init();let checks=0;
  for(const arena of ['colosseum','vortex','tempest','volcano','eclipse']){
    const engine=makeEngine(TOPS,PARTS,{event:()=>{},ko:(r,p,reason)=>{p.alive=false;p.koReason=reason;},finish:r=>{r.status='results';}});
    const members=[{id:'A',name:'Gate test',top:'phoenix',bot:false,build:{ratchet:'heavy5',bit:'flat'},launch:{power:100,angle:0,lane:0}},
       {id:'B',name:'Observer',top:'behemoth',bot:false,build:{ratchet:'wide7',bit:'ball'},launch:{power:55,angle:0,lane:0}}];
    function setup(x,z,vx,vz){
      const r={arena,age:0,status:'playing',fighters:[],players:members};
      r.fighters=engine.create(r,members);
      const p=r.fighters[0],observer=r.fighters[1];
      p.body.setTranslation(V(x,.39,z),true);p.body.setLinvel(V(vx,0,vz),true);
      observer.body.setTranslation(V(-2.0,.39,0),true);observer.body.setLinvel(V(0,0,0),true);
      return {r,p};
    }
    function advance(r,p,frames=75){
      let maxZ=0,returned=false;
      for(let i=0;i<frames&&r.status==='playing';i++){
        engine.tick(r,1/30);
        const pos=p.body.translation(),vel=p.body.linvel();
        maxZ=Math.max(maxZ,Math.abs(pos.z));
        if(pos.z>4.9&&vel.z<-.4)returned=true;
        if(!p.alive)break;
      }
      return {maxZ,returned};
    }
    // The same high-speed unforced shot must NOT be counted as a ring-out.
    {
      const {r,p}=setup(0,5.08,0,13),trace=advance(r,p);
      assert(p.alive,`unforced N gate exit in ${arena}: ${p.koReason||'unknown'}`);
      assert(trace.returned,`N gate failed to return unforced top in ${arena}`);
      assert(trace.maxZ<7.6,`N gate rescue outside playable floor in ${arena}: ${trace.maxZ}`);
      engine.free(r);checks++;
    }
    // Even an apparently fast collision that happened too long ago should not KO.
    {
      const {r,p}=setup(0,5.08,0,13);
      p.lastHitAt=-5;p.lastHitSpeed=16;
      const trace=advance(r,p);
      assert(p.alive&&trace.returned,`stale contact KO in ${arena}`);
      engine.free(r);checks++;
    }
    // Legitimate fresh impact creates a real knockout route, not an invisible wall.
    {
      const {r,p}=setup(0,5.08,0,13);
      p.lastHitAt=.01;p.lastHitSpeed=13;
      advance(r,p,55);
      assert(!p.alive&&p.koReason==='擊出場外',`strong impact failed to KO in ${arena}`);
      engine.free(r);checks++;
    }
    // Soft contact is not automatically a knockout just because a gap is nearby.
    {
      const {r,p}=setup(0,5.08,0,8);
      p.lastHitAt=.01;p.lastHitSpeed=1.8;
      const trace=advance(r,p);
      assert(p.alive&&trace.returned,`soft bump counted as knockout in ${arena}`);
      engine.free(r);checks++;
    }
  }
  // Static shape consistency protects against invisible larger gaps.
  const fs=require('node:fs'),path=require('node:path');
  const visual=fs.readFileSync(path.join(__dirname,'public','arena3d.js'),'utf8');
  assert(visual.includes('Math.sin(.185)'), 'visual gate mouth must match Rapier gate half-angle');
  console.log(`EXIT_TUNING_PASS checks=${checks+1} arenas=5 accidentalReturns=15 impactKOs=5`);
}
run().catch(e=>{console.error('EXIT_TUNING_FAIL',e.stack||e);process.exitCode=1;});

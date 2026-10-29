'use strict';
// Server-authoritative THREE-DIMENSIONAL rigid-body arena physics powered by Rapier 3D.
// Units: metre, kilogram, second. X/Z = stadium floor, Y = height.
const R = require('@dimforge/rapier3d-compat');
let initialized = false;
const U=40, RING=5.75, TICK=1/90, TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const length=(x,z)=>Math.hypot(x,z);
const norm=(x,z)=>{const v=Math.max(.0001,length(x,z));return [x/v,z/v]};
const quatAxis=q=>({x:2*(q.x*q.y-q.z*q.w),y:1-2*(q.x*q.x+q.z*q.z),z:2*(q.y*q.z+q.x*q.w)});
const V=(x,y,z)=>({x,y,z});
const yaw=a=>({x:0,y:Math.sin(a/2),z:0,w:Math.cos(a/2)});
const PLACES={
 colosseum:[[0,-3.2,.42],[0,3.2,.42]],
 vortex:[[-2.8,-2.35,.42],[2.8,2.35,.42],[-2.8,2.35,.38],[2.8,-2.35,.38]],
 tempest:[[0,-3.35,.46],[0,3.35,.46]],
 volcano:[[-2.9,-2.65,.50],[2.9,2.65,.50]],
 eclipse:[[-2.5,0,.44],[2.5,0,.44]],
};
function makeEngine(tops,parts,callbacks){
 const topBy=Object.fromEntries(tops.map(t=>[t.id,t]));
 const rats=Object.fromEntries(parts.ratchets.map(t=>[t.id,t]));
 const bits=Object.fromEntries(parts.bits.map(t=>[t.id,t]));
 const getParts=p=>({rat:rats[p.build?.ratchet]||rats.wide7,bit:bits[p.build?.bit]||bits.taper});
 const stats=p=>{const t=topBy[p.top],{rat,bit}=getParts(p);return {mass:clamp((1+(t.d-5)*.073+(t.type==='防禦'?.09:0))*(1+rat.mass),.7,1.6),grip:bit.grip,drive:bit.drive,rail:bit.rail,drain:bit.spinDrain,stability:rat.stability,damage:(t.a-4)*.13,stamina:t.e};};
 function fixed(r,shape,x,y,z,restitution=.87,friction=.5){const c=r.physics.world.createCollider(shape.setTranslation(x,y,z).setRestitution(restitution).setFriction(friction));return c;}
 function makeArena(r){
  const world=new R.World(V(0,-17.5,0));
  world.timestep=TICK;
  // Solver stabilization and accurate fast impact collision.
  world.numSolverIterations=10;
  r.physics={world,queue:new R.EventQueue(true),byCollider:new Map(),contactTimes:new Map(),rails:[],pillars:PLACES[r.arena]||PLACES.colosseum};
  const floor=R.ColliderDesc.cuboid(8.15,.17,8.15);
  fixed(r,floor,0,-.19,0,.08,.65);
  // Cylindrical real guard bumper pieces. Four openings: 2 elimination pockets, 2 return rails.
  for(let i=0;i<104;i++){
   const a=(i+.5)*TAU/104;
   const distance=Math.min(Math.abs(Math.atan2(Math.sin(a),Math.cos(a-Math.PI/2))),Math.abs(Math.atan2(Math.sin(a+Math.PI/2),Math.cos(a+Math.PI/2))));
   const danger=Math.abs(Math.abs(Math.sin(a))-1)<.043;
   const portal=Math.abs(Math.sin(a))<.19;
   if(danger||portal)continue;
   fixed(r,R.ColliderDesc.ball(.235),5.75*Math.cos(a),.42,5.75*Math.sin(a),.91,.3);
  }
  for(const [x,z,rad] of r.physics.pillars){fixed(r,R.ColliderDesc.cylinder(.35,rad),x,.38,z,.99,.27);}
  // Outer return lanes: tangible outer bumpers with a guided accelerator impulse.
  for(const side of [-1,1])for(let i=0;i<16;i++){
   const a=(side===1?0:Math.PI)+(i-7.5)*.05;
   fixed(r,R.ColliderDesc.ball(.19),6.7*Math.cos(a),.30,6.7*Math.sin(a),.98,.12);
  }
 }
 function create(r,members){
  if(r.physics?.world)r.physics.world.free();makeArena(r);
  const membersCount=members.length;
  return members.map((p,i)=>{
   const a=TAU*i/membersCount-Math.PI/2;
   const x=3.25*Math.cos(a),z=3.25*Math.sin(a),t=topBy[p.top];
   const st=stats(p),rad=.48,spinRate=82+st.stamina*3;
   // Top-shaped compound collision body: bottom tip + mid ratchet + large attack rim.
   const lean=.025+(i%3)*.01;
   const body=r.physics.world.createRigidBody(R.RigidBodyDesc.dynamic()
     .setTranslation(x,.39,z).setRotation({x:Math.cos(a)*Math.sin(lean/2),y:0,z:Math.sin(a)*Math.sin(lean/2),w:Math.cos(lean/2)})
     .setLinvel(-Math.sin(a)*2.1,0,Math.cos(a)*2.1)
     .setAngvel(V(.6,spinRate,.6))
     .setLinearDamping(.18).setAngularDamping(.055).setCcdEnabled(true).setCanSleep(false));
   const events=R.ActiveEvents.COLLISION_EVENTS|R.ActiveEvents.CONTACT_FORCE_EVENTS;
   const rim=r.physics.world.createCollider(R.ColliderDesc.cylinder(.14,rad)
     .setTranslation(0,.04,0).setDensity(st.mass*7.2).setFriction(.22*st.grip)
     .setRestitution(.98).setActiveEvents(events).setContactForceEventThreshold(.2),body);
   const ratchet=r.physics.world.createCollider(R.ColliderDesc.cylinder(.085,.30)
     .setTranslation(0,-.105,0).setDensity(st.mass*1.5).setFriction(.26).setRestitution(.87),body);
   const tip=r.physics.world.createCollider(R.ColliderDesc.ball(.125)
     .setTranslation(0,-.25,0).setDensity(st.mass*.3).setFriction(.40*st.grip).setRestitution(.18),body);
   for(const c of [rim,ratchet,tip])r.physics.byCollider.set(c.handle,p.id);
   return {...p,x:x*U,y:z*U,h:body.translation().y*U,vx:0,vy:0,q:[0,0,0,1],body,
      initialSpin:spinRate,spin:100,wobble:0,alive:true,koReason:'',cool:0,chargeCd:0,
      chargeUntil:0,boostUntil:0,fortressUntil:0,phaseUntil:0,bladeUntil:0,slowUntil:0,stunUntil:0,
      impact:0,skillCount:0,railTimer:0,railCooldown:0,railSign:1,railAngle:0,bot:!!p.bot,
      input:{targetId:null},aiTimer:0,orbitSign:i%2?-1:1,orbitPhase:i*2.2,
      lastHit:null,lastHitAt:0,lastImpactAt:-100,chargeCount:0,flightCount:0,score:0};
  });
 }
 function sync(p){const pos=p.body.translation(),vel=p.body.linvel(),q=p.body.rotation(),w=p.body.angvel(),ax=quatAxis(q);
  p.x=pos.x*U;p.y=pos.z*U;p.h=pos.y*U;p.vx=vel.x*U;p.vy=vel.z*U;p.q=[q.x,q.y,q.z,q.w];
  const topSpin=Math.abs(w.x*ax.x+w.y*ax.y+w.z*ax.z);
  p.spin=clamp(topSpin/p.initialSpin*100,0,105);
  p.wobble=clamp(Math.acos(clamp(ax.y,-1,1))*100/1.2,0,100);
 }
 function target(r,p,id){return r.fighters.find(f=>f.alive&&f.id!==p.id&&f.id===id)||r.fighters.filter(f=>f.alive&&f.id!==p.id).sort((a,b)=>length(a.x-p.x,a.y-p.y)-length(b.x-p.x,b.y-p.y))[0];}
 function burst(r,p,other,strength,lift=.2){if(!p?.alive)return;const pos=p.body.translation();let dx=pos.x, dz=pos.z;if(other){const from=other.body.translation();dx=pos.x-from.x;dz=pos.z-from.z;}const [nx,nz]=norm(dx,dz);const mass=p.body.mass();
  const impulse=V(nx*strength*mass,lift*mass,nz*strength*mass);
  p.body.applyImpulseAtPoint(impulse,V(pos.x,pos.y+.13,pos.z),true);
  p.impact=.5;
 }
 function charge(r,p,id){if(!p.alive||p.chargeCd>0||p.spin<13||p.railTimer>0||p.stunUntil>r.age)return false;
  const q=target(r,p,id||p.input.targetId);if(!q)return false;
  const a=p.body.translation(),b=q.body.translation(),vel=q.body.linvel();
  const [nx,nz]=norm(b.x+vel.x*.12-a.x,b.z+vel.z*.12-a.z);
  const s=stats(p),strength=(7.6+topBy[p.top].s*.33)*s.drive;
  p.body.applyImpulse(V(nx*p.body.mass()*strength,p.body.mass()*.22,nz*p.body.mass()*strength),true);
  p.body.applyTorqueImpulse(V(-nz*.35*p.body.mass(),0,nx*.35*p.body.mass()),true);
  p.chargeCd=4.5;p.chargeUntil=r.age+.75;p.chargeCount++;
  p.body.setAngvel(V(p.body.angvel().x,p.body.angvel().y*.958,p.body.angvel().z),true);
  callbacks.event(r,'charge',`${p.name} · 極限衝鋒！`,p.id,Math.round(strength*40),{x:p.x,y:p.y,targetId:q.id});return true;
 }
 function skill(r,p){if(!p.alive||p.cool>0||p.spin<12)return false;const t=topBy[p.top],foes=r.fighters.filter(q=>q.alive&&q.id!==p.id);
  p.cool=t.cd;p.skillCount++;
  const near=(distance,fn)=>foes.filter(q=>length((p.x-q.x)/U,(p.y-q.y)/U)<distance).forEach(fn);
  switch(t.power){
   case 'blast':near(3.4,q=>burst(r,q,p,6.0,1.5));break;
   case 'dash':case 'speed':p.boostUntil=r.age+3;charge(r,p,p.input.targetId);p.chargeCd=Math.min(p.chargeCd,2.3);break;
   case 'blade':p.bladeUntil=r.age+4.2;break;
   case 'fortress':case 'heal':p.fortressUntil=r.age+5.5;p.body.setAngvel(V(0,Math.max(55,p.body.angvel().y),0),true);break;
   case 'ice':near(3.5,q=>{q.slowUntil=r.age+2.6;burst(r,q,p,4,.4);});break;
   case 'quake':near(3.6,q=>{burst(r,q,p,8,2.7);q.stunUntil=r.age+.35;});break;
   case 'phase':p.phaseUntil=r.age+1.25;p.boostUntil=r.age+2;break;
   case 'storm':p.bladeUntil=r.age+3.4;p.boostUntil=r.age+2;near(2.6,q=>burst(r,q,p,5,.8));break;
   case 'vortex':near(4.2,q=>{const a=p.body.translation(),b=q.body.translation(),[nx,nz]=norm(a.x-b.x,a.z-b.z);q.body.applyImpulse(V(nx*2*q.body.mass(),.1,nz*2*q.body.mass()),true);});break;
   case 'nova':near(3.8,q=>burst(r,q,p,7,1.9));break;
  }
  p.body.setAngvel(V(p.body.angvel().x,p.body.angvel().y*.97,p.body.angvel().z),true);
  callbacks.event(r,'skill',`${p.name} · ${t.skill}！`,p.id,0);return true;
 }
 function spinStop(r,p){if(!p.alive)return;sync(p);const pos=p.body.translation(),v=p.body.linvel();
  if(pos.y<-.65||length(pos.x,pos.z)>8.25){callbacks.ko(r,p,'擊出場外');return;}
  if(p.spin<6.5){p.deadTime=(p.deadTime||0)+TICK;}else p.deadTime=0;
  const lean=quatAxis(p.body.rotation()).y;
  if(p.spin<6.5&&p.deadTime>.55 || (lean<.32&&p.spin<30&&pos.y<.35)){callbacks.ko(r,p,'停止轉動');return;}
  if(Math.abs(v.x)+Math.abs(v.z)<.1&&p.spin<7.5){p.deadTime+=TICK;}
 }
 function enterLane(r,p){if(p.railTimer>0||p.railCooldown>0||!p.alive)return;
  const t=p.body.translation(),v=p.body.linvel(),dist=length(t.x,t.z);
  if(dist<5.85||Math.abs(t.z)>1.6||Math.abs(t.x)<5.3)return;
  // Real colliders still govern the top. Original arcade rail applies acceleration and steering impulses.
  p.railTimer=.85;p.railCooldown=5.6;p.railSign=t.z<0?1:-1;
  callbacks.event(r,'rail',`${p.name} · 極限軌道加速！`,p.id,Math.round(length(v.x,v.z)*U),{x:p.x,y:p.y});
 }
 function physicsStep(r){
  const phy=r.physics;
  for(const p of r.fighters){if(!p.alive)continue;
   const b=p.body,pos=b.translation(),w=b.angvel(),v=b.linvel(),axis=quatAxis(b.rotation()),st=stats(p);
   // Real angular speed, tip friction and angular momentum: extra spin stabilization is an arcade assist.
   const spinSpeed=Math.max(0,w.x*axis.x+w.y*axis.y+w.z*axis.z);
   const lateral=length(v.x,v.z);const radius=length(pos.x,pos.z);
   if(spinSpeed>10){
    const strength=(.055+st.stability*.14)*clamp(spinSpeed/95,.2,1.5);
    b.applyTorque(V(-axis.z*strength,0,axis.x*strength),true);
    // Very light autonomous curvature from tip geometry, never player steering.
    if(p.stunUntil<=r.age&&p.chargeUntil<=r.age&&p.railTimer<=0){const [nx,nz]=norm(pos.x,pos.z);const torque=clamp((2.2-lateral)*.038,.002,.11)*st.drive;
      b.applyImpulse(V(-nz*p.orbitSign*torque,0,nx*p.orbitSign*torque),true);
    }
   }
   if(p.railTimer>0){ // track returns the moving rigid body through impulses, not teleporting.
     const sign=pos.x>=0?1:-1;const [nx,nz]=norm(pos.x,pos.z);
     const force=V(-nx*3.8-b.linvel().x*.22,1.25, -nz*3.8-b.linvel().z*.22);
     b.applyImpulse(V(force.x*b.mass()*TICK,force.y*b.mass()*TICK,force.z*b.mass()*TICK),true);
   }
   if(radius>4.8&&r.arena==='vortex')b.applyImpulse(V(-pos.x/radius*.024,0,-pos.z/radius*.024),true);
   if(r.arena==='tempest')b.applyImpulse(V(-pos.z*.002,0,pos.x*.002),true);
   if(r.arena==='volcano'&&r.age%8>6&&r.age%8<7&&Math.abs(pos.x)<2) b.applyImpulse(V(.045,.06,.025),true);
   const speed=length(v.x,v.z),max=15;if(speed>max){const s=max/speed;b.setLinvel(V(v.x*s,v.y,v.z*s),true);}
   const decay=(.017+(p.bladeUntil>r.age?.005:0)+Math.max(0,1-st.stamina*.11)*.009)*st.drain;
   b.applyTorque(V(-w.x*.003,-w.y*decay,-w.z*.003),true);
  }
  phy.world.step(phy.queue);
  // Contact force events and real velocity impulses measured by Rapier.
  phy.queue.drainContactForceEvents(c=>{
   const aid=phy.byCollider.get(c.collider1()),bid=phy.byCollider.get(c.collider2());
   if(!aid&&!bid)return;
   if(aid&&bid&&aid===bid)return;
   const a=r.fighters.find(p=>p.id===aid),b=r.fighters.find(p=>p.id===bid);
   const key=[aid||'W'+c.collider1(),bid||'W'+c.collider2()].sort().join(':');
   if(r.age-(phy.contactTimes.get(key)||-99)<.19)return;
   const impulse=c.maxForceMagnitude?.()||0;
   if(impulse<38)return;
   phy.contactTimes.set(key,r.age);
   if(a&&!a.alive||b&&!b.alive)return;
   const who=a||b,other=b||a;
   const pos=who.body.translation(),bb=other?.body.translation();
   const vx=who.body.linvel(),ov=other?.body.linvel()||V(0,0,0);
   const rel=length(vx.x-ov.x,vx.z-ov.z);
   if(other){
     // Arcade amplification on top of *real* rigid body contact impulse.
     const charged=(a.chargeUntil>r.age||b.chargeUntil>r.age);
     const extra=clamp(rel*.30+(charged?2.2:0)+impulse*.00006,1.0,5.3);
     burst(r,a,b,extra,clamp(rel*.13+(charged?1.0:0),.12,2.6));
     burst(r,b,a,extra,clamp(rel*.13+(charged?1.0:0),.12,2.6));
     a.lastHit=b.name;b.lastHit=a.name;a.lastHitAt=b.lastHitAt=r.age;
     callbacks.event(r,'hit',`${a.name} ⚡ ${b.name} · 3D 重擊！`,a.id,Math.round(rel*40),{x:(a.x+b.x)/2,y:(a.y+b.y)/2,critical:charged,force:Math.round(impulse)});
   }else{
     who.impact=.35;
     if(rel>2.7)callbacks.event(r,'wall','3D 護欄強力反彈！',who.id,Math.round(rel*40),{x:who.x,y:who.y});
   }
  });
  phy.queue.drainCollisionEvents(()=>{});
  for(const p of r.fighters){if(!p.alive)continue;spinStop(r,p);if(!p.alive)continue;enterLane(r,p);
   if(p.railTimer>0)p.railTimer=Math.max(0,p.railTimer-TICK);
   p.railCooldown=Math.max(0,p.railCooldown-TICK);
   if(p.impact>0)p.impact=Math.max(0,p.impact-TICK);
   // Open dangerous north/south pockets: knockout on momentum, rather than removing all walls.
   const pos=p.body.translation(),v=p.body.linvel(),out=Math.hypot(pos.x,pos.z);
   if(out>5.9&&Math.abs(pos.z)>4.5&&Math.abs(pos.x)<2.0&&length(v.x,v.z)>2.5){callbacks.ko(r,p,'擊出場外');}
  }
 }
 function tick(r,dt){if(r.status!=='playing')return;r.age+=dt;
  for(const p of r.fighters){if(!p.alive)continue;
   p.cool=Math.max(0,p.cool-dt);p.chargeCd=Math.max(0,p.chargeCd-dt);
   if(p.bot){p.aiTimer-=dt;if(p.aiTimer<=0){p.aiTimer=.4+Math.random()*.6;p.input.targetId=target(r,p)?.id||null;
      if(Math.random()<.62)charge(r,p,p.input.targetId);if(Math.random()<.26)skill(r,p);}}
  }
  for(let i=0;i<3&&r.status==='playing';i++)physicsStep(r);
  if(r.status!=='playing')return;
  if(r.age>=90){const alive=r.fighters.filter(p=>p.alive).sort((a,b)=>b.spin-a.spin||a.wobble-b.wobble);for(const p of alive.slice(1)){p.alive=false;p.koReason='時間到：轉速判定';}callbacks.finish(r);return;}
  if(r.fighters.filter(p=>p.alive).length<=1)callbacks.finish(r);
 }
 function snapshot(r){return {t:'tick',physics:'rapier3d',time:+r.age.toFixed(1),radius:Math.round(RING*U),arena:r.arena,
   geometry:{pillars:(PLACES[r.arena]||PLACES.colosseum).map(([x,z,rad])=>({x:x*U,y:z*U,r:rad*U})),lanes:true,exitAngles:[Math.PI/2,-Math.PI/2]},
   fighters:r.fighters.map(p=>{if(p.alive)sync(p);return {id:p.id,name:p.name,top:p.top,build:p.build,bot:p.bot,
    x:+p.x.toFixed(1),y:+p.y.toFixed(1),h:+(p.h||0).toFixed(1),q:p.q,vx:Math.round(p.vx),vy:Math.round(p.vy),
    spin:Math.round(p.spin),wobble:Math.round(p.wobble),alive:p.alive,reason:p.koReason||'',rail:p.railTimer>0,
    cool:+p.cool.toFixed(1),chargeCd:+p.chargeCd.toFixed(1),charging:p.chargeUntil>r.age,shield:p.fortressUntil>r.age,
    phase:p.phaseUntil>r.age,boost:p.boostUntil>r.age,blade:p.bladeUntil>r.age,impact:p.impact>0,skillCount:p.skillCount,
    rpm:Math.round(p.spin*p.initialSpin/100*60/(Math.PI*2))};})};
 }
 function free(r){if(r.physics?.world)r.physics.world.free();r.physics=null;}
 return {create,tick,charge,skill,snapshot,free,stats};
}
async function init(){if(!initialized){await R.init();initialized=true;}return R;}
module.exports={init,makeEngine};

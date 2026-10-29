'use strict';
// Server-authoritative THREE-DIMENSIONAL rigid-body arena physics powered by Rapier 3D.
// Units: metre, kilogram, second. X/Z = stadium floor, Y = height.
const R = require('@dimforge/rapier3d-compat');
let initialized = false;
const U=40, RING=5.75, TICK=1/90, TAU=Math.PI*2;
// V9.2: the lethal N/S gates are narrow, and a confirmed opponent impact is
// required for a gate KO. This reduces unforced accidents without removing KOs.
const EXIT_HALF_ANGLE=.185;
const EXIT_CONFIRM_Z=6.38;
const EXIT_IMPACT_WINDOW=1.6;
const EXIT_MIN_HIT_SPEED=3.5;
const EXIT_MIN_OUTWARD_SPEED=3.1;
const gateImpact=(r,p)=>p.lastHitAt>0 && r.age-p.lastHitAt<=EXIT_IMPACT_WINDOW && p.lastHitSpeed>=EXIT_MIN_HIT_SPEED;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const length=(x,z)=>Math.hypot(x,z);
const norm=(x,z)=>{const v=Math.max(.0001,length(x,z));return [x/v,z/v]};
const quatAxis=q=>({x:2*(q.x*q.y-q.z*q.w),y:1-2*(q.x*q.x+q.z*q.z),z:2*(q.y*q.z+q.x*q.w)});
const V=(x,y,z)=>({x,y,z});
const yaw=a=>({x:0,y:Math.sin(a/2),z:0,w:Math.cos(a/2)});
const ANOMALIES={
 blackhole:{name:'深淵黑洞',warning:'黑洞即將形成！遠離中心或利用引力衝鋒',duration:4.6,color:'#bb79ff'},
 meteor:{name:'隕石碎片雨',warning:'上空出現墜落警告！留意紅色落點',duration:4.4,color:'#ffae70'},
 cyclone:{name:'極速風暴',warning:'風場正在增強！小心橫向推力',duration:5.2,color:'#68f4d2'},
 magnet:{name:'雙極磁場',warning:'磁場即將啟動！場地中央將出現斥力',duration:4.5,color:'#7db9ff'},
 shockwave:{name:'重力震盪',warning:'地面共振警報！短暫失衡即將發生',duration:3.6,color:'#ffdf78'}
};
const ANOMALY_IDS=Object.keys(ANOMALIES);
const EVENT_RADIUS=3.7;
const randomPoint=()=>{const a=Math.random()*TAU,r=.7+Math.sqrt(Math.random())*2.5;return {x:+(Math.cos(a)*r).toFixed(2),z:+(Math.sin(a)*r).toFixed(2)};};
const anomalyInfo=(r)=>{const e=r.anomaly||{};return {kind:e.kind||null,phase:e.phase||'idle',name:ANOMALIES[e.kind]?.name||'',x:e.x||0,z:e.z||0,until:e.until||0,nextAt:r.nextAnomalyAt||0,spawns:e.spawns||[]};};
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
  r.physics={world,queue:new R.EventQueue(true),debris:[],debrisColliders:new Set(),byCollider:new Map(),guardColliders:new Set(),railColliders:new Set(),contactTimes:new Map(),rails:[],pillars:PLACES[r.arena]||PLACES.colosseum};
  const floor=R.ColliderDesc.cuboid(8.15,.17,8.15);
  fixed(r,floor,0,-.19,0,.08,.65);
  // Tall overlapping upright cylinders, NOT low spheres. A rounded horizontal row
  // acts like a ramp and can vault a fast spinning top over the barrier.
  // The two N/S pockets remain genuine ring-out openings; E/W are return-lane gates.
  for(let i=0;i<104;i++){
   const a=(i+.5)*TAU/104;
   const danger=Math.abs(Math.cos(a))<Math.sin(EXIT_HALF_ANGLE);
   const portal=Math.abs(Math.sin(a))<.19;
   if(danger||portal)continue;
   const guard=fixed(r,R.ColliderDesc.cylinder(1.68,.225),5.75*Math.cos(a),1.50,5.75*Math.sin(a),.58,.10);
   r.physics.guardColliders.add(guard.handle);
  }
  for(const [x,z,rad] of r.physics.pillars){fixed(r,R.ColliderDesc.cylinder(.35,rad),x,.38,z,.86,.27);}
  // The return lanes also have genuinely tall outer walls so fast tops cannot
  // jump their low spherical bumpers or escape the outer lane at speed.
  for(const side of [-1,1])for(let i=0;i<22;i++){
   const a=(side===1?0:Math.PI)+(i-10.5)*.043;
   const wall=fixed(r,R.ColliderDesc.cylinder(1.40,.245),6.84*Math.cos(a),1.27,6.84*Math.sin(a),.50,.08);
   r.physics.railColliders.add(wall.handle);
  }
 }
 function create(r,members){
  if(r.physics?.world)r.physics.world.free();makeArena(r);
  r.anomaly={phase:'idle',kind:null,x:0,z:0,until:0};r.nextAnomalyAt=7+Math.random()*3;r.lastAnomaly=null;
  const membersCount=members.length;
  return members.map((p,i)=>{
   const a=TAU*i/membersCount-Math.PI/2+.48;
   const launch=p.launch||{angle:0,power:85,lane:0};
   const lane=clamp(launch.lane||0,-1,1),angle=clamp(launch.angle||0,-40,40)*Math.PI/180;
   const theta=a+lane*.22,launchSpeed=(1.2+clamp(launch.power||85,55,100)*.020)*stats(p).drive;
   const x=(1.92+Math.abs(lane)*.22)*Math.cos(theta),z=(1.92+Math.abs(lane)*.22)*Math.sin(theta),t=topBy[p.top];
   const st=stats(p),rad=.48,spinRate=(77+st.stamina*3)*(0.79+clamp(launch.power||85,55,100)*.0025);
   const direct=theta+Math.PI/2+angle;
   // Top-shaped compound collision body: bottom tip + mid ratchet + large attack rim.
   const lean=.025+(i%3)*.01;
   const body=r.physics.world.createRigidBody(R.RigidBodyDesc.dynamic()
     .setTranslation(x,.39,z).setRotation({x:Math.cos(a)*Math.sin(lean/2),y:0,z:Math.sin(a)*Math.sin(lean/2),w:Math.cos(lean/2)})
     .setLinvel(Math.cos(direct)*launchSpeed,.18,Math.sin(direct)*launchSpeed)
     .setAngvel(V(.6,spinRate,.6))
     .setLinearDamping(.18).setAngularDamping(.055).setCcdEnabled(true).setCanSleep(false));
   const events=R.ActiveEvents.COLLISION_EVENTS|R.ActiveEvents.CONTACT_FORCE_EVENTS;
   // Real collision silhouette: a central hub plus independently positioned, rotating
   // lobe colliders. Density creates a different inertia tensor for each blade.
   const shape=t.blade||{lobes:5,reach:.39,tip:.13};
   const rim=r.physics.world.createCollider(R.ColliderDesc.cylinder(.125,.31)
     .setTranslation(0,.05,0).setDensity(st.mass*4.7).setFriction(.23*st.grip)
     .setRestitution(.89).setActiveEvents(events).setContactForceEventThreshold(.2),body);
   const contacts=[rim];
   for(let j=0;j<shape.lobes;j++){
     const az=TAU*j/shape.lobes + (shape.shape==='swept'?.10:0);
     const rr=shape.reach-(j%2&&shape.shape==='hammer'?.04:0);
     const cc=r.physics.world.createCollider(R.ColliderDesc.ball(shape.tip)
       .setTranslation(Math.cos(az)*rr,.05+(shape.shape==='axe'?.07:0),Math.sin(az)*rr)
       .setDensity(st.mass*(shape.shape==='shield'?1.30:1.65)/shape.lobes*4)
       .setFriction(.19*st.grip).setRestitution(.95)
       .setActiveEvents(events).setContactForceEventThreshold(.2),body);
     contacts.push(cc);
   }
   // Ratchet teeth change the compound body's mass distribution and lower striking surface.
   const ratchetCount=clamp(getParts(p).rat.gear||5,2,9);
   const ratchet=r.physics.world.createCollider(R.ColliderDesc.cylinder(.065,.235)
     .setTranslation(0,-.115,0).setDensity(st.mass*1.35).setFriction(.26).setRestitution(.8),body);
   contacts.push(ratchet);
   for(let j=0;j<ratchetCount;j++){
     const az=TAU*j/ratchetCount;
     contacts.push(r.physics.world.createCollider(R.ColliderDesc.ball(.055)
       .setTranslation(Math.cos(az)*.235,-.115,Math.sin(az)*.235)
       .setDensity(st.mass*.42).setFriction(.32).setRestitution(.83),body));
   }
   const tipRadius=getParts(p).bit.id==='ball'?.15:getParts(p).bit.id==='needle'?.085:getParts(p).bit.id==='rubber'?.145:.115;
   const tip=r.physics.world.createCollider(R.ColliderDesc.ball(tipRadius)
     .setTranslation(0,-.25,0).setDensity(st.mass*.7).setFriction(.40*st.grip).setRestitution(.18),body);
   contacts.push(tip);
   for(const c of contacts)r.physics.byCollider.set(c.handle,p.id);
   return {...p,x:x*U,y:z*U,h:body.translation().y*U,vx:0,vy:0,q:[0,0,0,1],body,
      initialSpin:spinRate,launchStrength:launchSpeed,spin:100,spinEnergy:100,wobble:0,alive:true,koReason:'',cool:0,chargeCd:0,
      chargeUntil:0,counterUntil:0,counterCd:0,counterCount:0,precisionCount:0,boostUntil:0,fortressUntil:0,phaseUntil:0,bladeUntil:0,slowUntil:0,stunUntil:0,
      impact:0,skillCount:0,railTimer:0,railCooldown:0,railSign:1,railAngle:0,bot:!!p.bot,
      input:{targetId:null},aiTimer:0,orbitSign:i%2?-1:1,orbitPhase:i*2.2,
      lastHit:null,lastHitAt:-100,lastHitSpeed:0,lastImpactAt:-100,chargeCount:0,flightCount:0,score:0};
  });
 }
 function sync(p){const pos=p.body.translation(),vel=p.body.linvel(),q=p.body.rotation(),w=p.body.angvel(),ax=quatAxis(q);
  p.x=pos.x*U;p.y=pos.z*U;p.h=pos.y*U;p.vx=vel.x*U;p.vy=vel.z*U;p.q=[q.x,q.y,q.z,q.w];
  const topSpin=Math.abs(w.x*ax.x+w.y*ax.y+w.z*ax.z);
  p.physicalSpin=clamp(topSpin/p.initialSpin*100,0,105);
  p.spin=clamp(p.spinEnergy,0,100);
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
  p.spinEnergy=Math.max(0,p.spinEnergy-3.8);
  callbacks.event(r,'charge',`${p.name} · 極限衝鋒！`,p.id,Math.round(strength*40),{x:p.x,y:p.y,targetId:q.id});return true;
 }
 function counter(r,p){
  if(!p.alive||p.counterCd>0||p.spinEnergy<10||p.railTimer>0)return false;
  p.counterUntil=r.age+.55;p.counterCd=6.8;p.spinEnergy=Math.max(0,p.spinEnergy-2.1);
  callbacks.event(r,'counter_ready',`${p.name} · 反擊姿態！`,p.id,0,{x:p.x,y:p.y});return true;
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
  p.spinEnergy=Math.max(0,p.spinEnergy-2.8);
  callbacks.event(r,'skill',`${p.name} · ${t.skill}！`,p.id,0);return true;
 }
 function spinStop(r,p){if(!p.alive)return;sync(p);const pos=p.body.translation(),v=p.body.linvel();
  if(pos.y<-.65||length(pos.x,pos.z)>8.25){callbacks.ko(r,p,'擊出場外');return;}
  if(p.spin<5.5){p.deadTime=(p.deadTime||0)+TICK;}else p.deadTime=0;
  const lean=quatAxis(p.body.rotation()).y;
  if(r.age>7&&(p.spin<5.5&&p.deadTime>.75 || (lean<.12&&p.spin<25&&pos.y<.35))){callbacks.ko(r,p,'停止轉動');return;}
  if(Math.abs(v.x)+Math.abs(v.z)<.1&&p.spin<7.5){p.deadTime+=TICK;}
 }
 function enterLane(r,p){if(p.railTimer>0||p.railCooldown>0||!p.alive)return;
  const t=p.body.translation(),v=p.body.linvel(),dist=length(t.x,t.z);
  if(dist<5.85||Math.abs(t.z)>1.6||Math.abs(t.x)<5.3)return;
  // Real colliders still govern the top. Original arcade rail applies acceleration and steering impulses.
  p.railTimer=.85;p.railCooldown=5.6;p.railSign=t.z<0?1:-1;
  callbacks.event(r,'rail',`${p.name} · 極限軌道加速！`,p.id,Math.round(length(v.x,v.z)*U),{x:p.x,y:p.y});
 }
 function spawnDebris(r){
  const phy=r.physics,world=phy.world,e=r.anomaly;
  for(let i=0;i<5;i++){
   const pos=e.spawns?.[i]||randomPoint(),radius=.20+(i%3)*.045;
   const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos.x,3.6+i*.55,pos.z)
     .setLinvel(0,-.7,0).setAngularDamping(.1).setCcdEnabled(true));
   const collider=world.createCollider(R.ColliderDesc.ball(radius).setDensity(.65).setRestitution(.66)
     .setFriction(.35).setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(.3),body);
   phy.debrisColliders.add(collider.handle);
   phy.debris.push({id:i,body,collider,expires:r.age+5.7,r:radius});
  }
 }
 function updateAnomaly(r){
  if(r.chaos===false||r.status!=='playing')return;
  const e=r.anomaly;
  if(e.phase==='idle'&&r.age>=r.nextAnomalyAt){
    let kinds=ANOMALY_IDS.filter(k=>k!==r.lastAnomaly),kind=kinds[Math.floor(Math.random()*kinds.length)];
    const pos=kind==='blackhole'?{x:0,z:0}:randomPoint();
    Object.assign(e,{kind,x:pos.x,z:pos.z,spawns:kind==='meteor'?Array.from({length:5},randomPoint):[],phase:'warning',until:r.age+2.2});
    callbacks.event(r,'anomaly_warning',ANOMALIES[kind].warning,'',0,{anomaly:anomalyInfo(r)});
  }else if(e.phase==='warning'&&r.age>=e.until){
    e.phase='active';e.until=r.age+ANOMALIES[e.kind].duration;r.lastAnomaly=e.kind;
    if(e.kind==='meteor')spawnDebris(r);
    callbacks.event(r,'anomaly_start',`場地異變：${ANOMALIES[e.kind].name}！`,'',0,{anomaly:anomalyInfo(r)});
  }else if(e.phase==='active'&&r.age>=e.until){
    callbacks.event(r,'anomaly_end',`${ANOMALIES[e.kind].name}結束`, '',0,{anomaly:anomalyInfo(r)});
    Object.assign(e,{phase:'idle',kind:null,until:0});
    r.nextAnomalyAt=r.age+9+Math.random()*4;
  }
 }
 function anomalyImpulse(r,p){
  if(r.chaos===false||r.anomaly?.phase!=='active')return;
  const e=r.anomaly,b=p.body,pos=b.translation(),vx=b.linvel().x,vz=b.linvel().z;
  const dx=e.x-pos.x,dz=e.z-pos.z,d=length(dx,dz),[nx,nz]=norm(dx,dz),m=b.mass();
  // Anomaly forces are deliberately bounded and mostly central. They must not
  // invalidate the guarded rim and the V9.2 earned ring-out rule.
  if(e.kind==='blackhole'&&d<EVENT_RADIUS){
   const force=clamp((EVENT_RADIUS-d)*.55,.12,1.4)*TICK*m;
   b.applyImpulse(V(nx*force,0,nz*force),true);
   if(d<.8)b.applyImpulse(V(-nx*.20*TICK*m,0,-nz*.20*TICK*m),true);
  }else if(e.kind==='cyclone'){
   const s=Math.sin(r.age*3+pos.z*.65);b.applyImpulse(V(s*.45*TICK*m,0,.24*Math.cos(r.age*2+pos.x)*TICK*m),true);
  }else if(e.kind==='magnet'&&d<3.2){
   const repulse=.95*TICK*m*(1-d/3.2);b.applyImpulse(V(-nx*repulse,0,-nz*repulse),true);
  }else if(e.kind==='shockwave'&&d<3.7){
   const phase=(r.age-(e.until-ANOMALIES.shockwave.duration));
   const radius=.65+phase*1.05;if(Math.abs(d-radius)<.33){
     const push=.65*TICK*m;b.applyImpulse(V(-nx*push,.24*TICK*m,-nz*push),true);
   }
  }
  // Nothing turns anomalies into uncontrolled outward acceleration near the rim.
  const speed=length(vx,vz);if(speed>13){b.setLinvel(V(vx*13/speed,b.linvel().y,vz*13/speed),true);}
 }
 function physicsStep(r){
  const phy=r.physics;
  for(const p of r.fighters){if(!p.alive)continue;
   const b=p.body,pos=b.translation(),w=b.angvel(),v=b.linvel(),axis=quatAxis(b.rotation()),st=stats(p);
   anomalyImpulse(r,p);
   // Real angular speed, tip friction and angular momentum: extra spin stabilization is an arcade assist.
   const spinSpeed=w.x*axis.x+w.y*axis.y+w.z*axis.z;
   // Motorized launch: retain the physical spin axis while gradually losing launch energy.
   // The world still resolves 3D tilt, inertia, contact and impacts; this only represents
   // a game-like, low-loss bearing instead of the exaggerated drag of a sphere tip.
   p.spinEnergy=clamp(p.spinEnergy-TICK*(.85+(p.bladeUntil>r.age?.15:0))*st.drain,0,100);
   const desired=p.initialSpin*(p.spinEnergy/100);
   const correction=clamp((desired-spinSpeed)*.20,-9,9);
   b.applyTorqueImpulse(V(axis.x*correction*.045,axis.y*correction*.045,axis.z*correction*.045),true);
   const lateral=length(v.x,v.z);const radius=length(pos.x,pos.z);
   if(p.spinEnergy>10){
    const strength=(2.4+st.stability*2.0)*clamp(p.spinEnergy/100,.15,1);
    b.applyTorqueImpulse(V(-axis.z*strength*TICK,0,axis.x*strength*TICK),true);
    // Very light autonomous curvature from tip geometry, never player steering.
    if(p.stunUntil<=r.age&&p.chargeUntil<=r.age&&p.railTimer<=0){const [nx,nz]=norm(pos.x,pos.z);const torque=clamp((2.2-lateral)*.038,.002,.11)*st.drive;
      b.applyImpulse(V(-nz*p.orbitSign*torque,0,nx*p.orbitSign*torque),true);
    }
   }
   if(p.railTimer>0){ // real guided impulses; no teleport and no instant elimination.
     const [nx,nz]=norm(pos.x,pos.z),vRad=v.x*nx+v.z*nz;
     const tx=-nz*p.railSign,tz=nx*p.railSign;
     const vTan=v.x*tx+v.z*tz;
     // Strong enough to turn back even a maximum-speed charge within the lane.
     const desiredRad=radius>5.8?-6.2:-2.4;
     const radialKick=clamp((desiredRad-vRad)*.19,-4,1.4);
     const tangentialKick=clamp((5.4-vTan)*.065,-.7,.7);
     b.applyImpulse(V((nx*radialKick+tx*tangentialKick)*b.mass(),0,(nz*radialKick+tz*tangentialKick)*b.mass()),true);
   }
   // The mouth of each N/S gate has an arcade-style return lip. Passive orbiting,
   // missed charges and gentle side bumps should bend back into the arena; a
   // recent *strong opponent hit* still has a genuine free exit route.
   if(Math.abs(pos.z)>4.75 && Math.abs(pos.x)<1.45 && !gateImpact(r,p)){
      const sign=pos.z>=0?1:-1,outward=v.z*sign;
      if(outward>0 && Math.abs(pos.z)>5.02){
        const redirect=clamp((outward+2.4)*.165,0,2.6);
        b.applyImpulse(V(0,0,-sign*redirect*b.mass()),true);
      }
   }
   // Shallow bowl guidance near the perimeter: reduces accidental self-ring-outs.
   // It is intentionally weak; charged impacts can still overwhelm it.
   if(radius>4.2&&p.chargeUntil<=r.age&&p.railTimer<=0){const pull=Math.min(.7,(radius-4.2)*.28);b.applyImpulse(V(-pos.x/radius*pull*TICK*b.mass(),0,-pos.z/radius*pull*TICK*b.mass()),true);}
   if(radius>4.8&&r.arena==='vortex')b.applyImpulse(V(-pos.x/radius*.024,0,-pos.z/radius*.024),true);
   if(r.arena==='tempest')b.applyImpulse(V(-pos.z*.002,0,pos.x*.002),true);
   if(r.arena==='volcano'&&r.age%8>6&&r.age%8<7&&Math.abs(pos.x)<2) b.applyImpulse(V(.045,.06,.025),true);
   const speed=length(v.x,v.z),max=15;if(speed>max){const s=max/speed;b.setLinvel(V(v.x*s,v.y,v.z*s),true);}
   const decay=(.005+(p.bladeUntil>r.age?.002:0)+Math.max(0,1-st.stamina*.11)*.003)*st.drain;
   b.applyTorqueImpulse(V(-w.x*.003*TICK,-w.y*decay*TICK,-w.z*.003*TICK),true);
  }
  phy.world.step(phy.queue);
  // Contact force events and real velocity impulses measured by Rapier.
  phy.queue.drainContactForceEvents(c=>{
   const aid=phy.byCollider.get(c.collider1()),bid=phy.byCollider.get(c.collider2());
   if(!aid&&!bid)return;
   const fallingDebris=phy.debrisColliders.has(c.collider1())||phy.debrisColliders.has(c.collider2());
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
   if(fallingDebris&&!other){
     if(r.age-(who.lastDebrisHitAt??-99)>.55){who.lastDebrisHitAt=r.age;
       who.spinEnergy=Math.max(0,who.spinEnergy-1.6);
       callbacks.event(r,'debris_hit',`${who.name} 撞上墜落碎片！`,who.id,140,{x:who.x,y:who.y});
     }
   }else if(other){
     // Arcade amplification on top of *real* rigid body contact impulse.
     const charged=(a.chargeUntil>r.age||b.chargeUntil>r.age);
     const bladeFactor=clamp(((topBy[a.top].blade?.reach||.39)+(topBy[b.top].blade?.reach||.39))/.78,.8,1.25);
     let extra=clamp((rel*.32+(charged?2.4:0)+impulse*.000055)*bladeFactor,1.1,6.2);
     // Counter rewards reading a charge, not button spamming.
     let parrier=null,attacker=null;
     if(a.counterUntil>r.age&&b.chargeUntil>r.age){parrier=a;attacker=b;}
     else if(b.counterUntil>r.age&&a.chargeUntil>r.age){parrier=b;attacker=a;}
     if(parrier){
       burst(r,attacker,parrier,extra+3,clamp(rel*.12,.1,1.2));
       burst(r,parrier,attacker,.6,.10);
       attacker.spinEnergy=Math.max(0,attacker.spinEnergy-2.8);
       parrier.counterUntil=0;parrier.counterCount++;
       callbacks.event(r,'counter_success',`${parrier.name} · 完美反擊！`,parrier.id,260,{x:parrier.x,y:parrier.y});
     }else{
       const precision=charged&&rel>5.2&&length(a.x-b.x,a.y-b.y)<3.5*U;
       if(precision){extra=Math.min(7.2,extra+1.0);(a.chargeUntil>r.age?a:b).precisionCount++;}
       burst(r,a,b,extra,clamp(rel*.13+(charged?1.0:0),.12,2.6));
       burst(r,b,a,extra,clamp(rel*.13+(charged?1.0:0),.12,2.6));
       if(precision)callbacks.event(r,'precision',`精準重擊！`,(a.chargeUntil>r.age?a:b).id,Math.round(rel*40),{x:(a.x+b.x)/2,y:(a.y+b.y)/2});
     }
     // Off-axis opposing impulses add visible tipping/gyro reaction (not health damage).
     const sa=topBy[a.top].blade,sb=topBy[b.top].blade;
     const tangent=norm(b.body.translation().x-a.body.translation().x,b.body.translation().z-a.body.translation().z);
     const torque=clamp(rel*.065,.10,.70);
     a.body.applyTorqueImpulse(V(tangent[1]*torque*a.body.mass(),0,-tangent[0]*torque*a.body.mass()),true);
     b.body.applyTorqueImpulse(V(-tangent[1]*torque*b.body.mass(),0,tangent[0]*torque*b.body.mass()),true);
     a.lastHit=b.name;b.lastHit=a.name;a.lastHitAt=b.lastHitAt=r.age;a.lastHitSpeed=b.lastHitSpeed=rel;
     const loss=clamp(rel*.20+(charged?3.0:0)+impulse*.0002,.6,9.0);
     a.spinEnergy=Math.max(0,a.spinEnergy-loss*stats(a).drain);
     b.spinEnergy=Math.max(0,b.spinEnergy-loss*stats(b).drain);
     callbacks.event(r,'hit',`${a.name} ⚡ ${b.name} · 3D 重擊！`,a.id,Math.round(rel*40),{x:(a.x+b.x)/2,y:(a.y+b.y)/2,critical:charged,force:Math.round(impulse)});
   }else{
     who.impact=.35;
     const guard=phy.guardColliders.has(c.collider1())||phy.guardColliders.has(c.collider2());
     const laneWall=phy.railColliders.has(c.collider1())||phy.railColliders.has(c.collider2());
     if((guard||laneWall)&&r.age-(who.lastGuardAt??-99)>.11){
       who.lastGuardAt=r.age;
       const wp=who.body.translation(),wv=who.body.linvel(),rad=Math.max(.01,length(wp.x,wp.z));
       const nx=wp.x/rad,nz=wp.z/rad,outward=wv.x*nx+wv.z*nz;
       // Enforce an inward *wall rebound* only at a real guard contact.
       // Never boost tops outward or add upward energy at a barrier.
       if(outward>0.6)who.body.applyImpulse(V(-nx*(outward*1.55)*who.body.mass(),0,-nz*(outward*1.55)*who.body.mass()),true);
       if(wv.y>1.65)who.body.setLinvel(V(wv.x,1.65,wv.z),true);
     }
     if(rel>2.7)callbacks.event(r,'wall','3D 護欄強力反彈！',who.id,Math.round(rel*40),{x:who.x,y:who.y});
   }
  });
  phy.queue.drainCollisionEvents(()=>{});
  for(let i=phy.debris.length-1;i>=0;i--){const d=phy.debris[i];
    if(r.age>=d.expires||d.body.translation().y<-.9){
      phy.debrisColliders.delete(d.collider.handle);
      phy.world.removeRigidBody(d.body);phy.debris.splice(i,1);
    }
  }
  // Anti-vault safety: a normal bumper contact must not turn top spin into a
  // vertical catapult. Only act in the protected rim, leaving real N/S exit
  // pockets and the E/W return lanes untouched. Center-field aerial KOs stay.
  for(const p of r.fighters){if(!p.alive)continue;
   const b=p.body,pos=b.translation(),dist=length(pos.x,pos.z),sine=dist>0?Math.abs(pos.z/dist):0;
   const protectedWall=dist>4.35&&dist<6.55&&sine>=.20&&sine<=Math.cos(EXIT_HALF_ANGLE);
   if(protectedWall){
      const vel=b.linvel();
      if(pos.y>.72&&vel.y>.55)b.setLinvel(V(vel.x,.55,vel.z),true);
      if(dist>5.96){ // emergency guard containment only if the rigid-body solver leaked through a segment
         const nx=pos.x/dist,nz=pos.z/dist,outward=vel.x*nx+vel.z*nz;
         b.setTranslation(V(nx*5.48,Math.min(pos.y,1.72),nz*5.48),true);
         b.setLinvel(V(vel.x-nx*Math.max(0,outward)*1.6,Math.min(vel.y,.4),vel.z-nz*Math.max(0,outward)*1.6),true);
      }
   }
   spinStop(r,p);if(!p.alive)continue;enterLane(r,p);
   if(p.railTimer>0)p.railTimer=Math.max(0,p.railTimer-TICK);
   p.railCooldown=Math.max(0,p.railCooldown-TICK);
   if(p.impact>0)p.impact=Math.max(0,p.impact-TICK);
   // Only a genuinely strong opponent impact can finish via the N/S gates.
   // The previous >5.9 radius test eliminated tops *inside* the exit mouth.
   const nowPos=p.body.translation(),v=p.body.linvel(),sign=nowPos.z>=0?1:-1;
   if(Math.abs(nowPos.z)>EXIT_CONFIRM_Z && Math.abs(nowPos.x)<1.25){
     const outward=v.z*sign;
     if(gateImpact(r,p)&&outward>EXIT_MIN_OUTWARD_SPEED){
       callbacks.ko(r,p,'擊出場外');
     }else if(!gateImpact(r,p)){
       // Returning from a missed shot is a controlled impact, not teleportation.
       // Keep the rigid body in the lane and reflect only excessive outward speed.
       if(outward>0.0){
         p.body.setLinvel(V(v.x*.85,Math.min(v.y,1.1),-sign*Math.max(3.2,outward*.46)),true);
         if(r.age-(p.lastExitSaveAt??-100)>.8){
           p.lastExitSaveAt=r.age;
           callbacks.event(r,'rail',`${p.name} · 安全回場反彈！`,p.id,Math.round(outward*40),{x:p.x,y:p.y});
         }
       }
     }
   }
  }
 }
 function tick(r,dt){if(r.status!=='playing')return;r.age+=dt;
  updateAnomaly(r);
  for(const p of r.fighters){if(!p.alive)continue;
   p.cool=Math.max(0,p.cool-dt);p.chargeCd=Math.max(0,p.chargeCd-dt);p.counterCd=Math.max(0,p.counterCd-dt);
   if(p.bot){p.aiTimer-=dt;if(p.aiTimer<=0){p.aiTimer=.4+Math.random()*.6;p.input.targetId=target(r,p)?.id||null;
      if(r.age>2.6&&Math.random()<.56)charge(r,p,p.input.targetId);if(r.age>2.0&&Math.random()<.22)skill(r,p);if(r.age>3&&Math.random()<.09)counter(r,p);}}
  }
  for(let i=0;i<3&&r.status==='playing';i++)physicsStep(r);
  if(r.status!=='playing')return;
  if(r.age>=90){const alive=r.fighters.filter(p=>p.alive).sort((a,b)=>b.spin-a.spin||a.wobble-b.wobble);for(const p of alive.slice(1)){p.alive=false;p.koReason='時間到：轉速判定';}callbacks.finish(r);return;}
  if(r.fighters.filter(p=>p.alive).length<=1)callbacks.finish(r);
 }
 function snapshot(r){return {t:'tick',physics:'rapier3d',time:+r.age.toFixed(1),radius:Math.round(RING*U),arena:r.arena,
   geometry:{pillars:(PLACES[r.arena]||PLACES.colosseum).map(([x,z,rad])=>({x:x*U,y:z*U,r:rad*U})),lanes:true,exitAngles:[Math.PI/2,-Math.PI/2]},
   chaos:r.chaos!==false,anomaly:anomalyInfo(r),hazards:(r.physics?.debris||[]).map(d=>{
     const p=d.body.translation();return {id:d.id,x:+p.x.toFixed(2),y:+p.y.toFixed(2),z:+p.z.toFixed(2),r:d.r};
   }),
   fighters:r.fighters.map(p=>{if(p.alive)sync(p);return {id:p.id,name:p.name,top:p.top,build:p.build,bot:p.bot,
    x:+p.x.toFixed(1),y:+p.y.toFixed(1),h:+(p.h||0).toFixed(1),q:p.q,vx:Math.round(p.vx),vy:Math.round(p.vy),
    spin:Math.round(p.spin),wobble:Math.round(p.wobble),alive:p.alive,reason:p.koReason||'',rail:p.railTimer>0,
    cool:+p.cool.toFixed(1),chargeCd:+p.chargeCd.toFixed(1),counterCd:+p.counterCd.toFixed(1),countering:p.counterUntil>r.age,charging:p.chargeUntil>r.age,shield:p.fortressUntil>r.age,
    phase:p.phaseUntil>r.age,boost:p.boostUntil>r.age,blade:p.bladeUntil>r.age,impact:p.impact>0,skillCount:p.skillCount,
    rpm:Math.round((p.physicalSpin||p.spin)*p.initialSpin/100*60/(Math.PI*2)),launch:p.launch};})};
 }
 function free(r){if(r.physics?.world)r.physics.world.free();r.physics=null;}
 return {create,tick,charge,counter,skill,snapshot,free,stats};
}
async function init(){if(!initialized){await R.init();initialized=true;}return R;}
module.exports={init,makeEngine};

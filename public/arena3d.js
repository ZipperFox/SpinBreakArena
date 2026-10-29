import * as THREE from './vendor/three.module.js';
// Actual WebGL 3D: dynamic rigid-body poses are broadcast from the authoritative Rapier server.
const stage=document.getElementById('stage');
const wrapper=document.getElementById('stageFrame');
const surface=document.createElement('canvas');
surface.id='stage3d';surface.setAttribute('aria-label','Three-dimensional spinning top arena');
wrapper.prepend(surface);
let renderer;
try { renderer=new THREE.WebGLRenderer({canvas:surface,alpha:false,antialias:true,powerPreference:'high-performance'}); }
catch(e){console.warn('[SpinBreak 3D] WebGL unsupported, displaying fallback renderer',e);surface.remove();throw e;}
const mobile=matchMedia('(max-width: 720px)').matches;
renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.4:1.9));
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;
renderer.shadowMap.enabled=!mobile;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#070e1e');scene.fog=new THREE.FogExp2('#070e1e',.025);
const cam=new THREE.PerspectiveCamera(mobile?58:47,1,.05,110);
cam.position.set(0,9.5,13.5);cam.lookAt(0,.3,0);
scene.add(new THREE.HemisphereLight('#b6e9ff','#1d1839',2.2));
const sun=new THREE.DirectionalLight('#fff2d6',4.2);sun.position.set(-4,9,5);sun.castShadow=!mobile;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-9;sun.shadow.camera.right=9;sun.shadow.camera.top=9;sun.shadow.camera.bottom=-9;sun.shadow.bias=-.0002;scene.add(sun);
const rimA=new THREE.PointLight('#42d9ff',80,25,2);rimA.position.set(7,3,-4);scene.add(rimA);
const rimB=new THREE.PointLight('#ff605d',60,22,2);rimB.position.set(-7,3,5);scene.add(rimB);
const mat=(color,metalness=.4,roughness=.35,emissive=null,emissiveIntensity=0)=>new THREE.MeshStandardMaterial({color,metalness,roughness,emissive:emissive||color,emissiveIntensity});
function mesh(geometry,material,parent=scene){const m=new THREE.Mesh(geometry,material);parent.add(m);return m;}
const palette={colosseum:['#142943','#ff9955','#54e9fa'],vortex:['#101d49','#6395ff','#ca9dff'],tempest:['#0b2c44','#6ef4ff','#e4eaaa'],volcano:['#452134','#ff6b3b','#ffdd83'],eclipse:['#241b45','#d785ff','#90baff']};
const battleground=new THREE.Group();scene.add(battleground);
let stageName='';
function ringTube(radius,start,end,y,color,tube=.06,parent=battleground){const pts=[];for(let i=0;i<=Math.max(4,Math.round((end-start)*radius*3));i++){const a=start+(end-start)*i/Math.max(4,Math.round((end-start)*radius*3));pts.push(new THREE.Vector3(Math.cos(a)*radius,y,Math.sin(a)*radius));}const path=new THREE.CatmullRomCurve3(pts);return mesh(new THREE.TubeGeometry(path,pts.length*2,tube,6,false),mat(color,.75,.24,color,.2),parent);}
function createStage(name){battleground.clear();stageName=name;
 const [base,hot,cyan]=palette[name]||palette.colosseum;
 const pedestal=mesh(new THREE.CylinderGeometry(6.2,6.43,.58,96),mat('#0f1c2f',.68,.36),battleground);pedestal.position.y=-.42;pedestal.receiveShadow=true;
 const plate=mesh(new THREE.CylinderGeometry(5.89,6.05,.16,96),mat(base,.53,.42),battleground);plate.position.y=-.055;plate.receiveShadow=true;
 for(let r=1.0;r<5.8;r+=1.0)ringTube(r,0,Math.PI*2,.035,cyan,r>4.4?.015:.01);
 ringTube(5.85,0,Math.PI*2,-.06,hot,.14);
 // Physical guard segments match fixed Rapier collider positions / dangerous gates.
 const guardMat=new THREE.MeshStandardMaterial({color:'#82d7e5',metalness:.56,roughness:.22,transparent:true,opacity:.56,side:THREE.DoubleSide});
 const guardGeo=new THREE.CylinderGeometry(.225,.225,3.36,9);
 const wall=new THREE.InstancedMesh(guardGeo,guardMat,104);let count=0;
 const dummy=new THREE.Object3D();
 for(let i=0;i<104;i++){
  const a=(i+.5)*Math.PI*2/104;
  const danger=Math.abs(Math.cos(a))<Math.sin(.185);
  const portal=Math.abs(Math.sin(a))<.19;
  if(danger||portal)continue;
  dummy.position.set(Math.cos(a)*5.75,1.50,Math.sin(a)*5.75);dummy.updateMatrix();wall.setMatrixAt(count++,dummy.matrix);
 }
 wall.count=count;wall.instanceMatrix.needsUpdate=true;battleground.add(wall);
 // Upper guard trim makes the true 3D wall height visible to players.
 ringTube(5.75,.22,Math.PI/2-.185,3.19,cyan,.045);ringTube(5.75,Math.PI/2+.185,Math.PI-.22,3.19,cyan,.045);
 ringTube(5.75,Math.PI+.22,Math.PI*1.5-.185,3.19,cyan,.045);ringTube(5.75,Math.PI*1.5+.185,Math.PI*2-.22,3.19,cyan,.045);
 const laneMat=new THREE.MeshStandardMaterial({color:'#3cb9d9',metalness:.60,roughness:.28,transparent:true,opacity:.42,side:THREE.DoubleSide});
 const laneGeo=new THREE.CylinderGeometry(.245,.245,2.80,8);
 const laneWall=new THREE.InstancedMesh(laneGeo,laneMat,44);let laneCount=0;
 for(const side of [-1,1]){
   ringTube(6.84,(side===1?0:Math.PI)-.45,(side===1?0:Math.PI)+.45,2.67,'#4dedff',.055);
   for(let i=0;i<22;i++){const a=(side===1?0:Math.PI)+(i-10.5)*.043;
     dummy.position.set(6.84*Math.cos(a),1.27,6.84*Math.sin(a));dummy.updateMatrix();laneWall.setMatrixAt(laneCount++,dummy.matrix);
   }
 }
 laneWall.count=laneCount;laneWall.instanceMatrix.needsUpdate=true;battleground.add(laneWall);
 for(const sign of [-1,1]){const danger=mesh(new THREE.BoxGeometry(1.95,.07,.14),mat('#f35f44',.35,.25,'#ff4f25',1.3),battleground);danger.position.set(0,.12,sign*5.78);}
 const placements={colosseum:[[0,-3.2,.42],[0,3.2,.42]],vortex:[[-2.8,-2.35,.42],[2.8,2.35,.42],[-2.8,2.35,.38],[2.8,-2.35,.38]],tempest:[[0,-3.35,.46],[0,3.35,.46]],volcano:[[-2.9,-2.65,.50],[2.9,2.65,.50]],eclipse:[[-2.5,0,.44],[2.5,0,.44]]};
 for(const [x,z,r] of (placements[name]||placements.colosseum)){
   const core=mesh(new THREE.CylinderGeometry(r,r,.7,20),mat('#293c53',.74,.33),battleground);core.position.set(x,.35,z);core.castShadow=!mobile;
   const trim=mesh(new THREE.TorusGeometry(r,.052,7,36),mat(hot,.73,.29,hot,.65),battleground);trim.rotation.x=Math.PI/2;trim.position.set(x,.7,z);
 }
 for(let i=0;i<48;i++){const a=i*Math.PI*2/48;const stud=mesh(new THREE.BoxGeometry(.22,.08,.5),mat('#24435e',.72,.3,cyan,.15),battleground);stud.position.set(Math.cos(a)*6.22,-.19,Math.sin(a)*6.22);stud.rotation.y=-a;}
 const middle=mesh(new THREE.CylinderGeometry(1.16,1.16,.015,40),new THREE.MeshBasicMaterial({color:hot,transparent:true,opacity:.06}),battleground);middle.position.y=.029;
}
const models=new Map(),effects=[];
// V9.3 visual-only redesign: game-scale layered mechanical spinning tops.
// Keep every mesh inside the original ~0.5 m collision footprint; Rapier remains authoritative.
function buildTop(top,parts={}){
 const main=parts.paint||top.color||'#ff7355', accent=top.accent||'#ffe8ab';
 const root=new THREE.Group();root.userData.fighterId=null;
 const bladePart=new THREE.Group(),ratchetPart=new THREE.Group(),bitPart=new THREE.Group();
 root.add(bladePart,ratchetPart,bitPart);
 root.userData.assemblies={bladePart,ratchetPart,bitPart};
 const form=top.blade||{lobes:5,reach:.40,tip:.12,shape:'wave'};
 const count=Math.max(2,form.lobes||5),shape=form.shape||'wave';
 const armor=mat('#253041',.83,.27),dark=mat('#0f1827',.68,.38);
 const steel=mat('#b9c5d1',.86,.25),bright=mat('#edf4ff',.78,.22);
 const color=mat(main,.57,.29,main,.12),line=mat(accent,.67,.24,accent,.22);
 const clear=mat(main,.42,.16,main,.47);
 const make=(geo,m,parent,x=0,y=0,z=0)=>{const obj=mesh(geo,m,parent);obj.position.set(x,y,z);obj.castShadow=!mobile;return obj;};
 const cyl=(a,b,h,m,parent,y,segs=48)=>make(new THREE.CylinderGeometry(a,b,h,segs),m,parent,0,y);
 const tor=(r,t,y,m,parent=bladePart)=>{const o=make(new THREE.TorusGeometry(r,t,8,48),m,parent,0,y);o.rotation.x=Math.PI/2;return o;};
 // The blade is a thick mechanical rotor, not an almost flat coin.
 cyl(.350,.343,.15,armor,bladePart,.015);
 cyl(.298,.327,.055,color,bladePart,.106);
 tor(.331,.032,.105,steel);
 tor(.255,.020,.143,line);
 const amp=shape==='shield'?.053:shape==='hammer'?.092:shape==='axe'?.112:shape==='swept'?.086:shape==='talon'?.099:.069;
 const steps=Math.max(80,count*16),profile=[];
 for(let i=0;i<steps;i++){
  const a=i*Math.PI*2/steps,phase=(a*count/(Math.PI*2))%1;
  let pulse;
  switch(shape){
   case 'shield': pulse=.45+.45*Math.pow(Math.max(0,Math.cos(phase*Math.PI*2)),2);break;
   case 'hammer': pulse=phase<.44?.94:Math.max(.10,.94-(phase-.44)*1.55);break;
   case 'axe': pulse=phase<.22?.42+phase*2.6:Math.max(.07,1-(phase-.22)*1.24);break;
   case 'swept': pulse=Math.pow(1-phase,.58);break;
   case 'talon': pulse=phase<.78?(.18+phase*1.04):Math.max(.10,1-(phase-.78)*4.1);break;
   default: pulse=.48+.47*Math.sin(phase*Math.PI);break;
  }
  const r=.365+amp*pulse;
  profile.push([Math.cos(a)*r,Math.sin(a)*r]);
 }
 const rotorShape=new THREE.Shape();profile.forEach(([x,z],i)=>i?rotorShape.lineTo(x,z):rotorShape.moveTo(x,z));rotorShape.closePath();
 const rotorGeo=new THREE.ExtrudeGeometry(rotorShape,{depth:.115,steps:1,bevelEnabled:true,bevelThickness:.014,bevelSize:.012,bevelSegments:1,curveSegments:3});
 // An extruded XY shape rotates to the world's horizontal XZ plane.
 const rotor=make(rotorGeo,[color,steel],bladePart,0,-.012,0);rotor.rotation.x=-Math.PI/2;
 const innerGear=cyl(.247,.254,.032,dark,bladePart,.158);
 tor(.247,.015,.180,steel);
 // Three-dimensional wedge armor on the upper rotor; shape and lobe count vary by blade.
 for(let i=0;i<count;i++){
  const a=(i+.5)*Math.PI*2/count, sector=Math.min(.39,Math.PI/count*.67);
  const inner=.283,outer=shape==='shield'?.399:.425;
  const plate=new THREE.Shape();
  for(let j=0;j<=5;j++){
   const ang=a-sector+(sector*2*j/5);
   const r=inner+(outer-inner)*(j/5);
   j?plate.lineTo(Math.cos(ang)*r,Math.sin(ang)*r):plate.moveTo(Math.cos(ang)*r,Math.sin(ang)*r);
  }
  for(let j=5;j>=0;j--){const ang=a-sector+sector*2*j/5;const r=inner+(outer-inner)*.13;plate.lineTo(Math.cos(ang)*r,Math.sin(ang)*r);}
  plate.closePath();
  const plateGeo=new THREE.ExtrudeGeometry(plate,{depth:.029,bevelEnabled:true,bevelSize:.007,bevelThickness:.008,bevelSegments:1,steps:1});
  const m=make(plateGeo,i%3===0?line:i%2?steel:color,bladePart,0,.145+(i%3===0?.012:0),0);
  m.rotation.x=-Math.PI/2;
  const bolt=make(new THREE.CylinderGeometry(.017,.017,.010,8),i%2?bright:dark,bladePart,Math.cos(a)*.295,.194,Math.sin(a)*.295);
 }
 // Raised center cap / locking assembly: clearly a spinning top from any camera angle.
 cyl(.203,.215,.052,steel,bladePart,.189);
 cyl(.173,.177,.035,dark,bladePart,.228);
 tor(.178,.015,.250,line);
 const emblem=cyl(.128,.130,.030,color,bladePart,.260,24);
 const symbol=make(new THREE.OctahedronGeometry(.088,0),bright,bladePart,0,.288,0);symbol.scale.y=.28;
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2+.45;
  make(new THREE.BoxGeometry(.035,.018,.075),line,bladePart,Math.cos(a)*.146,.265,Math.sin(a)*.146).rotation.y=-a;
 }
 // Ratchet looks like a second removable gear, with an obvious steel waist.
 const ratchet=parts.ratchet||'wide7';
 const gears={low3:3,heavy5:5,wide7:7,tall4:4,dense9:9,swift2:2};
 const gear=gears[ratchet]||7,heavy=ratchet==='heavy5'||ratchet==='dense9';
 const width=heavy?.270:ratchet==='swift2'?.225:.246;
 cyl(width,width*.93,.115,armor,ratchetPart,-.148,32);
 cyl(.180,.171,.061,steel,ratchetPart,-.217,32);
 const ratMat=heavy?steel:color;
 for(let j=0;j<gear;j++){
  const a=2*Math.PI*j/gear;
  const t=make(new THREE.BoxGeometry(heavy?.091:.072,.100,heavy?.097:.066),j%2?ratMat:steel,ratchetPart,
   Math.cos(a)*(width-.016),-.154,Math.sin(a)*(width-.016));t.rotation.y=-a;
 }
 const ratMark=make(new THREE.TorusGeometry(.190,.014,6,36),line,ratchetPart,0,-.085,0);ratMark.rotation.x=Math.PI/2;
 // The bit is a real distinct interchangeable shaft/tip, not a tiny glowing ball.
 const bit=parts.bit||'taper';
 const rubber=mat('#17212d',.1,.86),bitMat=bit==='rubber'?rubber:color;
 cyl(.134,.119,.080,steel,bitPart,-.264,32);
 cyl(.110,.101,.055,dark,bitPart,-.306,32);
 const cone=(rt,rb,h,y,m,seg=28)=>cyl(rt,rb,h,m,bitPart,y,seg);
 if(bit==='flat'){
  cone(.103,.124,.079,-.353,bitMat);cone(.123,.123,.018,-.393,rubber);
 }else if(bit==='rush'){
  cone(.112,.090,.088,-.355,bitMat);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;const t=make(new THREE.BoxGeometry(.029,.040,.039),steel,bitPart,Math.cos(a)*.112,-.363,Math.sin(a)*.112);t.rotation.y=-a;}
  cone(.092,.091,.018,-.402,steel);
 }else if(bit==='ball'){
  cone(.107,.092,.049,-.343,bitMat);
  make(new THREE.SphereGeometry(.089,18,12),steel,bitPart,0,-.352,0);
 }else if(bit==='needle'){
  cone(.104,.053,.073,-.345,bitMat);
  cone(.056,.009,.096,-.386,steel);
 }else if(bit==='orbit'){
  cone(.105,.092,.066,-.343,bitMat);
  const collar=make(new THREE.TorusGeometry(.093,.022,6,24),steel,bitPart,0,-.368,0);collar.rotation.x=Math.PI/2;
  make(new THREE.SphereGeometry(.072,16,12),line,bitPart,0,-.372,0);
 }else if(bit==='gear'){
  cone(.117,.087,.088,-.352,bitMat);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;const t=make(new THREE.BoxGeometry(.027,.053,.030),steel,bitPart,Math.cos(a)*.105,-.362,Math.sin(a)*.105);t.rotation.y=-a;}
  cone(.079,.055,.039,-.411,steel);
 }else if(bit==='rubber'){
  cone(.115,.131,.094,-.358,rubber);
  cone(.129,.129,.027,-.402,bitMat);
 }else{
  // Taper: clearly conical pivot with a small spherical contact foot.
  cone(.114,.047,.124,-.359,bitMat);
  make(new THREE.SphereGeometry(.031,12,8),steel,bitPart,0,-.417,0);
 }
 return root;
}
// Garage preview uses the same procedural artwork as battle; Rapier colliders remain simplified for performance.
const garageCanvas=document.getElementById('garage3d');
let garageRenderer=null,garagePreview=null,garageKey='';const garageScene=new THREE.Scene();
garageScene.background=new THREE.Color('#091321');
const garageCamera=new THREE.PerspectiveCamera(35,1,.1,30);garageCamera.position.set(1.76,1.40,2.46);garageCamera.lookAt(0,0,0);
garageScene.add(new THREE.HemisphereLight('#d8f3ff','#1b263a',2.6));
const glight=new THREE.DirectionalLight('#ffcc9c',5);glight.position.set(-2,5,4);garageScene.add(glight);
function updateGarage(state){
 const top=state.tops?.find(t=>t.id===state.selected);
 if(!top||!garageCanvas)return;
 const key=[top.id,state.build?.ratchet,state.build?.bit,state.build?.paint].join('|');
 if(key!==garageKey){
  if(garagePreview){garageScene.remove(garagePreview);garagePreview.traverse(m=>{if(m.isMesh)m.geometry.dispose();});}
  garagePreview=buildTop(top,state.build||{});garageScene.add(garagePreview);garageKey=key;
  const {bladePart,ratchetPart,bitPart}=garagePreview.userData.assemblies;
  bladePart.position.y=.36;ratchetPart.position.y=-.07;bitPart.position.y=-.45;
 }
 if(!garageRenderer){try{garageRenderer=new THREE.WebGLRenderer({canvas:garageCanvas,antialias:!mobile,powerPreference:'low-power'});garageRenderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.0:1.25));garageRenderer.outputColorSpace=THREE.SRGBColorSpace;}catch(e){console.warn('Garage preview unavailable',e);return;}}
 const rc=garageCanvas.getBoundingClientRect(),w=Math.max(2,Math.round(rc.width)),h=Math.max(2,Math.round(rc.height));
 if(garageRenderer.domElement.width!==w||garageRenderer.domElement.height!==h){garageRenderer.setSize(w,h,false);garageCamera.aspect=w/h;garageCamera.updateProjectionMatrix();}
 garagePreview.rotation.y+=.018;garageRenderer.render(garageScene,garageCamera);
}
function spawnFx(x,y,z,color,power){const count=Math.min(44,10+Math.round(power/7));const material=new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false});
 for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=2+Math.random()*7;const m=mesh(new THREE.OctahedronGeometry(.045+Math.random()*.055),material.clone());m.position.set(x,y,z);effects.push({m,v:new THREE.Vector3(Math.cos(a)*s,Math.random()*3.9,Math.sin(a)*s),life:.2+Math.random()*.45,max:.65});}
}
let cameraYaw=.1,camPitch=.8,zoom=15,shake=0,freeze=0,oldFrame=performance.now(),lastGarageFrame=0,lastArena='',time=0,baseline=null;
const source=()=>window.SPINBREAK_3D_BRIDGE?.getState?.()||{};
window.addEventListener('spinbreak-impact',e=>{
 const ev=e.detail;if(!ev)return;
 if(ev.kind==='hit'||ev.kind==='wall'||ev.kind==='charge'||ev.kind==='skill'||ev.kind==='ko'){
  const st=source();const fighter=st.latest?.fighters?.find(p=>p.id===ev.id);
  const x=Number.isFinite(ev.x)?ev.x/40:(fighter?.x||0)/40,z=Number.isFinite(ev.y)?ev.y/40:(fighter?.y||0)/40;
  const top=st.tops?.find(t=>t.id===fighter?.top);
  const strength=ev.kind==='hit'?ev.amount||120:ev.kind==='charge'?130:80;
  spawnFx(x,.5,z,top?.accent||'#ffd392',strength);
  shake=Math.max(shake,Math.min(.72,(strength/280)*.52));
  if(ev.kind==='hit'&&strength>155){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.25,.044,8,44),new THREE.MeshBasicMaterial({color:'#fff5c1',transparent:true,opacity:.87,depthWrite:false}));
    ring.rotation.x=Math.PI/2;ring.position.set(x,.5,z);scene.add(ring);
    effects.push({m:ring,v:new THREE.Vector3(),life:.32,max:.32,ring:true});
    freeze=Math.max(freeze,.095);
  }
 }
});
const projector=new THREE.Raycaster(),mouse=new THREE.Vector2();let pointerStart=null;
surface.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY,yaw:cameraYaw,pitch:camPitch};surface.setPointerCapture(e.pointerId);});
surface.addEventListener('pointermove',e=>{if(!pointerStart)return;const dx=e.clientX-pointerStart.x,dy=e.clientY-pointerStart.y;if(Math.abs(dx)+Math.abs(dy)<8)return;cameraYaw=pointerStart.yaw-dx*.005;camPitch=THREE.MathUtils.clamp(pointerStart.pitch+dy*.004,.46,1.25);});
surface.addEventListener('pointerup',e=>{if(!pointerStart)return;const moved=Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y);pointerStart=null;if(moved>13)return;
 const rect=surface.getBoundingClientRect();mouse.x=((e.clientX-rect.left)/rect.width)*2-1;mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
 projector.setFromCamera(mouse,cam);const meshes=[];for(const [id,obj] of models)if(id!==source().ownId)obj.group.traverse(m=>{if(m.isMesh)meshes.push(m)});
 const first=projector.intersectObjects(meshes,false)[0];if(!first)return;let obj=first.object;while(obj&&!obj.userData.fighterId)obj=obj.parent;
 if(obj?.userData.fighterId)window.SPINBREAK_3D_BRIDGE?.setTarget(obj.userData.fighterId);
});
// V10 synchronized anomaly displays; all physics comes from authoritative snapshots.
const anomalyOverlay=new THREE.Group();scene.add(anomalyOverlay);
let anomalyKind='',anomalyPhase='';
const debrisMeshes=new Map();
function anomalyMesh(g,m,x=0,y=.08,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);anomalyOverlay.add(o);return o;}
function rebuildAnomaly(a){
 for(const o of [...anomalyOverlay.children]){anomalyOverlay.remove(o);o.geometry?.dispose();o.material?.dispose();}
 anomalyKind=a?.kind||'';anomalyPhase=a?.phase||'';
 if(!anomalyKind||anomalyPhase==='idle')return;
 const warn=a.phase==='warning';
 const c={blackhole:0xbd72ff,meteor:0xff6644,cyclone:0x5cf4df,magnet:0x62aaff,shockwave:0xffce73}[a.kind]||0xffffff;
 const mat=new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:warn?.40:.72,depthWrite:false,side:THREE.DoubleSide});
 const ring=anomalyMesh(new THREE.TorusGeometry(a.kind==='blackhole'?2.4:2.0,.06,8,96),mat.clone(),a.x,.08,a.z);
 ring.rotation.x=Math.PI/2;ring.userData.main=true;
 if(a.kind==='blackhole'){
   const core=anomalyMesh(new THREE.SphereGeometry(.29,20,12),new THREE.MeshBasicMaterial({color:0x100c28}),a.x,.39,a.z);core.userData.core=true;
   const disc=anomalyMesh(new THREE.TorusGeometry(.48,.065,8,42),mat.clone(),a.x,.31,a.z);disc.rotation.x=Math.PI/2;disc.userData.disc=true;
 }else if(a.kind==='magnet'){
   for(let i=0;i<2;i++){const orb=anomalyMesh(new THREE.SphereGeometry(.17,10,9),mat.clone(),a.x+(i?1.35:-1.35),.35,a.z);orb.userData.orb=true;}
 }else if(a.kind==='shockwave')ring.userData.wave=true;
}
function updateAnomaly3D(s,dt){
 const a=s?.anomaly||{};
 if((a.kind||'')!==anomalyKind||(a.phase||'')!==anomalyPhase)rebuildAnomaly(a);
 const tick=s?.time||0;
 for(const o of anomalyOverlay.children){
   if(o.userData.main){o.scale.setScalar(1+Math.sin(tick*5)*.06);
     if(o.userData.wave&&a.phase==='active'){const progress=1-Math.max(0,a.until-tick)/3.6;o.scale.setScalar(.35+progress*1.5);}}
   if(o.userData.disc)o.rotation.z+=dt*2.8;
 }
 const hazards=new Set();
 for(const h of s?.hazards||[]){hazards.add(h.id);let mesh=debrisMeshes.get(h.id);
   if(!mesh){mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(h.r,1),new THREE.MeshStandardMaterial({color:0xf69b57,metalness:.65,roughness:.45,emissive:0x59210d,emissiveIntensity:.42}));scene.add(mesh);debrisMeshes.set(h.id,mesh);}
   mesh.visible=true;mesh.position.set(h.x,h.y,h.z);mesh.rotation.set(tick*2.5,h.id+tick*2,tick*1.2);
 }
 for(const [id,m] of debrisMeshes)if(!hazards.has(id)){scene.remove(m);m.geometry.dispose();m.material.dispose();debrisMeshes.delete(id);}
 // Dangerous impact zones are marked before meteorite spawn.
 if(a.kind==='meteor'&&a.phase==='warning'&&Array.isArray(a.spawns)){
   if(anomalyOverlay.children.filter(o=>o.userData.telegraph).length===0){
     for(const pos of a.spawns){const ring=anomalyMesh(new THREE.RingGeometry(.19,.30,24),new THREE.MeshBasicMaterial({color:0xff6447,transparent:true,opacity:.78,side:THREE.DoubleSide,depthWrite:false}),pos.x,.085,pos.z);ring.rotation.x=-Math.PI/2;ring.userData.telegraph=true;}
   }
 }
}
const targetIndicator=new THREE.Group();scene.add(targetIndicator);
const circle=mesh(new THREE.TorusGeometry(.66,.018,6,42),new THREE.MeshBasicMaterial({color:'#ffdf86',transparent:true,opacity:.9,depthTest:false}),targetIndicator);circle.rotation.x=Math.PI/2;
const marker=mesh(new THREE.ConeGeometry(.12,.25,4),new THREE.MeshBasicMaterial({color:'#ffe8a7',depthTest:false}),targetIndicator);marker.position.y=.65;marker.rotation.z=Math.PI;
function loop(t){requestAnimationFrame(loop);const dt=Math.min(.05,Math.max(.001,(t-oldFrame)/1000));oldFrame=t;time+=dt;
 const state=source(),s=state.latest;const name=state.room?.arena||'colosseum';if(name!==stageName)createStage(name);
 const rect=wrapper.getBoundingClientRect(),w=Math.max(2,Math.floor(rect.width)),h=Math.max(2,Math.floor(rect.height));if(w!==baseline?.w||h!==baseline?.h){renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();baseline={w,h};}
 updateAnomaly3D(s,dt);
 const active=new Set();const fighters=s?.fighters||[];
 for(const p of fighters){active.add(p.id);let obj=models.get(p.id);const top=state.tops?.find(t=>t.id===p.top);
   if(!obj){if(!top)continue;const group=buildTop(top,p.build);group.userData.fighterId=p.id;scene.add(group);obj={group,targetP:new THREE.Vector3(),targetQ:new THREE.Quaternion(),lastX:0,lastZ:0};models.set(p.id,obj);}
   obj.group.visible=p.alive||s?.time<5;
   obj.targetP.set((p.x||0)/40,(p.h||0)/40,(p.y||0)/40);
   if(Array.isArray(p.q)){
      const q=new THREE.Quaternion(...p.q).normalize();
      const axis=Array.isArray(p.axis)?new THREE.Vector3(...p.axis).normalize():new THREE.Vector3(0,1,0).applyQuaternion(q).normalize();
      if(Number.isFinite(p.spinPhase)){
        const tilt=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis);
        const spin=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.spinPhase);
        obj.targetQ.copy(tilt).multiply(spin);
      }else obj.targetQ.copy(q);
   }
   if(!obj.group.userData.init){obj.group.position.copy(obj.targetP);obj.group.quaternion.copy(obj.targetQ);obj.group.userData.init=true;}
   else{obj.group.position.copy(obj.targetP);obj.group.quaternion.copy(obj.targetQ);}
   const tail=obj.group.userData.tail;if(!tail){const line=mesh(new THREE.TorusGeometry(.53,.020,6,30),mat(top?.color||'#5be2ef',.1,.7,top?.color||'#5be2ef',.8),obj.group);line.position.y=-.02;line.rotation.x=Math.PI/2;obj.group.userData.tail=line;}else tail.visible=!!p.charging||!!p.boost||!!p.countering;
 }
 for(const [id,obj] of models)if(!active.has(id)){scene.remove(obj.group);obj.group.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});models.delete(id);}
 const activeTarget=models.get(state.targetId);targetIndicator.visible=!!(activeTarget&&s?.fighters?.find(x=>x.id===state.targetId)?.alive);
 if(activeTarget){targetIndicator.position.set(activeTarget.group.position.x,.4,activeTarget.group.position.z);marker.rotation.y+=dt*4;}
 const center=new THREE.Vector3(0,.5,0); // identical default camera focus for all multiplayer clients
 const pitch=camPitch,dist=mobile?zoom*1.05:zoom;
 const desired=new THREE.Vector3(Math.sin(cameraYaw)*Math.cos(pitch)*dist,Math.sin(pitch)*dist,Math.cos(cameraYaw)*Math.cos(pitch)*dist).add(center);
 if(shake>.001){desired.x+=(Math.random()-.5)*shake;desired.y+=(Math.random()-.5)*shake;shake*=Math.pow(.03,dt);}else shake=0;
 cam.position.lerp(desired,Math.min(1,dt*5));cam.lookAt(center);
 battleground.rotation.y=0;
 for(let i=effects.length-1;i>=0;i--){const p=effects[i];p.life-=dt;if(p.life<=0){scene.remove(p.m);p.m.geometry.dispose();p.m.material.dispose();effects.splice(i,1);continue;}
  if(p.ring){p.m.scale.setScalar(1+(p.max-p.life)*10);}else{p.v.y-=11*dt;p.m.position.addScaledVector(p.v,dt);}p.m.material.opacity=THREE.MathUtils.clamp(p.life/p.max,0,1);}
 if(freeze>0)freeze-=dt;
 if(t-lastGarageFrame>45&&source().room?.status!=='playing'){lastGarageFrame=t;updateGarage(state);}
 renderer.render(scene,cam);
}
// Preserve the existing 2D renderer as a fallback only if WebGL setup fails.
stage.style.visibility='hidden';window.SPIN3D_READY=true;
requestAnimationFrame(loop);
console.info('[SpinBreak] Three.js WebGL3D renderer enabled, authoritative Rapier snapshots');

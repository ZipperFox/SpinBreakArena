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
// V9.3: layered, toy-proportioned spinning top visual models. Rapier remains unchanged.
function buildTop(top,parts={}){
 const main=parts.paint||top.color||'#ff7355',accent=top.accent||'#ffe8ab';
 const root=new THREE.Group();root.userData.fighterId=null;
 const bladePart=new THREE.Group(),ratchetPart=new THREE.Group(),bitPart=new THREE.Group();
 root.add(bladePart,ratchetPart,bitPart);root.userData.assemblies={bladePart,ratchetPart,bitPart};
 const form=top.blade||{lobes:5,reach:.40,tip:.12,shape:'wave'};
 const count=Math.max(2,form.lobes||5),shape=form.shape||'wave';
 const armor=mat('#243141',.83,.28),dark=mat('#101723',.66,.40);
 const steel=mat('#c1cad8',.84,.25),bright=mat('#eff7ff',.76,.22);
 const color=mat(main,.61,.28,main,.14),line=mat(accent,.70,.24,accent,.26);
 const rubber=mat('#1d2430',.05,.83);
 const make=(g,m,parent,x=0,y=0,z=0)=>{const o=mesh(g,m,parent);o.position.set(x,y,z);o.castShadow=!mobile;return o;};
 const cyl=(a,b,h,m,parent,y,n=40)=>make(new THREE.CylinderGeometry(a,b,h,n),m,parent,0,y);
 const tor=(r,t,y,m,parent=bladePart)=>{const o=make(new THREE.TorusGeometry(r,t,8,44),m,parent,0,y);o.rotation.x=Math.PI/2;return o;};
 // Thick attack ring with a genuinely different outline for each blade form.
 cyl(.347,.345,.16,armor,bladePart,.006);
 cyl(.295,.315,.055,color,bladePart,.111);
 tor(.331,.028,.121,steel);
 tor(.257,.017,.153,line);
 const amp=shape==='shield'?.053:shape==='hammer'?.09:shape==='axe'?.108:shape==='swept'?.087:shape==='talon'?.10:.068;
 const outline=new THREE.Shape(),steps=Math.max(80,count*16);
 for(let i=0;i<steps;i++){
  const a=2*Math.PI*i/steps,phase=(i*count/steps)%1;
  let pulse;
  if(shape==='shield')pulse=.45+.45*Math.cos(2*Math.PI*phase)**2;
  else if(shape==='hammer')pulse=phase<.44?.94:Math.max(.1,.94-(phase-.44)*1.55);
  else if(shape==='axe')pulse=phase<.22?.42+phase*2.6:Math.max(.07,1-(phase-.22)*1.24);
  else if(shape==='swept')pulse=(1-phase)**.58;
  else if(shape==='talon')pulse=phase<.78?.18+phase*1.04:Math.max(.10,1-(phase-.78)*4.1);
  else pulse=.48+.47*Math.sin(phase*Math.PI);
  const r=.365+amp*pulse,x=Math.cos(a)*r,z=Math.sin(a)*r;
  if(i===0)outline.moveTo(x,z);else outline.lineTo(x,z);
 }
 outline.closePath();
 const rotor=make(new THREE.ExtrudeGeometry(outline,{depth:.115,steps:1,bevelEnabled:true,bevelSize:.012,bevelThickness:.014,bevelSegments:1}),[color,steel],bladePart,0,-.012);
 rotor.rotation.x=-Math.PI/2;
 cyl(.243,.254,.032,dark,bladePart,.160);
 tor(.245,.015,.182,steel);
 // Radial metal plates, fastening bolts and raised central lock.
 for(let i=0;i<count;i++){
  const a=(i+.5)*2*Math.PI/count,sector=Math.min(.38,Math.PI/count*.65);
  const plate=new THREE.Shape();const inner=.283,outer=shape==='shield'?.396:.423;
  for(let j=0;j<=5;j++){
   const ang=a-sector+2*sector*j/5,r=inner+(outer-inner)*j/5;
   if(j===0)plate.moveTo(Math.cos(ang)*r,Math.sin(ang)*r);
   else plate.lineTo(Math.cos(ang)*r,Math.sin(ang)*r);
  }
  for(let j=5;j>=0;j--){const ang=a-sector+2*sector*j/5,r=inner+.12*(outer-inner);plate.lineTo(Math.cos(ang)*r,Math.sin(ang)*r);}
  plate.closePath();
  const fin=make(new THREE.ExtrudeGeometry(plate,{depth:.028,bevelEnabled:true,bevelSize:.007,bevelThickness:.007,bevelSegments:1}),i%3===0?line:i%2?steel:color,bladePart,0,.146+(i%3===0?.009:0));
  fin.rotation.x=-Math.PI/2;
  make(new THREE.CylinderGeometry(.017,.017,.011,8),i%2?bright:dark,bladePart,Math.cos(a)*.294,.196,Math.sin(a)*.294);
 }
 cyl(.203,.215,.053,steel,bladePart,.188);
 cyl(.171,.176,.037,dark,bladePart,.229);
 tor(.178,.014,.250,line);
 cyl(.129,.133,.029,color,bladePart,.263,24);
 const jewel=make(new THREE.OctahedronGeometry(.088,0),bright,bladePart,0,.289);jewel.scale.y=.27;
 for(let i=0;i<4;i++){const a=i*Math.PI/2+.45;make(new THREE.BoxGeometry(.036,.017,.074),line,bladePart,Math.cos(a)*.146,.265,Math.sin(a)*.146).rotation.y=-a;}
 // Ratchet: physically layered middle gear with visible teeth count.
 const ratchet=parts.ratchet||'wide7';
 const gears={low3:3,heavy5:5,wide7:7,tall4:4,dense9:9,swift2:2};
 const countGear=gears[ratchet]||7,heavy=ratchet==='heavy5'||ratchet==='dense9';
 const width=heavy?.270:ratchet==='swift2'?.225:.246;
 cyl(width,width*.92,.115,armor,ratchetPart,-.148,32);
 cyl(.180,.171,.061,steel,ratchetPart,-.217,32);
 for(let i=0;i<countGear;i++){
  const a=2*Math.PI*i/countGear;
  const tooth=make(new THREE.BoxGeometry(heavy?.089:.070,.098,heavy?.096:.066),i%2?color:steel,ratchetPart,Math.cos(a)*(width-.018),-.154,Math.sin(a)*(width-.018));
  tooth.rotation.y=-a;
 }
 tor(.19,.014,-.084,line,ratchetPart);
 // Bit: recognizable tip shape for each of the eight interchangeable axle types.
 const bit=parts.bit||'taper',bitMat=bit==='rubber'?rubber:color;
 cyl(.134,.120,.08,steel,bitPart,-.264,32);
 cyl(.110,.101,.056,dark,bitPart,-.307,32);
 const cone=(a,b,h,y,m)=>cyl(a,b,h,m,bitPart,y,28);
 if(bit==='flat'){cone(.105,.124,.081,-.353,bitMat);cone(.123,.123,.018,-.392,rubber);}
 else if(bit==='rush'){cone(.112,.091,.088,-.356,bitMat);for(let i=0;i<6;i++){const a=i*Math.PI/3;const t=make(new THREE.BoxGeometry(.03,.04,.04),steel,bitPart,Math.cos(a)*.112,-.361,Math.sin(a)*.112);t.rotation.y=-a;}cone(.092,.09,.018,-.400,steel);}
 else if(bit==='ball'){cone(.107,.09,.049,-.344,bitMat);make(new THREE.SphereGeometry(.089,18,12),steel,bitPart,0,-.352);}
 else if(bit==='needle'){cone(.104,.054,.071,-.345,bitMat);cone(.055,.009,.096,-.387,steel);}
 else if(bit==='orbit'){cone(.105,.092,.066,-.344,bitMat);tor(.094,.022,-.369,steel,bitPart);make(new THREE.SphereGeometry(.073,16,12),line,bitPart,0,-.372);}
 else if(bit==='gear'){cone(.117,.087,.088,-.352,bitMat);for(let i=0;i<8;i++){const a=i*Math.PI/4;const t=make(new THREE.BoxGeometry(.027,.052,.03),steel,bitPart,Math.cos(a)*.105,-.362,Math.sin(a)*.105);t.rotation.y=-a;}cone(.079,.055,.039,-.41,steel);}
 else if(bit==='rubber'){cone(.115,.131,.093,-.358,rubber);cone(.129,.129,.028,-.402,bitMat);}
 else{cone(.114,.047,.124,-.36,bitMat);make(new THREE.SphereGeometry(.031,12,8),steel,bitPart,0,-.416);}
 return root;
}
// Garage uses the same visual parts as combat; Rapier keeps simplified rigid-body colliders.
const garageCanvas=document.getElementById('garage3d');
let garageRenderer=null,garagePreview=null,garageKey='';const garageScene=new THREE.Scene();
garageScene.background=new THREE.Color('#091321');
const garageCamera=new THREE.PerspectiveCamera(35,1,.1,30);garageCamera.position.set(1.76,1.4,2.46);garageCamera.lookAt(0,0,0);
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
const targetIndicator=new THREE.Group();scene.add(targetIndicator);
const circle=mesh(new THREE.TorusGeometry(.66,.018,6,42),new THREE.MeshBasicMaterial({color:'#ffdf86',transparent:true,opacity:.9,depthTest:false}),targetIndicator);circle.rotation.x=Math.PI/2;
const marker=mesh(new THREE.ConeGeometry(.12,.25,4),new THREE.MeshBasicMaterial({color:'#ffe8a7',depthTest:false}),targetIndicator);marker.position.y=.65;marker.rotation.z=Math.PI;
function loop(t){requestAnimationFrame(loop);const dt=Math.min(.05,Math.max(.001,(t-oldFrame)/1000));oldFrame=t;time+=dt;
 const state=source(),s=state.latest;const name=state.room?.arena||'colosseum';if(name!==stageName)createStage(name);
 const rect=wrapper.getBoundingClientRect(),w=Math.max(2,Math.floor(rect.width)),h=Math.max(2,Math.floor(rect.height));if(w!==baseline?.w||h!==baseline?.h){renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();baseline={w,h};}
 const active=new Set();const fighters=s?.fighters||[];
 for(const p of fighters){active.add(p.id);let obj=models.get(p.id);const top=state.tops?.find(t=>t.id===p.top);
   if(!obj){if(!top)continue;const group=buildTop(top,p.build);group.userData.fighterId=p.id;scene.add(group);obj={group,targetP:new THREE.Vector3(),targetQ:new THREE.Quaternion(),lastX:0,lastZ:0};models.set(p.id,obj);}
   obj.group.visible=p.alive||s?.time<5;
   obj.targetP.set((p.x||0)/40,(p.h||0)/40,(p.y||0)/40);if(Array.isArray(p.q))obj.targetQ.set(...p.q);
   if(!obj.group.userData.init){obj.group.position.copy(obj.targetP);obj.group.quaternion.copy(obj.targetQ);obj.group.userData.init=true;}
   else{obj.group.position.lerp(obj.targetP,Math.min(1,dt*21));obj.group.quaternion.slerp(obj.targetQ,Math.min(1,dt*21));}
   const tail=obj.group.userData.tail;if(!tail){const line=mesh(new THREE.TorusGeometry(.53,.020,6,30),mat(top?.color||'#5be2ef',.1,.7,top?.color||'#5be2ef',.8),obj.group);line.position.y=-.02;line.rotation.x=Math.PI/2;obj.group.userData.tail=line;}else tail.visible=!!p.charging||!!p.boost;
 }
 for(const [id,obj] of models)if(!active.has(id)){scene.remove(obj.group);obj.group.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});models.delete(id);}
 const activeTarget=models.get(state.targetId);targetIndicator.visible=!!(activeTarget&&s?.fighters?.find(x=>x.id===state.targetId)?.alive);
 if(activeTarget){targetIndicator.position.set(activeTarget.group.position.x,.4,activeTarget.group.position.z);marker.rotation.y+=dt*4;}
 const own=models.get(state.ownId);const center=own&&state.room?.status==='playing'?own.group.position.clone().multiplyScalar(.18):new THREE.Vector3();center.y=.5;
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

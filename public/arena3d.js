import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {createMaterials,createEnvironment,buildArena,buildAlternateArena,addBattleBowl,STAGES} from './forge/art.mjs';
import {CombatVisuals} from './forge/combat-visuals.mjs';
import {createAccretionMaterial} from './forge/accretion.mjs';
import {makeMechanicalTop,disposeMechanicalTop} from './mechanical-top.mjs';
import {fitDistance, projectPoint, visibleTopHeight} from './framing.mjs';
// Actual WebGL 3D: dynamic rigid-body poses are broadcast from the authoritative Rapier server.
const stage=document.getElementById('stage');
const wrapper=document.getElementById('stageFrame');
const surface=document.createElement('canvas');
surface.id='stage3d';surface.setAttribute('aria-label','Three-dimensional spinning top arena');
wrapper.prepend(surface);
let renderer;
try { renderer=new THREE.WebGLRenderer({canvas:surface,alpha:false,antialias:!matchMedia('(max-width: 720px)').matches,powerPreference:'high-performance'}); }
catch(e){console.warn('[SpinBreak 3D] WebGL unsupported, displaying fallback renderer',e);surface.remove();throw e;}
// V10.3: client-side graphics profiles. Never change authoritative server physics or network time.
const mobile=matchMedia('(max-width: 720px)').matches;
const qualitySelect=document.getElementById('graphicsQuality'),fpsLabel=document.getElementById('graphicsFps');
const allowedQualities=new Set(['auto','low','medium','high']);
let qualityChoice='auto';
try {const saved=localStorage.getItem('spinbreak-graphics-quality');if(allowedQualities.has(saved))qualityChoice=saved;}catch{}
if(qualitySelect)qualitySelect.value=qualityChoice;
const graphics={level:'medium',ratio:1.2,initialRatio:1.2,fxScale:1,trail:18,shadows:false,frames:0,elapsed:0,averageFps:60};
let envTarget=null,envTexture=null,forgeEnv=null;
const scene=new THREE.Scene();scene.background=new THREE.Color('#070e1e');scene.fog=new THREE.FogExp2('#070e1e',.025);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const deviceRatio=Math.min(devicePixelRatio||1,2.5);
function graphicsTier(){return qualityChoice==='auto'?(mobile?'medium':'high'):qualityChoice;}
function applyGraphicsProfile(){
 const tier=graphicsTier();graphics.level=tier;
 const cap=tier==='low'?(mobile?1.05:1.1):tier==='medium'?(mobile?1.3:1.5):(mobile?1.55:1.85);
 graphics.initialRatio=Math.min(deviceRatio,cap);graphics.ratio=graphics.initialRatio;
 graphics.trail=tier==='low'?9:tier==='medium'?17:28;
 graphics.fxScale=tier==='low'?.58:tier==='medium'?.80:1;
 graphics.shadows=tier==='high'&&!mobile;
 renderer.setPixelRatio(graphics.ratio);renderer.shadowMap.enabled=graphics.shadows;
 renderer.toneMappingExposure=.98;composer.setPixelRatio(graphics.ratio);
 ensureEnvironment();
 if(typeof garageKey!=='undefined')garageKey='';
}
qualitySelect?.addEventListener('change',()=>{
 qualityChoice=allowedQualities.has(qualitySelect.value)?qualitySelect.value:'auto';
 try{localStorage.setItem('spinbreak-graphics-quality',qualityChoice);}catch{}
 applyGraphicsProfile();
});
// Small procedural soft-box studio environment. PMREM provides real PBR reflections without CDN/HDR downloads.
function ensureEnvironment(){
 if(!envTarget){
  const c=document.createElement('canvas');c.width=512;c.height=256;
  const ctx=c.getContext('2d');
  if(!ctx)return;
  const grad=ctx.createLinearGradient(0,0,0,256);grad.addColorStop(0,'#d4e5f6');grad.addColorStop(.40,'#24344c');grad.addColorStop(.65,'#0b1426');grad.addColorStop(1,'#161a29');
  ctx.fillStyle=grad;ctx.fillRect(0,0,512,256);
  // Large reflection panels: broad strips reveal metal curvature and blade contour.
  for(const [x,w,power] of [[22,41,.86],[157,67,.70],[315,22,.95],[423,48,.72]]){
   const g=ctx.createLinearGradient(x,0,x+w,0);g.addColorStop(0,'rgba(220,242,255,0)');g.addColorStop(.35,`rgba(228,243,255,${power})`);g.addColorStop(.75,`rgba(246,249,255,${power})`);g.addColorStop(1,'rgba(220,242,255,0)');
   ctx.fillStyle=g;ctx.fillRect(x,30,w,103);
  }
  ctx.fillStyle='rgba(255,177,120,.42)';ctx.fillRect(265,95,33,34);
  envTexture=new THREE.CanvasTexture(c);envTexture.mapping=THREE.EquirectangularReflectionMapping;envTexture.colorSpace=THREE.SRGBColorSpace;
  const pmrem=new THREE.PMREMGenerator(renderer);envTarget=pmrem.fromEquirectangular(envTexture);pmrem.dispose();
 }
 if(!forgeEnv)forgeEnv=createEnvironment(renderer);scene.environment=forgeEnv.texture;scene.environmentIntensity=.73;
 if(typeof garageScene!=='undefined'){garageScene.environment=envTexture;garageScene.environmentIntensity=1.1;}
}
const cam=new THREE.PerspectiveCamera(mobile?58:47,1,.05,110);
cam.position.set(0,9.5,13.5);cam.lookAt(0,.3,0);
scene.add(new THREE.HemisphereLight('#c4d5e7','#282119',1.0));
const sun=new THREE.DirectionalLight('#ffe3bf',2.25);sun.position.set(-4,9,5);sun.castShadow=!mobile;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-9;sun.shadow.camera.right=9;sun.shadow.camera.top=9;sun.shadow.camera.bottom=-9;sun.shadow.bias=-.0002;scene.add(sun);
const rimA=new THREE.PointLight('#9cdfff',35,25,2);rimA.position.set(7,3,-4);scene.add(rimA);
const rimB=new THREE.PointLight('#ffd5ab',26,22,2);rimB.position.set(-7,3,5);scene.add(rimB);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,cam));const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.31,.29,1.38);composer.addPass(bloom);composer.addPass(new OutputPass());const forgeFx=new CombatVisuals(scene,Array.from({length:4},()=>({accent:0xe5a456})),mobile,()=>.025);const forgeMaterials=createMaterials(!mobile);
const mat=(color,metalness=.4,roughness=.35,emissive=null,emissiveIntensity=0)=>new THREE.MeshStandardMaterial({color,metalness,roughness,emissive:emissive||color,emissiveIntensity});
function mesh(geometry,material,parent=scene){const m=new THREE.Mesh(geometry,material);parent.add(m);return m;}
const palette={colosseum:['#142943','#ff9955','#54e9fa'],vortex:['#101d49','#6395ff','#ca9dff'],tempest:['#0b2c44','#6ef4ff','#e4eaaa'],volcano:['#452134','#ff6b3b','#ffdd83'],eclipse:['#241b45','#d785ff','#90baff']};
const battleground=new THREE.Group();scene.add(battleground);
// V10.5: five distinct *visual* arenas. The floor is a decal; stage scenery stays
// outside the collision radius and can never imply a new physical obstacle.
const floorTextureCache=new Map();
const stageMood={
 colosseum:{sky:'#18111d',fog:'#281724',floor:'#8a6249',acc:'#ffbd70',accent:'#e75342'},
 vortex:{sky:'#090b26',fog:'#161140',floor:'#342564',acc:'#b88bff',accent:'#4fd5f8'},
 tempest:{sky:'#061e32',fog:'#102a45',floor:'#124d64',acc:'#8fefff',accent:'#d8fcff'},
 volcano:{sky:'#240b0b',fog:'#381013',floor:'#4b1a16',acc:'#ff742b',accent:'#ffcb50'},
 eclipse:{sky:'#11121f',fog:'#171828',floor:'#353444',acc:'#ffdf91',accent:'#9caaff'}
};
function makeStageFloor(name){
 if(floorTextureCache.has(name))return floorTextureCache.get(name);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const ctx=canvas.getContext('2d');if(!ctx)return null;
 const spec=stageMood[name]||stageMood.colosseum,c=256,tau=Math.PI*2;
 const base=ctx.createRadialGradient(c,c,0,c,c,256);
 base.addColorStop(0,name==='volcano'?'#261b22':name==='eclipse'?'#3c3549':spec.floor);
 base.addColorStop(.74,spec.floor);base.addColorStop(1,'#090e17');ctx.fillStyle=base;ctx.fillRect(0,0,512,512);
 ctx.save();ctx.translate(c,c);ctx.lineCap='round';
 const circle=(r,color,w=2)=>{ctx.beginPath();ctx.arc(0,0,r,0,tau);ctx.strokeStyle=color;ctx.lineWidth=w;ctx.stroke();};
 const segment=(a,r1,r2,color,w=2)=>{ctx.beginPath();ctx.moveTo(Math.cos(a)*r1,Math.sin(a)*r1);ctx.lineTo(Math.cos(a)*r2,Math.sin(a)*r2);ctx.strokeStyle=color;ctx.lineWidth=w;ctx.stroke();};
 const rand=(()=>{let n={colosseum:15,vortex:271,tempest:917,volcano:334,eclipse:121}[name]||13;return()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296}})();
 if(name==='colosseum'){
   // Bronze gladiatorial arena: tiled concentric stone slabs, Roman-like radial medallion.
   for(const r of [46,94,145,188,223])circle(r,'#e5c08a',r===223?6:3);
   for(let i=0;i<40;i++){const ang=i*tau/40;segment(ang,102,244,i%5===0?'#f6d8a2':'#4f372f',i%5===0?4:2);}
   for(let i=0;i<8;i++){const a=i*tau/8;segment(a,15,88,'#f6dcb5',7);segment(a+.07,25,80,'#512e2e',3);}
   circle(31,'#f8d8a6',10);circle(67,'#794738',7);
 }else if(name==='vortex'){
   // Spiral labyrinth that can be seen distinctly even from a distant camera.
   for(let arm=0;arm<5;arm++){ctx.beginPath();for(let j=0;j<140;j++){const r=12+j*1.6,an=arm*tau/5+j*.052;const x=r*Math.cos(an),y=r*Math.sin(an);j?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.strokeStyle=arm%2?'#69ddff':'#c6a5ff';ctx.lineWidth=arm%2?8:13;ctx.globalAlpha=.8;ctx.stroke();}
   ctx.globalAlpha=1;circle(42,'#a997ff',8);circle(235,'#5ce4fb',8);
 }else if(name==='tempest'){
   // Triangular electric circuit grid and giant opposing lightning runes.
   for(let i=-320;i<340;i+=44){ctx.strokeStyle='#56dff066';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(i,-260);ctx.lineTo(i+270,260);ctx.moveTo(i+270,-260);ctx.lineTo(i,260);ctx.stroke();}
   const bolt=(cx,cy,k)=>{ctx.beginPath();ctx.moveTo(cx-26*k,cy-70*k);ctx.lineTo(cx+20*k,cy-25*k);ctx.lineTo(cx-5*k,cy+4*k);ctx.lineTo(cx+32*k,cy+6*k);ctx.lineTo(cx-25*k,cy+75*k);ctx.lineTo(cx-7*k,cy+20*k);ctx.lineTo(cx-37*k,cy+19*k);ctx.closePath();ctx.fillStyle='#c4faff';ctx.shadowColor='#45eaff';ctx.shadowBlur=10;ctx.fill();ctx.shadowBlur=0;};
   bolt(-98,0,.75);bolt(96,0,-.75);circle(215,'#89e8ff',6);circle(64,'#e3ffff',4);
 }else if(name==='volcano'){
   // Wide branching lava cracks; no drawn rubble that suggests an actual collider.
   for(let i=0;i<23;i++){const a=i*tau/23,r0=48+rand()*48;let x=Math.cos(a)*r0,y=Math.sin(a)*r0;ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<8;j++){const rad=r0+22*(j+1);const theta=a+(rand()-.5)*.24;x=Math.cos(theta)*rad;y=Math.sin(theta)*rad;ctx.lineTo(x,y);}ctx.strokeStyle='#ff7420';ctx.lineWidth=3+rand()*5;ctx.shadowColor='#ff4814';ctx.shadowBlur=13;ctx.stroke();ctx.shadowBlur=0;}
   circle(220,'#d84a24',9);circle(42,'#ffbb51',6);
 }else if(name==='eclipse'){
   // Strong monochrome solar eclipse, golden orbit ticks and an offset shadow disk.
   circle(230,'#e6bd72',11);circle(198,'#8e819f',2);
   for(let i=0;i<48;i++){const a=i*tau/48;segment(a,i%4===0?191:209,238,i%4===0?'#ffe4a1':'#a3a6d3',i%4===0?5:2);}
   ctx.beginPath();ctx.arc(0,0,87,0,tau);ctx.fillStyle='#ead6b6';ctx.fill();
   ctx.beginPath();ctx.arc(28,-16,91,0,tau);ctx.fillStyle='#17182e';ctx.fill();
   circle(110,'#f1dba0',5);circle(148,'#807baf',3);
 }
 // Surface microtexture adds believable roughness, but does not hide the theme art.
 for(let i=0;i<180;i++){const a=rand()*tau,r=rand()*247;ctx.fillStyle=i%2?'#ffffff0b':'#00000018';ctx.fillRect(Math.cos(a)*r,Math.sin(a)*r,1+rand()*3,1+rand()*3);}
 ctx.restore();const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());floorTextureCache.set(name,tex);return tex;
}
function stageScenery(name,hot,cyan){
 const add=(geometry,material,x,y,z)=>{const o=mesh(geometry,material,battleground);o.position.set(x,y,z);return o;};
 const M=(color,glow=.05)=>mat(color,.62,.32,color,glow);
 const pole=(angle,radius,height,material,rad=.22)=>{const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;return add(new THREE.CylinderGeometry(rad*.72,rad,height,9),material,x,height*.5-.32,z)};
 // All of this architecture lives beyond the ring and the return lanes (r >= 8).
 if(name==='colosseum'){
  const bronze=M('#b78d62'),ivory=M('#e2c6a1'),red=M('#9c293c');
  for(let i=0;i<12;i++){const a=(i+.5)*Math.PI/6,r=8.9;
   pole(a,r,3.1,ivory,.31);add(new THREE.CylinderGeometry(.42,.42,.16,10),bronze,Math.cos(a)*r,2.80,Math.sin(a)*r);
   if(i%2===0){const banner=add(new THREE.BoxGeometry(.82,1.25,.07),red,Math.cos(a)*8.38,1.85,Math.sin(a)*8.38);banner.rotation.y=-a;}}
  add(new THREE.TorusGeometry(8.9,.12,6,96),bronze,0,2.9,0).rotation.x=Math.PI/2;
 }else if(name==='vortex'){
  const crystal=M('#aa8cff',.9),deep=M('#3b236b',.23);
  for(let i=0;i<9;i++){const a=i*Math.PI*2/9,r=8.6+(i%2)*.5;
   const o=add(new THREE.OctahedronGeometry(.40+i%3*.08,0),i%2?crystal:deep,Math.cos(a)*r,1.4+i%3*.35,Math.sin(a)*r);o.rotation.set(.35,a,.15);}
  for(const [r,y] of [[7.55,.45],[8.25,1.55],[8.9,2.9]]){
    const ring=add(new THREE.TorusGeometry(r,.05,7,92),M('#a77cff',.56),0,y,0);ring.rotation.x=Math.PI/2;}
 }else if(name==='tempest'){
   const steel=M('#607f9d'),electric=M('#5cf3ff',1.2);
   for(let i=0;i<8;i++){const a=i*Math.PI/4,r=8.35;
    pole(a,r,3.5,steel,.17);
    const p=add(new THREE.OctahedronGeometry(.21,0),electric,Math.cos(a)*r,3.37,Math.sin(a)*r);p.scale.y=1.65;
   }
   for(let i=0;i<8;i++){const a=i*Math.PI/4+.22;
    const arc=add(new THREE.TorusGeometry(8.0,.06,5,84,Math.PI/4),electric,0,.28,0);
    arc.rotation.x=Math.PI/2;arc.rotation.z=a;}
 }else if(name==='volcano'){
   const rock=M('#1c1b21'),lava=M('#ff6425',.9);
   for(let i=0;i<14;i++){const a=i*Math.PI*2/14,r=8.15+(i%3)*.30,h=1.2+(i%5)*.48;
    const o=add(new THREE.ConeGeometry(.48+(i%3)*.12,h,5),rock,Math.cos(a)*r,h*.5-.4,Math.sin(a)*r);o.rotation.y=a;
    if(i%2===0){const ember=add(new THREE.ConeGeometry(.11,.23,5),lava,Math.cos(a)*r,h-.32,Math.sin(a)*r);ember.rotation.y=a;}}
   for(let i=0;i<7;i++){const a=i*Math.PI*2/7+.12;
    const stream=add(new THREE.BoxGeometry(.22,.025,1.65),lava,Math.cos(a)*7.45,-.16,Math.sin(a)*7.45);stream.rotation.y=-a;}
 }else if(name==='eclipse'){
   const obsidian=M('#282a42'),gold=M('#ffda8a',.82);
   for(let i=0;i<8;i++){const a=i*Math.PI/4,r=8.45,h=1.9+(i%2)*.85;
    const p=add(new THREE.ConeGeometry(.37,h,4),obsidian,Math.cos(a)*r,h*.5-.35,Math.sin(a)*r);p.rotation.y=Math.PI/4;
    add(new THREE.OctahedronGeometry(.12,0),gold,Math.cos(a)*r,h-.24,Math.sin(a)*r);}
   const halo=add(new THREE.TorusGeometry(8.2,.065,7,108),gold,0,2.05,0);halo.rotation.x=Math.PI/2;
 }
}
function stageLighting(name){
 const mode=stageMood[name]||stageMood.colosseum;
 scene.background.set(mode.sky);scene.fog.color.set(mode.fog);
 const shared=STAGES[({colosseum:'forge',vortex:'void',tempest:'storm'})[name]];if(shared){scene.background.set(shared.bg);scene.fog.color.set(shared.bg);sun.color.set(shared.key);rimA.color.set(shared.rim);rimB.color.set(shared.key)}else{sun.color.set(mode.acc);rimA.color.set(mode.accent);rimB.color.set(mode.acc);}
}
let stageName='';
function ringTube(radius,start,end,y,color,tube=.06,parent=battleground){const pts=[];for(let i=0;i<=Math.max(4,Math.round((end-start)*radius*3));i++){const a=start+(end-start)*i/Math.max(4,Math.round((end-start)*radius*3));pts.push(new THREE.Vector3(Math.cos(a)*radius,y,Math.sin(a)*radius));}const path=new THREE.CatmullRomCurve3(pts);return mesh(new THREE.TubeGeometry(path,pts.length*2,tube,6,false),mat(color,.75,.24,color,.2),parent);}
function createStage(name){
 // Previous stages need GPU cleanup to avoid accumulating buffers on repeated room selection.
 battleground.traverse(o=>{if(o.isMesh||o.isLine){o.geometry?.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)if(m&&!Object.values(forgeMaterials).includes(m))m.dispose();}});
 battleground.clear();stageName=name;stageLighting(name);
 const [base,hot,cyan]=palette[name]||palette.colosseum;
 // Shared FORGE ZERO architecture. The authoritative Rapier floor is flat, so use
 // the same floor surface shader/texture and markings with a flat height profile.
 const theme=({colosseum:'forge',vortex:'void',tempest:'storm',volcano:'forge',eclipse:'void'})[name]||'forge';
 const shell=theme==='forge'?buildArena(forgeMaterials):buildAlternateArena(forgeMaterials,theme);
 battleground.add(shell);addBattleBowl(shell,forgeMaterials,theme,()=>.032,{rail:false});
 // Preserve exact return-lane and obstacle geometry; noninteractive architecture remains decorative.
 for(const side of [-1,1]){let deck=mesh(new THREE.BoxGeometry(2.55,.14,4.15),mat('#3c4448',.72,.42),battleground);deck.position.set(side*6.55,-.09,0);deck.receiveShadow=true;}
 if(name==='volcano'||name==='eclipse'){
 const floor=mesh(new THREE.CircleGeometry(5.57,128),new THREE.MeshStandardMaterial({map:makeStageFloor(name),metalness:.55,roughness:.46,side:THREE.DoubleSide}),battleground);floor.rotation.x=-Math.PI/2;floor.position.y=.039;floor.receiveShadow=true;}
 // Physical guard segments match fixed Rapier collider positions / dangerous gates.
 const guardMat=new THREE.MeshStandardMaterial({color:'#82d7e5',metalness:.56,roughness:.22,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide});
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
 ringTube(5.75,.22,Math.PI/2-.185,3.19,cyan,.018);ringTube(5.75,Math.PI/2+.185,Math.PI-.22,3.19,cyan,.018);
 ringTube(5.75,Math.PI+.22,Math.PI*1.5-.185,3.19,cyan,.018);ringTube(5.75,Math.PI*1.5+.185,Math.PI*2-.22,3.19,cyan,.018);
 const laneMat=new THREE.MeshStandardMaterial({color:'#3cb9d9',metalness:.60,roughness:.28,transparent:true,opacity:.15,depthWrite:false,side:THREE.DoubleSide});
 const laneGeo=new THREE.CylinderGeometry(.245,.245,2.80,8);
 const laneWall=new THREE.InstancedMesh(laneGeo,laneMat,44);let laneCount=0;
 for(const side of [-1,1]){
   ringTube(6.84,(side===1?0:Math.PI)-.45,(side===1?0:Math.PI)+.45,2.67,'#a8c4c7',.022);
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
 if(name==='volcano'||name==='eclipse')stageScenery(name,hot,cyan);
}
const models=new Map(),effects=[];
// Roster badges are independent of spinning/tilting models, so every competitor
// remains identifiable even when several tops overlap visually.
function createFighterBadge(p,order,color,isMine=false){
 const canvas=document.createElement('canvas');canvas.width=384;canvas.height=96;
 const ctx=canvas.getContext('2d');if(!ctx)return null;
 ctx.fillStyle='rgba(5,13,29,.82)';ctx.beginPath();ctx.roundRect(4,6,376,82,18);ctx.fill();
 ctx.strokeStyle=color||'#8bdfff';ctx.lineWidth=4;ctx.stroke();
 ctx.font='bold 37px system-ui, sans-serif';ctx.fillStyle='#f8fbff';ctx.textAlign='center';ctx.textBaseline='middle';
 const name=String(p.name||p.id).slice(0,12);ctx.fillText(isMine?`★ 你 · ${name}`:`${order+1} · ${name}`,192,46,350);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false});
 const badge=new THREE.Sprite(material);badge.scale.set(1.65,.42,1);badge.renderOrder=200;scene.add(badge);
 return badge;
}
function releaseFighter(obj){
 releaseMotionLayer(obj.motion);
 scene.remove(obj.group);disposeMechanicalTop(obj.group);
 if(obj.badge){scene.remove(obj.badge);obj.badge.material.map?.dispose();obj.badge.material.dispose();}
}

// V9.3 visual-only redesign: game-scale layered mechanical spinning tops.
// Keep every mesh inside the original ~0.5 m collision footprint; Rapier remains authoritative.
function buildTop(top,parts={}){return makeMechanicalTop(THREE,top,parts,{high:graphics.level==='high',shadows:!mobile});}
// Garage preview uses the same procedural artwork as battle; Rapier colliders remain simplified for performance.
const garageCanvas=document.getElementById('garage3d');
let garageRenderer=null,garagePreview=null,garageKey='',garageExplode=0,garageAim=0,garageYaw=.65,garagePitch=.52,garageDrag=null,garagePrev=performance.now(),garageW=0,garageH=0;const garageScene=new THREE.Scene();
garageScene.background=new THREE.Color('#091321');
const garageCamera=new THREE.PerspectiveCamera(35,1,.1,30);garageCamera.position.set(1.76,1.40,2.46);garageCamera.lookAt(0,0,0);
garageScene.add(new THREE.HemisphereLight('#d8f3ff','#1b263a',1.8));
const assemblyButton=document.getElementById('garageExplode');assemblyButton?.addEventListener('click',()=>{garageAim=1-garageAim;assemblyButton.textContent=garageAim?'組裝':'拆解'});garageCanvas?.addEventListener('pointerdown',e=>{garageDrag={x:e.clientX,y:e.clientY};garageCanvas.setPointerCapture(e.pointerId)});garageCanvas?.addEventListener('pointermove',e=>{if(!garageDrag)return;garageYaw-=(e.clientX-garageDrag.x)*.012;garagePitch=THREE.MathUtils.clamp(garagePitch+(e.clientY-garageDrag.y)*.009,.12,1.38);garageDrag={x:e.clientX,y:e.clientY}});for(const ev of ['pointerup','pointercancel'])garageCanvas?.addEventListener(ev,()=>garageDrag=null);
applyGraphicsProfile();
const glight=new THREE.DirectionalLight('#ffcc9c',5);glight.position.set(-2,5,4);garageScene.add(glight);
function updateGarage(state){
 const top=state.tops?.find(t=>t.id===state.selected);
 if(!top||!garageCanvas)return;
 const key=[top.id,state.build?.ratchet,state.build?.bit,state.build?.core,state.build?.paint].join('|');
 if(key!==garageKey){
  if(garagePreview){garageScene.remove(garagePreview);disposeMechanicalTop(garagePreview);}
  garagePreview=buildTop(top,state.build||{});garageScene.add(garagePreview);garageKey=key;
  garagePreview.userData.setExplode(garageExplode);
 }
 if(!garageRenderer){try{garageRenderer=new THREE.WebGLRenderer({canvas:garageCanvas,antialias:!mobile,powerPreference:'low-power'});garageRenderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.0:1.25));garageRenderer.outputColorSpace=THREE.SRGBColorSpace;garageRenderer.toneMapping=THREE.ACESFilmicToneMapping;garageRenderer.toneMappingExposure=1.0;}catch(e){console.warn('Garage preview unavailable',e);return;}}
 const rc=garageCanvas.getBoundingClientRect(),w=Math.max(2,Math.round(rc.width)),h=Math.max(2,Math.round(rc.height));
 if(garageW!==w||garageH!==h){garageW=w;garageH=h;garageRenderer.setSize(w,h,false);garageCamera.aspect=w/h;garageCamera.updateProjectionMatrix();}
 const gd=Math.min(.1,(performance.now()-garagePrev)/1000);garagePrev=performance.now();garageExplode+=(garageAim-garageExplode)*Math.min(1,gd*7);garagePreview.userData.setExplode(garageExplode);let d=2.45+garageExplode*.65;garageCamera.position.set(Math.cos(garageYaw)*Math.cos(garagePitch)*d,Math.sin(garagePitch)*d,Math.sin(garageYaw)*Math.cos(garagePitch)*d);garageCamera.lookAt(0,.04,0);garageRenderer.render(garageScene,garageCamera);
}
// GPU-friendly soft spark sprites: one Points draw call per impact, not dozens of meshes.
const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;
const glowContext=glowCanvas.getContext('2d');
if(glowContext){const gradient=glowContext.createRadialGradient(32,32,0,32,32,32);
 gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.22,'rgba(255,255,255,.96)');
 gradient.addColorStop(.49,'rgba(255,255,255,.35)');gradient.addColorStop(1,'rgba(255,255,255,0)');
 glowContext.fillStyle=gradient;glowContext.fillRect(0,0,64,64);}
const glowTexture=new THREE.CanvasTexture(glowCanvas);glowTexture.colorSpace=THREE.SRGBColorSpace;
const fxRingGeometry=new THREE.TorusGeometry(1,.026,5,mobile?36:54);
function eventRandom(seed){let n=(seed>>>0)||1;return ()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967296;};}
function effectSeed(ev){let n=(((ev.frame||0)*2654435761)^(Math.round(ev.amount||0)*1013904223))>>>0;
 for(const ch of String(ev.id||'')+String(ev.kind||''))n=Math.imul(n^ch.charCodeAt(0),16777619)>>>0;return n;}
function addRing(x,y,z,color,radius,life=0.52,thickness=1){
 const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.90,depthWrite:false,
  blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
 const m=new THREE.Mesh(fxRingGeometry,material);m.position.set(x,y,z);m.rotation.x=Math.PI/2;
 m.scale.set(radius,radius,thickness);scene.add(m);
 effects.push({m,type:'pulse',life,max:life,base:radius,expand:2.1});
}
function addFlash(x,y,z,color,size=1.2,life=.25){
 const m=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color,transparent:true,
  opacity:.96,blending:THREE.AdditiveBlending,depthWrite:false}));
 m.position.set(x,y,z);m.scale.set(size,size,1);scene.add(m);
 effects.push({m,type:'flash',life,max:life,base:size});
}
function spawnFx(x,y,z,color,power,ev={}){
 // Upper bounds are intentional: 4-person impacts on iPhones must not allocate per-spark materials.
 if(effects.length>(graphics.level==='low'?28:mobile?45:85))return;
 const rand=eventRandom(effectSeed(ev));const n=Math.min(Math.round((mobile?24:46)*graphics.fxScale),Math.max(7,Math.round(power/(mobile?9:6)*graphics.fxScale)));
 const positions=new Float32Array(n*3),colors=new Float32Array(n*3),velocities=new Float32Array(n*3);
 const warm=new THREE.Color(color),white=new THREE.Color('#fff7dc');
 for(let i=0;i<n;i++){
  const a=rand()*Math.PI*2,speed=(1.8+rand()*5.6)*(Math.min(2.0,power/135));
  const j=i*3;positions[j]=(rand()-.5)*.18;positions[j+1]=(rand()-.5)*.16;positions[j+2]=(rand()-.5)*.18;
  velocities[j]=Math.cos(a)*speed;velocities[j+1]=1.1+rand()*4.2;velocities[j+2]=Math.sin(a)*speed;
  const mixed=warm.clone().lerp(white,.35+rand()*.6);colors[j]=mixed.r;colors[j+1]=mixed.g;colors[j+2]=mixed.b;
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
 const material=new THREE.PointsMaterial({size:mobile?.17:.14,map:glowTexture,alphaTest:.025,vertexColors:true,
  transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true});
 const m=new THREE.Points(geometry,material);m.position.set(x,y,z);m.frustumCulled=false;scene.add(m);
 const life=.38+rand()*.23;
 effects.push({m,type:'sparks',life,max:life,positions,velocities});
 addFlash(x,y,z,color,Math.min(2.1,.60+power/135),.23);
 addRing(x,.16,z,color,.24+Math.min(.26,power/650),.45);
 if(power>155)addRing(x,.18,z,'#dffaff',.20,.39);
}
let cameraYaw=.1,camPitch=.8,zoom=15,shake=0,freeze=0,oldFrame=performance.now(),lastGarageFrame=0,lastArena='',time=0,baseline=null;
const source=()=>window.SPINBREAK_3D_BRIDGE?.getState?.()||{};
window.addEventListener('spinbreak-impact',e=>{
 const ev=e.detail;if(!ev)return;
 if(ev.kind==='start')forgeFx.reset();
 if(['hit','wall','charge','skill','ko','counter','counter_success','counter_ready','rail','return'].includes(ev.kind)){
  const st=source(),fighter=st.latest?.fighters?.find(p=>p.id===ev.id);
  const x=Number.isFinite(ev.x)?ev.x/40:(fighter?.x||0)/40;
  const z=Number.isFinite(ev.y)?ev.y/40:(fighter?.y||0)/40;
  const top=st.tops?.find(t=>t.id===fighter?.top);
  const palette={wall:'#8de7ff',charge:'#d2fcff',counter:'#8fffe0',ko:'#ffcc82'};
  const strength=ev.kind==='hit'?(ev.amount||100):ev.kind==='ko'?250:ev.kind==='charge'?185:ev.kind==='skill'?200:ev.kind==='counter'?215:86;
  const kind=ev.kind==='counter_ready'?'guard':ev.kind==='counter_success'?'counter':['rail','return'].includes(ev.kind)?'charge':ev.kind;
  const velocity=Math.hypot(fighter?.vx||0,fighter?.vy||0);forgeFx.event(kind,{x,z,power:Math.min(1.8,Math.max(.16,strength/135)),color:palette[ev.kind]||top?.accent||'#ffd392',dx:velocity?(fighter.vx||0)/velocity:1,dz:velocity?(fighter.vy||0)/velocity:0});
  if(['hit','wall','ko','counter','skill'].includes(kind))spawnFx(x,.48,z,palette[ev.kind]||top?.accent||'#ffd392',strength*.72,ev);
  shake=Math.max(shake,Math.min(mobile?.23:.48,strength/650));
  // Render pause is cosmetic only, and must never alter the server-synchronized physics clock.
  if(strength>175){freeze=Math.max(freeze,.055);impactFocus={x,z,life:.48,max:.48};}
 }
});
document.getElementById('cameraMode')?.addEventListener('change',e=>{let v=e.target.value;camPitch=v==='top'?1.25:v==='low'?.48:.8;zoom=v==='top'?15.8:v==='low'?13.5:15;});
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
 const m=new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:warn?.35:.68,
  depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
 const ring=anomalyMesh(new THREE.TorusGeometry(a.kind==='blackhole'?1.62:2.1,.055,6,mobile?44:76),m.clone(),a.x,.12,a.z);
 ring.rotation.x=Math.PI/2;ring.userData.main=true;
 if(a.kind==='blackhole'){
  const disk=anomalyMesh(new THREE.PlaneGeometry(5.4,5.4),createAccretionMaterial(),a.x,.10,a.z);disk.rotation.x=-Math.PI/2;disk.userData.accretion=true;disk.material.uniforms.strength.value=warn?.22:1;
  const core=anomalyMesh(new THREE.SphereGeometry(.31,16,12),new THREE.MeshBasicMaterial({color:'#080318'}),a.x,.36,a.z);core.userData.core=true;
  for(let i=0;i<3;i++){
   const disk=anomalyMesh(new THREE.TorusGeometry(.52+i*.34,.055-i*.009,5,64),m.clone(),a.x,.36+i*.035,a.z);
   disk.rotation.x=Math.PI/2+(i-1)*.20;disk.userData.orbit=i+1;
  }
 }else if(a.kind==='cyclone'){
   for(let i=0;i<3;i++){
    const points=[];
    for(let j=0;j<=65;j++){const u=j/65,theta=u*Math.PI*5+i*2.094;
      const radius=.55+u*1.75;points.push(new THREE.Vector3(Math.cos(theta)*radius,.12+u*2.3,Math.sin(theta)*radius));}
    const spiral=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:c,transparent:true,opacity:warn?.28:.62,depthWrite:false,blending:THREE.AdditiveBlending}));
    spiral.userData.cyclone=true;spiral.position.set(a.x,0,a.z);anomalyOverlay.add(spiral);
   }
 }else if(a.kind==='magnet'){
   for(let i=0;i<2;i++){
    const orb=anomalyMesh(new THREE.SphereGeometry(.19,12,10),m.clone(),a.x+(i?1.35:-1.35),.35,a.z);orb.userData.orb=true;
    const field=anomalyMesh(new THREE.TorusGeometry(1.3+i*.33,.035,5,48),m.clone(),a.x,.18+i*.14,a.z);
    field.rotation.x=Math.PI/2+i*.22;field.userData.orbit=i+1;
   }
 }else if(a.kind==='shockwave'){
   ring.userData.wave=true;
   const halo=anomalyMesh(new THREE.TorusGeometry(.8,.035,5,48),m.clone(),a.x,.15,a.z);
   halo.rotation.x=Math.PI/2;halo.userData.wave=true;
 }
}
function updateAnomaly3D(s,dt){
 const a=s?.anomaly||{};
 if((a.kind||'')!==anomalyKind||(a.phase||'')!==anomalyPhase)rebuildAnomaly(a);
 const tick=s?.time||0;
 for(const o of anomalyOverlay.children){
   if(o.userData.accretion){o.material.uniforms.time.value=tick;o.material.uniforms.strength.value=a.phase==='warning'?.22:1;}
   if(o.userData.main)o.scale.setScalar(1+Math.sin(tick*5)*.085);
   if(o.userData.wave&&a.phase==='active'){const progress=THREE.MathUtils.clamp(1-Math.max(0,a.until-tick)/3.6,0,1);o.scale.setScalar(.35+progress*1.75);o.material.opacity=Math.max(.08,.80*(1-progress));}
   if(o.userData.orbit)o.rotation.y+=dt*(1+o.userData.orbit*.9);
   if(o.userData.cyclone)o.rotation.y+=dt*1.9;
   if(o.userData.telegraph){o.material.opacity=.4+Math.abs(Math.sin(tick*8))*.58;o.scale.setScalar(1+Math.sin(tick*6)*.10);}
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
// Motion FX are purely presentational: no force/velocity is applied by the Three.js client.
const groundShadowCanvas=document.createElement('canvas');groundShadowCanvas.width=groundShadowCanvas.height=64;
const shadowContext=groundShadowCanvas.getContext('2d');
if(shadowContext){const g=shadowContext.createRadialGradient(32,32,3,32,32,32);g.addColorStop(0,'rgba(0,0,0,.8)');g.addColorStop(.45,'rgba(0,0,0,.48)');g.addColorStop(1,'rgba(0,0,0,0)');shadowContext.fillStyle=g;shadowContext.fillRect(0,0,64,64);}
const groundShadowMap=new THREE.CanvasTexture(groundShadowCanvas);
const groundShadowGeometry=new THREE.PlaneGeometry(1.5,1.5);
function makeMotionLayer(color){
 const geom=new THREE.BufferGeometry(),verts=30*2,positions=new Float32Array(verts*3),colors=new Float32Array(verts*3),indices=[];
 const c=new THREE.Color(color);
 for(let i=0;i<verts;i++){const brightness=.10+.90*(i/2/29)**1.8;colors[i*3]=c.r*brightness;colors[i*3+1]=c.g*brightness;colors[i*3+2]=c.b*brightness;}
 for(let i=0;i<29;i++){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
 geom.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
 geom.setAttribute('color',new THREE.BufferAttribute(colors,3));geom.setIndex(indices);geom.setDrawRange(0,0);
 const trail=new THREE.Mesh(geom,new THREE.MeshBasicMaterial({side:THREE.DoubleSide,vertexColors:true,transparent:true,opacity:.76,depthWrite:false,blending:THREE.AdditiveBlending}));
 trail.frustumCulled=false;scene.add(trail);
 const shadow=new THREE.Mesh(groundShadowGeometry,new THREE.MeshBasicMaterial({map:groundShadowMap,transparent:true,opacity:.48,depthWrite:false,depthTest:true}));
 shadow.rotation.x=-Math.PI/2;shadow.position.y=.065;scene.add(shadow);
 return {trail,shadow,points:[],lastSample:-Infinity};
}
function updateMotionLayer(obj,p,serverTime){
 const layer=obj.motion;if(!layer)return;const pos=obj.group.position;
 layer.shadow.position.set(pos.x,.064,pos.z);const height=Math.max(0,pos.y-.35);
 layer.shadow.material.opacity=p.alive?.42/(1+height*.55):0;
 layer.shadow.scale.setScalar(1+Math.min(1.8,height*.45));
 if(!p.alive){layer.points.length=0;layer.trail.geometry.setDrawRange(0,0);return;}
 if(serverTime-layer.lastSample>.045){
  const prev=layer.points.at(-1);const dist=prev?Math.hypot(pos.x-prev.x,pos.z-prev.z):0;
  if(dist>2.8)layer.points.length=0; // Never draw a trail across a network teleport.
  if(!prev||dist>.045){layer.points.push({x:pos.x,z:pos.z,t:serverTime});if(layer.points.length>graphics.trail)layer.points.shift();}
  layer.lastSample=serverTime;
 }
 while(layer.points.length&&serverTime-layer.points[0].t>.28)layer.points.shift();const pts=layer.points,n=Math.min(pts.length,graphics.trail);if(n<2){layer.trail.geometry.setDrawRange(0,0);return;}
 const arr=layer.trail.geometry.attributes.position.array;
 for(let i=0;i<n;i++){
  const pt=pts[pts.length-n+i],prev=pts[Math.max(0,pts.length-n+i-1)],next=pts[Math.min(pts.length-1,pts.length-n+i+1)];
  const dx=next.x-prev.x,dz=next.z-prev.z,len=Math.max(.001,Math.hypot(dx,dz)),width=(.012+.059*(i/Math.max(1,n-1)))*(p.charging?1.65:1);
  const px=-dz/len*width,pz=dx/len*width,idx=i*6;
  arr[idx]=pt.x+px;arr[idx+1]=.095;arr[idx+2]=pt.z+pz;
  arr[idx+3]=pt.x-px;arr[idx+4]=.095;arr[idx+5]=pt.z-pz;
 }
 layer.trail.geometry.attributes.position.needsUpdate=true;layer.trail.geometry.setDrawRange(0,(n-1)*6);
 layer.trail.visible=graphics.level!=='low'||p.charging||p.boost;
}
function releaseMotionLayer(layer){
 scene.remove(layer.trail,layer.shadow);layer.trail.geometry.dispose();layer.trail.material.dispose();layer.shadow.material.dispose();
}
let impactFocus=null;
// Visible through translucent guards so the player never loses their own top in a crowded arena.
const myMarker=new THREE.Group();scene.add(myMarker);
const myHalo=new THREE.Mesh(new THREE.RingGeometry(.53,.69,48),new THREE.MeshBasicMaterial({color:'#7bf8ff',side:THREE.DoubleSide,transparent:true,opacity:.90,depthTest:false,depthWrite:false}));
myHalo.rotation.x=-Math.PI/2;myHalo.renderOrder=180;myMarker.add(myHalo);
const myArrow=new THREE.Mesh(new THREE.ConeGeometry(.16,.27,5),new THREE.MeshBasicMaterial({color:'#ffffff',depthTest:false,depthWrite:false}));
myArrow.position.y=.95;myArrow.rotation.z=Math.PI;myArrow.renderOrder=181;myMarker.add(myArrow);
myMarker.visible=false;
// Name and locator may remain visible even when the top is depth-occluded.
// A local-player-only contour remains legible through the stadium geometry;
// it never participates in the authoritative rigid-body simulation.
const myTopSilhouette=new THREE.Group();scene.add(myTopSilhouette);
function silhouetteMesh(geometry,color,opacity,y){
 const m=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,
   depthTest:false,depthWrite:false,fog:false,toneMapped:false}));
 m.position.y=y;m.renderOrder=210;myTopSilhouette.add(m);return m;
}
silhouetteMesh(new THREE.CylinderGeometry(.39,.37,.13,36),'#52eaff',.24,.045);
silhouetteMesh(new THREE.CylinderGeometry(.15,.16,.16,24),'#ffffff',.36,.15);
const silhouetteRim=silhouetteMesh(new THREE.TorusGeometry(.395,.027,8,48),'#7dfaff',.66,.12);
silhouetteRim.rotation.x=Math.PI/2;
myTopSilhouette.visible=false;
const targetIndicator=new THREE.Group();scene.add(targetIndicator);
const circle=mesh(new THREE.TorusGeometry(.66,.018,6,42),new THREE.MeshBasicMaterial({color:'#ffdf86',transparent:true,opacity:.9,depthTest:false}),targetIndicator);circle.rotation.x=Math.PI/2;
const marker=mesh(new THREE.ConeGeometry(.12,.25,4),new THREE.MeshBasicMaterial({color:'#ffe8a7',depthTest:false}),targetIndicator);marker.position.y=.65;marker.rotation.z=Math.PI;
function loop(t){requestAnimationFrame(loop);const elapsed=Math.max(.001,(t-oldFrame)/1000),dt=Math.min(.05,elapsed);oldFrame=t;time+=dt;
 const state=source(),s=state.latest;const name=state.room?.arena||'colosseum';if(name!==stageName)createStage(name);
 const rect=wrapper.getBoundingClientRect(),w=Math.max(2,Math.floor(rect.width)),h=Math.max(2,Math.floor(rect.height));if(w!==baseline?.w||h!==baseline?.h){renderer.setSize(w,h,false);composer.setSize(w,h);cam.aspect=w/h;cam.updateProjectionMatrix();baseline={w,h};}
 updateAnomaly3D(s,dt);
 const active=new Set();const fighters=s?.fighters||[];
 for(const [index,p] of fighters.entries()){active.add(p.id);let obj=models.get(p.id);
   // Never silently lose a competitor merely because a top definition arrives late.
   const top=state.tops?.find(t=>t.id===p.top)||state.tops?.[0]||{id:p.top,color:'#72d9ed',accent:'#ffffff',blade:{lobes:5,shape:'wave'}};
   if(!obj){let group;
     try{group=buildTop(top,p.build||{});}
     catch(error){
       console.error('[SpinBreak 3D] top model failed; restoring a visible fallback',p.id,error);
       group=new THREE.Group();mesh(new THREE.CylinderGeometry(.40,.40,.19,40),new THREE.MeshStandardMaterial({color:top.color||'#72d9ed',metalness:.8,roughness:.28}),group);
       mesh(new THREE.CylinderGeometry(.14,.14,.065,24),new THREE.MeshStandardMaterial({color:'#f4f8ff',metalness:.72,roughness:.24}),group).position.y=.15;
     }
     group.userData.fighterId=p.id;scene.add(group);
     obj={group,targetP:new THREE.Vector3(),targetQ:new THREE.Quaternion(),motion:makeMotionLayer(top.color||'#6fefff'),
       badge:createFighterBadge(p,index,p.id===state.ownId?'#6af6ff':top.accent||top.color,p.id===state.ownId),lastX:0,lastZ:0};models.set(p.id,obj);}
   obj.group.visible=!!p.alive||s?.time<5; // The UI now explicitly explains an early local KO.
   obj.targetP.set((p.x||0)/40,visibleTopHeight(p),(p.y||0)/40);
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
   obj.group.userData.setExposure?.(p.alive?(p.rpm||0):0,dt,time);
   if(obj.badge){obj.badge.visible=!!p.alive;obj.badge.position.set(obj.group.position.x,obj.group.position.y+1.15,obj.group.position.z);}
   updateMotionLayer(obj,p,Number.isFinite(s?.time)?s.time:time);
   const tail=obj.group.userData.tail;if(!tail){const line=mesh(new THREE.TorusGeometry(.53,.020,6,30),mat(top?.color||'#5be2ef',.1,.7,top?.color||'#5be2ef',.8),obj.group);line.position.y=-.02;line.rotation.x=Math.PI/2;obj.group.userData.tail=line;line.visible=!!p.charging||!!p.boost||!!p.countering;}else tail.visible=!!p.charging||!!p.boost||!!p.countering;
 }
 for(const [id,obj] of models)if(!active.has(id)){releaseFighter(obj);models.delete(id);}
 const myActor=fighters.find(p=>p.id===state.ownId),myModel=models.get(state.ownId);
 myMarker.visible=!!(myActor?.alive&&myModel?.group.visible);
 if(myMarker.visible){myMarker.position.set(myModel.group.position.x,.16,myModel.group.position.z);myMarker.rotation.y=time*.4;}
// The owner-only rotor silhouette follows the same coordinate as the physical top.
myTopSilhouette.visible=myMarker.visible;
if(myTopSilhouette.visible){myTopSilhouette.position.copy(myModel.group.position);myTopSilhouette.rotation.set(0,Number.isFinite(myActor?.spinPhase)?myActor.spinPhase:time*16,0);}
 forgeFx.update(dt,fighters.map(p=>({x:p.x/40,z:p.y/40,alive:p.alive,charge:p.charging?1:0,boost:p.boost?1:0,guard:p.countering?1:0,color:state.tops?.find(t=>t.id===p.top)?.accent||0xe5a456})));
 window.SPINBREAK_RENDER_DIAGNOSTICS={visualPipeline:'FORGE_SHARED_V11',theme:stageName,postprocessing:graphics.level==='high',effects:forgeFx.diagnostics,accretion:anomalyOverlay.children.some(o=>o.userData.accretion),serverFighters:fighters.length,models:models.size,
  activeModels:[...models.entries()].filter(([id,o])=>o.group.visible&&active.has(id)).map(([id])=>id),
  missingModels:fighters.filter(p=>p.alive&&!models.has(p.id)).map(p=>p.id),
  eliminated:fighters.filter(p=>!p.alive).map(p=>({id:p.id,reason:p.reason})),
  own:{id:state.ownId||null,present:!!myActor,alive:!!myActor?.alive,
       model:!!myModel,visible:!!myModel?.group.visible,
       reason:myActor?.reason||'',x:myActor?.x,z:myActor?.y,
       rawHeight:myActor?.h,displayHeight:myActor?visibleTopHeight(myActor):null,
       silhouette:myTopSilhouette.visible,
       meshCount:(()=>{let n=0;myModel?.group.traverse(o=>{if(o.isMesh&&o.geometry?.attributes?.position?.count>0)n++;});return n;})()}};
 const activeTarget=models.get(state.targetId);targetIndicator.visible=!!(activeTarget&&s?.fighters?.find(x=>x.id===state.targetId)?.alive);
 if(activeTarget){targetIndicator.position.set(activeTarget.group.position.x,.4,activeTarget.group.position.z);marker.rotation.y+=dt*4;}
 const center=new THREE.Vector3(0,.5,0); // visualization only; authoritative positions stay unchanged
 let push=0;if(impactFocus){impactFocus.life-=dt;if(impactFocus.life<=0)impactFocus=null;
  else{push=Math.pow(impactFocus.life/impactFocus.max,1.2);center.x=impactFocus.x*.20*push;center.z=impactFocus.z*.20*push;}}
 const pitch=camPitch,combatants=fighters.filter(x=>x.alive).length;
 const framing=combatants===2?Math.min(zoom,13.8):zoom;
 // Keep *every living fighter*, including the local player, inside the camera.
 // High-speed rail returns at the rim otherwise disappear from the narrow phone view.
 const baseDist=(mobile?framing*1.05:framing)-push*(mobile?.35:.85);
 const dist=fitDistance(fighters,{yaw:cameraYaw,pitch,fov:cam.fov,aspect:cam.aspect,baseDistance:baseDist,maxDistance:36});
 const desired=new THREE.Vector3(Math.sin(cameraYaw)*Math.cos(pitch)*dist,Math.sin(pitch)*dist,Math.cos(cameraYaw)*Math.cos(pitch)*dist).add(center);
 if(shake>.001){desired.x+=(Math.random()-.5)*shake;desired.y+=(Math.random()-.5)*shake;shake*=Math.pow(.03,dt);}else shake=0;
 // Fast zoom-out for a fighter approaching the edge; a slower zoom-in avoids jitter.
 const requiredRadius=desired.distanceTo(center),currentRadius=cam.position.distanceTo(center);
 cam.position.lerp(desired,Math.min(1,dt*(requiredRadius>currentRadius?13:3.5)));cam.lookAt(center);
 if(myActor?.alive&&myModel){
   const projection=projectPoint({x:myActor.x/40,y:visibleTopHeight(myActor),z:myActor.y/40},
       {yaw:cameraYaw,pitch,dist:cam.position.distanceTo(center),fov:cam.fov,aspect:cam.aspect,center});
   window.SPINBREAK_RENDER_DIAGNOSTICS.own.withinFrame=projection.visible;
 }
 battleground.rotation.y=0;
 for(let i=effects.length-1;i>=0;i--){const p=effects[i];p.life-=dt;
  if(p.life<=0){scene.remove(p.m);if(p.type==='sparks')p.m.geometry.dispose();p.m.material.dispose();effects.splice(i,1);continue;}
  const progress=1-p.life/p.max,fade=Math.pow(p.life/p.max,1.35);
  if(p.type==='sparks'){
    for(let j=0;j<p.positions.length;j+=3){p.velocities[j+1]-=10*dt;
      p.positions[j]+=p.velocities[j]*dt;p.positions[j+1]+=p.velocities[j+1]*dt;p.positions[j+2]+=p.velocities[j+2]*dt;}
    p.m.geometry.attributes.position.needsUpdate=true;
  }else if(p.type==='pulse')p.m.scale.set(p.base+p.expand*progress,p.base+p.expand*progress,1);
  else if(p.type==='flash')p.m.scale.setScalar(p.base*(1+progress*.6));
  p.m.material.opacity=fade;
 }
 if(freeze>0)freeze-=dt;
 if(t-lastGarageFrame>45&&source().room?.status!=='playing'){lastGarageFrame=t;updateGarage(state);}
 // Auto-quality avoids sustained GPU overload. Render scaling affects only pixels, never 30Hz server state.
 graphics.frames++;graphics.elapsed+=elapsed;
 if(graphics.elapsed>=5){
   const fps=graphics.frames/graphics.elapsed;graphics.averageFps=Math.round(fps);
   if(fpsLabel)fpsLabel.textContent=String(graphics.averageFps)+' FPS';
   if(qualityChoice==='auto'){
     const floor=mobile?.73:.90;
     let next=graphics.ratio;
     if(fps<(mobile?39:46))next=Math.max(floor,graphics.ratio-.12);
     else if(fps>57)next=Math.min(graphics.initialRatio,graphics.ratio+.06);
     if(Math.abs(next-graphics.ratio)>.03){graphics.ratio=next;renderer.setPixelRatio(next);renderer.setSize(w,h,false);composer.setPixelRatio(next);composer.setSize(w,h);}
   }
   graphics.frames=0;graphics.elapsed=0;
 }
 if(graphics.level==='high')composer.render(dt);else renderer.render(scene,cam);
}
// Preserve the existing 2D renderer as a fallback only if WebGL setup fails.
stage.style.visibility='hidden';window.SPIN3D_READY=true;
requestAnimationFrame(loop);
console.info('[SpinBreak] Three.js WebGL3D renderer enabled, authoritative Rapier snapshots');

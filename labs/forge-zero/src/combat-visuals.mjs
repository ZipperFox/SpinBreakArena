import * as T from 'three';
const TAU=2*Math.PI;
const vertex='varying vec2 v;void main(){v=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const waveFrag='varying vec2 v;uniform vec3 tint;uniform float phase;uniform float opacity;uniform float style;void main(){float r=length(v),a=atan(v.y,v.x);float edge=exp(-pow((r-.72)*42.,2.));float inner=exp(-pow((r-.52)*13.,2.))*.26;float rays=pow(max(0.,.5+.5*cos(a*13.+sin(a*7.+phase)*2.)),7.);float spoke=exp(-pow((r-.66)*8.,2.))*rays;float fading=1.-smoothstep(.84,1.,r);float alpha=(edge+inner+spoke*.38*style)*opacity*fading;gl_FragColor=vec4(tint*(1.1+edge*1.6),alpha);}';
const auraFrag='varying vec2 v;uniform vec3 tint;uniform float phase;uniform float strength;void main(){float r=length(v),a=atan(v.y,v.x);float band=exp(-pow((r-.73)*19.,2.));float dash=pow(.5+.5*sin(a*8.-phase*2.),3.);float core=exp(-pow((r-.88)*40.,2.));float val=band*(.18+.72*dash)+core*.34;gl_FragColor=vec4(tint*1.7,val*strength);}';
function mat(fragment,uniforms){return new T.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false});}
export class CombatVisuals{
 constructor(scene,types,mobile){this.scene=scene;this.mobile=mobile;this.geo=new T.PlaneGeometry(2,2);this.pool=[];this.time=0;this.events=0;
 for(let i=0;i<(mobile?10:18);i++){let material=mat(waveFrag,{tint:{value:new T.Color()},phase:{value:0},opacity:{value:0},style:{value:1}}),o=new T.Mesh(this.geo,material);o.rotation.x=-Math.PI/2;o.visible=false;o.renderOrder=4;scene.add(o);this.pool.push({o,life:0,max:0,size:1,span:1});}
 this.auras=types.map(t=>{let o=new T.Mesh(this.geo,mat(auraFrag,{tint:{value:new T.Color(t.accent)},phase:{value:0},strength:{value:0}}));o.rotation.x=-Math.PI/2;o.visible=false;o.renderOrder=3;scene.add(o);return o});
 // Real volumetric-looking shields, with a rim highlight instead of an opaque sphere.
 const shieldGeo=new T.SphereGeometry(.76,mobile?20:32,mobile?12:20);
 this.shields=types.map(t=>{let material=new T.ShaderMaterial({uniforms:{tint:{value:new T.Color(t.accent)},time:{value:0},strength:{value:0}},vertexShader:'varying vec3 n;varying vec3 eye;varying vec3 local;void main(){local=position;vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);eye=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 n;varying vec3 eye;varying vec3 local;uniform vec3 tint;uniform float time;uniform float strength;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(eye))),2.7);float lines=pow(.5+.5*sin(local.y*44.-time*9.),14.);gl_FragColor=vec4(tint*1.5,(rim*.40+lines*.06)*strength);}',transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.FrontSide,toneMapped:false});let o=new T.Mesh(shieldGeo,material);o.visible=false;scene.add(o);return o});
 // Reusable soft flash billboards and tiny metal fragments, independent of gameplay.
 const cg=document.createElement('canvas');cg.width=cg.height=64;const ctx=cg.getContext('2d');const grad=ctx.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(255,255,255,1)');grad.addColorStop(.20,'rgba(255,235,195,.65)');grad.addColorStop(.55,'rgba(255,160,55,.14)');grad.addColorStop(1,'rgba(255,140,30,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);this.flashTex=new T.CanvasTexture(cg);
 this.flashes=Array.from({length:mobile?6:10},()=>{let o=new T.Sprite(new T.SpriteMaterial({map:this.flashTex,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));o.visible=false;scene.add(o);return {o,life:0,max:1,size:1}});
 this.debris=new T.InstancedMesh(new T.IcosahedronGeometry(.045,0),new T.MeshStandardMaterial({color:0xd0d5d9,metalness:.8,roughness:.45}),mobile?36:84);this.debris.count=0;this.debris.frustumCulled=false;scene.add(this.debris);this.chips=[];this.tmp=new T.Object3D();
 }
 wave(e,tint,life,size,span,style=1){let p=this.pool.find(v=>!v.life)||this.pool.reduce((x,y)=>x.life<y.life?x:y);p.max=p.life=life;p.size=size;p.span=span;p.o.position.set(e.x,.09,e.z);p.o.material.uniforms.tint.value.set(tint);p.o.material.uniforms.style.value=style;p.o.visible=true;}
 event(kind,e){this.events++;const p=Math.min(1.8,Math.max(.1,e.power||1)),heavy=p>.82,accent=e.color||0xffbc67;
 if(kind==='hole'||kind==='anomaly'){this.wave({x:0,z:0},kind==='hole'?0x9674ff:e.kind==='wind'?0x70e5f7:0xffb268,1.1,.5,5.8,1);return}
 if(kind==='guard'){this.wave(e,accent,.52,.6,1.4,.3);return}
 if(kind==='charge'){this.wave(e,accent,.38,.28,1.18,.3);return}
 if(!['hit','wall','counter','skill','ko'].includes(kind))return;
 let tint=kind==='skill'||kind==='counter'?accent:0xffc58c;let strong=heavy||kind==='skill'||kind==='ko';
 this.wave(e,tint,strong?.55:.27,.18,strong?2.35:1.0,strong?1:.25);
 if(strong)this.wave(e,0xffe1bc,.35,.11,1.25,.12);
 let f=this.flashes.find(v=>!v.life)||this.flashes.reduce((x,y)=>x.life<y.life?x:y);f.life=f.max=strong?.20:.105;f.size=strong?1.5:.75;f.o.position.set(e.x,.53,e.z);f.o.material.color.set(tint);f.o.visible=true;
 let count=kind==='wall'?3:strong?14:5;for(let i=0;i<count&&this.chips.length<this.debris.instanceMatrix.count;i++){let a=Math.atan2(e.dz||0,e.dx||1)+(i%2?Math.PI:0)+(Math.random()-.5)*1.6,s=1.8+Math.random()*p*4;this.chips.push({x:e.x,y:.46,z:e.z,vx:Math.cos(a)*s,vz:Math.sin(a)*s,vy:1.1+Math.random()*2.6,life:.45+Math.random()*.45,rot:Math.random()*TAU})}
 }
 update(dt,actors){this.time+=dt;for(let p of this.pool){if(!p.life)continue;p.life=Math.max(0,p.life-dt);p.o.visible=p.life>0;let u=1-p.life/p.max;p.o.scale.setScalar(p.size+p.span*(1-Math.pow(1-u,2)));p.o.material.uniforms.phase.value=u*5;p.o.material.uniforms.opacity.value=p.life/p.max*.62;}
 for(let f of this.flashes){if(!f.life)continue;f.life=Math.max(0,f.life-dt);f.o.visible=f.life>0;let u=1-f.life/f.max;f.o.scale.setScalar(f.size*(.4+u*.9));f.o.material.opacity=(1-u)**2*.9}
 for(let i=0;i<actors.length;i++){let a=actors[i],o=this.auras[i],s=this.shields[i];o.visible=a.alive&&(a.charge>.05||a.boost>.05);o.position.set(a.x,.065,a.z);o.scale.setScalar(1.03+(a.boost>0?.25:0));o.material.uniforms.phase.value=this.time*9+i;o.material.uniforms.strength.value=a.boost>0?.8:Math.min(.75,a.charge);s.visible=a.alive&&a.guard>0;s.position.set(a.x,.49,a.z);s.material.uniforms.time.value=this.time;s.material.uniforms.strength.value=Math.min(1,a.guard*3);}
 let n=0;for(let i=this.chips.length-1;i>=0;i--){let q=this.chips[i];q.life-=dt;if(q.life<=0){this.chips.splice(i,1);continue}q.vy-=8*dt;q.x+=q.vx*dt;q.z+=q.vz*dt;q.y+=q.vy*dt;if(q.y<.065){q.y=.065;q.vy=Math.abs(q.vy)*.30;q.vx*=.65;q.vz*=.65}q.rot+=dt*9;this.tmp.position.set(q.x,q.y,q.z);this.tmp.rotation.set(q.rot,q.rot*.7,q.rot*.3);this.tmp.scale.setScalar(Math.min(1,q.life*5));this.tmp.updateMatrix();this.debris.setMatrixAt(n++,this.tmp.matrix)}this.debris.count=n;this.debris.instanceMatrix.needsUpdate=true;
 }
 reset(){for(let p of [...this.pool,...this.flashes]){p.life=0;p.o.visible=false}this.chips=[];this.debris.count=0;for(let o of [...this.auras,...this.shields])o.visible=false}
 get diagnostics(){return {events:this.events,waves:this.pool.filter(p=>p.life>0).length,chips:this.chips.length,shields:this.shields.filter(o=>o.visible).length}}
}

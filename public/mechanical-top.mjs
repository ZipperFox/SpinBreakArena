// Original mesh construction; Anatomy-inspired rigid groups, real profiles and assembly contract.
// Geometry and materials are built once per configuration, not per frame.
import {rotorSpec,assemblyOffsets,exposure,TAU} from './rotor-spec.mjs';
export {rotorSpec,assemblyOffsets,exposure};
export function makeMechanicalTop(T,type,build={},options={}){
 const s=rotorSpec(type,build),high=options.high!==false,root=new T.Group(),rotor=new T.Group();root.add(rotor);
 const attack=new T.Group(),weight=new T.Group(),core=new T.Group(),tip=new T.Group();rotor.add(attack,weight,core,tip);
 const paint=build.paint||type.color||0x698da1,accent=type.accent||0xe2c398,materials=[];
 const mat=(color,metalness,roughness,extra={})=>{let m=new T.MeshPhysicalMaterial({color,metalness,roughness,envMapIntensity:1.0,...extra});materials.push(m);return m};
 const cut=mat(0xc6c9ca,.97,.29,{anisotropy:high?.42:0}),cast=mat(0x596168,.91,.43),dark=mat(0x202a30,.73,.46),anod=mat(paint,.77,.37,{clearcoat:high?.16:0}),poly=mat(paint,.10,.46,{clearcoat:.22}),black=mat(0x10161a,.08,.79),accentMat=mat(accent,.68,.40),weightMat=mat(s.core==='tungsten'?0x89817a:0x989fa4,.91,.40),carbon=mat(0x222b32,.22,.59);
 function mesh(g,geo,m,x=0,y=0,z=0){let o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=options.shadows!==false;o.receiveShadow=true;g.add(o);return o}
 function lathe(g,profile,m,segs=high?64:40){return mesh(g,new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),segs),m)}
 // Closed profiled annulus: continuous outer wall, machined chamfers, top land and actual inner bore.
 function annulus(g,levels,m,rad=s.radiusAt,segments=high?144:84){const pos=[],idx=[],uv=[],n=levels.length;
 for(let j=0;j<n;j++){let [y,f,absolute]=levels[j];for(let i=0;i<=segments;i++){let a=i*TAU/segments,r=absolute??rad(a)*f;pos.push(Math.cos(a)*r,y,Math.sin(a)*r);uv.push(i/segments,j/(n-1))}}
 for(let j=0;j<n-1;j++)for(let i=0;i<segments;i++){let k=j*(segments+1)+i,l=k+segments+1;idx.push(k,l,k+1,k+1,l,l+1)}
 let geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return mesh(g,geo,m)}
 function circular(g,rad,y0,y1,m,inner=.204){return annulus(g,[[y0,.94],[y0+.008,1],[y1-.008,1],[y1,.94],[y1,0,inner],[y0,0,inner],[y0,.94]],m,()=>rad,high?72:48)}
 function bolt(g,r,y,angle,scale=1){let o=mesh(g,new T.CylinderGeometry(.023*scale,.023*scale,.013,6),cut,r*Math.cos(angle),y,r*Math.sin(angle));o.rotation.y=-angle;let slot=mesh(g,new T.BoxGeometry(.024*scale,.003,.006*scale),black,o.position.x,y+.008,o.position.z);slot.rotation.y=-angle}
 function inset(g,a,span,r0,r1,y,depth,m){let sh=new T.Shape(),N=12;for(let i=0;i<=N;i++){let u=i/N,t=a-span/2+u*span,r=r0+(r1-r0)*Math.sin(Math.PI*u)**.65;let x=Math.cos(t)*r,z=-Math.sin(t)*r;i?sh.lineTo(x,z):sh.moveTo(x,z)}
 for(let i=N;i>=0;i--){let t=a-span/2+i/N*span;sh.lineTo(Math.cos(t)*r0,-Math.sin(t)*r0)}sh.closePath();let o=mesh(g,new T.ExtrudeGeometry(sh,{depth,steps:1,bevelEnabled:true,bevelSegments:1,bevelThickness:.004,bevelSize:.004,curveSegments:3}),m,0,y,0);o.rotation.x=-Math.PI/2;return o}
 // Attack ring lower cast body plus polished bearing land and a continuous swept striking edge.
 let half=s.thickness*.5;
 annulus(attack,[[-half,.92],[-half+.012,1],[half-.016,1],[half,.91],[half,0,.204],[-half,0,.204],[-half,.92]],cast);
 annulus(attack,[[half-.025,.997],[half-.012,1.002],[half-.002,.97],[half+.001,.91],[half+.001,.89],[half-.023,.96],[half-.025,.997]],cut);
 annulus(attack,[[half+.003,.88],[half+.009,.86],[half+.017,.79],[half+.017,0,.222],[half+.003,0,.214],[half+.003,.88]],anod);
 circular(attack,.244,-half+.006,half+.019,dark,.204);
 const sector=TAU/s.lobes;for(let i=0;i<s.lobes;i++){let q=(i+.5)*sector,span=sector*.64,r=s.radiusAt(q)*.82;
 inset(attack,q,span,.253,Math.max(.27,r),half+.019,.014,poly);
 if(s.form==='shield'){inset(attack,q,span*.90,.279,Math.min(s.reach*.89,r+.035),half+.041,.017,dark)}
 else if(s.form==='swept'){inset(attack,q-sector*.12,span*.72,.264,Math.max(.31,r),half+.037,.007,cut)}
 else if(s.form==='hammer'||s.form==='axe'){inset(attack,q,span*.62,.28,Math.max(.32,r),half+.041,.019,weightMat)}
 else inset(attack,q+sector*.11,span*.52,.275,Math.max(.30,r),half+.036,.009,accentMat);
 bolt(attack,.255,half+.024,i*sector,.88);
 }
 // The four slots meet around one mechanical shaft. The central cap, pin and locking collar are a separate module.
 lathe(core,[[0,.282],[.112,.282],[.146,.268],[.171,.245],[.171,.204],[.181,.196],[.181,.139],[.162,.122],[.162,.075],[.117,.075],[.117,.11],[0,.11]],s.core==='carbon'?carbon:s.core==='tungsten'?weightMat:cut);
 lathe(core,[[.112,.285],[.14,.285],[.153,.274],[.155,.247],[.132,.239],[.118,.242],[.112,.285]],poly);
 circular(core,.187,.197,.213,dark,.162);
 for(let i=0;i<6;i++){let t=i*TAU/6;bolt(core,.147,.253,t,.72)}
 // A single non-symmetrical witness mark plus an annular serial band; not a separate glow decoration.
 let marker=inset(core,.18,.42,.068,.133,.286,.007,accentMat);marker.name='rotation witness';
 let m0=mesh(core,new T.CylinderGeometry(.062,.062,.008,high?32:20),black,0,.289,0);m0.name='launcher socket';
 circular(weight,s.ringRadius,-.217,-.079,weightMat,.135);
 circular(weight,s.ringRadius*.91,-.231,-.202,dark,.13);
 for(let i=0;i<s.gear;i++){let t=i*TAU/s.gear;let o=mesh(weight,new T.BoxGeometry(.048,.087,.062),i%2?cast:cut,(s.ringRadius-.012)*Math.cos(t),-.153,(s.ringRadius-.012)*Math.sin(t));o.rotation.y=-t;bolt(weight,s.ringRadius*.76,-.085,t,.64)}
 // Actual bit-specific contact profiles, not just differently scaled copies.
 let rr=s.tipRadius,bitMat=s.bit==='rubber'||s.bit==='flat'?black:poly;
 lathe(tip,[[0,-.235],[.122,-.235],[.132,-.254],[.117,-.285],[.104,-.32],[.09,-.347],[.07,-.36],[0,-.36]],cut);
 lathe(tip,[[0,-.347],[.107,-.347],[.119,-.368],[rr,-.425],[rr*.93,-.453],[0,-.46]],bitMat);
 if(['rush','gear'].includes(s.bit))for(let i=0;i<8;i++){let t=i*TAU/8,o=mesh(tip,new T.BoxGeometry(.025,.049,.032),cut,.107*Math.cos(t),-.365,.107*Math.sin(t));o.rotation.y=-t}
 if(s.bit==='ball'||s.bit==='orbit')mesh(tip,new T.SphereGeometry(rr,24,16),cut,0,-.46+rr,0);
 // Subtle exposure surface at the real attack ring, not an opaque glowing disk.
 let blurMat=new T.ShaderMaterial({uniforms:{strength:{value:0},time:{value:0},color:{value:new T.Color(paint)}},vertexShader:'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 p;uniform float strength;uniform float time;uniform vec3 color;void main(){float r=length(p),a=atan(p.y,p.x);float b=smoothstep(.45,.66,r)*(1.-smoothstep(.91,1.,r));float lines=.5+.5*cos(r*135.);float streak=pow(.5+.5*cos(a*3.-time*10.),3.);gl_FragColor=vec4(mix(vec3(.76,.81,.84),color,.33),b*(.18+.17*lines+.14*streak)*strength);}',transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false});
 materials.push(blurMat);let blur=mesh(attack,new T.PlaneGeometry(s.reach*2.04,s.reach*2.04),blurMat,0,half+.076,0);blur.rotation.x=-Math.PI/2;blur.castShadow=false;blur.receiveShadow=false;blur.visible=false;
 root.userData={...root.userData,rotor,ratchet:weight,bit:tip,spec:s,assemblies:{bladePart:attack,ratchetPart:weight,bitPart:tip,corePart:core},blur,materials};
 root.userData.setExplode=t=>{let o=assemblyOffsets(t);attack.position.y=o.attack;weight.position.y=o.weight;core.position.y=o.core;tip.position.y=o.tip;};
 root.userData.setExposure=(rpm,dt,time)=>{let v=exposure(rpm,dt);blur.visible=v>.12;blurMat.uniforms.strength.value=v;blurMat.uniforms.time.value=time;};
 return root;
}
export function disposeMechanicalTop(root){const g=new Set(),m=new Set();root.traverse(o=>{if(o.geometry)g.add(o.geometry);for(let x of Array.isArray(o.material)?o.material:[o.material])if(x)m.add(x)});for(let x of g)x.dispose();for(let x of m)x.dispose();}

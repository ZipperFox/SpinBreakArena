// Original SPINBREAK mechanical catalogue. Scaled game units, not measured toy dimensions.
export const TAU=Math.PI*2;
export const CORES=Object.freeze({
 alloy:{label:'合金標準',mass:.20,radius:.176,y:.178,stability:1,drain:1,drive:1,armor:1},
 tungsten:{label:'高密度配重',mass:.34,radius:.164,y:.155,stability:1.17,drain:.91,drive:.90,armor:1.17},
 carbon:{label:'碳纖輕量',mass:.105,radius:.185,y:.195,stability:.90,drain:1.07,drive:1.12,armor:.89}
});
const design={
 phoenix:[3,'talon',.56,.39,.13],raptor:[4,'swept',.55,.35,.09],mantis:[2,'axe',.64,.32,.15],
 behemoth:[8,'shield',.49,.44,.15],glacier:[10,'shield',.46,.43,.12],golem:[5,'hammer',.59,.39,.16],
 lynx:[3,'swept',.54,.31,.085],fox:[9,'shield',.48,.39,.08],cobra:[4,'talon',.58,.33,.105],
 leviathan:[6,'wave',.53,.36,.11],solar:[5,'wave',.54,.37,.12],unicorn:[3,'hammer',.58,.35,.115],
 talon:[3,'talon',.60,.37,.13],shield:[8,'shield',.55,.48,.15],swept:[5,'swept',.59,.33,.09],balanced:[6,'wave',.55,.37,.12]
};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),smooth=n=>n*n*(3-2*n);
export function rotorSpec(type,build={}){
 const key=type.id||type.shape||'balanced',d=design[key]||design.balanced,[lobes,form,reach,waist,thickness]=d;
 const r=build.ratchet||'standard',bit=build.bit||'taper',core=CORES[build.core]||CORES.alloy;
 const gear=({light:3,standard:6,heavy:9,low3:3,heavy5:5,wide7:7,tall4:4,dense9:9,swift2:2})[r]||6;
 const heavy=['heavy','heavy5','dense9'].includes(r),light=['light','low3','swift2'].includes(r);
 const ringRadius=heavy?.266:light?.222:.246,ratMass=heavy?.30:light?.13:.20;
 const tipRadius=({flat:.119,rush:.085,ball:.12,needle:.027,orbit:.09,gear:.081,rubber:.124,taper:.047})[bit]||.047;
 const tipMass=bit==='rubber'?.12:bit==='needle'?.075:.095;
 const phase=key==='mantis'?.12:key==='cobra'?.26:key==='raptor'?.21:0;
 const radiusAt=angle=>{let u=((angle+phase)*lobes/TAU%1+1)%1,p;
 if(form==='talon')p=u<.70?smooth(u/.70):1-smooth((u-.70)/.30);
 else if(form==='swept')p=u<.27?smooth(u/.27):1-smooth((u-.27)/.73);
 else if(form==='axe')p=u<.22?smooth(u/.22):u<.49?1:1-smooth((u-.49)/.51);
 else if(form==='hammer')p=u<.25?smooth(u/.25):u<.61?1:1-smooth((u-.61)/.39);
 else if(form==='shield')p=.64+.36*Math.pow(Math.sin(Math.PI*u),2);
 else p=Math.pow(Math.sin(Math.PI*u),1.55);
 return waist+(reach-waist)*p;};
 // Annulus polar integral, constant thickness/density approximation. Each slot mass and inertia is explicit.
 let area=0,J=0,inner=.204;for(let i=0;i<360;i++){let rr=radiusAt(i*TAU/360);area+=(rr*rr-inner*inner)*TAU/720;J+=(rr**4-inner**4)*TAU/1440}
 const bladeMass=area*thickness*7.7,bladeInertia=bladeMass*J/area;
 const parts=[{id:'attack',label:'攻擊環',mass:bladeMass,inertia:bladeInertia,y:.035,minY:-.073,maxY:.073,radius:reach},{id:'weight',label:'配重／棘輪',mass:ratMass,inertia:.65*ratMass*ringRadius**2,y:-.15,minY:-.235,maxY:-.075,radius:ringRadius},{id:'core',label:'鎖定核心',mass:core.mass,inertia:.5*core.mass*core.radius**2,y:core.y,minY:.075,maxY:.287,radius:core.radius},{id:'tip',label:'軸尖組件',mass:tipMass,inertia:.5*tipMass*.12**2,y:-.33,minY:-.46,maxY:-.235,radius:.13}];
 const mass=parts.reduce((s,p)=>s+p.mass,0),inertia=parts.reduce((s,p)=>s+p.inertia,0),com=parts.reduce((s,p)=>s+p.mass*p.y,0)/mass;
 return {key,lobes,form,reach,waist,thickness,radiusAt,gear,ringRadius,tipRadius,bit,core:build.core in CORES?build.core:'alloy',coreData:core,parts,mass,inertia,com,armor:core.armor,stability:core.stability,drain:core.drain,drive:core.drive};
}
export function assemblyOffsets(t){t=clamp(t,0,1);return {attack:.16*t,core:.57*t,weight:-.13*t,tip:-.49*t}}
export function exposure(rpm,dt=1/60){const turns=Math.abs(rpm)/60*Math.min(.035,Math.max(.008,dt));return clamp(turns*.82,0,.94)}

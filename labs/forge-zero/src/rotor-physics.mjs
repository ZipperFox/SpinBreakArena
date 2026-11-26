// Scaled planar rigid rotor model. Lengths are game units, not measured metres.
export const STEP=1/240,RADIUS=5.24,RAIL=4.78,TAU=Math.PI*2;
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const surfaceHeight=r=>.045+.57*Math.pow(clamp(r/5.6,0,1),2.3);
export const heightAt=(x,z)=>surfaceHeight(Math.hypot(x,z));
export const slope=r=>.57*2.3/5.6*Math.pow(clamp(r/5.6,0,1),1.3);
export const spinEnergy=a=>.5*a.inertia*a.omega*a.omega;
export const kinetic=a=>spinEnergy(a)+.5*a.mass*(a.vx*a.vx+a.vz*a.vz);
export function drain(a,e){a.omega=Math.sign(a.omega||1)*Math.sqrt(Math.max(0,a.omega*a.omega-2*Math.max(0,e)/a.inertia));}
export function accelerate(a,dx,dz,speed){let l=Math.hypot(dx,dz)||1,old=.5*a.mass*(a.vx*a.vx+a.vz*a.vz),goal=.5*a.mass*speed*speed,E=Math.min(goal,old+spinEnergy(a)*.12*.78),v=Math.sqrt(2*E/a.mass);drain(a,Math.max(0,E-old)/.78);a.vx=dx/l*v;a.vz=dz/l*v;return v}
export function collide(a,b){let dx=b.x-a.x,dz=b.z-a.z,r=Math.hypot(dx,dz),rad=a.radius+b.radius;if(r>=rad)return null;
 let nx=r>1e-7?dx/r:1,nz=r>1e-7?dz/r:0,tx=-nz,tz=nx,ia=1/a.mass,ib=1/b.mass,inv=ia+ib,d=rad-r+.0001;
 a.x-=nx*d*ia/inv;a.z-=nz*d*ia/inv;b.x+=nx*d*ib/inv;b.z+=nz*d*ib/inv;
 let vn=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;if(vn<=0)return null;
 let before=kinetic(a)+kinetic(b),jn=1.72*vn/inv,vt=(a.vx-b.vx)*tx+(a.vz-b.vz)*tz+a.omega*a.radius+b.omega*b.radius,jt=clamp(vt/(inv+a.radius*a.radius/a.inertia+b.radius*b.radius/b.inertia),-jn*.23,jn*.23);
 a.vx-=(jn*nx+jt*tx)*ia;a.vz-=(jn*nz+jt*tz)*ia;b.vx+=(jn*nx+jt*tx)*ib;b.vz+=(jn*nz+jt*tz)*ib;a.omega-=jt*a.radius/a.inertia;b.omega-=jt*b.radius/b.inertia;
 return {nx,nz,vn,jn,jt,loss:Math.max(0,before-kinetic(a)-kinetic(b))}
}
export function integrate(a,dt,anomaly,t,match){let r=Math.max(.0001,Math.hypot(a.x,a.z)),nx=a.x/r,nz=a.z/r,ratio=Math.min(1,Math.abs(a.omega)/a.initialOmega),speed=Math.hypot(a.vx,a.vz),drag=a.drag*(1+2.3*(1-ratio)**2),g=35*slope(r),curve=.22*ratio;
 let fx=-nx*g-a.vx*drag-a.vz*curve,fz=-nz*g-a.vz*drag+a.vx*curve;
 if(anomaly==='hole'){fx-=nx*15;fz-=nz*15}else if(anomaly==='wind'){fx+=Math.cos(t*1.7)*8;fz+=Math.sin(t*1.7)*8}else if(anomaly==='shock'){fx+=nx*10;fz+=nz*10}
 a.vx+=fx*dt;a.vz+=fz*dt;a.x+=a.vx*dt;a.z+=a.vz*dt;
 if(match)drain(a,.5*a.inertia*a.initialOmega*a.initialOmega*(.012+.012*(speed/15)**2+.10*a.wobble*a.wobble)*dt/a.stamina);
 else a.omega+= (a.initialOmega-a.omega)*Math.min(1,dt*1.8);
 a.wobble*=Math.exp(-dt*(1+ratio*4));a.precession=(a.precession+dt*(2.8+10*(1-ratio)))%TAU;
 let wobble=clamp((1-ratio)**3*1.05+a.wobble,0,1.12),lean=Math.min(.18,speed*.007);
 a.leanX=Math.sin(a.precession)*wobble+a.vz*lean/Math.max(1,speed);a.leanZ=Math.cos(a.precession)*wobble-a.vx*lean/Math.max(1,speed);a.tilt=Math.hypot(a.leanX,a.leanZ);a.spin=(a.spin+a.omega*dt)%TAU;
}
export function railDash(a){let r=Math.hypot(a.x,a.z);if(r<RAIL||a.railCd>0||Math.abs(a.omega)/a.initialOmega<.23)return 0;let nx=a.x/r,nz=a.z/r,rad=a.vx*nx+a.vz*nz,tan=-a.vx*nz+a.vz*nx;if(Math.abs(nz)>.94||rad<1||Math.abs(tan)<2)return 0;let s=Math.sign(tan),v=accelerate(a,-nz*s*.94-nx*.34,nx*s*.94-nz*.34,Math.min(34,(19+11*Math.abs(a.omega)/a.initialOmega)*a.railFactor));a.railCd=1.15;a.rail=.38;a.charge=Math.max(a.charge,.3);return v}

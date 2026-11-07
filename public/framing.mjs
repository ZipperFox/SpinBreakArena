/* Camera-only framing: physical position and server time remain untouched. */
const rad=Math.PI/180;
const finite=(n,f=0)=>Number.isFinite(n)?n:f;
export function projectPoint(point,{yaw=0,pitch=.8,dist=15,fov=47,aspect=1,center={x:0,y:.5,z:0}}={}){
 const sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
 const x=finite(point.x)-finite(center.x),y=finite(point.y)-finite(center.y,.5),z=finite(point.z)-finite(center.z);
 const toward=x*sy*cp+y*sp+z*cy*cp;
 const depth=dist-toward,tanV=Math.tan(fov*rad/2);
 const right=x*cy-z*sy,up=-x*sy*sp+y*cp-z*cy*sp;
 const nx=right/(Math.max(.001,depth)*tanV*Math.max(.15,aspect));
 const ny=up/(Math.max(.001,depth)*tanV);
 return {x:nx,y:ny,depth,visible:depth>0&&Math.abs(nx)<.94&&Math.abs(ny)<.94};
}
// The art floor is at y≈0.03m. A still-live body can briefly drift below the
// rendered surface. Clamp ONLY the model's presentation height, never Rapier.
export function visibleTopHeight(p){
 const y=finite(p?.h,16)/40;
 const x=finite(p?.x)/40,z=finite(p?.y)/40;
 const radius=Math.hypot(x,z);
 const onPlaySurface=radius<=5.85||(p?.rail===true&&radius<=7.6);
 return p?.alive&&onPlaySurface?Math.max(.44,y):y;
}
export function fitDistance(fighters,{yaw=0,pitch=.8,fov=47,aspect=1,baseDistance=15,maxDistance=36}={}){
 const sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
 const tanV=Math.tan(fov*rad/2),tanH=tanV*Math.max(.15,aspect);
 let dist=finite(baseDistance,15);
 for(const p of fighters||[]){
  if(!p.alive||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
  const x=p.x/40,y=visibleTopHeight(p)-.5,z=p.y/40;
  const toward=x*sy*cp+y*sp+z*cy*cp;
  const right=x*cy-z*sy,up=-x*sy*sp+y*cp-z*cy*sp;
  // The 0.6m margin includes the top mesh and its name badge.
  dist=Math.max(dist,toward+(Math.abs(right)+.65)/(tanH*.78),toward+(Math.abs(up)+.85)/(tanV*.78));
 }
 return Math.min(maxDistance,Math.max(baseDistance,dist));
}

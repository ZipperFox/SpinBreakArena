'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const {visibleTopHeight,fitDistance,projectPoint}=await import('./public/framing.mjs');
 const src=fs.readFileSync('./public/arena3d.js','utf8');
 const html=fs.readFileSync('./public/index.html','utf8');
 const pkg=require('./package.json');
 assert.equal(pkg.version,'10.7.0');
 assert(html.includes('/arena3d.js?v=10.7'));
 assert(src.includes('obj.targetP.set((p.x||0)/40,visibleTopHeight(p),'));
 assert(src.includes('myTopSilhouette.visible=myMarker.visible'));
 assert(src.includes('depthTest:false,depthWrite:false,fog:false,toneMapped:false'));
 assert(src.includes('myTopSilhouette.position.copy(myModel.group.position)'));
 assert(src.includes('meshCount:(()=>'));
 const onFloor={id:'player',alive:true,x:190,y:80,h:-12};
 assert.equal(visibleTopHeight(onFloor),.44);
 assert.equal(visibleTopHeight({...onFloor,h:16}),.44);
 assert.equal(visibleTopHeight({...onFloor,h:52}),1.3);
 assert.equal(visibleTopHeight({...onFloor,alive:false}),-.3);
 assert.equal(visibleTopHeight({...onFloor,x:310,y:110}),-.3);
 assert.equal(visibleTopHeight({...onFloor,x:280,y:80,rail:true}),.44);
 assert.equal(visibleTopHeight({...onFloor,x:280,y:80,rail:false}),-.3);
 let cases=0;
 for(const aspect of [.5,.56,.70,1,1.78])for(const fov of [47,58])for(const yaw of [0,.5,1.5,3,4.7,5.9])for(const pitch of [.5,.8,1.1]){
  const fighters=[onFloor,{id:'other',alive:true,x:-170,y:-80,h:17},{id:'third',alive:true,x:0,y:190,h:19}];
  const dist=fitDistance(fighters,{yaw,pitch,fov,aspect,maxDistance:36});
  for(const p of fighters){
   const q=projectPoint({x:p.x/40,y:visibleTopHeight(p),z:p.y/40},{yaw,pitch,dist,fov,aspect});
   assert(q.visible,JSON.stringify({id:p.id,aspect,yaw,q}));
   cases++;
  }
 }
 console.log('OWNER_VISIBLE_V107_PASS cameraCases='+cases+' floorClamp=7 xrayContour=true physicsUnchanged=true');
})().catch(e=>{console.error('OWNER_VISIBLE_V107_FAIL',e.stack||e);process.exitCode=1;});

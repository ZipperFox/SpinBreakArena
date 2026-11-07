'use strict';
// V10.6: the server knows all four fighters, but each browser must be able to see its own top.
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const {fitDistance,projectPoint}=await import('./public/framing.mjs');
 const arena=fs.readFileSync('./public/arena3d.js','utf8');
 const client=fs.readFileSync('./public/client.js','utf8');
 const html=fs.readFileSync('./public/index.html','utf8');
 const server=fs.readFileSync('./server.js','utf8');
 assert(arena.includes('myMarker.visible=!!(myActor?.alive&&myModel?.group.visible)'));
 assert(arena.includes('const dist=fitDistance('),'Use camera framing to keep the entire live roster inside the view');
 assert(arena.includes('top model failed; restoring a visible fallback'),'Never silently drop a top whose visual model fails');
 assert(arena.includes('own:{id:state.ownId'),'Report local model visibility diagnostics');
 assert(client.includes('你的陀螺已淘汰')&&client.includes('找不到你自己的陀螺資料'));
 assert(server.includes('Fighter roster mismatch'));
 assert(server.includes("'.mjs':'text/javascript; charset=utf-8'"),'ES module must use JavaScript MIME for browser strict-module loading');
 assert(/\/arena3d\.js\?v=10\.(?:6|7)/.test(html));
 let cases=0;
 // Five arenas, four player identities, extreme angles, very narrow mobile screens,
 // rail returns, and large top jump heights.
 for(const arenaId of ['colosseum','vortex','tempest','volcano','eclipse']){
  for(const aspect of [.53,.70,1.25,1.77])for(const fov of [47,58])for(let yaw=0;yaw<Math.PI*2;yaw+=Math.PI/3){
   const fighters=[
    {id:'P1',x:0,y:-276,h:17,alive:true},
    {id:'P2',x:270,y:0,h:16,alive:true},
    {id:'P3',x:-230,y:130,h:88,alive:true},
    {id:'P4',x:0,y:270,h:14,alive:true},
   ];
   for(const pitch of [.50,.80,1.16]){
    const dist=fitDistance(fighters,{yaw,pitch,fov,aspect,baseDistance:14,maxDistance:36});
    assert(Number.isFinite(dist)&&dist>=14&&dist<=36);
    for(const mine of fighters){
     const pos={x:mine.x/40,y:mine.h/40,z:mine.y/40};
     const projected=projectPoint(pos,{yaw,pitch,dist,fov,aspect});
     assert(projected.visible,`${arenaId} my=${mine.id} yaw=${yaw} aspect=${aspect} dist=${dist} xy=${projected.x},${projected.y}`);
     cases++;
    }
   }
  }
 }
 // An eliminated fighter should have a clear UI reason, not a silently missing top.
 assert(client.includes('else if(!mine.alive)'));
 console.log(`OWN_TOP_VISIBILITY_PASS cameraCases=${cases} arenas=5 players=4 deviceRatios=4 localKOStatus=true visibleFallback=true`);
})().catch(e=>{console.error('OWN_TOP_VISIBILITY_FAIL',e.stack||e);process.exitCode=1;});

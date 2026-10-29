'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const URL = process.env.GAME_WS || 'ws://127.0.0.1:3000/ws';
function client(label){
 return new Promise((resolve,reject)=>{
  const socket=new WebSocket(URL), messages=[], waiters=[];
  const c={socket,label,messages,send:o=>socket.send(JSON.stringify(o)),wait:(fn,ms=5000)=>new Promise((yes,no)=>{
   const found=messages.find(fn);if(found)return yes(found);
   const w={fn,yes,no,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(w),1);no(Error(label+' timed out '+messages.slice(-10).map(x=>x.t)));},ms)};
   waiters.push(w);
  })};
  socket.onmessage=e=>{const m=JSON.parse(e.data);messages.push(m);if(messages.length>2000)messages.shift();for(const w of [...waiters])if(w.fn(m)){clearTimeout(w.timer);waiters.splice(waiters.indexOf(w),1);w.yes(m);}};
  socket.onopen=()=>resolve(c);socket.onerror=reject;
 });
}
function get(path){return new Promise((resolve,reject)=>http.get('http://127.0.0.1:3000'+path,r=>{let str='';r.on('data',b=>str+=b);r.on('end',()=>resolve({code:r.statusCode,body:str,headers:r.headers}));}).on('error',reject));}
async function run(){
 const health=await get('/health');assert.equal(health.code,200);assert.equal(JSON.parse(health.body).version,'2.0');
 const manifest=await get('/manifest.webmanifest');assert.equal(manifest.code,200);assert(manifest.headers['content-type'].includes('manifest+json'));
 const icon=await get('/icon-192.png');assert.equal(icon.code,200);
 const bad=await get('/../server.js');assert(bad.code===403||bad.code===404);
 const a=await client('host');await a.wait(x=>x.t==='hello');a.send({t:'create',name:'Host',top:'phoenix'});
 const j=await a.wait(x=>x.t==='joined');assert.match(j.token,/^[a-f0-9]{64}$/);const room=j.room.code;
 const b=await client('guest');await b.wait(x=>x.t==='hello');b.send({t:'join',code:room,name:'Guest',top:'fox'});
 const jb=await b.wait(x=>x.t==='joined');assert.equal(jb.room.players.length,2);
 b.socket.close();await a.wait(x=>x.t==='room'&&x.room.players.find(p=>p.id===jb.id)?.connected===false);
 const invalid=await client('invalid');await invalid.wait(x=>x.t==='hello');invalid.send({t:'resume',token:'a'.repeat(64)});await invalid.wait(x=>x.t==='resume_failed');invalid.socket.close();
 const b2=await client('guest-resumed');await b2.wait(x=>x.t==='hello');b2.send({t:'resume',token:jb.token});
 const resumed=await b2.wait(x=>x.t==='joined'&&x.resumed===true);assert.equal(resumed.id,jb.id);assert.equal(resumed.room.code,room);
 await a.wait(x=>x.t==='room'&&x.room.players.find(p=>p.id===jb.id)?.connected===true);
 a.send({t:'arena',id:'vortex'});await a.wait(x=>x.t==='room'&&x.room.arena==='vortex');a.send({t:'bots',count:0});await a.wait(x=>x.t==='room'&&x.room.bots===0);
 a.send({t:'start'});await a.wait(x=>x.t==='room'&&x.room.status==='playing');
 await b2.wait(x=>x.t==='tick'&&x.fighters.length===2);
 const before=await b2.wait(x=>x.t==='tick'&&x.time>=0.3);
 b2.send({t:'input',x:1,y:1,burst:true});await b2.wait(x=>x.t==='event'&&x.kind==='skill');
 b2.socket.close();await a.wait(x=>x.t==='room'&&x.room.players.some(p=>p.id===jb.id&&p.connected===false));
 const b3=await client('guest-reconnect-match');await b3.wait(x=>x.t==='hello');b3.send({t:'resume',token:jb.token});
 const back=await b3.wait(x=>x.t==='joined'&&x.resumed);assert.equal(back.room.status,'playing');
 const after=await b3.wait(x=>x.t==='tick'&&x.time>before.time);assert(after.fighters.some(p=>p.id===jb.id));
 b3.send({t:'ping'});await b3.wait(x=>x.t==='pong');
 a.send({t:'leave'}); // Leaving player does not receive room broadcast.
 const updates=await b3.wait(x=>x.t==='room'&&x.room.host===jb.id);assert.equal(updates.room.host,jb.id);
 console.log('✓ HTTP assets, manifest, health + traversal protection');
 console.log('✓ invite by code + 64-digit private rejoin token');
 console.log('✓ disconnected player slot preserved + invalid token rejected');
 console.log('✓ reconnect before and during live match, including input & skill');
 console.log('✓ ping and new host assignment');
 for(const c of [a,b2,b3])c.socket.close();
 console.log('ALL V2 REMOTE TESTS PASS');
}
run().catch(e=>{console.error(e);process.exit(1);});

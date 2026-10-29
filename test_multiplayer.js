/** Local integration test for a running server; no external dependencies. */
'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const address=process.env.GAME_WS||'ws://127.0.0.1:3000/ws';
const pending=[];
function client(name){return new Promise((resolve,reject)=>{const socket=new WebSocket(address);const c={socket,name,messages:[],id:null,code:null,send:m=>socket.send(JSON.stringify(m)),wait:(pred,limit=6000)=>new Promise((res,rej)=>{const match=c.messages.find(pred);if(match)return res(match);let timer=setTimeout(()=>{pending.splice(pending.indexOf(entry),1);rej(new Error(`${name}: timeout waiting for ${pred.toString().slice(0,90)}; recent ${c.messages.slice(-4).map(x=>x.t).join()}`));},limit);const entry={c,pred,res:v=>{clearTimeout(timer);res(v);}};pending.push(entry);})};socket.onmessage=e=>{const m=JSON.parse(e.data);c.messages.push(m);if(m.t==='hello'){c.id=m.id;}for(const p of [...pending]){if(p.c===c&&p.pred(m)){pending.splice(pending.indexOf(p),1);p.res(m);}}};socket.onopen=()=>resolve(c);socket.onerror=reject;});}
async function run(){const checkHttp=await new Promise((resolve,reject)=>http.get('http://127.0.0.1:3000/health',r=>{let x='';r.on('data',d=>x+=d);r.on('end',()=>resolve(JSON.parse(x)));}).on('error',reject));assert(checkHttp.ok);
 const a=await client('alpha'),b=await client('bravo'),c=await client('charlie'),d=await client('delta');await Promise.all([a,b,c,d].map(x=>x.wait(m=>m.t==='hello')));
 a.send({t:'create',name:'測試主機',top:'phoenix'});const joinA=await a.wait(m=>m.t==='joined');assert.equal(joinA.room.players.length,1);const room=joinA.room.code;
 b.send({t:'join',code:room,name:'測試隊友B',top:'golem'});await b.wait(m=>m.t==='joined');
 c.send({t:'join',code:room,name:'測試隊友C',top:'fox'});await c.wait(m=>m.t==='joined');
 d.send({t:'join',code:room,name:'測試隊友D',top:'solar'});await d.wait(m=>m.t==='joined');
 await a.wait(m=>m.t==='room'&&m.room.players.length===4);a.send({t:'arena',id:'volcano'});await a.wait(m=>m.t==='room'&&m.room.arena==='volcano');
 a.send({t:'start'});await Promise.all([a,b,c,d].map(x=>x.wait(m=>m.t==='room'&&m.room.status==='playing')));
 const snaps=await Promise.all([a,b,c,d].map(x=>x.wait(m=>m.t==='tick'&&Array.isArray(m.fighters)&&m.fighters.length===4)));
 assert(snaps.every(x=>x.fighters.length===4));const ids=snaps.map(x=>x.fighters.map(f=>f.id).sort().join(','));assert(ids.every(x=>x===ids[0]),'Players disagree on fighters');
 a.send({t:'input',charge:true,targetId:b.id});b.send({t:'input',burst:true});c.send({t:'input',charge:true,targetId:d.id});d.send({t:'input',burst:true});await new Promise(r=>setTimeout(r,800));
 const after=await a.wait(m=>m.t==='tick'&&m.time>0.6);assert(after.fighters.every(f=>Number.isFinite(f.x)));assert(a.messages.some(m=>m.t==='event'&&m.kind==='skill'),'Skill event missing');assert(a.messages.some(m=>m.t==='event'&&m.kind==='charge'),'Charge event missing');
 console.log('✓ 4 real players connected and joined same room');console.log('✓ arena and lobby settings synchronized');console.log('✓ authoritative snapshots match across browsers');console.log('✓ one-shot charges and special skills triggered');
 for(const x of [a,b,c,d])x.socket.close();
 const solo=await client('solo');await solo.wait(m=>m.t==='hello');solo.send({t:'create',name:'練習玩家',top:'lynx'});const r=await solo.wait(m=>m.t==='joined');assert.equal(r.room.bots,1);solo.send({t:'start'});await solo.wait(m=>m.t==='room'&&m.room.status==='playing');const snap=await solo.wait(m=>m.t==='tick'&&m.fighters.length===2);assert(snap.fighters.some(x=>x.bot));console.log('✓ solo practice with server-side AI opponent');solo.socket.close();console.log('ALL MULTIPLAYER TESTS PASS');}
run().catch(err=>{console.error(err);process.exitCode=1;setTimeout(()=>process.exit(1),200);});

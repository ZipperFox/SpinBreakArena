/** SPIN//BREAK ARENA — zero-dependency authoritative Node.js multiplayer server. */
'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PORT = +(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const TPS = 30, DT = 1 / TPS, MAX_PLAYERS = 4, ROOM_IDLE_MS = 45 * 60 * 1000;
const ROOT = path.join(__dirname, 'public');
const TOPS = [
  {id:'phoenix',name:'緋焰鳳凰',type:'攻擊',a:7,d:3,s:6,e:4,skill:'赤焰爆裂',power:'blast',cd:10,color:'#ff613f',accent:'#ffd36b'},
  {id:'raptor',name:'雷霆迅鷹',type:'攻擊',a:7,d:3,s:7,e:3,skill:'超電磁衝鋒',power:'dash',cd:11,color:'#f8c942',accent:'#a1f8ff'},
  {id:'mantis',name:'血月螳螂',type:'攻擊',a:8,d:3,s:5,e:4,skill:'緋紅刃舞',power:'blade',cd:11,color:'#fb436f',accent:'#ffbcce'},
  {id:'behemoth',name:'鋼鐵巨獸',type:'防禦',a:4,d:7,s:3,e:6,skill:'絕對要塞',power:'fortress',cd:10,color:'#7bb9d9',accent:'#e1f6ff'},
  {id:'glacier',name:'永凍冰壁',type:'防禦',a:3,d:8,s:3,e:6,skill:'零度封鎖',power:'ice',cd:11,color:'#7be3ff',accent:'#ffffff'},
  {id:'golem',name:'黑曜巨神',type:'防禦',a:4,d:8,s:2,e:6,skill:'大地震盪',power:'quake',cd:10,color:'#b39bff',accent:'#f7dbad'},
  {id:'lynx',name:'疾風山貓',type:'速度',a:5,d:3,s:8,e:4,skill:'暴風加速',power:'speed',cd:9,color:'#50edd1',accent:'#eaff9b'},
  {id:'fox',name:'幻影九尾',type:'速度',a:4,d:4,s:8,e:4,skill:'殘像閃避',power:'phase',cd:11,color:'#dc88ff',accent:'#fbd2ff'},
  {id:'cobra',name:'蒼嵐眼鏡蛇',type:'速度',a:5,d:4,s:7,e:4,skill:'螺旋風暴',power:'storm',cd:10,color:'#63ec9b',accent:'#d6ffd5'},
  {id:'leviathan',name:'深淵海龍',type:'平衡',a:5,d:5,s:5,e:5,skill:'深海重力',power:'vortex',cd:11,color:'#618df9',accent:'#a0e9ff'},
  {id:'solar',name:'日輪聖龍',type:'平衡',a:6,d:4,s:5,e:5,skill:'太陽再燃',power:'heal',cd:12,color:'#ffb555',accent:'#fff0af'},
  {id:'unicorn',name:'星辰獨角獸',type:'平衡',a:4,d:5,s:6,e:5,skill:'群星共鳴',power:'nova',cd:11,color:'#d3b3ff',accent:'#fcffff'},
];
const TOP_BY_ID = Object.fromEntries(TOPS.map(x => [x.id, x]));
const ARENAS = [
  {id:'colosseum',name:'王者競技場',desc:'標準競技場，純粹決勝負'},
  {id:'vortex',name:'深淵漩渦',desc:'中央引力改變走位'},
  {id:'tempest',name:'雷暴聖域',desc:'旋轉風場，順勢加速'},
  {id:'volcano',name:'熔岩裂谷',desc:'雙側熔岩間歇噴發'},
  {id:'eclipse',name:'終焉日蝕',desc:'隨時間逐漸收縮的戰圈'},
];
const ARENA_IDS = new Set(ARENAS.map(a=>a.id));
const rooms = new Map();
const RESUME_WINDOW_MS = 90 * 1000;
const MAX_ROOMS = 80;
const MAX_SOCKETS = 180;
const sockets = new Set();
let nextClient = 0;
const clamp = (v,min,max) => Math.max(min, Math.min(max, v));
const rnd = (a,b) => a + Math.random() * (b-a);
const dist = (x,y) => Math.hypot(x,y);
const now = () => Date.now();
function safeName(v) { return String(v || '挑戰者').replace(/[<>\\\r\n\t]/g,'').slice(0,16).trim() || '挑戰者'; }
function code() { let s; do { s = [...crypto.randomBytes(5)].slice(0,5).map(v=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v%32]).join(''); } while(rooms.has(s)); return s; }
function publicRoom(r) {return {code:r.code,host:r.host,status:r.status,arena:r.arena,bots:r.bots,players:r.players.map(p=>({id:p.id,name:p.name,top:p.top,bot:p.bot,connected:p.connected!==false,ready:p.connected!==false})),results:r.results||null,round:r.round};}
function send(ws, obj) { if (!ws || ws.closed) return; if(ws.sock.writableLength>1024*1024)return disconnect(ws); const data = Buffer.from(JSON.stringify(obj)); let head; if (data.length<126) {head=Buffer.from([0x81,data.length]);} else if(data.length<65536){head=Buffer.alloc(4);head[0]=0x81;head[1]=126;head.writeUInt16BE(data.length,2);}else {head=Buffer.alloc(10);head[0]=0x81;head[1]=127;head.writeBigUInt64BE(BigInt(data.length),2);} try{ws.sock.write(Buffer.concat([head,data]));}catch{disconnect(ws);} }
function broadcast(r,obj){for(const p of r.players){if(!p.bot)send(p.ws,obj);}}
function updateLobby(r){ r.updated=now();broadcast(r,{t:'room',room:publicRoom(r)}); }
function error(ws,msg){send(ws,{t:'error',msg});}
function exitRoom(ws,temporary=false){
  const r=ws.room;if(!r)return;ws.room=null;
  const idx=r.players.findIndex(p=>p.id===ws.id && p.ws===ws);
  if(idx<0)return;const p=r.players[idx];
  if(temporary){
    p.ws=null;p.connected=false;p.lostAt=now();
    const f=r.fighters.find(x=>x.id===p.id);if(f)f.input={x:0,y:0,guard:false};
  }else{
    r.players.splice(idx,1);
    if(r.status==='playing'){const f=r.fighters.find(x=>x.id===p.id);if(f&&f.alive)ko(r,f,'離開競技場');}
  }
  if(r.players.length===0){rooms.delete(r.code);return;}
  if(!temporary&&r.host===ws.id)r.host=r.players.find(x=>x.connected)?.id||r.players[0].id;
  updateLobby(r);
}
function disconnect(ws){if(ws.closed)return;ws.closed=true;sockets.delete(ws);exitRoom(ws,true);try{ws.sock.destroy();}catch{}}
function resume(ws,token){
  if(typeof token!=='string'||!/^([a-f0-9]{64})$/.test(token))return send(ws,{t:'resume_failed'});
  for(const r of rooms.values()){
    const p=r.players.find(x=>x.token===token);
    if(!p)continue;
    if(p.lostAt&&now()-p.lostAt>RESUME_WINDOW_MS)return send(ws,{t:'resume_failed'});
    exitRoom(ws);
    if(p.ws&&p.ws!==ws)disconnect(p.ws);
    ws.id=p.id;ws.room=r;p.ws=ws;p.connected=true;p.lostAt=0;
    send(ws,{t:'joined',id:ws.id,room:publicRoom(r),token:p.token,resumed:true});
    if(r.status==='playing')send(ws,snapshot(r));
    if(r.status==='results')send(ws,{t:'result',results:r.results});
    updateLobby(r);return;
  }
  send(ws,{t:'resume_failed'});
}
function purgeAbsent(r){
  let changed=false;
  for(const p of [...r.players])if(!p.connected&&p.lostAt&&now()-p.lostAt>RESUME_WINDOW_MS){
    r.players.splice(r.players.indexOf(p),1);changed=true;
    if(r.status==='playing'){const f=r.fighters.find(x=>x.id===p.id);if(f&&f.alive)ko(r,f,'斷線逾時');}
  }
  if(!r.players.length){rooms.delete(r.code);return;}
  if(!r.players.some(x=>x.id===r.host)){r.host=r.players.find(x=>x.connected)?.id||r.players[0].id;changed=true;}
  if(changed)updateLobby(r);
}
function createRoom(ws, msg, joinCode) {
  exitRoom(ws);let r;
  if(joinCode){r=rooms.get(String(joinCode).trim().toUpperCase());if(!r)return error(ws,'找不到房間，請確認房間代碼');if(r.status!=='lobby')return error(ws,'對戰進行中，請等待下一場');if(r.players.length>=MAX_PLAYERS)return error(ws,'房間人數已滿');while(r.players.length+1+r.bots>MAX_PLAYERS)r.bots--;}
  else {if(rooms.size>=MAX_ROOMS)return error(ws,'伺服器房間已達上限，稍後再試');r={code:code(),host:ws.id,status:'lobby',arena:'colosseum',bots:1,players:[],fighters:[],events:[],results:null,round:0,updated:now(),age:0,hitPairs:new Map()};rooms.set(r.code,r);}
  const token=crypto.randomBytes(32).toString('hex');
  ws.room=r;r.players.push({id:ws.id,name:safeName(msg.name),top:TOP_BY_ID[msg.top]?msg.top:'phoenix',bot:false,ws,connected:true,lostAt:0,token});
  send(ws,{t:'joined',id:ws.id,room:publicRoom(r),token,resumed:false});updateLobby(r);
}
function fightersFor(r){const members=r.players.filter(p=>!p.bot).map(p=>({...p}));const picks=TOPS.slice();for(let i=picks.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[picks[i],picks[j]]=[picks[j],picks[i]];}
  for(let i=0;i<r.bots;i++){members.push({id:'bot'+i,name:['烈焰','閃電','旋風'][i]+'機神',top:picks[(i+r.round*3)%picks.length].id,bot:true});}
  return members.map((p,i)=>{let a=2*Math.PI*i/members.length-Math.PI/2;return {...p,x:Math.cos(a)*185,y:Math.sin(a)*185,vx:Math.cos(a+Math.PI/2)*65,vy:Math.sin(a+Math.PI/2)*65,hp:100,spin:100,alive:true,shield:false,cool:0,burstUntil:0,fortressUntil:0,phaseUntil:0,slowUntil:0,bladeUntil:0,boostUntil:0,stunUntil:0,edgeRisk:0,skillCount:0,impact:0,score:0,lastHit:null,lastHitAt:0,input:{x:0,y:0,guard:false},aiTimer:0,aiTarget:null};});
}
function start(r){if(r.status!=='lobby')return;if(r.players.filter(x=>x.connected).length<1||r.players.some(x=>!x.connected))return;if(r.players.length+r.bots<2)return; r.round++;r.fighters=fightersFor(r);r.status='playing';r.age=0;r.results=null;r.hitPairs.clear();r.events=[];broadcast(r,{t:'room',room:publicRoom(r)});event(r,'start','BATTLE START!','',0);}
function event(r,kind,msg,id,amount){const e={t:'event',kind,msg,id,amount,seq:crypto.randomBytes(3).toString('hex')};r.events.push(e);if(r.events.length>12)r.events.shift();broadcast(r,e);}
function damage(r,target,hp,spin,source,detail){if(!target.alive || target.phaseUntil>r.age)return 0;const t=TOP_BY_ID[target.top];const guarding=target.input.guard&&target.spin>5;const fortress=target.fortressUntil>r.age;let factor=(1-(t.d-4)*0.043-Math.max(0,t.s-5)*0.026)*(guarding?0.54:1)*(fortress?0.53:1);const actual=Math.max(0.3,hp*factor);target.hp=Math.max(0,target.hp-actual);target.spin=Math.max(0,target.spin-spin*(guarding?0.62:1)*(fortress?0.5:1));target.impact=0.3;if(source&&source.id!==target.id){target.lastHit=source.name;target.lastHitAt=r.age;}if(target.hp<=0||target.spin<=0)ko(r,target,detail||'失去轉速');return actual;}
function ko(r,p,reason){if(!p.alive)return;p.alive=false;p.hp=Math.max(0,p.hp);p.spin=Math.max(0,p.spin);event(r,'ko',`${p.name} 失去戰鬥能力！`,p.id,0);if(r.fighters.filter(p=>p.alive).length<=1)finish(r);}
function finish(r){if(r.status!=='playing')return;const ranked=[...r.fighters].sort((a,b)=>Number(b.alive)-Number(a.alive)||b.hp-a.hp||b.spin-a.spin);r.results=ranked.map((p,i)=>({id:p.id,name:p.name,top:p.top,rank:i+1,hp:Math.round(p.hp),spin:Math.round(p.spin)}));r.status='results';broadcast(r,{t:'result',results:r.results});updateLobby(r);}
function skill(r,p){if(!p.alive||p.cool>0||p.spin<16||p.stunUntil>r.age)return;const t=TOP_BY_ID[p.top];p.spin-=16;p.cool=t.cd;p.skillCount++;let radius=135;
  const foes=r.fighters.filter(q=>q.alive&&q.id!==p.id);
  function push(q,amt){let dx=q.x-p.x,dy=q.y-p.y,n=Math.max(1,dist(dx,dy));q.vx+=dx/n*amt;q.vy+=dy/n*amt;q.edgeRisk=r.age+1.3;}
  switch(t.power){
    case 'blast':for(const q of foes)if(dist(q.x-p.x,q.y-p.y)<168){damage(r,q,13,8,p,'赤焰爆裂');push(q,250);}break;
    case 'dash':p.boostUntil=r.age+2.4;p.bladeUntil=r.age+2.4;{const n=dist(p.input.x,p.input.y)||1;let dx=p.input.x/n,dy=p.input.y/n;if(n<=1){const q=foes.sort((a,b)=>dist(a.x-p.x,a.y-p.y)-dist(b.x-p.x,b.y-p.y))[0];dx=q?(q.x-p.x)/Math.max(1,dist(q.x-p.x,q.y-p.y)):1;dy=q?(q.y-p.y)/Math.max(1,dist(q.x-p.x,q.y-p.y)):0;}p.vx+=dx*290;p.vy+=dy*290;}break;
    case 'blade':p.bladeUntil=r.age+4.9;for(const q of foes)if(dist(q.x-p.x,q.y-p.y)<135){damage(r,q,12,4,p);push(q,120);}break;
    case 'fortress':p.fortressUntil=r.age+4.2;p.spin=Math.min(100,p.spin+6);break;
    case 'ice':for(const q of foes)if(dist(q.x-p.x,q.y-p.y)<200){q.slowUntil=r.age+4;damage(r,q,7,5,p);push(q,50);}p.fortressUntil=r.age+2.6;break;
    case 'quake':for(const q of foes)if(dist(q.x-p.x,q.y-p.y)<195){damage(r,q,13,7,p);q.stunUntil=r.age+1.15;push(q,280);}break;
    case 'speed':p.boostUntil=r.age+5;p.bladeUntil=r.age+2.2;p.spin=Math.min(100,p.spin+8);break;
    case 'phase':p.phaseUntil=r.age+1.25;p.boostUntil=r.age+1.8;break;
    case 'storm':p.boostUntil=r.age+3;p.bladeUntil=r.age+3;for(const q of foes)if(dist(q.x-p.x,q.y-p.y)<105){damage(r,q,5,3,p);push(q,130);}break;
    case 'vortex':p.fortressUntil=r.age+2.1;for(const q of foes)if(dist(q.x-p.x,q.y-p.y)<250){let dx=p.x-q.x,dy=p.y-q.y,n=Math.max(1,dist(dx,dy));q.vx+=dx/n*100;q.vy+=dy/n*100;q.slowUntil=r.age+2.3;damage(r,q,9,7,p);}break;
    case 'heal':p.hp=Math.min(100,p.hp+21);p.spin=Math.min(100,p.spin+15);break;
    case 'nova':p.hp=Math.min(100,p.hp+10);p.spin=Math.min(100,p.spin+14);for(const q of foes)if(dist(q.x-p.x,q.y-p.y)<145){damage(r,q,7,4,p);push(q,130);}break;
  }
  event(r,'skill',`${p.name} · ${t.skill}！`,p.id,0);
}
function boundRadius(r){return r.arena==='eclipse'?285-65*clamp((r.age-12)/70,0,1):285;}
function applyArena(r,p,dt){if(r.arena==='vortex'){const d=Math.max(40,dist(p.x,p.y));p.vx-=p.x/d*60*dt;p.vy-=p.y/d*60*dt;if(d<63)p.spin=Math.max(0,p.spin-0.65*dt);}
 else if(r.arena==='tempest'){p.vx+=(-p.y/285)*65*dt;p.vy+=(p.x/285)*65*dt;}
 else if(r.arena==='volcano'){const cycle=r.age%9;const live=cycle>5.8&&cycle<7.8;if(live){for(const v of [{x:-128,y:0},{x:128,y:0}])if(dist(p.x-v.x,p.y-v.y)<58){p.hp-=5.0*dt;p.spin-=3.5*dt;p.impact=0.1;if(p.hp<=0||p.spin<=0)ko(r,p,'熔岩噴發');}}}
}
function updateAI(r,p,dt){p.aiTimer-=dt;if(p.aiTimer<=0){p.aiTimer=rnd(.32,.8);const foes=r.fighters.filter(q=>q.alive&&q.id!==p.id);const target=foes.sort((a,b)=>dist(a.x-p.x,a.y-p.y)-dist(b.x-p.x,b.y-p.y))[0];if(target){const dx=target.x-p.x,dy=target.y-p.y,n=dist(dx,dy)||1;const aggression=Math.random();p.input.x=dx/n*(aggression<.82?1:-.5)-dy/n*rnd(-.38,.38);p.input.y=dy/n*(aggression<.82?1:-.5)+dx/n*rnd(-.38,.38);p.aiTarget=target.id;}p.input.guard=Math.random()<.16;}
 if(p.cool<=0&&p.spin>27&&Math.random()<dt*(.24+(100-p.hp)/220))skill(r,p);
}
function tickRoom(r,dt){if(r.status!=='playing')return;r.age+=dt;
 for(const p of r.fighters){if(!p.alive)continue;const t=TOP_BY_ID[p.top];if(p.bot)updateAI(r,p,dt);p.cool=Math.max(0,p.cool-dt);p.impact=Math.max(0,p.impact-dt);let inp=p.input;
  const n=Math.hypot(inp.x,inp.y)||1,speed=(145+t.s*15)*(p.boostUntil>r.age?1.42:1)*(p.slowUntil>r.age?.55:1);let accel=3.5 + t.s*.2;if(p.stunUntil>r.age)accel=0;if(inp.guard&&p.spin>5){accel*=.66;p.spin-=1.55*dt;}
  const tx=inp.x/n*speed,ty=inp.y/n*speed;
  p.vx+=(tx-p.vx)*Math.min(1,accel*dt);p.vy+=(ty-p.vy)*Math.min(1,accel*dt);
  if(p.stunUntil>r.age){p.vx*=.97;p.vy*=.97;}
  applyArena(r,p,dt);
  p.x+=p.vx*dt;p.y+=p.vy*dt;
  p.spin-=dt*(.62+(6-t.e)*.07+(p.bladeUntil>r.age?.17:0));
  if(p.spin<=0){p.spin=0;ko(r,p,'轉速歸零');continue;}
  const radius=boundRadius(r),dd=dist(p.x,p.y);if(dd>radius-18){const nx=p.x/dd,ny=p.y/dd,rv=p.vx*nx+p.vy*ny;
    if(dd>radius+5&&p.edgeRisk>r.age&&rv>55){ko(r,p,'擊出場外');continue;}
    const pen=dd-(radius-18);p.x-=nx*pen;p.y-=ny*pen;
    if(rv>0){p.vx-=1.55*rv*nx;p.vy-=1.55*rv*ny;}
    if(dd>radius-10&&rv>55){p.spin=Math.max(0,p.spin-.8*dt);}
  }
 }
 const alive=r.fighters.filter(p=>p.alive);
 for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++){
  const a=alive[i],b=alive[j],dx=b.x-a.x,dy=b.y-a.y,d=dist(dx,dy),limit=45;
  if(d>=limit)continue;const nx=(dx||.01)/(d||1),ny=dy/(d||1),overlap=limit-d;a.x-=nx*overlap*.5;a.y-=ny*overlap*.5;b.x+=nx*overlap*.5;b.y+=ny*overlap*.5;
  const va=a.vx*nx+a.vy*ny,vb=b.vx*nx+b.vy*ny,closing=va-vb;
  if(closing>0){const ta=TOP_BY_ID[a.top],tb=TOP_BY_ID[b.top],ma=1+(ta.d-4)*.07,mb=1+(tb.d-4)*.07,impulse=closing*1.2/(1/ma+1/mb);a.vx-=nx*impulse/ma;a.vy-=ny*impulse/ma;b.vx+=nx*impulse/mb;b.vy+=ny*impulse/mb;}
  let key=[a.id,b.id].sort().join(':'),last=r.hitPairs.get(key)||-10;
  if(r.age-last>.42){r.hitPairs.set(key,r.age);const ta=TOP_BY_ID[a.top],tb=TOP_BY_ID[b.top];// Directional collision: the faster initiator deals the heavier blow.
    // Passive defenders receive a smaller recoil hit rather than equal, free counter-damage.
    const chargeA=clamp(.48+Math.max(0,va)/205,.48,1.7);
    const chargeB=clamp(.48+Math.max(0,-vb)/205,.48,1.7);
    const da=(2.7+ta.a*.78+(a.bladeUntil>r.age?(ta.power==='blade'?5.5:3.5):0))*chargeA;
    const db=(2.7+tb.a*.78+(b.bladeUntil>r.age?(tb.power==='blade'?5.5:3.5):0))*chargeB;
    const dealtA=damage(r,b,da,da*.32,a,'高速撞擊');const dealtB=damage(r,a,db,db*.32,b,'高速撞擊');a.edgeRisk=r.age+1.3;b.edgeRisk=r.age+1.3;
    event(r,'hit',`${a.name} ⚡ ${b.name}`,a.id,Math.round(Math.max(dealtA,dealtB)));
  }
 }
 if(r.status!=='playing')return;
 if(r.age>=95){for(const p of r.fighters)if(p.alive){p.alive=false;}const ranking=[...r.fighters].sort((a,b)=>b.hp-a.hp||b.spin-a.spin);if(ranking[0])ranking[0].alive=true;finish(r);return;}
 if(r.fighters.filter(p=>p.alive).length<=1)finish(r);
}
function snapshot(r){return {t:'tick',time:Math.round(r.age*10)/10,radius:boundRadius(r),arena:r.arena,fighters:r.fighters.map(p=>({id:p.id,name:p.name,top:p.top,bot:p.bot,x:Math.round(p.x*10)/10,y:Math.round(p.y*10)/10,vx:Math.round(p.vx),vy:Math.round(p.vy),hp:Math.max(0,Math.round(p.hp)),spin:Math.max(0,Math.round(p.spin)),alive:p.alive,cool:+p.cool.toFixed(1),shield:p.input.guard||p.fortressUntil>r.age,phase:p.phaseUntil>r.age,boost:p.boostUntil>r.age,blade:p.bladeUntil>r.age,slow:p.slowUntil>r.age,impact:p.impact>0,skillCount:p.skillCount}))};}
function handle(ws,msg){if(!msg||typeof msg!=='object'||typeof msg.t!=='string')return;const r=ws.room;
 switch(msg.t){
  case 'resume':return resume(ws,msg.token);
  case 'ping':return send(ws,{t:'pong'});
  case 'create':return createRoom(ws,msg,null);
  case 'join':return createRoom(ws,msg,msg.code);
  case 'leave':return exitRoom(ws);
  case 'set':if(!r||r.status!=='lobby')return;{const p=r.players.find(p=>p.id===ws.id);if(p){if(TOP_BY_ID[msg.top])p.top=msg.top;if(msg.name)p.name=safeName(msg.name);updateLobby(r);}}return;
  case 'arena':if(!r||r.host!==ws.id||r.status!=='lobby'||!ARENA_IDS.has(msg.id))return; r.arena=msg.id;return updateLobby(r);
  case 'bots':if(!r||r.host!==ws.id||r.status!=='lobby')return;r.bots=clamp(Math.floor(Number(msg.count)||0),0,MAX_PLAYERS-r.players.filter(p=>!p.bot).length);return updateLobby(r);
  case 'start':if(!r||r.host!==ws.id)return;return start(r);
  case 'again':if(!r||r.host!==ws.id||r.status!=='results')return;r.status='lobby';r.fighters=[];r.results=null;return updateLobby(r);
  case 'input':if(!r||r.status!=='playing')return;{const p=r.fighters.find(p=>p.id===ws.id);if(!p||!p.alive)return;p.input.x=clamp(Number(msg.x)||0,-1,1);p.input.y=clamp(Number(msg.y)||0,-1,1);p.input.guard=!!msg.guard;if(msg.burst)skill(r,p);}return;
 }
}
// RFC 6455 WebSocket framing (masked client frames, fragmented frame support omitted intentionally).
function parseFrames(ws,chunk){ws.buffer=Buffer.concat([ws.buffer,chunk]);if(ws.buffer.length>16384)return disconnect(ws);while(ws.buffer.length>=2){const buf=ws.buffer;const b0=buf[0],b1=buf[1],op=b0&15,masked=!!(b1&128),fin=!!(b0&128);let len=b1&127,offset=2;
  if(len===126){if(buf.length<4)return;len=buf.readUInt16BE(2);offset=4;}else if(len===127){if(buf.length<10)return;const big=buf.readBigUInt64BE(2);if(big>8192n)return disconnect(ws);len=Number(big);offset=10;}
  if(len>8192||!masked||!fin)return disconnect(ws);if(buf.length<offset+4+len)return;const key=buf.subarray(offset,offset+4);offset+=4;const payload=Buffer.from(buf.subarray(offset,offset+len));for(let i=0;i<len;i++)payload[i]^=key[i%4];ws.buffer=buf.subarray(offset+len);
  if(op===8)return disconnect(ws);if(op===9){try{ws.sock.write(Buffer.from([0x8a,payload.length,...payload]));}catch{return disconnect(ws);}continue;}
  if(op===10)continue;if(op!==1) return disconnect(ws);
  const timestamp=now();if(timestamp-ws.rateStart>1000){ws.rateStart=timestamp;ws.rateCount=0;}if(++ws.rateCount>80)return disconnect(ws);
  try{handle(ws,JSON.parse(payload.toString('utf8')));}catch{}
  if(ws.closed)return;
 } }
const mime={'.webmanifest':'application/manifest+json','.png':'image/png','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
  if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,game:'spin-break-arena',version:'2.0',rooms:rooms.size,uptime:Math.round(process.uptime())}));return;}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end('Method not allowed');return;}
  let uri;try{uri=decodeURIComponent((req.url||'/').split('?')[0]);}catch{res.writeHead(400);res.end('Invalid path');return;}const file=path.resolve(ROOT,'.'+(uri==='/'?'/index.html':uri));
  if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);});
});
server.on('upgrade',(req,sock,head)=>{
  if(sockets.size>=MAX_SOCKETS){sock.destroy();return;}
  if(req.url!=='/ws'||req.headers.upgrade?.toLowerCase()!=='websocket'||!req.headers['sec-websocket-key']){sock.destroy();return;}
  // Reject cross-origin browser sockets; the client and game server share one origin.
  if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){sock.destroy();return;}}catch{sock.destroy();return;}}
  const key=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+key+'\r\n\r\n');
  const ws={id:'P'+(++nextClient),sock,closed:false,buffer:Buffer.alloc(0),room:null,rateStart:now(),rateCount:0};sockets.add(ws);
  sock.on('data',c=>{if(!ws.closed)parseFrames(ws,c);});sock.on('close',()=>disconnect(ws));sock.on('error',()=>disconnect(ws));sock.setNoDelay(true);if(head.length)parseFrames(ws,head);
  send(ws,{t:'hello',id:ws.id,tops:TOPS,arenas:ARENAS,version:'2.0'});
});
if (require.main === module) {
  setInterval(()=>{for(const r of rooms.values())if(r.status==='playing')tickRoom(r,DT);},1000/TPS);
  setInterval(()=>{for(const r of rooms.values()){if(r.status==='playing')broadcast(r,snapshot(r));if(r.updated<now()-ROOM_IDLE_MS&&r.status!=='playing'){for(const p of r.players)if(!p.bot){send(p.ws,{t:'error',msg:'房間已逾時'});if(p.ws)p.ws.room=null;}rooms.delete(r.code);}}},50);
  setInterval(()=>{for(const r of rooms.values())purgeAbsent(r);},2000);
  server.listen(PORT,HOST,()=>console.log(`[SPIN//BREAK] http://localhost:${PORT} | WebSocket /ws | 免安裝外部套件`));
  process.on('SIGINT',()=>{server.close();process.exit(0);});
}
module.exports={TOPS,ARENAS,fightersFor,tickRoom,skill,start,snapshot,publicRoom,server};

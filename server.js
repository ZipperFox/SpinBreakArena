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
  {id:'solar',name:'日輪聖龍',type:'平衡',a:6,d:4,s:5,e:5,skill:'日輪穩心',power:'heal',cd:12,color:'#ffb555',accent:'#fff0af'},
  {id:'unicorn',name:'星辰獨角獸',type:'平衡',a:4,d:5,s:6,e:5,skill:'星環衝擊',power:'nova',cd:11,color:'#d3b3ff',accent:'#fcffff'},
];
const TOP_BY_ID = Object.fromEntries(TOPS.map(x => [x.id, x]));
// Original fantasy parts: inspired by the real three-layer customization principle, not licensed toy parts.
const PARTS = {
 ratchets: [
  {id:'low3',name:'三翼低重心',code:'3-L',mass:-.07,stability:.10,recoil:.06,drag:0,gear:3,desc:'輕快，低重心，容易控制'},
  {id:'heavy5',name:'五爪鋼輪',code:'5-H',mass:.18,stability:.02,recoil:.04,drag:.025,gear:5,desc:'重量衝擊，機動較低'},
  {id:'wide7',name:'七星平衡輪',code:'7-B',mass:.03,stability:.14,recoil:0,drag:.035,gear:7,desc:'抗晃動，偏向穩定'},
  {id:'tall4',name:'四刃高塔輪',code:'4-T',mass:-.02,stability:-.08,recoil:.19,drag:0,gear:4,desc:'高攻擊角度，但易晃動'},
  {id:'dense9',name:'九齒密度輪',code:'9-D',mass:.11,stability:.07,recoil:-.02,drag:.045,gear:9,desc:'持久穩重，速度稍慢'},
  {id:'swift2',name:'雙刃疾速輪',code:'2-S',mass:-.13,stability:-.04,recoil:.14,drag:0,gear:2,desc:'高速反彈，抗撞較弱'}
 ],
 bits: [
  {id:'flat',name:'平面衝擊軸',code:'FL',drive:1.24,control:.88,spinDrain:1.13,grip:1.17,rail:1.03,desc:'高速亂衝，碰撞爆發強'},
  {id:'rush',name:'追擊高速軸',code:'RU',drive:1.13,control:1.06,spinDrain:1.14,grip:1.09,rail:1.28,desc:'善於咬合外圈加速軌道'},
  {id:'ball',name:'球形耐久軸',code:'BA',drive:.84,control:.93,spinDrain:.77,grip:.95,rail:.85,desc:'低摩擦，保持轉速'},
  {id:'needle',name:'尖針守心軸',code:'NE',drive:.66,control:1.12,spinDrain:.71,grip:.93,rail:.82,desc:'低速守中，靠穩定獲勝'},
  {id:'taper',name:'錐形平衡軸',code:'TA',drive:1.02,control:1.04,spinDrain:.99,grip:1,rail:1,desc:'攻守均衡，適合起步'},
  {id:'orbit',name:'環流萬向軸',code:'OR',drive:1.08,control:1.12,spinDrain:1.02,grip:1.01,rail:1.06,desc:'方向轉換靈活'},
  {id:'gear',name:'齒輪突進軸',code:'GE',drive:1.10,control:.88,spinDrain:1.18,grip:1.04,rail:1.44,desc:'軌道增速最強，但消耗轉速'},
  {id:'rubber',name:'橡膠制動軸',code:'RB',drive:.90,control:1.25,spinDrain:1.22,grip:1.28,rail:.78,desc:'抓地強，撞擊不易失控'}
 ]
};
const RAT = Object.fromEntries(PARTS.ratchets.map(p=>[p.id,p]));
const BIT = Object.fromEntries(PARTS.bits.map(p=>[p.id,p]));
const DEFAULT_BUILD={ratchet:'wide7',bit:'taper'};
const validBuild=b=>({ratchet:RAT[b?.ratchet]?b.ratchet:DEFAULT_BUILD.ratchet,bit:BIT[b?.bit]?b.bit:DEFAULT_BUILD.bit});
const buildCode=b=>RAT[b.ratchet].code+' / '+BIT[b.bit].code;
const partStats=p=>{const rat=RAT[p.build?.ratchet]||RAT.wide7,bit=BIT[p.build?.bit]||BIT.taper;return {rat,bit,mass:clamp(1+rat.mass,.78,1.23),drive:bit.drive,control:bit.control,spinDrain:bit.spinDrain,grip:bit.grip,rail:bit.rail,stability:rat.stability,recoil:rat.recoil};};
const ARENAS = [
  {id:'colosseum',name:'王者競技場',desc:'弧形防撞護欄／兩處回場加速通道／南北出界口'},
  {id:'vortex',name:'深淵漩渦',desc:'四個緩衝墩／回場軌道／中央引力改變走位'},
  {id:'tempest',name:'雷暴聖域',desc:'雙側加速護欄／旋轉風場／反彈再進攻'},
  {id:'volcano',name:'熔岩裂谷',desc:'高彈力障礙墩／間歇噴發／危險出界口'},
  {id:'eclipse',name:'終焉日蝕',desc:'安全護欄逐漸內縮，後期封閉回場通道'},
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
function publicRoom(r) {return {code:r.code,host:r.host,status:r.status,arena:r.arena,bots:r.bots,players:r.players.map(p=>({id:p.id,name:p.name,top:p.top,build:p.build,bot:p.bot,connected:p.connected!==false,ready:p.connected!==false})),results:r.results||null,round:r.round};}
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
  ws.room=r;r.players.push({id:ws.id,name:safeName(msg.name),top:TOP_BY_ID[msg.top]?msg.top:'phoenix',build:validBuild(msg.build),bot:false,ws,connected:true,lostAt:0,token});
  send(ws,{t:'joined',id:ws.id,room:publicRoom(r),token,resumed:false});updateLobby(r);
}
function fightersFor(r){const members=r.players.filter(p=>!p.bot).map(p=>({...p}));const picks=TOPS.slice();for(let i=picks.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[picks[i],picks[j]]=[picks[j],picks[i]];}
  for(let i=0;i<r.bots;i++){members.push({id:'bot'+i,name:['烈焰','閃電','旋風'][i]+'機神',top:picks[(i+r.round*3)%picks.length].id,build:{ratchet:PARTS.ratchets[(i+r.round)%PARTS.ratchets.length].id,bit:PARTS.bits[(i*3+r.round)%PARTS.bits.length].id},bot:true});}
  return members.map((p,i)=>{let a=2*Math.PI*i/members.length-Math.PI/2;return {...p,x:Math.cos(a)*157,y:Math.sin(a)*157,vx:Math.cos(a+Math.PI/2)*(i%2?-112:112)-Math.cos(a)*38,vy:Math.sin(a+Math.PI/2)*(i%2?-112:112)-Math.sin(a)*38,orbitSign:i%2?-1:1,orbitPhase:i*2.4,chargeCd:0,chargeUntil:0,knockX:0,knockY:0,railTimer:0,railCooldown:0,railAngle:0,railSign:1,spin:100,wobble:0,koReason:'',edgeKick:0,alive:true,shield:false,cool:0,burstUntil:0,fortressUntil:0,phaseUntil:0,slowUntil:0,bladeUntil:0,boostUntil:0,stunUntil:0,edgeRisk:0,skillCount:0,impact:0,score:0,lastHit:null,lastHitAt:0,input:{guard:false,targetId:null},aiTimer:0,aiTarget:null};});
}
function start(r){if(r.status!=='lobby')return;if(r.players.filter(x=>x.connected).length<1||r.players.some(x=>!x.connected))return;if(r.players.length+r.bots<2)return; r.round++;r.fighters=fightersFor(r);r.status='playing';r.age=0;r.results=null;r.hitPairs.clear();r.contactPairs=new Map();r.events=[];broadcast(r,{t:'room',room:publicRoom(r)});event(r,'start','BATTLE START!','',0);}
function event(r,kind,msg,id,amount,extra={}){const e={t:'event',kind,msg,id,amount,...extra,seq:crypto.randomBytes(3).toString('hex')};r.events.push(e);if(r.events.length>12)r.events.shift();broadcast(r,e);}
// V5: autonomous momentum & tactical charge; ring-out / spin-stop remain decisive.  There is no health, hit point or damage system.
const DISC_R=22;
const massOf=p=>{const t=TOP_BY_ID[p.top];return (1+(t.d-5)*.075+(t.type==='防禦'?.07:0))*partStats(p).mass;};
const gripOf=p=>{const t=TOP_BY_ID[p.top];return clamp((.75+t.e*.055 + (p.input.guard?.18:0))*partStats(p).grip,.68,1.7);};
function loseSpin(r,p,amount,source){
 if(!p.alive||amount<=0)return;
 const t=TOP_BY_ID[p.top];
 let scale=clamp(1.15-(t.e-4)*.045-(t.type==='速度'?.18:0)-(p.fortressUntil>r.age?.18:0)-(p.input.guard?.12:0),.5,1.3);
 // Triangle of counters: attack destabilizes heavy defense, speed outmaneuvers attack,
 // and stable defensive rims punish reckless speed impacts. This supplements real momentum.
 if(source&&source!==p){
  const attacker=TOP_BY_ID[source.top]?.type;
  if(t.type==='防禦'&&attacker==='攻擊')scale*=1.65;
  if(t.type==='攻擊'&&attacker==='速度')scale*=1.32;
  if(t.type==='速度'&&attacker==='防禦')scale*=1.12;
 }
 // Prototype tuning, all unlocks are freely available. Applied to rotational recoil only.
 const tuning={golem:1.12,glacier:1.1,behemoth:1.09,raptor:.78,lynx:.77,leviathan:.88,unicorn:.94,mantis:.94};
 const loss=amount*scale*partStats(p).spinDrain*(tuning[p.top]||1);
 p.spin=Math.max(0,p.spin-loss);
 p.wobble=clamp(p.wobble+loss*(1.05-(t.d-4)*.035)*(1-partStats(p).stability),0,100);
 p.impact=.35;
 if(source&&source!==p){p.lastHit=source.name;p.lastHitAt=r.age;}
 if(p.spin<=1.5)ko(r,p,'停止轉動');
}
function ko(r,p,reason){
 if(!p.alive)return;
 p.alive=false;p.koReason=reason;p.spin=Math.max(0,p.spin);
 event(r,'ko',`${p.name} ${reason==='擊出場外'?'被猛烈擊出場外！':reason==='停止轉動'?'失去轉速，停止旋轉！':reason+'！'}`,p.id,0);
 if(r.fighters.filter(f=>f.alive).length<=1)finish(r);
}
function finish(r){
 if(r.status!=='playing')return;
 const ranked=[...r.fighters].sort((a,b)=>Number(b.alive)-Number(a.alive)||b.spin-a.spin||a.wobble-b.wobble);
 r.results=ranked.map((p,i)=>({id:p.id,name:p.name,top:p.top,rank:i+1,spin:Math.round(p.spin),reason:p.koReason|| (i===0?'最後旋轉者':'轉速判定')}));
 r.status='results';broadcast(r,{t:'result',results:r.results});updateLobby(r);
}
function kick(r,src,p,force,spinLoss=0){
 if(!p.alive||p.phaseUntil>r.age)return;
 const dx=p.x-src.x,dy=p.y-src.y,d=Math.max(1,dist(dx,dy));
 const nx=dx/d,ny=dy/d;
 const impulse=force/(massOf(p)*(p.fortressUntil>r.age?1.45:1));
 p.knockX+=nx*impulse;p.knockY+=ny*impulse;p.edgeKick=Math.max(p.edgeKick,impulse);
 if(spinLoss)loseSpin(r,p,spinLoss,src);
}
function chooseTarget(r,p,targetId){
 const foes=r.fighters.filter(q=>q.alive&&q.id!==p.id&&q.railTimer<=0);
 return foes.find(q=>q.id===targetId)||foes.sort((a,b)=>dist(a.x-p.x,a.y-p.y)-dist(b.x-p.x,b.y-p.y))[0]||null;
}
// Single-tap tactical movement, never continuous player steering.
function charge(r,p,targetId){
 if(!p.alive||p.railTimer>0||p.chargeCd>0||p.spin<11||p.stunUntil>r.age)return false;
 const target=chooseTarget(r,p,targetId||p.input.targetId);
 const t=TOP_BY_ID[p.top],part=partStats(p);
 let dx=target?target.x-p.x: -p.y,dy=target?target.y-p.y:p.x;
 // Lead a moving opponent; never trust client-supplied speed or impulse.
 if(target){dx+=clamp(target.vx+target.knockX,-230,230)*.18;dy+=clamp(target.vy+target.knockY,-230,230)*.18;}
 const norm=Math.max(1,dist(dx,dy));dx/=norm;dy/=norm;
 const burst=(255+t.s*14)*clamp(part.drive,.66,1.24)/Math.sqrt(massOf(p));
 p.knockX+=dx*burst;p.knockY+=dy*burst;
 const speed=dist(p.vx+p.knockX,p.vy+p.knockY);
 if(speed>610){const ratio=610/speed;p.vx*=ratio;p.vy*=ratio;p.knockX*=ratio;p.knockY*=ratio;}
 p.chargeUntil=r.age+.88;
 p.chargeCd=4.3+(t.type==='防禦'?.4:0);
 p.spin-=3.6;p.wobble=clamp(p.wobble+1.2,0,100);
 p.edgeKick=Math.max(p.edgeKick,burst*.38);
 event(r,'charge',`${p.name} · 極限衝鋒！`,p.id,Math.round(burst),{x:p.x,y:p.y,targetId:target?.id||null});
 return true;
}
function skill(r,p){
 if(!p.alive||p.cool>0||p.spin<13||p.stunUntil>r.age)return;
 const t=TOP_BY_ID[p.top];p.spin-=2.8;p.cool=t.cd;p.skillCount++;
 const foes=r.fighters.filter(q=>q.alive&&q.id!==p.id);
 const near=(radius,fun)=>{for(const q of foes)if(dist(q.x-p.x,q.y-p.y)<radius)fun(q);};
 switch(t.power){
  case 'blast':near(115,q=>kick(r,p,q,140,1.5));p.vx*=.9;p.vy*=.9;break;
  case 'dash':p.boostUntil=r.age+2.2;p.bladeUntil=r.age+2.2;{
    const target=chooseTarget(r,p,p.input.targetId);
    let dx=target?target.x-p.x:-p.y,dy=target?target.y-p.y:p.x,n=dist(dx,dy);
    n=Math.max(.001,n);p.vx+=dx/n*178;p.vy+=dy/n*178;
  }break;
  case 'blade':p.bladeUntil=r.age+4.5;p.boostUntil=r.age+1.5;break;
  case 'fortress':p.fortressUntil=r.age+7.8;p.wobble*=.32;p.vx*=.75;p.vy*=.75;break;
  case 'ice':near(150,q=>{q.slowUntil=r.age+2.6;kick(r,p,q,145,.9);});p.fortressUntil=r.age+2.2;break;
  case 'quake':near(125,q=>{kick(r,p,q,235,1.8);q.stunUntil=r.age+.45;});p.vx*=.5;p.vy*=.5;break;
  case 'speed':p.boostUntil=r.age+5;p.bladeUntil=r.age+2;break;
  case 'phase':p.phaseUntil=r.age+1.45;p.boostUntil=r.age+2.4;p.wobble*=.6;break;
  case 'storm':p.boostUntil=r.age+3.5;p.bladeUntil=r.age+3.5;near(110,q=>kick(r,p,q,155,.7));break;
  case 'vortex':p.fortressUntil=r.age+2.5;p.bladeUntil=r.age+2.5;near(230,q=>{let dx=p.x-q.x,dy=p.y-q.y,n=Math.max(1,dist(dx,dy));q.vx+=dx/n*125/massOf(q);q.vy+=dy/n*125/massOf(q);q.slowUntil=r.age+1.4;});break;
  case 'heal':p.wobble*=.32;p.fortressUntil=r.age+3.1;p.vx*=.8;p.vy*=.8;break;
  case 'nova':p.wobble*=.55;near(145,q=>kick(r,p,q,260,1.5));break;
 }
 event(r,'skill',`${p.name} · ${t.skill}！`,p.id,0);
}
// Visible bounce pillars and channel entrances. Same geometry is sent to the browser.
function arenaFeatures(r){
 const pillars=({colosseum:[[0,-125,16],[0,125,16]],vortex:[[-113,-87,17],[113,87,17],[-113,87,15],[113,-87,15]],tempest:[[0,-132,18],[0,132,18]],volcano:[[-116,-108,20],[116,108,20]],eclipse:[[-98,0,17],[98,0,17]]})[r.arena]||[];
 return {pillars:pillars.map(([x,y,radius])=>({x,y,r:radius})),lanes:boundRadius(r)>198,exitAngles:[-Math.PI/2,Math.PI/2],laneAngles:[0,Math.PI]};
}
function nearAngle(a,target,limit){return Math.abs(Math.atan2(Math.sin(a-target),Math.cos(a-target)))<limit;}
function pillarCollision(r,p,ob){
 const dx=p.x-ob.x,dy=p.y-ob.y,d=Math.hypot(dx,dy),min=DISC_R+ob.r;
 if(d>=min||d<.001||p.railTimer>0)return;
 const nx=dx/d,ny=dy/d,overlap=min-d;p.x+=nx*overlap;p.y+=ny*overlap;
 const speedX=p.vx+p.knockX,speedY=p.vy+p.knockY,approach=-(speedX*nx+speedY*ny);
 if(approach>0){const rebound=approach*1.85;p.knockX+=nx*rebound;p.knockY+=ny*rebound;p.edgeKick=Math.max(p.edgeKick,rebound*.65);loseSpin(r,p,rebound*.0035);if(r.age-(p.lastBumper||-10)>.28){p.lastBumper=r.age;event(r,'wall','防撞墩強力反彈！',p.id,Math.round(rebound),{x:p.x,y:p.y});}}
}
function boundRadius(r){
 const natural=r.arena==='eclipse'?235-60*clamp((r.age-12)/75,0,1):235;
 // Every arena closes late to force physical contact; no HP/timeout damage.
 const final=55*clamp((r.age-37)/38,0,1);
 return natural-final;
}
function applyArena(r,p,dt){
 if(r.arena==='vortex'){
  const d=Math.max(40,dist(p.x,p.y));p.vx-=p.x/d*95*dt;p.vy-=p.y/d*95*dt;
 }else if(r.arena==='tempest'){
  p.vx+=(-p.y/285)*95*dt;p.vy+=(p.x/285)*95*dt;
 }else if(r.arena==='volcano'){
  const cycle=r.age%9;
  if(cycle>5.8&&cycle<7.8){for(const v of [{x:-128,y:0},{x:128,y:0}]){
   const dx=p.x-v.x,dy=p.y-v.y,d=dist(dx,dy);
   if(d<75&&d>1){p.vx+=dx/d*270*dt;p.vy+=dy/d*270*dt;p.wobble=Math.min(100,p.wobble+3*dt);}
  }}
 }
}
function updateAI(r,p,dt){
 p.aiTimer-=dt;
 if(p.aiTimer<=0){
  p.aiTimer=rnd(.35,.85);
  const foes=r.fighters.filter(q=>q.alive&&q.id!==p.id);
  p.input.targetId=foes.length?foes[Math.floor(Math.random()*foes.length)].id:null;
  p.input.guard=Math.random()<.1;
 }
 if(p.chargeCd<=0&&p.spin>15&&Math.random()<dt*.42)charge(r,p,p.input.targetId);
 if(p.cool<=0&&p.spin>24&&Math.random()<dt*.20)skill(r,p);
}

function arenaEdge(r,p){
 if(p.railTimer>0)return;
 const dd=dist(p.x,p.y);if(dd<1)return;
 const safe=Math.max(65,boundRadius(r)-DISC_R);
 if(dd<safe)return;
 const nx=p.x/dd,ny=p.y/dd,angle=Math.atan2(ny,nx);
 const vx=p.vx+p.knockX,vy=p.vy+p.knockY;
 const outward=vx*nx+vy*ny;const speed=dist(vx,vy);
 const features=arenaFeatures(r);
 // Original re-entry lanes: a fast top entering left/right is accelerated round the outer rim.
 if(features.lanes&&p.railCooldown<=0&&outward>65&&speed>90&&features.laneAngles.some(a=>nearAngle(angle,a,.25))){
  p.railTimer=1.0;p.railCooldown=5;p.railAngle=angle;p.railSign=(p.y>=0?1:-1);p.knockX=0;p.knockY=0;
  event(r,'rail',`${p.name} 沿外圈加速通道衝刺回場！`,p.id,Math.round(speed),{x:p.x,y:p.y});return;
 }
 // Only dangerous exit pockets can eject a top; guarded walls physically rebound.
 if(features.exitAngles.some(a=>nearAngle(angle,a,r.arena==='volcano'?.34:.24))&&outward>90&&p.edgeKick>48&&dd>safe+.4){
  ko(r,p,'擊出場外');return;
 }
 p.x-=nx*(dd-safe);p.y-=ny*(dd-safe);
 if(outward>0){
  const restitution=.83;const bounce=(1+restitution)*outward;
  p.knockX-=bounce*nx;p.knockY-=bounce*ny;
  p.edgeKick=Math.max(p.edgeKick,bounce*.43);
  loseSpin(r,p,Math.min(.75,outward*.002));
  if(outward>65&&r.age-(p.lastWall||-10)>.27){p.lastWall=r.age;event(r,'wall','護欄反彈！',p.id,Math.round(outward),{x:p.x,y:p.y});}
 }
}
function updateRail(r,p,dt){
 p.railTimer=Math.max(0,p.railTimer-dt);
 if(p.railTimer>0){
  const progress=1-p.railTimer/1.0;
  const sweep=1.12*progress*p.railSign;
  const a=p.railAngle+sweep,trackR=boundRadius(r)+18;
  p.x=Math.cos(a)*trackR;p.y=Math.sin(a)*trackR;p.vx=0;p.vy=0;
  p.spin=Math.max(2,p.spin-dt*.55);
 }else{
  const a=p.railAngle+1.12*p.railSign;
  const inward=-215*partStats(p).rail;
  const tangent=120*p.railSign*partStats(p).rail;
  p.x=Math.cos(a)*(boundRadius(r)-DISC_R-5);
  p.y=Math.sin(a)*(boundRadius(r)-DISC_R-5);
  p.vx=Math.cos(a)*inward-Math.sin(a)*tangent;
  p.vy=Math.sin(a)*inward+Math.cos(a)*tangent;
  p.knockX=0;p.knockY=0;
  event(r,'return',`${p.name} 高速回場！`,p.id,Math.round(dist(p.vx,p.vy)),{x:p.x,y:p.y});
 }
}

function collide(r,a,b){
 if(!a.alive||!b.alive||a.railTimer>0||b.railTimer>0||a.phaseUntil>r.age||b.phaseUntil>r.age)return;
 const dx=b.x-a.x,dy=b.y-a.y,d=dist(dx,dy),limit=DISC_R*2;
 if(d>=limit)return;
 const nx=d>1e-6?dx/d:1,ny=d>1e-6?dy/d:0;
 const ma=massOf(a),mb=massOf(b),invA=1/ma,invB=1/mb,overlap=limit-d;
 // Correct penetration fully, with a small skin so tops do not remain touching.
 const shift=(overlap+1.1)/(invA+invB);
 a.x-=nx*shift*invA;a.y-=ny*shift*invA;
 b.x+=nx*shift*invB;b.y+=ny*shift*invB;
 const rvx=b.vx+b.knockX-a.vx-a.knockX,rvy=b.vy+b.knockY-a.vy-a.knockY;
 const closing=-(rvx*nx+rvy*ny);
 const key=[a.id,b.id].sort().join(':'),lastContact=r.contactPairs?.get(key)??-100;
 // One impact per brief contact: repeated overlap does not drain spin or stick together.
 if(r.age-lastContact<.12)return;
 if(closing<10){
  if(overlap>2){a.knockX-=nx*35*invA;a.knockY-=ny*35*invA;b.knockX+=nx*35*invB;b.knockY+=ny*35*invB;}
  return;
 }
 (r.contactPairs??(r.contactPairs=new Map())).set(key,r.age);
 const ta=TOP_BY_ID[a.top],tb=TOP_BY_ID[b.top];
 const armedA=a.chargeUntil>r.age,armedB=b.chargeUntil>r.age;
 const restitution=clamp(1.04+(ta.a+tb.a-10)*.014+((armedA||armedB)?.12:0),.97,1.28);
 const impulse=(1+restitution)*closing/(invA+invB);
 const impactToA=impulse*invA*(1+(armedB?.32:0))*(a.fortressUntil>r.age?.57:1);
 const impactToB=impulse*invB*(1+(armedA?.32:0))*(b.fortressUntil>r.age?.57:1);
 a.knockX-=nx*impactToA;a.knockY-=ny*impactToA;
 b.knockX+=nx*impactToB;b.knockY+=ny*impactToB;
 a.edgeKick=Math.max(a.edgeKick,impactToA);b.edgeKick=Math.max(b.edgeKick,impactToB);
 const tangentX=-ny,tangentY=nx,slip=rvx*tangentX+rvy*tangentY;
 const tangential=clamp(slip*.15+(a.spin-b.spin)*.15,-75,75);
 a.knockX+=tangentX*tangential*invA/(invA+invB)*.40;
 a.knockY+=tangentY*tangential*invA/(invA+invB)*.40;
 b.knockX-=tangentX*tangential*invB/(invA+invB)*.40;
 b.knockY-=tangentY*tangential*invB/(invA+invB)*.40;
 const collisionEnergy=closing*closing/2900;
 const guardA=a.input.guard?.65:1,guardB=b.input.guard?.65:1;
 loseSpin(r,a,collisionEnergy*guardA*(mb/ma)*.20*clamp(1-(ta.a-tb.a)*.1-(ta.s-5)*.13,.62,1.55),b);
 loseSpin(r,b,collisionEnergy*guardB*(ma/mb)*.20*clamp(1-(tb.a-ta.a)*.1-(tb.s-5)*.13,.62,1.55),a);
 if(!a.alive||!b.alive)return;
 a.stunUntil=Math.max(a.stunUntil,r.age+Math.min(.32,closing/1100));
 b.stunUntil=Math.max(b.stunUntil,r.age+Math.min(.32,closing/1100));
 if(r.age-(r.hitPairs.get(key)??-100)>.15){r.hitPairs.set(key,r.age);
  event(r,'hit',`${a.name} ⚡ ${b.name} · ${Math.round(closing)} 衝擊速度`,a.id,Math.round(closing),{x:(a.x+b.x)/2,y:(a.y+b.y)/2,critical:armedA||armedB});
 }
}

function tickRoom(r,dt){
 if(r.status!=='playing')return;
 r.age+=dt;
 // Substeps prevent high-speed tops from passing through one another.
 for(const p of r.fighters){
  if(!p.alive)continue;
  if(p.bot)updateAI(r,p,dt);
  p.cool=Math.max(0,p.cool-dt);p.chargeCd=Math.max(0,p.chargeCd-dt);p.railCooldown=Math.max(0,p.railCooldown-dt);p.impact=Math.max(0,p.impact-dt);p.edgeKick=Math.max(0,p.edgeKick-25*dt);
 }
 const step=dt/3;
 for(let sub=0;sub<3;sub++){
  for(const p of r.fighters){
   if(!p.alive)continue;
   if(p.railTimer>0){updateRail(r,p,step);continue;}
   const t=TOP_BY_ID[p.top],mass=massOf(p),part=partStats(p);
   // Uncontrolled orbital motion comes from the tip, stadium and inertia, not WASD.
   // A very weak restoring force prevents idle tops simply stopping at the rim.
   const d=Math.max(1,dist(p.x,p.y)),spinFactor=clamp(p.spin/100,.3,1);
   const tangentialSpeed=(87+t.s*11)*part.drive*spinFactor*(p.boostUntil>r.age?1.48:1);
   const radialForce=clamp((d-102)*.55,-42,96);
   const phaseForce=Math.sin(r.age*1.25+p.orbitPhase)*22;
   const targetVx=(-p.y/d*p.orbitSign*tangentialSpeed-p.x/d*radialForce)+(p.x/d*phaseForce);
   const targetVy=(p.x/d*p.orbitSign*tangentialSpeed-p.y/d*radialForce)+(p.y/d*phaseForce);
   const steering=p.stunUntil>r.age?.08:p.chargeUntil>r.age?.16:.45;
   p.vx+=(targetVx-p.vx)*steering*step;
   p.vy+=(targetVy-p.vy)*steering*step;
   const drag=(.17+(100-p.spin)*.0014+p.wobble*.0055)/gripOf(p);
   p.vx*=Math.max(0,1-drag*step);p.vy*=Math.max(0,1-drag*step);
   p.knockX*=Math.max(0,1-.57*step);p.knockY*=Math.max(0,1-.57*step);
   const full=dist(p.vx+p.knockX,p.vy+p.knockY);
   if(full>730){const k=730/full;p.knockX*=k;p.knockY*=k;p.vx*=k;p.vy*=k;}
   applyArena(r,p,step);
   p.x+=(p.vx+p.knockX)*step;p.y+=(p.vy+p.knockY)*step;
   p.spin-=step*(1.65+(6-t.e)*.06+(p.input.guard?.25:0)+(p.wobble*.006)+(p.bladeUntil>r.age?.1:0))*partStats(p).spinDrain;
   p.wobble=Math.max(0,p.wobble-step*(1.8+t.d*.33));
   if(p.spin<=1.5){p.spin=0;ko(r,p,'停止轉動');continue;}
   for(const ob of arenaFeatures(r).pillars)pillarCollision(r,p,ob);
   arenaEdge(r,p);
  }
  if(r.status!=='playing')break;
  const alive=r.fighters.filter(p=>p.alive);
  for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++)collide(r,alive[i],alive[j]);
  if(r.status!=='playing')break;
  // The last collision can eject a top over the rim in the same simulation step.
  for(const p of alive)if(p.alive&&p.railTimer<=0)arenaEdge(r,p);
  if(r.status!=='playing')break;
 }
 if(r.status!=='playing')return;
 if(r.age>=75){
  const alive=r.fighters.filter(p=>p.alive).sort((a,b)=>b.spin-a.spin||a.wobble-b.wobble);
  if(alive.length>1){const winner=alive[0];for(const p of alive)if(p!==winner){p.alive=false;p.koReason='時間到：轉速判定';}}
  finish(r);return;
 }
 if(r.fighters.filter(p=>p.alive).length<=1)finish(r);
}
function snapshot(r){return {t:'tick',time:Math.round(r.age*10)/10,radius:boundRadius(r),geometry:arenaFeatures(r),arena:r.arena,fighters:r.fighters.map(p=>({id:p.id,name:p.name,top:p.top,build:p.build,rail:p.railTimer>0,bot:p.bot,x:Math.round(p.x*10)/10,y:Math.round(p.y*10)/10,vx:Math.round(p.vx+p.knockX),vy:Math.round(p.vy+p.knockY),spin:Math.max(0,Math.round(p.spin)),wobble:Math.round(p.wobble),alive:p.alive,reason:p.koReason,cool:+p.cool.toFixed(1),chargeCd:+p.chargeCd.toFixed(1),charging:p.chargeUntil>r.age,shield:p.input.guard||p.fortressUntil>r.age,phase:p.phaseUntil>r.age,boost:p.boostUntil>r.age,blade:p.bladeUntil>r.age,slow:p.slowUntil>r.age,impact:p.impact>0,skillCount:p.skillCount}))};}
function handle(ws,msg){if(!msg||typeof msg!=='object'||typeof msg.t!=='string')return;const r=ws.room;
 switch(msg.t){
  case 'resume':return resume(ws,msg.token);
  case 'ping':return send(ws,{t:'pong'});
  case 'create':return createRoom(ws,msg,null);
  case 'join':return createRoom(ws,msg,msg.code);
  case 'leave':return exitRoom(ws);
  case 'set':if(!r||r.status!=='lobby')return;{const p=r.players.find(p=>p.id===ws.id);if(p){if(TOP_BY_ID[msg.top])p.top=msg.top;if(msg.build)p.build=validBuild(msg.build);if(msg.name)p.name=safeName(msg.name);updateLobby(r);}}return;
  case 'arena':if(!r||r.host!==ws.id||r.status!=='lobby'||!ARENA_IDS.has(msg.id))return; r.arena=msg.id;return updateLobby(r);
  case 'bots':if(!r||r.host!==ws.id||r.status!=='lobby')return;r.bots=clamp(Math.floor(Number(msg.count)||0),0,MAX_PLAYERS-r.players.filter(p=>!p.bot).length);return updateLobby(r);
  case 'start':if(!r||r.host!==ws.id)return;return start(r);
  case 'again':if(!r||r.host!==ws.id||r.status!=='results')return;r.status='lobby';r.fighters=[];r.results=null;return updateLobby(r);
  case 'input':if(!r||r.status!=='playing')return;{const p=r.fighters.find(p=>p.id===ws.id);if(!p||!p.alive)return;p.input.guard=false;if(typeof msg.targetId==='string')p.input.targetId=msg.targetId.slice(0,64);if(msg.charge)charge(r,p,p.input.targetId);if(msg.burst)skill(r,p);}return;
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
  if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,game:'spin-break-arena',version:'5.0',rooms:rooms.size,uptime:Math.round(process.uptime())}));return;}
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
  send(ws,{t:'hello',id:ws.id,tops:TOPS,arenas:ARENAS,parts:PARTS,version:'5.0'});
});
if (require.main === module) {
  setInterval(()=>{for(const r of rooms.values())if(r.status==='playing')tickRoom(r,DT);},1000/TPS);
  setInterval(()=>{for(const r of rooms.values()){if(r.status==='playing')broadcast(r,snapshot(r));if(r.updated<now()-ROOM_IDLE_MS&&r.status!=='playing'){for(const p of r.players)if(!p.bot){send(p.ws,{t:'error',msg:'房間已逾時'});if(p.ws)p.ws.room=null;}rooms.delete(r.code);}}},50);
  setInterval(()=>{for(const r of rooms.values())purgeAbsent(r);},2000);
  server.listen(PORT,HOST,()=>console.log(`[SPIN//BREAK] http://localhost:${PORT} | WebSocket /ws | 免安裝外部套件`));
  process.on('SIGINT',()=>{server.close();process.exit(0);});
}
module.exports={TOPS,PARTS,ARENAS,fightersFor,tickRoom,skill,charge,start,snapshot,publicRoom,server,massOf,arenaFeatures,arenaEdge,collide,validBuild};

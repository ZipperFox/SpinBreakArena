/** SPIN//BREAK ARENA — zero-dependency authoritative Node.js multiplayer server. */
'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const PHYSICS = require('./physics3d');

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
// Each blade has a distinct physical footprint. Shared with the 3D garage and the server's collider builder.
const BLADE_FORMS={
 phoenix:{lobes:3,reach:.43,tip:.16,shape:'talon'},raptor:{lobes:4,reach:.42,tip:.13,shape:'swept'},
 mantis:{lobes:2,reach:.47,tip:.20,shape:'axe'},behemoth:{lobes:8,reach:.35,tip:.11,shape:'shield'},
 glacier:{lobes:10,reach:.33,tip:.095,shape:'shield'},golem:{lobes:5,reach:.42,tip:.18,shape:'hammer'},
 lynx:{lobes:3,reach:.40,tip:.12,shape:'swept'},fox:{lobes:9,reach:.34,tip:.10,shape:'shield'},
 cobra:{lobes:4,reach:.45,tip:.14,shape:'talon'},leviathan:{lobes:6,reach:.385,tip:.14,shape:'wave'},
 solar:{lobes:5,reach:.40,tip:.15,shape:'wave'},unicorn:{lobes:3,reach:.43,tip:.15,shape:'hammer'}
};
for(const top of TOPS)top.blade=BLADE_FORMS[top.id];
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
const hexColor=v=>typeof v==='string'&&/^#[a-f0-9]{6}$/i.test(v)?v.toLowerCase():null;
const validBuild=b=>({ratchet:RAT[b?.ratchet]?b.ratchet:DEFAULT_BUILD.ratchet,bit:BIT[b?.bit]?b.bit:DEFAULT_BUILD.bit,paint:hexColor(b?.paint)});
const validLaunch=o=>({angle:clamp(Number.isFinite(Number(o?.angle))?Number(o.angle):0,-40,40),power:clamp(Number.isFinite(Number(o?.power))?Number(o.power):85,55,100),lane:[-1,0,1].includes(Number(o?.lane))?Number(o.lane):0});
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
function publicRoom(r) {return {code:r.code,host:r.host,status:r.status,arena:r.arena,bots:r.bots,players:r.players.map(p=>({id:p.id,name:p.name,top:p.top,build:p.build,launch:p.launch,bot:p.bot,connected:p.connected!==false,ready:p.connected!==false})),results:r.results||null,round:r.round};}
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
  if(r.players.length===0){if(engine)engine.free(r);rooms.delete(r.code);return;}
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
  if(!r.players.length){if(engine)engine.free(r);rooms.delete(r.code);return;}
  if(!r.players.some(x=>x.id===r.host)){r.host=r.players.find(x=>x.connected)?.id||r.players[0].id;changed=true;}
  if(changed)updateLobby(r);
}
function createRoom(ws, msg, joinCode) {
  exitRoom(ws);let r;
  if(joinCode){r=rooms.get(String(joinCode).trim().toUpperCase());if(!r)return error(ws,'找不到房間，請確認房間代碼');if(r.status!=='lobby')return error(ws,'對戰進行中，請等待下一場');if(r.players.length>=MAX_PLAYERS)return error(ws,'房間人數已滿');while(r.players.length+1+r.bots>MAX_PLAYERS)r.bots--;}
  else {if(rooms.size>=MAX_ROOMS)return error(ws,'伺服器房間已達上限，稍後再試');r={code:code(),host:ws.id,status:'lobby',arena:'colosseum',bots:1,players:[],fighters:[],events:[],results:null,round:0,updated:now(),age:0,hitPairs:new Map()};rooms.set(r.code,r);}
  const token=crypto.randomBytes(32).toString('hex');
  ws.room=r;r.players.push({id:ws.id,name:safeName(msg.name),top:TOP_BY_ID[msg.top]?msg.top:'phoenix',build:validBuild(msg.build),launch:validLaunch(msg.launch),bot:false,ws,connected:true,lostAt:0,token});
  send(ws,{t:'joined',id:ws.id,room:publicRoom(r),token,resumed:false});updateLobby(r);
}
// Rapier 3D runs exclusively on the server. The browser only renders snapshots.
let engine;
function event(r,kind,msg,id,amount,extra={}){const e={t:'event',kind,msg,id,amount,...extra,seq:crypto.randomBytes(3).toString('hex')};r.events.push(e);if(r.events.length>12)r.events.shift();broadcast(r,e);}
function ko(r,p,reason){if(!p.alive)return;p.alive=false;p.koReason=reason;if(p.body){try{p.body.setEnabled(false)}catch{}}
 event(r,'ko',`${p.name} ${reason==='擊出場外'?'被重擊轟出場外！':reason==='停止轉動'?'翻倒／停止轉動！':reason+'！'}`,p.id,0);
 if(r.status==='playing'&&r.fighters.filter(f=>f.alive).length<=1)finish(r);
}
function finish(r){if(r.status!=='playing')return;const ranked=[...r.fighters].sort((a,b)=>Number(b.alive)-Number(a.alive)||b.spin-a.spin||a.wobble-b.wobble);
 r.results=ranked.map((p,i)=>({id:p.id,name:p.name,top:p.top,rank:i+1,spin:Math.round(p.spin),reason:p.koReason|| (i===0?'最後旋轉者':'轉速判定')}));
 r.status='results';broadcast(r,{t:'result',results:r.results});updateLobby(r);
}
function fightersFor(r){const members=r.players.filter(p=>!p.bot).map(p=>({...p}));const picks=TOPS.slice();for(let i=picks.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[picks[i],picks[j]]=[picks[j],picks[i]];}
 for(let i=0;i<r.bots;i++)members.push({id:'bot'+i,name:['烈焰','閃電','旋風'][i]+'機神',top:picks[(i+r.round*3)%picks.length].id,build:{ratchet:PARTS.ratchets[(i+r.round)%PARTS.ratchets.length].id,bit:PARTS.bits[(i*3+r.round)%PARTS.bits.length].id},launch:validLaunch({angle:(i-1)*16,power:78+(i%3)*7,lane:(i%3)-1}),bot:true});
 return engine.create(r,members);
}
function start(r){if(r.status!=='lobby')return;if(r.players.filter(x=>x.connected).length<1||r.players.some(x=>!x.connected))return;if(r.players.length+r.bots<2)return;
 const active=[...rooms.values()].filter(x=>x.status==='playing').length;
 if(active>=12){broadcast(r,{t:'error',msg:'3D 物理房間已滿，請稍後再開房'});return;}
 r.round++;r.status='playing';r.age=0;r.results=null;r.hitPairs.clear();r.events=[];
 try{r.fighters=fightersFor(r);}catch(e){r.status='lobby';console.error('[physics3d]',e);broadcast(r,{t:'error',msg:'3D 物理引擎初始化失敗'});return;}
 broadcast(r,{t:'room',room:publicRoom(r)});event(r,'start','3D PHYSICS / LET IT RIP!','',0);
}
function tickRoom(r,dt){return engine.tick(r,dt);}
function charge(r,p,id){return engine.charge(r,p,id);}
function skill(r,p){return engine.skill(r,p);}
function snapshot(r){return engine.snapshot(r);}
const massOf=p=>p.body?.mass()||engine.stats(p).mass;
const arenaFeatures=r=>engine.snapshot(r).geometry;
const arenaEdge=()=>{};const collide=()=>{};
function handle(ws,msg){if(!msg||typeof msg!=='object'||typeof msg.t!=='string')return;const r=ws.room;
 switch(msg.t){
  case 'resume':return resume(ws,msg.token);
  case 'ping':return send(ws,{t:'pong'});
  case 'create':return createRoom(ws,msg,null);
  case 'join':return createRoom(ws,msg,msg.code);
  case 'leave':return exitRoom(ws);
  case 'set':if(!r||r.status!=='lobby')return;{const p=r.players.find(p=>p.id===ws.id);if(p){if(TOP_BY_ID[msg.top])p.top=msg.top;if(msg.build)p.build=validBuild(msg.build);if(msg.launch)p.launch=validLaunch(msg.launch);if(msg.name)p.name=safeName(msg.name);updateLobby(r);}}return;
  case 'arena':if(!r||r.host!==ws.id||r.status!=='lobby'||!ARENA_IDS.has(msg.id))return; r.arena=msg.id;return updateLobby(r);
  case 'bots':if(!r||r.host!==ws.id||r.status!=='lobby')return;r.bots=clamp(Math.floor(Number(msg.count)||0),0,MAX_PLAYERS-r.players.filter(p=>!p.bot).length);return updateLobby(r);
  case 'start':if(!r||r.host!==ws.id)return;return start(r);
  case 'again':if(!r||r.host!==ws.id||r.status!=='results')return;engine.free(r);r.status='lobby';r.fighters=[];r.results=null;return updateLobby(r);
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
  if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,game:'spin-break-arena',version:'9.0',physics:'rapier3d',rooms:rooms.size,uptime:Math.round(process.uptime())}));return;}
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
  send(ws,{t:'hello',id:ws.id,tops:TOPS,arenas:ARENAS,parts:PARTS,version:'9.0' });
});
if (require.main === module) {
  PHYSICS.init().then(()=>{engine=PHYSICS.makeEngine(TOPS,PARTS,{event,ko,finish});console.log('[SPIN//BREAK] RAPier 3D engine initialized');}) .catch(e=>{console.error('[SPIN//BREAK] Rapier initialization failed:',e);process.exit(1);});
  setInterval(()=>{for(const r of rooms.values())if(r.status==='playing')tickRoom(r,DT);},1000/TPS);
  setInterval(()=>{for(const r of rooms.values()){if(r.status==='playing')broadcast(r,snapshot(r));if(r.updated<now()-ROOM_IDLE_MS&&r.status!=='playing'){if(r.physics)engine.free(r);for(const p of r.players)if(!p.bot){send(p.ws,{t:'error',msg:'房間已逾時'});if(p.ws)p.ws.room=null;}rooms.delete(r.code);}}},50);
  setInterval(()=>{for(const r of rooms.values())purgeAbsent(r);},2000);
  const launch=setInterval(()=>{if(engine){clearInterval(launch);server.listen(PORT,HOST,()=>console.log(`[SPIN//BREAK] V9 / Rapier 3D | http://localhost:${PORT} | WebSocket /ws`));}},80);
  process.on('SIGINT',()=>{server.close();process.exit(0);});
}
module.exports={TOPS,PARTS,BLADE_FORMS,validLaunch,ARENAS,fightersFor,tickRoom,skill,charge,start,snapshot,publicRoom,server,massOf,arenaFeatures,arenaEdge,collide,validBuild};

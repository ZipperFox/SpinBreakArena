/** Public deployment smoke test. Usage: node verify_live.js https://your-service.onrender.com */
'use strict';
const assert = require('node:assert/strict');
const baseInput = process.argv[2] || process.env.GAME_URL;
if (!baseInput) { console.error('用法：node verify_live.js https://你的遊戲網址'); process.exit(2); }
let base;
try { base = new URL(baseInput); } catch { console.error('無效網址'); process.exit(2); }
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
  console.error('請使用網站首頁網址（http:// 或 https://），不要包含路徑、參數或密碼'); process.exit(2);
}
const wsUrl = new URL('/ws', base);
wsUrl.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
const peers = [];
function open(label) {
  return new Promise((resolve,reject) => {
    const sock = new WebSocket(wsUrl.href);
    let completed = false;
    const p = {sock,label,received:[],waiters:[],send: x => sock.send(JSON.stringify(x)), wait(fn,ms=15000){
      const hit = p.received.find(fn);if(hit)return Promise.resolve(hit);
      return new Promise((done,fail)=>{const waiter={fn,done,fail};waiter.timer=setTimeout(()=>{p.waiters=p.waiters.filter(w=>w!==waiter);fail(new Error(label+' 等待訊息逾時'));},ms);p.waiters.push(waiter);});
    }};
    peers.push(p);
    sock.onmessage = e => {try{const msg=JSON.parse(e.data);p.received.push(msg);for(const w of [...p.waiters])if(w.fn(msg)){clearTimeout(w.timer);p.waiters=p.waiters.filter(x=>x!==w);w.done(msg);}}catch{}};
    sock.onopen = () => {completed=true;resolve(p);};
    sock.onerror = () => {if(!completed){completed=true;reject(new Error('無法連線：'+label));}};
    sock.onclose = () => {if(!completed){completed=true;reject(new Error('連線提前關閉：'+label));}};
    setTimeout(()=>{if(!completed){completed=true;sock.close();reject(new Error('WebSocket 等待逾時：'+label));}},20000);
  });
}
async function run(){
  const res=await fetch(new URL('/health',base),{signal:AbortSignal.timeout(100000)});
  assert.equal(res.status,200,'健康檢查必須回 200');
  const health=await res.json();assert.equal(health.ok,true);assert.equal(health.game,'spin-break-arena');
  console.log('✓ 公開 HTTP(S) 健康檢查');
  const host=await open('房主');await host.wait(x=>x.t==='hello');
  host.send({t:'create',name:'PublicSmokeHost',top:'phoenix'});
  const joined=await host.wait(x=>x.t==='joined');
  const guest=await open('訪客');await guest.wait(x=>x.t==='hello');
  guest.send({t:'join',name:'PublicSmokeGuest',code:joined.room.code,top:'lynx'});
  const guestJoined=await guest.wait(x=>x.t==='joined');
  assert.equal(guestJoined.room.code,joined.room.code);
  console.log('✓ 兩名真實 WebSocket 客戶端開房、加入同一個房間');
  host.send({t:'bots',count:0});await host.wait(x=>x.t==='room'&&x.room.bots===0);
  host.send({t:'start'});
  await host.wait(x=>x.t==='tick'&&x.fighters.length===2);
  await guest.wait(x=>x.t==='tick'&&x.fighters.length===2);
  guest.send({t:'input',x:.5,y:-.3,burst:true});
  await guest.wait(x=>x.t==='event'&&x.kind==='skill');
  console.log('✓ 同步戰鬥快照與技能，公開多人服務運作正常');
}
run().catch(err=>{console.error('驗證失敗：',err.message);process.exitCode=1;}).finally(()=>{for(const p of peers){for(const w of p.waiters)clearTimeout(w.timer);try{p.sock.close();}catch{}}});

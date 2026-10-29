'use strict';
(() => {
const $ = id => document.getElementById(id);
const els = Object.fromEntries(['roster','profile','topType','bigTop','topName','topSkill','topStats','statTotal','typeFilters','netDot','netState','btnSound','soundText','bladeSelect','ratchetSelect','bitSelect','buildInfo','garage3d','paintSelect','paintReset','presetSelect','presetSave','presetLoad','launchPower','launchAngle','launchLane','launchPowerValue','launchAngleValue','stage','stageFrame','stageTitle','gameTimer','roundState','fightHud','centerOverlay','overlayPlay','impactBanner','eventToast','playerName','roomInput','btnCreate','btnJoin','roomMessage','lobbyHeading','lobbyStatus','roomCode','btnCopy','btnShare','participants','arenaSelect','arenaDescription','botCount','btnStart','btnAgain','btnLeave','scoreboard','combatLog','touchTarget','touchBurst','touchGuard','touchCounter','chaosSelect','anomalyStatus'].map(x=>[x,$(x)]));
const ctx=els.stage.getContext('2d',{alpha:false});
let ws,ownId=null,room=null,tops=[],arenas=[],parts={ratchets:[],bits:[]},selected='phoenix',build={ratchet:'wide7',bit:'taper',paint:null},launch={power:85,angle:0,lane:0},filter='全部',latest=null,vis={},particles=[],shockwaves=[],trails={},logEntries=[],lastEvent='',status='offline',audioOn=false,audioCtx=null,beatTimer=null,beatStep=0,soundCooldown=0;
let playTime=0,flash=0,shake=0,bannerTimer=null,toastTimer=null,gameOverShown=false;
const storageKey='spinbreak-session-v2';
let reconnectTimer=null,everConnected=false,waitForResume=false,lastServerSeen=Date.now();
const queryRoom=(new URLSearchParams(location.search).get('room')||'').slice(0,5).toUpperCase();
const saveSession=(token,code)=>{try{sessionStorage.setItem(storageKey,JSON.stringify({token,code}));}catch{}};
const readSession=()=>{try{return JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{return null;}};
const clearSession=()=>{try{sessionStorage.removeItem(storageKey);}catch{}};
try{const previousName=localStorage.getItem('spinbreak-player-name');if(previousName)els.playerName.value=previousName;const b=JSON.parse(localStorage.getItem('spinbreak-build-v4')||'null');if(b?.top)selected=b.top;if(b?.ratchet)build.ratchet=b.ratchet;if(b?.bit)build.bit=b.bit;if(/^#[0-9a-f]{6}$/i.test(b?.paint||''))build.paint=b.paint;const l=JSON.parse(localStorage.getItem('spinbreak-launch-v9')||'null');if(l)launch={power:Math.max(55,Math.min(100,+l.power||85)),angle:Math.max(-40,Math.min(40,+l.angle||0)),lane:[-1,0,1].includes(+l.lane)?+l.lane:0};}catch{}
const input={charge:false,burst:false};let targetId=null;
window.SPINBREAK_3D_BRIDGE={getState:()=>({latest,room,tops,parts,selected,build,launch,ownId,targetId}),setTarget:id=>{if(latest?.fighters?.some(p=>p.id===id&&p.alive&&id!==ownId)){targetId=id;notify('鎖定 '+latest.fighters.find(p=>p.id===id).name);updateChargeUI();}}};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hypot=(x,y)=>Math.hypot(x,y);
const escapeHTML = s => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const getTop=id=>tops.find(t=>t.id===id)||tops[0];
const getArena=id=>arenas.find(a=>a.id===id)||arenas[0];
const color=(hex,alpha)=>{if(!hex||!hex.startsWith('#'))return 'rgba(150,190,255,'+alpha+')';let h=hex.slice(1);return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${alpha})`;};
const send=obj=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify(obj));};
function network(){
 if(ws&&(ws.readyState===WebSocket.OPEN||ws.readyState===WebSocket.CONNECTING))return;
 const scheme=location.protocol==='https:'?'wss:':'ws:';
 status='connecting';netUI();clearTimeout(reconnectTimer);
 let sock;try{sock=new WebSocket(`${scheme}//${location.host}/ws`);}catch{status='offline';netUI();reconnectTimer=setTimeout(network,2300);return;}
 ws=sock;
 sock.onopen=()=>{if(ws!==sock)return;status='online';everConnected=true;lastServerSeen=Date.now();netUI();};
 sock.onclose=()=>{if(ws!==sock)return;status='offline';netUI();if(room){showMsg('網路暫時中斷，正在保留你的席位並自動重連…','error');showOverlay('連線中斷，正在重連','請保持此頁開啟。網路恢復後將自動返回原房間，約 90 秒內可保留席位。','立即重連',()=>{ws=null;network();});}
 else if(!everConnected)showMsg('伺服器啟動中，正在自動重試…','error');
 reconnectTimer=setTimeout(network,2300);
 };
 sock.onerror=()=>{};
 sock.onmessage=e=>{if(ws!==sock)return;lastServerSeen=Date.now();try{onMessage(JSON.parse(e.data));}catch(err){console.error(err);}};
}
function inviteOverlay(){
 if(!queryRoom)return;
 els.roomInput.value=queryRoom;
 showMsg('朋友邀請你加入房間 '+queryRoom+'。選擇暱稱後按加入。');
 showOverlay('收到戰鬥邀請！',`房間 ${escapeHTML(queryRoom)} · 直接加入朋友的戰場`, '加入這場對戰',()=>els.btnJoin.click());
}
function netUI(){els.netState.textContent=({online:'伺服器已連線',offline:'伺服器未連線',connecting:'正在連線'})[status];els.netDot.className='live-dot '+(status==='online'?'online':status==='offline'?'offline':'');}
function onMessage(m){switch(m.t){
 case 'hello':ownId=m.id;tops=m.tops;arenas=m.arenas;parts=m.parts||parts;if(!tops.some(t=>t.id===selected))selected='phoenix';renderBuildOptions();renderRoster();renderProfile();renderArenaOptions();{const old=readSession();if(old?.token&&(!queryRoom||old.code===queryRoom)){waitForResume=true;send({t:'resume',token:old.token});}else{waitForResume=false;inviteOverlay();}}return;
 case 'resume_failed':waitForResume=false;clearSession();room=null;latest=null;renderLobby();if(queryRoom)inviteOverlay();else showOverlay('準備進入戰場','點擊建立房間，即可與 AI 練習或邀請朋友','立即開始對戰',()=>els.btnCreate.click());return;
 case 'joined':ownId=m.id;room=m.room;waitForResume=false;{const mine=room.players.find(p=>p.id===ownId);if(mine){selected=mine.top;build=mine.build||build;launch=mine.launch||launch;syncGarageControls();renderBuildOptions();renderRoster();renderProfile();}}if(m.token)saveSession(m.token,room.code);if(!m.resumed){latest=null;vis={};trails={};particles=[];logEntries=[];gameOverShown=false;targetId=null;}renderLobby();
 if(room.status==='lobby'){showOverlay(m.resumed?'歡迎回到競技場！':'集結！準備開戰','分享邀請連結給朋友，所有玩家選好陀螺後由房主開戰',room.host===ownId?'開始戰鬥':'等待房主開始',()=>room?.host===ownId?send({t:'start'}):notify('等待房主開始戰鬥'));}
 else if(room.status==='playing')hideOverlay();
 showMsg((m.resumed?'已恢復連線：':'已進入房間：')+room.code,'success');return;
 case 'room':room=m.room;renderLobby();if(room.status==='playing')hideOverlay();return;
 case 'tick':latest=m;if(room&&room.status==='playing'){renderAnomaly();els.gameTimer.textContent=formatTime(90-m.time);els.roundState.textContent='BATTLE LIVE';renderScores();renderHud();updateChargeUI();}return;
 case 'event':handleEvent(m);return;
 case 'result':showResults(m.results);return;
 case 'error':showMsg(m.msg,'error');notify(m.msg);if(queryRoom&&!room)inviteOverlay();return;
 case 'pong':return;
}}
function renderAnomaly(){
 const a=latest?.anomaly;
 if(!els.anomalyStatus)return;
 if(!a||a.phase==='idle'){els.anomalyStatus.textContent='';els.anomalyStatus.className='anomaly-status';return;}
 const remain=Math.max(0,(a.until||0)-(latest?.time||0));
 els.anomalyStatus.textContent=(a.phase==='warning'?'⚠ 異變預警：':'◆ 異變中：')+a.name+' · '+remain.toFixed(1)+'s';
 els.anomalyStatus.className='anomaly-status '+(a.phase==='warning'?'warning':'active');
}
function formatTime(secs){secs=Math.ceil(Math.max(0,secs));return `${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`;}
function topMarkup(t){return `<div class="top-disc" style="--base:${t.color};--highlight:${t.accent};--glow:${t.color}"><div class="disc-shadow"></div><div class="disc-body"></div></div>`;}
function renderRoster(){els.roster.innerHTML=tops.filter(t=>filter==='全部'||t.type===filter).map(t=>`<button class="top-card ${t.id===selected?'active':''}" data-top="${t.id}" title="${t.name} · ${t.skill}"><span class="card-type">${t.type}型</span>${topMarkup(t)}<div class="card-name">${t.name}</div><div class="card-detail">${t.skill}</div></button>`).join('');for(const card of els.roster.querySelectorAll('[data-top]'))card.addEventListener('click',()=>{if(room?.status==='playing'){notify('對戰中無法更換陀螺');return;}selected=card.dataset.top;els.bladeSelect.value=selected;syncGarageControls();renderRoster();renderProfile();saveBuild();if(room)send({t:'set',top:selected,build,launch,name:els.playerName.value});});}
function saveBuild(){try{localStorage.setItem('spinbreak-build-v4',JSON.stringify({top:selected,...build}));}catch{}}
function partName(group,id){return parts[group].find(p=>p.id===id)?.name||id;}
function partCode(group,id){return parts[group].find(p=>p.id===id)?.code||id;}
function renderBuildOptions(){
 els.bladeSelect.innerHTML=tops.map(t=>`<option value="${t.id}">${t.name} · ${t.type}</option>`).join('');
 for(const [el,group] of [[els.ratchetSelect,'ratchets'],[els.bitSelect,'bits']])el.innerHTML=parts[group].map(p=>`<option value="${p.id}">${p.code} · ${p.name}</option>`).join('');
 if(!parts.ratchets.some(p=>p.id===build.ratchet))build.ratchet='wide7';
 if(!parts.bits.some(p=>p.id===build.bit))build.bit='taper';
 els.bladeSelect.value=selected;els.ratchetSelect.value=build.ratchet;els.bitSelect.value=build.bit;syncGarageControls();updateBuildInfo();
}
function updateBuildInfo(){
 const r=parts.ratchets.find(p=>p.id===build.ratchet),b=parts.bits.find(p=>p.id===build.bit);
 els.buildInfo.innerHTML=`<strong>${escapeHTML(getTop(selected)?.name||'')} · ${escapeHTML(r?.code||'')} / ${escapeHTML(b?.code||'')}</strong><span>${escapeHTML(r?.desc||'')}<br>${escapeHTML(b?.desc||'')}<br>發射 ${launch.power}%／${launch.angle}°，${launch.lane===0?'中央':launch.lane<0?'偏左':'偏右'}路線</span>`;window.dispatchEvent(new Event('spinbreak-garage-change'));
}
for(const id of ['bladeSelect','ratchetSelect','bitSelect'])els[id].addEventListener('change',()=>{
 if(room?.status==='playing'){notify('戰鬥中無法修改零件');renderBuildOptions();return;}
 selected=els.bladeSelect.value;build={ratchet:els.ratchetSelect.value,bit:els.bitSelect.value,paint:build.paint};saveBuild();updateBuildInfo();renderRoster();renderProfile();
 if(room)send({t:'set',top:selected,build,launch,name:els.playerName.value});
});
function renderProfile(){const t=getTop(selected);if(!t)return;updateBuildInfo();els.topType.textContent=t.type+'型';els.bigTop.innerHTML=topMarkup(t);els.topName.textContent=t.name;els.topSkill.textContent='✦ 必殺技 · '+t.skill;els.topStats.innerHTML=[['攻擊','a'],['防禦','d'],['速度','s'],['續航','e']].map(([name,k])=>`<div class="stat"><span>${name}</span><div class="stat-track"><div class="stat-fill" style="width:${t[k]*12.5}%"></div></div><strong>${t[k]}</strong></div>`).join('');els.statTotal.textContent=`刀刃 ${t.a+t.d+t.s+t.e} 點 · ${partCode('ratchets',build.ratchet)} / ${partCode('bits',build.bit)}`;
}
// V8 / V9 launch configuration + offline garage presets.
function syncGarageControls(){
 if(!els.launchPower)return;
 els.launchPower.value=String(launch.power);els.launchAngle.value=String(launch.angle);els.launchLane.value=String(launch.lane);
 els.launchPowerValue.textContent=launch.power+'%';els.launchAngleValue.textContent=launch.angle+'°';
 els.paintSelect.value=build.paint||getTop(selected)?.color||'#ff613f';
}
function applyGarage(){saveBuild();try{localStorage.setItem('spinbreak-launch-v9',JSON.stringify(launch));}catch{}
 syncGarageControls();updateBuildInfo();renderRoster();renderProfile();
 if(room?.status==='lobby')send({t:'set',top:selected,build,launch,name:els.playerName.value});
}
els.paintSelect.addEventListener('input',()=>{if(room?.status==='playing')return;build.paint=els.paintSelect.value;applyGarage();});
els.paintReset.addEventListener('click',()=>{if(room?.status==='playing')return;build.paint=null;applyGarage();});
for(const id of ['launchPower','launchAngle','launchLane'])els[id].addEventListener('input',()=>{
 if(room?.status==='playing'){syncGarageControls();return;}
 launch={power:+els.launchPower.value,angle:+els.launchAngle.value,lane:+els.launchLane.value};applyGarage();
});
const presetStorage='spinbreak-presets-v9';
function readPresets(){try{return JSON.parse(localStorage.getItem(presetStorage)||'{}')||{};}catch{return {};}}
els.presetSave.addEventListener('click',()=>{const p=readPresets();p[els.presetSelect.value]={top:selected,build:{...build},launch:{...launch}};try{localStorage.setItem(presetStorage,JSON.stringify(p));notify('已儲存配裝 '+(+els.presetSelect.value+1));}catch{notify('瀏覽器無法儲存配裝');}});
els.presetLoad.addEventListener('click',()=>{if(room?.status==='playing'){notify('請在下一回合換裝');return;}const p=readPresets()[els.presetSelect.value];if(!p){notify('這個欄位還沒有配裝');return;}if(tops.some(t=>t.id===p.top))selected=p.top;build={ratchet:p.build?.ratchet||'wide7',bit:p.build?.bit||'taper',paint:p.build?.paint||null};launch={power:+p.launch?.power||85,angle:+p.launch?.angle||0,lane:+p.launch?.lane||0};renderBuildOptions();applyGarage();notify('已套用配裝 '+(+els.presetSelect.value+1));});
syncGarageControls();
els.typeFilters.addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;for(const x of els.typeFilters.querySelectorAll('[data-filter]'))x.classList.toggle('active',x===b);renderRoster();});
function renderArenaOptions(){els.arenaSelect.innerHTML=arenas.map(a=>`<option value="${a.id}">${a.name}</option>`).join('');}
function showMsg(s,type=''){els.roomMessage.textContent=s;els.roomMessage.className='room-message '+type;}
function renderLobby(){els.stageFrame.classList.toggle('playing',room?.status==='playing');const inRoom=!!room;const isHost=inRoom&&room.host===ownId;els.roomCode.textContent=room?.code||'-----';els.lobbyHeading.textContent=inRoom?(room.status==='lobby'?'挑戰者集結中':room.status==='playing'?'戰鬥進行中':'本局對戰結束'):'尚未加入房間';els.lobbyStatus.textContent=room?.status==='playing'?'FIGHT':room?.status==='results'?'RESULT':'WAITING';els.btnStart.disabled=!(isHost&&room.status==='lobby'&&room.players.length+room.bots>=2&&room.players.every(p=>p.connected!==false));els.btnStart.classList.toggle('hidden',!isHost||room.status!=='lobby');els.btnAgain.classList.toggle('hidden',!isHost||room.status!=='results');els.btnLeave.classList.toggle('hidden',!inRoom);els.arenaSelect.disabled=!isHost||room.status!=='lobby';els.chaosSelect.disabled=!isHost||room.status!=='lobby';els.chaosSelect.value=room?.chaos===false?'off':'on';els.botCount.disabled=!isHost||room.status!=='lobby';els.btnCopy.disabled=!inRoom;els.btnShare.disabled=!inRoom;els.arenaSelect.value=room?.arena||'colosseum';els.arenaDescription.textContent=getArena(room?.arena)?.desc||'每座競技場都有不同的規則。';els.stageTitle.innerHTML=escapeHTML(getArena(room?.arena)?.name||'王者競技場')+' <span>· ARENA</span>';if(room){const maxBots=Math.max(0,4-room.players.length);els.botCount.innerHTML=Array.from({length:maxBots+1},(_,n)=>`<option value="${n}">${n} 位</option>`).join('');els.botCount.value=String(Math.min(room.bots,maxBots));}
 els.participants.innerHTML=inRoom?room.players.map((p,i)=>{const t=getTop(p.top);return `<div class="participant"><span class="p-number">0${i+1}</span><div class="p-detail"><strong>${escapeHTML(p.name)}${p.id===ownId?' (你)':''}</strong><small>${escapeHTML(t?.name||'未知陀螺')} · ${escapeHTML(partCode('ratchets',p.build?.ratchet))} / ${escapeHTML(partCode('bits',p.build?.bit))}${p.id===room.host?' · 房主':''}</small></div><span class="p-tag ${p.connected===false?'disconnected':''}">${p.connected===false?'重連中':'READY'}</span></div>`;}).join('')+Array.from({length:room.bots},(_,i)=>`<div class="participant"><span class="p-number">AI</span><div class="p-detail"><strong>AI 對手 #${i+1}</strong><small>自動選角 · 智慧對戰</small></div><span class="p-tag">CPU</span></div>`).join(''):'<div class="placeholder-person">◎ 建立房間，準備開戰</div>';
 if(room?.status==='lobby'){els.roundState.textContent='STANDBY';els.gameTimer.textContent='01:15';}if(room?.status==='results')els.roundState.textContent='FINISHED';
}
els.btnCreate.addEventListener('click',()=>{if(status!=='online'){showMsg('伺服器尚未連線','error');return;}try{localStorage.setItem('spinbreak-player-name',els.playerName.value);}catch{}send({t:'create',name:els.playerName.value,top:selected,build,launch});});
els.btnJoin.addEventListener('click',()=>{const code=els.roomInput.value.toUpperCase().trim();if(code.length!==5){showMsg('請輸入五位房間代碼','error');return;}try{localStorage.setItem('spinbreak-player-name',els.playerName.value);}catch{}send({t:'join',code,name:els.playerName.value,top:selected,build,launch});});
els.roomInput.addEventListener('keydown',e=>{if(e.key==='Enter')els.btnJoin.click();});
els.btnStart.addEventListener('click',()=>{if(!audioOn){initAudio();audioOn=true;els.soundText.textContent='音效開';beat();beatTimer=setInterval(beat,117);}send({t:'start'});});els.btnAgain.addEventListener('click',()=>{send({t:'again'});gameOverShown=false;showOverlay('下一場，突破極限','重新選擇戰鬥陀螺與競技場，迎接下一場決戰','準備再戰',()=>send({t:'start'}));});els.btnLeave.addEventListener('click',()=>{send({t:'leave'});clearSession();room=null;latest=null;vis={};trails={};renderLobby();showOverlay('準備好燃燒鬥志了嗎？','建立房間即可與 AI 對戰，或邀請朋友加入 2～4 人競技','立即開始對戰',()=>els.btnCreate.click());});
els.arenaSelect.addEventListener('change',()=>send({t:'arena',id:els.arenaSelect.value}));els.chaosSelect.addEventListener('change',()=>send({t:'chaos',enabled:els.chaosSelect.value==='on'}));els.botCount.addEventListener('change',()=>send({t:'bots',count:+els.botCount.value}));els.playerName.addEventListener('change',()=>{if(room?.status==='lobby')send({t:'set',top:selected,build,launch,name:els.playerName.value});});
function inviteLink(){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('room',room.code);return url.toString();}
async function copyInvite(){if(!room)return;const link=inviteLink();try{await navigator.clipboard.writeText(link);notify('邀請連結已複製，可傳給朋友');}catch{window.prompt('長按並複製這個邀請網址：',link);}}
els.btnCopy.addEventListener('click',copyInvite);
els.btnShare.addEventListener('click',async()=>{
 if(!room)return;const url=inviteLink();
 if(navigator.share){try{await navigator.share({title:'SPIN//BREAK 陀螺對戰邀請',text:`快來加入我的戰鬥陀螺房間 ${room.code}！`,url});return;}catch(e){if(e.name==='AbortError')return;}}
 await copyInvite();
});
if(queryRoom){els.roomInput.value=queryRoom;showMsg('已讀取朋友的邀請：'+queryRoom);}
function showOverlay(title,subtitle,buttonText,action){els.centerOverlay.classList.remove('hidden');els.centerOverlay.innerHTML=`<div class="overlay-label">SPIN//BREAK ARENA</div><div class="overlay-heading">${title}</div><div class="overlay-sub">${subtitle}</div><button class="primary-btn big-btn" id="dynamicOverlayBtn">${buttonText} <span>↗</span></button>`;els.centerOverlay.querySelector('#dynamicOverlayBtn').onclick=action;}
function hideOverlay(){els.centerOverlay.classList.add('hidden');}
els.overlayPlay.addEventListener('click',()=>els.btnCreate.click());
function notify(s){els.eventToast.textContent=s;els.eventToast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>els.eventToast.classList.remove('show'),2300);}
function banner(s){els.impactBanner.textContent=s;els.impactBanner.classList.remove('show');void els.impactBanner.offsetHeight;els.impactBanner.classList.add('show');clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>els.impactBanner.classList.remove('show'),900);}
function log(s){logEntries.unshift(s);logEntries=logEntries.slice(0,18);els.combatLog.innerHTML=logEntries.map(x=>`<div class="log-line">${escapeHTML(x)}</div>`).join('');}
function handleEvent(m){window.dispatchEvent(new CustomEvent('spinbreak-impact',{detail:m}));log(m.msg);if(m.kind==='start'){gameOverShown=false;banner('LET IT RIP!');hideOverlay();playEffect('start');return;}const f=latest?.fighters?.find(x=>x.id===m.id);if(f||Number.isFinite(m.x)){const t=getTop(f?.top);const fx=m.x??f?.x,fy=m.y??f?.y;spawnBurst(fx,fy,t?.color||'#ff8749',m.kind==='skill'?45:m.kind==='charge'?42:m.kind==='hit'?34:20,m.kind==='hit'?Math.max(100,m.amount*.9):120);shockwaves.push({x:fx,y:fy,r:10,life:m.kind==='hit'?.7:m.kind==='skill'?1.2:.5,max:m.kind==='hit'?.7:m.kind==='skill'?1.2:.5,c:t?.color||'#ffaa55'});}if(m.kind==='anomaly_warning'){notify(m.msg);banner('ARENA WARNING!');playEffect('skill');return;}if(m.kind==='anomaly_start'){notify(m.msg);banner('ARENA CHAOS!');shake=8;playEffect('skill');return;}if(m.kind==='anomaly_end'){notify(m.msg);return;}if(m.kind==='counter_success'){banner('PERFECT COUNTER!');shake=12;playEffect('ko');}if(m.kind==='precision'){banner('PRECISION HIT!');shake=10;playEffect('hit');}if(m.kind==='skill'){notify(m.msg);banner('BURST!!');shake=6;flash=.2;playEffect('skill');}else if(m.kind==='charge'){banner('EXTREME CHARGE!');shake=10;flash=.2;playEffect('skill');}else if(m.kind==='ko'){notify(m.msg);banner(m.msg.includes('場外')?'RING OUT!':'SPIN FINISH!');shake=15;flash=.5;playEffect('ko');}else if(m.kind==='hit'){shake=Math.max(shake,clamp(m.amount/14,6,22));flash=Math.max(flash,Math.min(.25,m.amount/1800));if(m.amount>160)banner(m.critical?'CRITICAL IMPACT!':'CLASH!');playEffect('hit');}else if(m.kind==='wall'){shake=Math.max(shake,8);playEffect('hit');}else if(m.kind==='rail'){notify('外圈通道 · 加速準備！');shake=7;playEffect('skill');}else if(m.kind==='return'){banner('RAIL RETURN!');shake=9;playEffect('skill');}}
function showResults(results){if(gameOverShown)return;gameOverShown=true;const win=results?.find(x=>x.rank===1);const iWon=win?.id===ownId;banner(iWon?'VICTORY!':'BATTLE OVER');playEffect(iWon?'win':'ko');const scoreboard=results?.map(p=>`<div style="display:flex;justify-content:space-between;gap:30px;padding:6px 0;border-bottom:1px solid #ffffff25;font-size:13px"><span>${p.rank}. ${escapeHTML(p.name)}</span><span>${p.spin} 轉速 · ${escapeHTML(p.reason||'')}</span></div>`).join('')||'';showOverlay(iWon?'你就是這場的王者！':`勝者：${escapeHTML(win?.name||'挑戰者')}`,`<div style="min-width:210px;margin:8px auto 0">${scoreboard}</div><div style="margin-top:12px">房主可以在右側大廳按「再戰一場」。</div>`,'再戰準備',()=>{if(room?.host===ownId)els.btnAgain.click();else notify('等待房主重開房間');});}
function renderScores(){if(!latest?.fighters)return;els.scoreboard.innerHTML=[...latest.fighters].sort((a,b)=>Number(b.alive)-Number(a.alive)||b.spin-a.spin).map(p=>{const t=getTop(p.top);return `<div class="score-item ${p.alive?'':'dead'}" style="--sc:${t?.color||'#fff'}"><span class="score-name">${escapeHTML(p.name)}${p.id===ownId?' (你)':''}</span><span class="score-value">${p.alive?p.spin+'% SPIN':'OUT'}</span></div>`;}).join('');}
function renderHud(){if(!latest?.fighters)return;els.fightHud.innerHTML=latest.fighters.map(p=>{const t=getTop(p.top);return `<div class="hud-card ${p.id===ownId?'me':''} ${p.alive?'':'dead'}" style="--pcolor:${t?.color||'#fff'}"><div class="hud-name">${p.id===ownId?'★ ':''}${escapeHTML(p.name)}</div><div class="hud-meters"><div class="hud-meter spin"><i style="width:${p.spin}%"></i></div></div><div class="hud-nums"><span>轉速 ${p.spin}%</span><span>${p.alive?(p.wobble>45?'不穩定':'旋轉中'):(p.reason||'淘汰')}</span></div></div>`;}).join('');}
// V5: no movement controls. Each command is a one-shot, server-authoritative skill.
function selectNextTarget(){
 const alive=latest?.fighters?.filter(p=>p.alive&&p.id!==ownId&&!p.rail)||[];
 if(!alive.length){targetId=null;return;}
 const i=alive.findIndex(p=>p.id===targetId);
 targetId=alive[(i+1)%alive.length].id;
 notify('鎖定 '+alive.find(p=>p.id===targetId).name);
}
function sendAction(type){
 if(room?.status!=='playing')return;
 const me=latest?.fighters?.find(p=>p.id===ownId);
 if(!me?.alive)return;
 if(type==='charge'&&me.chargeCd>.08){notify(`衝鋒冷卻 ${me.chargeCd.toFixed(1)} 秒`);return;}
 if(type==='burst'&&me.cool>.08){notify(`必殺冷卻 ${me.cool.toFixed(1)} 秒`);return;}
 send({t:'input',charge:type==='charge',burst:type==='burst',counter:type==='counter',targetId});
}
function updateChargeUI(){
 const me=latest?.fighters?.find(p=>p.id===ownId);
 if(!me)return;
 els.touchCounter.innerHTML=me.counterCd>0?`反擊 <small>${me.counterCd.toFixed(1)}s</small>`:me.countering?'反擊 <small>ACTIVE</small>':'反擊 <small>PARRY</small>';
 els.touchGuard.innerHTML=me.chargeCd>0?`衝鋒 <small>${me.chargeCd.toFixed(1)}s</small>`:'衝鋒 <small>CHARGE</small>';
 els.touchBurst.innerHTML=me.cool>0?`必殺 <small>${me.cool.toFixed(1)}s</small>`:'必殺 <small>SKILL</small>';
 els.touchTarget.textContent='◎ '+(latest?.fighters?.find(p=>p.id===targetId)?.name||'自動鎖定最近目標');
}
window.addEventListener('keydown',e=>{
 if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
 const k=e.key.toLowerCase();
 if([' ','j','k','tab'].includes(k)){e.preventDefault();if(e.repeat)return;
 if(k===' ')sendAction('charge');else if(k==='tab')selectNextTarget();else if(k==='k')sendAction('counter');else sendAction('burst');}
});
els.touchGuard.addEventListener('click',()=>sendAction('charge'));els.touchCounter.addEventListener('click',()=>sendAction('counter'));
els.touchBurst.addEventListener('click',()=>sendAction('burst'));
els.touchTarget.addEventListener('click',selectNextTarget);
els.stage.addEventListener('pointerdown',e=>{
 if(room?.status!=='playing'||!latest?.fighters)return;
 const rect=els.stage.getBoundingClientRect();
 const x=(e.clientX-rect.left)*W/rect.width-CX;
 const y=(e.clientY-rect.top)*H/rect.height-CY;
 const hit=latest.fighters.filter(p=>p.alive&&p.id!==ownId).find(p=>dist(p.x-x,p.y-y)<36);
 if(hit){targetId=hit.id;notify('鎖定 '+hit.name);updateChargeUI();}
});
// Original synth percussion loop; all sounds are generated on device (no downloaded audio).
function initAudio(){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audioCtx=audioCtx||new Audio();if(audioCtx.state==='suspended')audioCtx.resume();}
function tone(freq,duration,type='sine',gain=.12,slide=1){if(!audioOn||!audioCtx)return;const t=audioCtx.currentTime;let osc=audioCtx.createOscillator(),g=audioCtx.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(Math.max(30,freq*slide),t+duration);g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);osc.connect(g).connect(audioCtx.destination);osc.start(t);osc.stop(t+duration+.01);}
function noise(duration,gain=.03){if(!audioOn||!audioCtx)return;const n=Math.floor(audioCtx.sampleRate*duration);const buffer=audioCtx.createBuffer(1,n,audioCtx.sampleRate);const ar=buffer.getChannelData(0);for(let i=0;i<n;i++)ar[i]=(Math.random()*2-1)*(1-i/n);const src=audioCtx.createBufferSource(),g=audioCtx.createGain();g.gain.value=gain;src.buffer=buffer;src.connect(g).connect(audioCtx.destination);src.start();}
function beat(){if(!audioOn||!audioCtx)return;const s=beatStep++%16;if(s%4===0)tone(105,.16,'sine',.11,.28);if(s===4||s===12){noise(.08,.028);tone(190,.07,'triangle',.028,.5);}if(s%2===0)noise(.025,.013);if(s===7||s===15)tone(220,.1,'sawtooth',.012,1.33);}
function playEffect(kind){if(!audioOn)return;const tm=performance.now();if(kind==='hit'){if(tm-soundCooldown<55)return;soundCooldown=tm;tone(88,.19,'sawtooth',.21,.33);tone(250,.09,'square',.09,.32);noise(.13,.09);}else if(kind==='skill'){tone(160,.38,'sawtooth',.1,3.8);setTimeout(()=>tone(580,.25,'triangle',.09,.4),120);}else if(kind==='ko'){tone(440,.62,'sawtooth',.13,.17);noise(.2,.06);}else if(kind==='win'||kind==='start'){[280,370,470,700].forEach((n,i)=>setTimeout(()=>tone(n,.28,'triangle',.09,.9),i*100));}}
els.btnSound.addEventListener('click',()=>{initAudio();audioOn=!audioOn;els.soundText.textContent=audioOn?'音效開':'音效關';if(audioOn){beat();beatTimer=setInterval(beat,117);}else{clearInterval(beatTimer);beatTimer=null;}});
// Canvas rendering system. World: -285 .. 285, centered at (500,H/2).
const PI=Math.PI,TAU=2*Math.PI;
let W=1000,H=740,CX=500,CY=370,scale=1,renderLast=performance.now();
function canvasResize(){const rect=els.stage.getBoundingClientRect();if(!rect.width||!rect.height)return;const dpr=Math.min(window.devicePixelRatio||1,2);const ww=Math.round(rect.width*dpr),hh=Math.round(rect.height*dpr);if(els.stage.width!==ww||els.stage.height!==hh){els.stage.width=ww;els.stage.height=hh;}scale=ww/1000;H=hh/scale;CY=H/2;ctx.setTransform(scale,0,0,scale,0,0);}
function pathCircle(x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,TAU);}
function glowCircle(x,y,r,col,blur=14){ctx.save();ctx.shadowColor=col;ctx.shadowBlur=blur;ctx.fillStyle=col;pathCircle(x,y,r);ctx.fill();ctx.restore();}
function line(x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function rotRing(x,y,r,n,rot,color,width=2){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;for(let i=0;i<n;i++){const a=i*TAU/n+rot;ctx.beginPath();ctx.arc(x,y,r,a,a+TAU/n*.6);ctx.stroke();}ctx.restore();}
function bg(t){const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#071020');g.addColorStop(.52,'#101a30');g.addColorStop(1,'#070b16');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);const radial=ctx.createRadialGradient(CX,CY,30,CX,CY,650);radial.addColorStop(0,'rgba(42,86,126,.27)');radial.addColorStop(1,'transparent');ctx.fillStyle=radial;ctx.fillRect(0,0,W,H);
 ctx.save();ctx.strokeStyle='rgba(118,159,199,.055)';ctx.lineWidth=1;let spacing=42;for(let x=0;x<W;x+=spacing)line(x,0,x,H,'rgba(110,160,190,.04)');for(let y=0;y<H;y+=spacing)line(0,y,W,y,'rgba(110,160,190,.04)');ctx.restore();
 for(let i=0;i<60;i++){const x=(i*173.7+43)%W,y=(i*132.7+17)%H;ctx.fillStyle=`rgba(153,197,247,${.08+Math.sin(t*1.4+i)*.06})`;ctx.fillRect(x,y,1.4,1.4);}
}
function drawArena(t,arena,radius,age){ctx.save();ctx.translate(CX,CY);const palette=({colosseum:['#1a273b','#27344a','#ffb66f'],vortex:['#101d38','#193055','#5c8fff'],tempest:['#101e30','#223851','#5fe3f2'],volcano:['#2b1c24','#49262b','#ff7552'],eclipse:['#18162e','#2c2443','#d792ff']})[arena]||['#1a273b','#28354a','#ffb66f'];
 ctx.shadowColor='#000';ctx.shadowBlur=38;ctx.shadowOffsetY=30;ctx.fillStyle='#030710';pathCircle(0,0,radius+20);ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 ctx.fillStyle='#060e1c';pathCircle(0,0,radius+19);ctx.fill();ctx.lineWidth=8;ctx.strokeStyle='#354560';ctx.stroke();ctx.lineWidth=5;ctx.strokeStyle=palette[2];pathCircle(0,0,radius+10);ctx.stroke();
 const gradient=ctx.createRadialGradient(0,0,20,0,0,radius);gradient.addColorStop(0,palette[1]);gradient.addColorStop(.75,palette[0]);gradient.addColorStop(1,'#101728');ctx.fillStyle=gradient;pathCircle(0,0,radius);ctx.fill();ctx.save();pathCircle(0,0,radius-3);ctx.clip();
 // Mechanical radial floor markings
 for(let i=0;i<28;i++){const ang=i*TAU/28+t*.012;line(Math.cos(ang)*118,Math.sin(ang)*118,Math.cos(ang)*radius,Math.sin(ang)*radius,i%2?'#ffffff08':'#ffffff12',1.1);}
 for(const rr of [64,119,184,238]){ctx.strokeStyle='rgba(156,183,217,.14)';ctx.lineWidth=1;pathCircle(0,0,rr);ctx.stroke();}
 rotRing(0,0,221,16,t*.05,color(palette[2],.32),5);rotRing(0,0,98,12,-t*.11,color(palette[2],.36),3);rotRing(0,0,radius-22,28,0,color(palette[2],.4),9);
 for(let i=0;i<8;i++){const a=i*TAU/8;ctx.save();ctx.translate(Math.cos(a)*148,Math.sin(a)*148);ctx.rotate(a);ctx.fillStyle=color(palette[2],.18);ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(15,0);ctx.lineTo(0,9);ctx.lineTo(-15,0);ctx.closePath();ctx.fill();ctx.restore();}
 if(arena==='vortex'){const v=ctx.createRadialGradient(0,0,8,0,0,130);v.addColorStop(0,'rgba(6,3,25,.98)');v.addColorStop(.6,'rgba(74,88,216,.27)');v.addColorStop(1,'transparent');ctx.fillStyle=v;pathCircle(0,0,145);ctx.fill();for(let i=0;i<5;i++){ctx.strokeStyle=`rgba(125,174,255,${.2+i*.05})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,30+i*17,t*(i%2?-.6:.8)+i,t*(i%2?-.6:.8)+i+3.4);ctx.stroke();}}
 if(arena==='tempest'){for(let i=0;i<8;i++){const a=t*.43+i*TAU/8;ctx.strokeStyle='#6fe1f236';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,155+i%2*24,a,a+.75);ctx.stroke();line(Math.cos(a)*190,Math.sin(a)*190,Math.cos(a+.15)*225,Math.sin(a+.15)*225,'#75eaf251',2);}}
 if(arena==='volcano'){const wave=age%9,hot=wave>5.8&&wave<7.8,warn=wave>4.6;for(const x of [-128,128]){const grd=ctx.createRadialGradient(x,0,0,x,0,69);grd.addColorStop(0,hot?'#ff4c456f':warn?'#ffa14665':'#e94e2d22');grd.addColorStop(1,'transparent');ctx.fillStyle=grd;pathCircle(x,0,69);ctx.fill();ctx.strokeStyle=hot?'#ffcf73':warn?'#ff9b54':'#8c3d4d';ctx.lineWidth=hot?4:2;ctx.setLineDash([7,7]);pathCircle(x,0,57);ctx.stroke();ctx.setLineDash([]);if(hot)for(let j=0;j<7;j++){const a=j*TAU/7+t*3;glowCircle(x+Math.cos(a)*rnd(8,42),Math.sin(a)*rnd(8,40),2+Math.random()*2,'#ffba4e',10);}}}
 if(arena==='eclipse'){for(let i=0;i<12;i++){const a=i*TAU/12-t*.12;ctx.strokeStyle='#c090ff39';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,radius+13,a,a+.27);ctx.stroke();}const gr=ctx.createRadialGradient(0,0,radius-30,0,0,radius+50);gr.addColorStop(0,'transparent');gr.addColorStop(.5,'#db59f81c');gr.addColorStop(1,'#dc5af84a');ctx.fillStyle=gr;pathCircle(0,0,radius+42);ctx.fill();}
 // Central insignia
 ctx.save();ctx.rotate(t*.065);ctx.strokeStyle=color(palette[2],.23);ctx.lineWidth=2;for(let i=0;i<4;i++){const a=i*PI/2;line(Math.cos(a)*16,Math.sin(a)*16,Math.cos(a)*51,Math.sin(a)*51,color(palette[2],.35),3);}ctx.restore();glowCircle(0,0,8,color(palette[2],.9),18);
 ctx.restore();ctx.strokeStyle=palette[2];ctx.lineWidth=3;pathCircle(0,0,radius-7);ctx.stroke();ctx.restore();
 // perimeter field warning markers
 ctx.save();ctx.translate(CX,CY);for(let i=0;i<12;i++){const a=i*TAU/12;ctx.save();ctx.translate(Math.cos(a)*(radius+31),Math.sin(a)*(radius+31));ctx.rotate(a+PI/2);ctx.fillStyle=color(palette[2],.7);ctx.beginPath();ctx.moveTo(-6,0);ctx.lineTo(0,-8);ctx.lineTo(6,0);ctx.closePath();ctx.fill();ctx.restore();}ctx.restore();
}
function drawGeometry(geometry,radius,t){
 // Physical guard segments, recessed exit pockets, outside acceleration lanes and contact bumpers.
 ctx.save();ctx.translate(CX,CY);
 for(let i=0;i<4;i++){
  const start=-Math.PI+i*Math.PI/2+.26,end=-Math.PI+(i+1)*Math.PI/2-.26;
  ctx.beginPath();ctx.strokeStyle='#8ce7ff55';ctx.lineWidth=15;ctx.arc(0,0,radius+11,start,end);ctx.stroke();
  ctx.beginPath();ctx.strokeStyle='#b9e8ff';ctx.lineWidth=4;ctx.arc(0,0,radius+11,start,end);ctx.stroke();
 }
 // Danger pockets open at north and south. Entry is only fatal with sufficient impact momentum.
 for(const a of [-Math.PI/2,Math.PI/2]){
  ctx.beginPath();ctx.arc(0,0,radius+12,a-.23,a+.23);ctx.strokeStyle='#ff654d';ctx.lineWidth=13;ctx.stroke();
  ctx.fillStyle='#ffbd83';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText('OUT',Math.cos(a)*(radius+40),Math.sin(a)*(radius+40));
 }
 if(geometry?.lanes!==false){
  for(const a of [0,Math.PI]){
   const offset=a===0?1:-1;
   ctx.save();ctx.shadowColor='#61f5ff';ctx.shadowBlur=14;ctx.strokeStyle='#54e8ffb8';ctx.lineWidth=8;ctx.beginPath();ctx.arc(0,0,radius+25,a-.24,a+.9*(offset===1?1:-1),offset===-1);ctx.stroke();ctx.restore();
   ctx.fillStyle='#7fffff';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText('RETURN',Math.cos(a)*(radius+57),Math.sin(a)*(radius+57));
  }
 }
 for(const ob of geometry?.pillars||[{x:0,y:-125,r:16},{x:0,y:125,r:16}]){
  const pulse=.55+Math.sin(t*4+ob.x)*.13;
  ctx.save();ctx.shadowColor='#e5a96c';ctx.shadowBlur=17;ctx.fillStyle='#0b2234';pathCircle(ob.x,ob.y,ob.r+6);ctx.fill();ctx.lineWidth=5;ctx.strokeStyle=`rgba(255,184,109,${pulse})`;pathCircle(ob.x,ob.y,ob.r+2);ctx.stroke();ctx.fillStyle='#f6c382';pathCircle(ob.x,ob.y,ob.r-4);ctx.fill();ctx.fillStyle='#334050';pathCircle(ob.x,ob.y,ob.r-9);ctx.fill();ctx.restore();
 }
 ctx.restore();
}
function spawnBurst(x,y,c,n=30,strength=140){for(let i=0;i<n;i++){const a=Math.random()*TAU,s=(.2+Math.random())*strength;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.5,max:.85,size:Math.random()*3+1,c});}if(particles.length>420)particles.splice(0,particles.length-420);}
function drawParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.98;p.vy*=.98;if(p.life<=0){particles.splice(i,1);continue;}ctx.save();ctx.globalAlpha=clamp(p.life/.55,0,1);glowCircle(CX+p.x,CY+p.y,p.size,p.c,8);ctx.restore();}}
function drawWaves(dt){for(let i=shockwaves.length-1;i>=0;i--){const p=shockwaves[i];p.life-=dt;p.r+=dt*230;if(p.life<=0){shockwaves.splice(i,1);continue;}ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.strokeStyle=p.c;ctx.lineWidth=3;pathCircle(CX+p.x,CY+p.y,p.r);ctx.stroke();ctx.globalAlpha=1;}}
function drawTop(p,t,tm,dt){if(!p.alive){
  const x=CX+p.x+(p.reason==='擊出場外'?(p.vx||0)*.06:0),y=CY+p.y+(p.reason==='擊出場外'?(p.vy||0)*.06:0);
  ctx.save();ctx.globalAlpha=p.reason==='擊出場外'?.25:.42;ctx.translate(x,y);
  if(p.reason!=='擊出場外')ctx.scale(1,.36);
  drawTopBody(0,0,22,t.color,t.accent,0);ctx.restore();return;
 }let x=CX+p.x,y=CY+p.y;const col=t.color,acc=t.accent,ang=tm*12*(.30+p.spin/85)+(p.id.length*1.9),r=22;const wobble=(p.wobble||0)/100; x+=Math.sin(tm*23)*wobble*3; y+=Math.cos(tm*27)*wobble*3;let tr=trails[p.id]||(trails[p.id]=[]);tr.push({x,y,alpha:1});if(tr.length>15)tr.shift();if(tr.length>1){ctx.save();ctx.lineCap='round';for(let i=1;i<tr.length;i++){ctx.strokeStyle=color(col,i/tr.length*.35);ctx.lineWidth=2+i/tr.length*7;ctx.beginPath();ctx.moveTo(tr[i-1].x,tr[i-1].y);ctx.lineTo(tr[i].x,tr[i].y);ctx.stroke();}ctx.restore();}
 if(p.boost&&Math.random()<.28)spawnBurst(p.x,p.y,col,2,40);
 if(p.phase){ctx.save();ctx.globalAlpha=.33;drawTopBody(x-17,y+10,r,col,acc,ang-.4);drawTopBody(x+18,y-8,r,col,acc,ang+.4);ctx.restore();}
 ctx.save();ctx.translate(x,y);ctx.fillStyle='#0009';ctx.beginPath();ctx.ellipse(3,15,27,10,0,0,TAU);ctx.fill();ctx.restore();
 if(p.id===targetId){ctx.save();ctx.setLineDash([5,5]);ctx.strokeStyle='#ffec73';ctx.lineWidth=3;pathCircle(x,y,34);ctx.stroke();ctx.restore();}
 if(p.charging){ctx.save();ctx.strokeStyle='#ffe0a0';ctx.lineWidth=4;ctx.shadowColor='#ffc44b';ctx.shadowBlur=26;pathCircle(x,y,32);ctx.stroke();ctx.restore();}
 if(p.shield){ctx.save();ctx.strokeStyle='#b6eafd';ctx.lineWidth=2;ctx.shadowColor='#71d6ff';ctx.shadowBlur=15;ctx.setLineDash([8,5]);ctx.lineDashOffset=-tm*28;pathCircle(x,y,30);ctx.stroke();ctx.restore();}
 if(p.blade){rotRing(x,y,34,4,-tm*3,color(acc,.75),4);}
 if(p.impact)glowCircle(x,y,27,'rgba(255,243,220,.62)',20);if(p.rail){glowCircle(x,y,32,'rgba(72,233,255,.28)',25);rotRing(x,y,34,5,tm*8,'#7df8ff',3);}
 drawTopBody(x,y,r,col,acc,ang,p.build);
 // fighter callout
 ctx.fillStyle=p.id===ownId?'#fff1c9':'#dfebff';ctx.shadowColor='#000';ctx.shadowBlur=7;ctx.textAlign='center';ctx.font=`${p.id===ownId?'bold ':''}12px system-ui`;ctx.fillText((p.id===ownId?'★ ':'')+p.name,x,y-38);ctx.shadowBlur=0;
 if(p.cool===0){ctx.fillStyle=color(acc,.8);ctx.fillRect(x-13,y+30,26,3);}else{ctx.fillStyle='#101a2b';ctx.fillRect(x-13,y+30,26,3);ctx.fillStyle=color(col,.8);ctx.fillRect(x-13,y+30,26*clamp(1-p.cool/(t.cd||10),0,1),3);}
}
function drawTopBody(x,y,r,col,acc,ang,build){ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.shadowColor=col;ctx.shadowBlur=17;ctx.fillStyle='#15213a';pathCircle(0,3,r+3);ctx.fill();ctx.shadowBlur=0;
 // Cutting teeth and outer chassis
 const teeth=Math.max(2,Math.min(9,+(parts.ratchets.find(x=>x.id===build?.ratchet)?.gear||5)));for(let i=0;i<teeth;i++){const a=i*TAU/teeth;ctx.save();ctx.rotate(a);ctx.fillStyle=i%2?col:acc;ctx.beginPath();ctx.moveTo(r-2,-6);ctx.lineTo(r+7,-5);ctx.lineTo(r+5,5);ctx.lineTo(r-2,6);ctx.closePath();ctx.fill();ctx.restore();}
 const g=ctx.createRadialGradient(-6,-7,1,0,0,r);g.addColorStop(0,acc);g.addColorStop(.32,col);g.addColorStop(.55,'#1b2741');g.addColorStop(.82,col);g.addColorStop(1,'#0d1528');ctx.fillStyle=g;pathCircle(0,0,r);ctx.fill();ctx.strokeStyle=acc;ctx.lineWidth=2;pathCircle(0,0,r-2);ctx.stroke();ctx.strokeStyle='#dceef0aa';ctx.lineWidth=1;pathCircle(0,0,r-8);ctx.stroke();
 for(let i=0;i<5;i++){const a=i*TAU/5;ctx.save();ctx.rotate(a);ctx.fillStyle=acc;ctx.beginPath();ctx.moveTo(-3,-8);ctx.lineTo(0,-17);ctx.lineTo(5,-8);ctx.closePath();ctx.fill();ctx.restore();}
 ctx.fillStyle='#16253a';pathCircle(0,0,8);ctx.fill();const bitId=build?.bit||'taper';ctx.fillStyle=bitId==='gear'?'#8ef5ff':bitId==='rubber'?'#ffbb66':acc;if(bitId==='needle'){ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(8,5);ctx.lineTo(-8,5);ctx.closePath();ctx.fill();}else if(bitId==='flat'||bitId==='rush'){ctx.fillRect(-6,-6,12,12);}else{pathCircle(0,0,bitId==='ball'?6.6:5.3);ctx.fill();}glowCircle(0,0,2.3,'#fff8e8',5);ctx.restore();}
function introDuel(t){const c1={id:'intro1',name:'緋焰鳳凰',x:Math.cos(t*.6)*112,y:Math.sin(t*.6)*98,spin:90,cool:3,alive:true,shield:false,boost:true};const c2={id:'intro2',name:'雷霆迅鷹',x:Math.cos(t*.67+PI)*120,y:Math.sin(t*.67+PI)*95,spin:75,cool:2,alive:true,shield:false,boost:false};drawTop(c1,getTop('phoenix')||{color:'#f65c46',accent:'#ffd16a',cd:10},t,0);drawTop(c2,getTop('raptor')||{color:'#ffdf61',accent:'#aceefa',cd:10},t,0);}
function frame(now){if(window.SPIN3D_READY){requestAnimationFrame(frame);return;}const dt=clamp((now-renderLast)/1000,0,.055);renderLast=now;playTime+=dt;canvasResize();ctx.save();ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,W,H);const offs=shake>0?(Math.random()-.5)*shake:0;ctx.translate(offs,offs*.7);shake=Math.max(0,shake-dt*24);bg(playTime);drawArena(playTime,room?.arena||'colosseum',latest?.radius||235,latest?.time||0);drawGeometry(latest?.geometry||null,latest?.radius||235,playTime);
 if(latest?.fighters&&(room?.status==='playing'||room?.status==='results')){const ids=new Set();for(const p of latest.fighters){ids.add(p.id);let v=vis[p.id];if(!v){v=vis[p.id]={x:p.x,y:p.y};}const lerp=clamp(dt*24,0,1);v.x+=(p.x-v.x)*lerp;v.y+=(p.y-v.y)*lerp;const t=getTop(p.top);if(t)drawTop({...p,x:v.x,y:v.y},t,playTime,dt);}
 for(const id of Object.keys(trails))if(!ids.has(id))delete trails[id];}else if(tops.length)introDuel(playTime);
 drawWaves(dt);drawParticles(dt);ctx.restore();if(flash>0){flash-=dt;ctx.save();ctx.fillStyle=`rgba(255,246,227,${flash*.4})`;ctx.fillRect(0,0,W,H);ctx.restore();}requestAnimationFrame(frame);}
network();setInterval(()=>{if(ws?.readyState===WebSocket.OPEN){if(Date.now()-lastServerSeen>50000)ws.close();else send({t:'ping'});}},20000);requestAnimationFrame(frame);
})();

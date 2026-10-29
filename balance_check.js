/** AI-vs-AI statistical smoke test; *not* a substitute for human playtesting. */
const {TOPS,ARENAS,fightersFor,tickRoom}=require('./server');
const N=Number(process.argv[2]||720);
const win=Object.fromEntries(TOPS.map(t=>[t.id,0]));
const played=Object.fromEntries(TOPS.map(t=>[t.id,0]));
const survived=Object.fromEntries(TOPS.map(t=>[t.id,0]));
const durations=[];
let broken=0;
for(let game=0;game<N;game++){
 const shuffled=TOPS.slice();for(let j=shuffled.length-1;j>0;j--){const k=Math.floor(Math.random()*(j+1));[shuffled[j],shuffled[k]]=[shuffled[k],shuffled[j]];}const picks=shuffled.slice(0,4);
 const r={code:'BENCH',round:1,host:'nobody',arena:ARENAS[game%ARENAS.length].id,status:'playing',bots:0,players:picks.map((t,i)=>({id:'sim'+i,name:t.name,top:t.id,bot:false})),age:0,fighters:[],events:[],results:null,hitPairs:new Map(),updated:Date.now()};
 r.fighters=fightersFor(r);r.fighters.forEach(f=>{f.bot=true;played[f.top]++});
 let ticks=0;
 while(r.status==='playing'&&ticks<3000){tickRoom(r,1/30);ticks++;for(const f of r.fighters){if(!Number.isFinite(f.x)||!Number.isFinite(f.spin))broken++;}}
 if(!r.results||r.results.length!==4){broken++;continue;}
 win[r.results[0].top]++;for(const f of r.fighters)if(f.alive)survived[f.top]++;
 durations.push(r.age);
}
const table=TOPS.map(t=>({name:t.name,type:t.type,played:played[t.id],wins:win[t.id],winRate:(100*win[t.id]/Math.max(1,played[t.id])).toFixed(1)+'%',baseRate:'25%',survivals:survived[t.id]})).sort((a,b)=>parseFloat(b.winRate)-parseFloat(a.winRate));
console.table(table);
console.log({games:N,meanSeconds:(durations.reduce((a,b)=>a+b,0)/N).toFixed(1),numericalErrors:broken});
if(broken)process.exitCode=1;

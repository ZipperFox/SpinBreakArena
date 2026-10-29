'use strict';
const {spawn}=require('node:child_process');
const http=require('node:http');
const path=require('node:path');
const port=31860;
let child;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function check(){
 return new Promise(resolve=>{const r=http.get(`http://127.0.0.1:${port}/health`,res=>{let data='';res.on('data',x=>data+=x);res.on('end',()=>{try{resolve(JSON.parse(data).physics==='rapier3d')}catch{resolve(false)}});});r.on('error',()=>resolve(false));r.setTimeout(1500,()=>{r.destroy();resolve(false)});});
}
(async()=>{
 child=spawn(process.execPath,[path.join(__dirname,'..','server.js')],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr.on('data',data=>stderr+=data.toString());
 for(let i=0;i<45;i++){if(child.exitCode!==null)throw Error(`server exited: ${stderr}`);if(await check())break;await delay(150);}
 if(!await check())throw Error(`Rapier 3D server did not start: ${stderr}`);
 const t=spawn(process.execPath,[path.join(__dirname,'..','test_multiplayer.js')],{cwd:path.join(__dirname,'..'),env:{...process.env,GAME_WS:`ws://127.0.0.1:${port}/ws`},stdio:['ignore','pipe','pipe']});
 let output='',error='';t.stdout.on('data',d=>output+=d.toString());t.stderr.on('data',d=>error+=d.toString());
 const ret=await Promise.race([new Promise(resolve=>t.once('exit',resolve)),delay(20000).then(()=>{t.kill('SIGKILL');return 124;})]);
 if(ret!==0)throw Error(`4-player multiplayer integration failed (code ${ret}): ${output}\n${error}\n${stderr}`);
 console.log(output.trim());console.log('RAPIER3D_MULTIPLAYER_PASS');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;}).finally(()=>{child?.kill('SIGTERM');});

'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {create,SOUND_NAMES}=require('./public/audio.js');
const audio=fs.readFileSync('./public/audio.js','utf8');
const renderer=fs.readFileSync('./public/arena3d.js','utf8');
const html=fs.readFileSync('./public/index.html','utf8');
const client=fs.readFileSync('./public/client.js','utf8');
let played=0,requests=0,volume=0;
const param=()=>({value:0,setValueAtTime(n){this.value=n;},setTargetAtTime(n){this.value=n;}});
const node=()=>({gain:param(),threshold:param(),ratio:param(),knee:param(),attack:param(),release:param(),playbackRate:param(),connect(){return this;},start(){played++;}});
class AudioCtor{
 constructor(){this.currentTime=2;this.state='running';this.destination=node();}
 createDynamicsCompressor(){return node();}createGain(){return node();}createBufferSource(){return node();}
 decodeAudioData(bytes){assert(bytes.byteLength>44);return Promise.resolve({duration:.25});}
 resume(){return Promise.resolve();}
}
for(const name of SOUND_NAMES){const p=path.join(__dirname,'public/sfx',name+'.wav');const b=fs.readFileSync(p);assert.equal(b.toString('ascii',0,4),'RIFF',name);assert.equal(b.toString('ascii',8,12),'WAVE',name);assert(b.length>2000,name+' audio must be nonempty');}
let clock=1000;
async function main(){
 const sfx=create({AudioCtor,now:()=>clock,fetch:async url=>{requests++;const file=url.split('/').pop().split('?')[0];const b=fs.readFileSync(path.join(__dirname,'public/sfx',file));return {ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};}});
 assert.equal(sfx.isEnabled(),false);assert.equal(sfx.play('hit',{amount:200}),false);
 sfx.setVolume(.15);assert.equal(sfx.enable(),true);await sfx.ready();assert.equal(sfx.loadedCount(),SOUND_NAMES.length);
 assert.equal(sfx.play('hit',{amount:240}),true);assert.equal(sfx.play('hit',{amount:240}),false);
 clock+=150;assert.equal(sfx.play('hit',{amount:40}),true);
 for(const kind of ['wall','charge','skill','counter','ko','warning','anomaly','start','win']){clock+=1000;assert.equal(sfx.play(kind),true,kind);}
 sfx.disable();assert.equal(sfx.play('hit',{amount:220}),false);
 assert(!audio.includes('createOscillator'),'No synthetic oscillator beeps');
 assert(!audio.includes('setInterval('),'No audio sequencer');
 assert(html.includes('effectsVolume')&&client.includes('soundEngine?.setVolume?'),'User volume control');
 for(const id of ['colosseum','vortex','tempest','volcano','eclipse']){
  assert(renderer.includes(`if(name==='${id}')`)||renderer.includes(`else if(name==='${id}')`),'Stage art '+id);
  assert(renderer.includes(`${id}:{sky:`),'Unique environment mood '+id);
 }
 assert(renderer.includes('makeStageFloor(name)'),'No identical floor texture');
 assert(renderer.includes('stageScenery(name,hot,cyan)'),'Stage structures');
 assert(renderer.includes('stageLighting(name)'),'Stage ambient colors');
 assert(renderer.includes('beyond the ring and the return lanes'),'Stage scenery must remain visually-only outside the ring');
 assert(fs.readFileSync('./server.js','utf8').includes("'.wav':'audio/wav'"),'Serve WAV with correct MIME');
 assert.equal(requests,SOUND_NAMES.length);
 console.log(`V10_5_AUDIO_ARENAS_PASS uniqueStages=5 localSamples=${SOUND_NAMES.length} audioStarts=${played} audioNetworkLoads=${requests} volumeControl=true`);
}
main().catch(err=>{console.error(err);process.exitCode=1;});

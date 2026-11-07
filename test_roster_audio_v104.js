'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {create}=require('./public/audio.js');
const makeParam=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
let nodes=0,played=0;
function makeNode(){nodes++;return {connect(){return this;},start(){played++;},stop(){},gain:makeParam(),frequency:makeParam(),detune:{value:0},Q:{value:0},threshold:makeParam(),knee:makeParam(),ratio:makeParam(),attack:makeParam(),release:makeParam()};}
class AudioContextMock{
 constructor(){this.sampleRate=24000;this.currentTime=2;this.destination=makeNode();this.state='running';}
 createDynamicsCompressor(){return makeNode();}
 createGain(){return makeNode();}
 createOscillator(){return makeNode();}
 createBiquadFilter(){return makeNode();}
 createBufferSource(){return makeNode();}
 createBuffer(_channels,n){return {getChannelData:()=>new Float32Array(n)};}
 resume(){return Promise.resolve();}
}
let clock=1000;
const sfx=create({AudioCtor:AudioContextMock,now:()=>clock});
assert.equal(sfx.isEnabled(),false);
assert.equal(sfx.play('hit'),false,'Sound must be opt-in');
assert.equal(sfx.enable(),true);
assert.equal(sfx.play('hit',{amount:230}),true);
const playedAfterHit=played;
assert(playedAfterHit>=3,'Impact should have multiple damped resonances');
clock+=50;assert.equal(sfx.play('hit',{amount:200}),false,'Rate limit overlapping impacts');
clock+=120;assert.equal(sfx.play('hit',{amount:130}),true);
for(const kind of ['wall','charge','skill','counter','ko','warning','anomaly','start','win']){
 clock+=1000;assert.equal(sfx.play(kind),true,kind+' should be recognized');
}
sfx.disable();assert.equal(sfx.play('hit'),false);
const client=fs.readFileSync('./public/client.js','utf8');
const renderer=fs.readFileSync('./public/arena3d.js','utf8');
const server=fs.readFileSync('./server.js','utf8');
const html=fs.readFileSync('./public/index.html','utf8');
assert(!client.includes('setInterval(beat,'),'No continuous beep rhythm');
assert(html.indexOf('/audio.js?v=10.4')<html.indexOf('/client.js?v=10.4'));
assert(client.includes('rosterExpected')&&client.includes('已淘汰'),'Explain 3 of 4 when one has been eliminated');
assert(renderer.includes('createFighterBadge')&&renderer.includes('SPINBREAK_RENDER_DIAGNOSTICS'));
assert(renderer.includes('missingModels:')&&renderer.includes('badge.visible=!!p.alive'));
assert(server.includes('Fighter roster mismatch')&&server.includes('state.rosterExpected'));
console.log(`V10_4_ROSTER_AUDIO_PASS oscillatorStarts=${played} nodes=${nodes} fourModelBadges=true rosterDiagnostics=true eventDrivenAudio=true`);

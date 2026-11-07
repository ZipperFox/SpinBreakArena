'use strict';
// V10.4 roster regression continues to run; V10.5 audio no longer uses oscillators.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const client=fs.readFileSync('./public/client.js','utf8');
const renderer=fs.readFileSync('./public/arena3d.js','utf8');
const server=fs.readFileSync('./server.js','utf8');
const html=fs.readFileSync('./public/index.html','utf8');
assert(!client.includes('setInterval(beat,'),'No continuous beep rhythm');
assert(html.indexOf('/audio.js?v=10.5')<html.indexOf('/client.js?v=10.5'));
assert(client.includes('rosterExpected')&&client.includes('已淘汰'),'Explain 3 of 4 when one has been eliminated');
assert(renderer.includes('createFighterBadge')&&renderer.includes('SPINBREAK_RENDER_DIAGNOSTICS'));
assert(renderer.includes('missingModels:')&&renderer.includes('badge.visible=!!p.alive'));
assert(server.includes('Fighter roster mismatch')&&server.includes('state.rosterExpected'));
console.log('V10_4_ROSTER_PASS fourModelBadges=true rosterDiagnostics=true');

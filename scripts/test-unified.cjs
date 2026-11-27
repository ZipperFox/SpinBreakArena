'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync('public/arena3d.js','utf8'),html=fs.readFileSync('public/index.html','utf8');
for(let f of ['art.mjs','combat-visuals.mjs','accretion.mjs','mechanical-top.mjs','rotor-spec.mjs','audio.mjs'])assert.equal(fs.readFileSync('public/forge/'+f,'utf8'),fs.readFileSync('labs/forge-zero/src/'+f,'utf8'),f);
for(let k of ['buildArena(forgeMaterials)','buildAlternateArena(forgeMaterials','addBattleBowl(shell','createEnvironment(renderer)','composer.render(dt)','forgeFx.event(kind','forgeFx.update(dt','createAccretionMaterial()','fitDistance(fighters'])assert(src.includes(k),k);
for(let k of ['garageExplode','coreSelect','btnCreate','btnJoin','botCount','touchController','cameraMode','musicVolume'])assert(html.includes('id="'+k+'"'),k);
assert(!src.includes('world.step('));console.log('UNIFIED_FORGE_PASS sharedModules=6 scene=true bloom=true contactShader=true accretion=true authoritative=true');

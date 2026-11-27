'use strict';
const fs=require('node:fs'),path=require('node:path');
const src=path.join(__dirname,'..','node_modules','three','build','three.core.js');
const core=path.join(__dirname,'..','node_modules','three','build','three.module.js');
const target=path.join(__dirname,'..','public','vendor');
fs.mkdirSync(target,{recursive:true});
fs.copyFileSync(src,path.join(target,'three.core.js'));
fs.copyFileSync(core,path.join(target,'three.module.js'));
console.log('[SPIN//BREAK] Bundled Three.js locally, no runtime CDN required');

const threeRoot=path.join(__dirname,'..','node_modules','three');
fs.cpSync(path.join(threeRoot,'examples','jsm'),path.join(target,'addons'),{recursive:true});
const lab=path.join(__dirname,'..','labs','forge-zero','src'),forge=path.join(__dirname,'..','public','forge');fs.mkdirSync(forge,{recursive:true});
for(const n of ['art.mjs','combat-visuals.mjs','accretion.mjs','rotor-physics.mjs','mechanical-top.mjs','rotor-spec.mjs','audio.mjs'])fs.copyFileSync(path.join(lab,n),path.join(forge,n));
fs.cpSync(path.join(lab,'sfx'),path.join(forge,'sfx'),{recursive:true});

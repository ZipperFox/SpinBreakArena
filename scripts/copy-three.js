'use strict';
const fs=require('node:fs'),path=require('node:path');
const src=path.join(__dirname,'..','node_modules','three','build','three.core.js');
const core=path.join(__dirname,'..','node_modules','three','build','three.module.js');
const target=path.join(__dirname,'..','public','vendor');
fs.mkdirSync(target,{recursive:true});
fs.copyFileSync(src,path.join(target,'three.core.js'));
fs.copyFileSync(core,path.join(target,'three.module.js'));
console.log('[SPIN//BREAK] Bundled Three.js locally, no runtime CDN required');

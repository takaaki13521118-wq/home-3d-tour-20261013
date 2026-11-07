// Actual pinned parsers and WASM. No browser rendering is simulated here.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {jwwBrowserModule,convertCADBytes} from '../cad-runtime.mjs';
import {cadVectors,cadPreview} from '../cad-core.mjs';
import {makePlanDesign,planSpawn} from '../plan-core.mjs';
const root=process.env.CAD_TEST_ROOT;if(!root)throw Error('CAD_TEST_ROOT is required');
const require=createRequire(root+'/package.json');const DxfParser=require('dxf-parser');
const packageRoot=root+'/node_modules/';
const glue=await fs.readFile(packageRoot+'ezjww/wasm/ezjww_wasm.js','utf8');
const init=(await import('data:text/javascript;base64,'+Buffer.from(jwwBrowserModule(glue)).toString('base64'))).default;
const jww=await init(await fs.readFile(packageRoot+'ezjww/wasm/ezjww_wasm_bg.wasm'));
const drawing=jww.newJwwDocument();const base={group:0,pen_style:1,pen_color:1,pen_width:0,layer:0,layer_group:0,flag:0};
for(const [x1,y1,x2,y2]of [[0,0,80,0],[80,0,80,60],[80,60,0,60],[0,60,0,0]])drawing.entities.push({type:'LINE',base:{...base},start_x:x1,start_y:y1,end_x:x2,end_y:y2});
drawing.options.layer_groups[0].scale=100;
const bytes=jww.toJwwBytes(drawing);assert(bytes.length>100);
const result=await convertCADBytes(bytes,'jww',{DxfParser,loadJWW:async()=>jww});
const cad=cadVectors(result.doc,result);const p=cadPreview(cad,cad.layers.map(l=>l.name),{metresPerUnit:.001,paperScale:100});
const d=makePlanDesign(p.lines,p.width,p.height,{width:p.worldWidth});assert.equal(d.walls.length,4);assert(Math.abs(Math.abs(d.walls[0].x2-d.walls[0].x1)-8)<.001);assert(planSpawn(d));
console.log('PASS: JWW binary writer → browser-adapted WASM → DXF → 8m/6m wall model → safe spawn');
const dxf=jww.readDxfString(bytes,true,16);const r=await convertCADBytes(new TextEncoder().encode(dxf),'dxf',{DxfParser});assert.equal(cadVectors(r.doc).lines.length,4);
await assert.rejects(()=>convertCADBytes(new TextEncoder().encode('AutoCAD Binary DXF\r\n'),'dxf',{DxfParser}),/バイナリ/);
await assert.rejects(()=>convertCADBytes(new Uint8Array([1,2]),'jww',{DxfParser,loadJWW:async()=>jww}),/JWW/);
console.log('PASS: real ASCII DXF parser and malformed/binary rejection');
const dwg=await import(pathToFileURL(packageRoot+'dwgdxf/dist/index.js').href);
await dwg.init({wasmBase:pathToFileURL(packageRoot+'dwgdxf/dist/wasm').href});
for(const version of ['AC1014','AC1015','AC1018','AC1021','AC1024','AC1027','AC1032']){
 const response=await fetch('https://raw.githubusercontent.com/DomCR/ACadSharp/master/samples/sample_'+version+'.dwg');if(!response.ok)throw Error('DWG fixture fetch failed '+response.status);
 const data=new Uint8Array(await response.arrayBuffer());
 const decoded=await convertCADBytes(data,'dwg',{DxfParser,loadDWG:async()=>dwg});
 const v=cadVectors(decoded.doc,decoded);assert(v.lines.length>0);assert(v.layers.length>0);
 console.log('PASS: DWG '+version+' → '+v.lines.length+' straight wall candidates / '+v.layers.length+' layers');
}
// Check the exact hosted browser entry points (including the generated JWW glue).
for(const [url,check]of [
 ['https://cdn.jsdelivr.net/npm/ezjww@0.7.11/wasm/ezjww_wasm.js',t=>assert.equal(t,glue)],
 ['https://cdn.jsdelivr.net/npm/dxf-parser@1.1.2/+esm',t=>assert(t.includes('export'))],
 ['https://cdn.jsdelivr.net/npm/dwgdxf@2.0.1/dist/index.js',t=>assert(t.includes('convertDwgToDxf'))],
 ['https://cdn.jsdelivr.net/npm/dwgdxf@2.0.1/dist/wasm/dwgdxf.js',t=>assert(t.includes('convertDwgToDxf'))]
]){const response=await fetch(url);assert(response.ok,url);check(await response.text());}
console.log('PASS: pinned browser CDN entry points available');

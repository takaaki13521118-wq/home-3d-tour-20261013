// Run with PDF_TEST_ROOT pointing to an isolated npm prefix. No private plan is uploaded.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {detectWalls,makePlanDesign,planSpawn} from '../plan-core.mjs';
const prefix=process.env.PDF_TEST_ROOT;if(!prefix)throw Error('Set PDF_TEST_ROOT to the test dependency prefix');
const require=createRequire(prefix+'/package.json'),canvasLib=require('@napi-rs/canvas');
for(const key of ['DOMMatrix','ImageData','Path2D'])globalThis[key]=canvasLib[key];
const pdfjs=await import(pathToFileURL(prefix+'/node_modules/pdfjs-dist/build/pdf.mjs'));
const stream='0 G 4 w 20 20 200 140 re S 120 20 m 120 70 l S 120 100 m 120 160 l S';
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 240 180] /Resources << >> /Contents 5 0 R >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 240 180] /Resources << >> /Contents 5 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
let content='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(content.length);content+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
const xref=content.length;content+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(const offset of offsets.slice(1))content+=`${String(offset).padStart(10,'0')} 00000 n \n`;content+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
const task=pdfjs.getDocument({data:Uint8Array.from(Buffer.from(content)),isEvalSupported:false});const pdf=await task.promise;assert.equal(pdf.numPages,2);
for(const pageNumber of [1,2]){const page=await pdf.getPage(pageNumber),viewport=page.getViewport({scale:1});const canvas=canvasLib.createCanvas(viewport.width,viewport.height),ctx=canvas.getContext('2d');await page.render({canvasContext:ctx,viewport}).promise;const lines=detectWalls(ctx.getImageData(0,0,canvas.width,canvas.height),{minLength:24});assert(lines.length>=6);const model=makePlanDesign(lines,canvas.width,canvas.height,{width:12});assert(planSpawn(model));}
await task.destroy();console.log('PASS: actual PDF.js library, two-page PDF rendering, wall extraction and usable 3D model data');

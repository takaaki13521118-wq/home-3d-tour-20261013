import assert from 'node:assert/strict';
import fs from 'node:fs';import {createRequire} from 'node:module';
import {ocrTokens} from '../plan-ocr.mjs';import {textCandidates} from '../plan-semantic.mjs';
const require=createRequire(process.env.OCR_TEST_ROOT+'/package.json'),{createWorker}=require('tesseract.js');
const worker=await createWorker('jpn+eng',1,{cachePath:process.env.OCR_TEST_ROOT});
try{await worker.setParameters({tessedit_pageseg_mode:'11'});const image=Buffer.from(fs.readFileSync(new URL('./fixtures/semantic-plan.b64',import.meta.url),'utf8'),'base64');const {data}=await worker.recognize(image,{}, {blocks:true,text:true});const result=textCandidates(ocrTokens(data));console.log('Actual OCR labels:',result.map(c=>c.name).join(', '));for(const kind of ['kitchen','tatami','storage','stairs'])assert(result.some(c=>c.kind===kind),'Missing OCR kind '+kind);}finally{await worker.terminate();}
console.log('PASS: real Japanese OCR -> kitchen, tatami, storage and stairs candidates');

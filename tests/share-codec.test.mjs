import assert from 'node:assert/strict';
import {encodePlanFragment,decodePlanFragment,shareURL,designFromHash} from '../share-codec.mjs';
const original={version:2,name:'家族の間取り・東京',width:10.1234,depth:8.2376,height:2.6,thickness:.12,wall:'#aabbcc',roof:'flat',walls:[{x1:-3.1234,z1:-2,x2:3.1234,z2:-2,kind:'wall'},{x1:3.1234,z1:-2,x2:3.1234,z2:2,kind:'door'},{x1:-3.1234,z1:2,x2:3.1234,z2:2,kind:'window'},{x1:-1,z1:-1,x2:1,z2:1,kind:'wall'}]};
const compact=encodePlanFragment(original);assert.deepEqual(decodePlanFragment(compact),original);
const url=shareURL('https://example.test/house/?v=2#old',original);assert(url.startsWith('https://example.test/house/?v=2#plan='));assert.deepEqual(designFromHash(url.slice(url.indexOf('#'))),original);
assert.equal(designFromHash('#none'),null);assert.equal(shareURL('https://example.test/#old',null),'https://example.test/');
const legacy={version:1,name:'小さな家',width:10,depth:9,height:2.6,bedrooms:2,ratio:.45,side:'north',roof:'shed',wall:'#778855',roofColor:'#aa7744'};
const oldURL=shareURL('https://example.test/',legacy);assert.deepEqual(designFromHash(oldURL.slice(oldURL.indexOf('#'))),legacy);
assert.deepEqual(designFromHash('#design='+encodeURIComponent(JSON.stringify(original))),original); // Old links remain usable.
const many={...original,name:'日本語の家'.repeat(8),width:60,depth:60,walls:Array.from({length:400},(_,i)=>({x1:-30,z1:+(-30+i*.1).toFixed(4),x2:30,z2:+(30-i*.1).toFixed(4),kind:['wall','door','window'][i%3]}))};
const manyURL=shareURL('https://example.test/house/?v=2',many);assert(manyURL.length<8000,`max-size link too long: ${manyURL.length}`);assert.deepEqual(designFromHash(manyURL.slice(manyURL.indexOf('#'))),many);
for(const bad of ['','!','A','AAAA','_'.repeat(12001),compact.slice(0,-5)])assert.throws(()=>decodePlanFragment(bad));
const tampered=compact.split('');tampered[0]='_' ;assert.throws(()=>decodePlanFragment(tampered.join('')));
console.log('PASS: compact family links, 400-wall size bound, Unicode, legacy links and malformed fragment rejection');

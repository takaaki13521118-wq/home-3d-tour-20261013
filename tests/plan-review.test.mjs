import assert from 'node:assert/strict';
import {reviewRect,excludePlanRegions,cropReviewRegions} from '../plan-review.mjs';
const wall=(x1,y1,x2,y2,kind='wall')=>({x1,y1,x2,y2,kind});
const rect=reviewRect({x:80,y:80},{x:20,y:20});
const exterior=[wall(20,20,80,20),wall(80,20,80,80),wall(80,80,20,80),wall(20,80,20,20)];
const furniture=[wall(30,30,60,30),wall(60,30,60,60),wall(60,60,30,60),wall(30,60,30,30)];
const openings=[wall(25,40,45,40,'door'),wall(55,50,75,50,'window')];
const source=[...exterior,...furniture,...openings],copy=structuredClone(source);
let result=excludePlanRegions(source,[rect]);
assert.deepEqual(result.lines,[...exterior,...openings]);assert.equal(result.removed.length,4);assert.deepEqual(source,copy);
// Boundaries and outside portions remain; arbitrary angles and reversed lines work.
assert.deepEqual(excludePlanRegions([wall(0,50,100,50)],[rect]).lines,[wall(0,50,20,50),wall(80,50,100,50)]);
assert.deepEqual(excludePlanRegions([wall(100,100,0,0)],[rect]).lines,[wall(100,100,80,80),wall(20,20,0,0)]);
assert.deepEqual(excludePlanRegions([wall(0,20,100,20)],[rect]).lines,[wall(0,20,100,20)]);
assert.deepEqual(excludePlanRegions([wall(0,40,40,0)],[rect]).removed,[]); // touches one corner
assert.deepEqual(excludePlanRegions(result.lines,[rect]).lines,result.lines);
const a=reviewRect({x:10,y:10},{x:60,y:70}),b=reviewRect({x:40,y:20},{x:90,y:80});
assert.deepEqual(excludePlanRegions([wall(0,50,100,50)],[a,b]).lines,[wall(0,50,10,50),wall(90,50,100,50)]);
assert.deepEqual(cropReviewRegions([rect],30,30,40,40),[{left:0,top:0,right:40,bottom:40}]);
assert.deepEqual(cropReviewRegions([rect],90,90,40,40),[]);
assert.throws(()=>reviewRect({x:NaN,y:0},{x:10,y:10}));
assert.throws(()=>reviewRect({x:0,y:0},{x:5,y:10}));
// A complete mock room with tatami seams and an attached kitchen: the user
// excludes only the interior; structural boundary and openings survive.
const seams=[wall(50,20,50,80),wall(20,50,50,50),wall(50,65,80,65)];
result=excludePlanRegions([...exterior,...seams,...furniture,...openings],[rect]);
assert.deepEqual(result.lines,[...exterior,...openings]);assert.equal(result.removed.length,7);
console.log('PASS: reviewed furniture/tatami exclusion, boundary/crossing/diagonal preservation, openings, overlap, crop and input validation');

assert.deepEqual(cropReviewRegions([rect],78,30,40,40),[{left:0,top:0,right:2,bottom:40}]);
assert.equal(excludePlanRegions([wall(0,10,30,10)],cropReviewRegions([rect],78,30,40,40)).lines[0].x1,2);
assert.deepEqual(excludePlanRegions([wall(19.9,50,100,50)],[rect],{minLength:1}).lines,[wall(80,50,100,50)]);

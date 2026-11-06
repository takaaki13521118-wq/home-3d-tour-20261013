import assert from 'node:assert/strict';
import {detectWalls,makePlanDesign,validatePlanDesign,planSpawn,planAllowed,closestLine,addOpening,openParallelWalls} from '../plan-core.mjs';
import {validateDesign,createDesignHistory,interiorStartRoom,designShareURL} from '../house-core.mjs';
const width=240,height=180,data=new Uint8ClampedArray(width*height*4).fill(255);
function rect(x,y,w,h){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){const p=(j*width+i)*4;data[p]=data[p+1]=data[p+2]=0;}}
rect(20,20,200,4);rect(20,156,200,4);rect(20,20,4,140);rect(216,20,4,140);rect(118,20,4,80);rect(118,125,4,35);rect(50,60,8,8); // short text-like noise
const lines=detectWalls({width,height,data},{minLength:24,merge:5});assert(lines.length>=6&&lines.length<15);
assert(lines.some(l=>Math.abs(l.y1-21.5)<3&&Math.abs(l.y2-l.y1)<1&&l.x2-l.x1>190));
assert(!lines.some(l=>l.x1>=50&&l.x2<=58&&l.y1>=60&&l.y2<=68));
const d=makePlanDesign(lines,width,height,{width:12,height:2.6});assert.equal(d.depth,9);assert.deepEqual(validateDesign(JSON.parse(JSON.stringify(d))),d);assert.equal(interiorStartRoom(d),'planWalk');
const spawn=planSpawn(d);assert(spawn);assert(planAllowed(d,spawn.x,spawn.z));assert(!planAllowed(d,99,0));
const hit=closestLine([{x1:10,y1:20,x2:210,y2:20,kind:'wall'}],100,23,5);assert.equal(hit.index,0);assert.equal(closestLine(lines,-100,-100,3),null);
const split=addOpening({x1:10,y1:20,x2:210,y2:20,kind:'wall'},.95,30,'door');assert.equal(split.length,3);assert.equal(split[1].kind,'door');assert(Math.abs(split[1].x2-split[1].x1-30)<1e-8);
assert.throws(()=>addOpening({x1:0,y1:0,x2:10,y2:0,kind:'wall'},.5,30,'door'));
for(const change of [{thickness:NaN},{width:Infinity},{walls:[]},{height:99},{wall:'red'},{walls:[{x1:0,x2:1,z1:0,z2:1,kind:'wall'}]}])assert.throws(()=>validatePlanDesign({...d,...change}));
const h=createDesignHistory();h.push(d);h.push({...d,name:'second'});const restored=h.undo();restored.walls[0].x1=999;assert.equal(h.redo().name,'second');assert.notEqual(h.undo().walls[0].x1,999);
const shared=designShareURL('https://example.test/',d);assert.deepEqual(validateDesign(JSON.parse(decodeURIComponent(shared.split('#design=')[1]))),d);
const empty=new Uint8ClampedArray(width*height*4).fill(255);assert.equal(detectWalls({width,height,data:empty}).length,0);assert.throws(()=>detectWalls({width,height,data},{minLength:0}));
console.log('PASS: raster wall detection, noise rejection, dimensions, plan validation, safe spawn, openings, save/share and deep history');

const paired=[{x1:0,y1:20,x2:200,y2:20,kind:'wall'},{x1:0,y1:25,x2:200,y2:25,kind:'wall'},{x1:0,y1:50,x2:200,y2:50,kind:'wall'}];const opened=openParallelWalls(paired,{index:0,t:.5},30,'door',8);assert.equal(opened.filter(l=>l.kind==='door').length,2);assert.equal(opened.at(-1).y1,50);console.log('PASS: paired wall outlines receive matching openings');

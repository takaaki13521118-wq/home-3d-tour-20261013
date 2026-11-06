import assert from 'node:assert/strict';
import {bindJoystick,stickVector} from '../joystick.mjs';
assert.deepEqual(stickVector(.03,.04),{x:0,y:0});
assert.deepEqual(stickVector(1,0),{x:1,y:0});
assert(Math.abs(Math.hypot(...Object.values(stickVector(3,4)))-1)<1e-10);
function surface(){return {style:{},captured:new Set(),addEventListener(){},setPointerCapture(id){this.captured.add(id)},hasPointerCapture(id){return this.captured.has(id)},releasePointerCapture(id){this.captured.delete(id);this.onlostpointercapture({pointerId:id})},getBoundingClientRect(){return {left:0,top:0,width:100,height:100}}};}
const left=surface(),right=surface(),leftKnob=surface(),rightKnob=surface();let walk,look,enabled=true;
const a=bindJoystick(left,leftKnob,(x,y)=>walk={x,y},()=>enabled),b=bindJoystick(right,rightKnob,(x,y)=>look={x,y},()=>enabled);
const event=(pointerId,clientX,clientY,button=0)=>({pointerId,clientX,clientY,button,preventDefault(){}});
left.onpointerdown(event(10,50,0));right.onpointerdown(event(20,100,50));assert.equal(walk.y,-1);assert.equal(look.x,1);
right.onpointerdown(event(30,0,50));right.onpointermove(event(30,0,50));right.onpointerup(event(30));assert.equal(look.x,1);
left.onpointerup(event(10));assert.deepEqual(walk,{x:0,y:0});assert.equal(look.x,1);assert.equal(leftKnob.style.transform,'');
right.onpointercancel(event(20));assert.deepEqual(look,{x:0,y:0});assert.equal(right.captured.size,0);
right.onpointerdown(event(21,0,50));right.onlostpointercapture(event(21));assert.deepEqual(look,{x:0,y:0});
left.onpointerdown(event(11,50,0));right.onpointerdown(event(22,100,50));a.reset();b.reset();assert.deepEqual(walk,{x:0,y:0});assert.deepEqual(look,{x:0,y:0});
enabled=false;right.onpointerdown(event(23,100,50));assert.equal(right.captured.size,0);
enabled=true;right.onpointerdown(event(24,100,50,2));assert.equal(right.captured.size,0);
console.log('PASS: stick dead zone, diagonal limit, two-finger independence, cancellation, release and mode reset');

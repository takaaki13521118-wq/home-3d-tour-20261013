import assert from 'node:assert/strict';
import {bindJoystick,stickVector,walkingVector} from '../joystick.mjs';
assert.deepEqual(stickVector(.02,.02),{x:0,y:0});
assert.deepEqual(stickVector(1,0),{x:1,y:0});
assert(stickVector(.25,0).x<.25); // fine aiming near the centre
assert(stickVector(.25,0).x>.18); // short thumb movement still responds
assert(Math.abs(Math.hypot(...Object.values(stickVector(3,4)))-1)<1e-10);
assert.equal(walkingVector(0,0,0,-1).forward,1.55); // full tilt travels 55% farther per second
assert(walkingVector(0,0,0,-.3).forward<.32); // small tilt remains precise
assert(Math.abs(Math.hypot(...Object.values(walkingVector(0,0,1,-1)))-1.55)<1e-10); // diagonal does not accelerate further
assert(Math.abs(Math.hypot(...Object.values(walkingVector(1,1,0,0)))-1)<1e-10); // keyboard pace is unchanged
function surface(){const classes=new Set();return {style:{},captured:new Set(),classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},addEventListener(){},setPointerCapture(id){this.captured.add(id)},hasPointerCapture(id){return this.captured.has(id)},releasePointerCapture(id){this.captured.delete(id);this.onlostpointercapture({pointerId:id})},getBoundingClientRect(){return {left:0,top:0,width:100,height:100}}};}
const event=(pointerId,clientX,clientY,button=0)=>({pointerId,clientX,clientY,button,preventDefault(){}});
const left=surface(),right=surface(),leftKnob=surface(),rightKnob=surface();let walk,look,enabled=true;
const a=bindJoystick(left,leftKnob,(x,y)=>walk={x,y},()=>enabled),b=bindJoystick(right,rightKnob,(x,y)=>look={x,y},()=>enabled);
left.onpointerdown(event(10,20,70));right.onpointerdown(event(20,75,30));a.update(1/60);b.update(1/60);
assert(left.classList.contains('engaged')&&right.classList.contains('engaged'));
assert.deepEqual(walk,{x:0,y:0});assert.deepEqual(look,{x:0,y:0}); // no jump from off-centre touches
left.onpointermove(event(10,20,34));right.onpointermove(event(20,111,30));a.update(1/60);b.update(1/60);
assert(walk.y<0&&walk.y>-.5);assert(look.x>0&&look.x<.5); // gradual start
for(let i=0;i<30;i++){a.update(1/60);b.update(1/60);}assert.equal(walk.y,-1);assert.equal(look.x,1);
right.onpointerdown(event(30,0,50));right.onpointermove(event(30,0,50));right.onpointerup(event(30));b.update(1/60);assert.equal(look.x,1);
left.onpointerup(event(10));a.update(1/60);assert(walk.y> -1&&walk.y<0);assert.equal(look.x,1);
assert(!left.classList.contains('engaged'));
for(let i=0;i<15;i++)a.update(1/60);assert.deepEqual(walk,{x:0,y:0});assert.equal(leftKnob.style.transform,'');
right.onpointercancel(event(20));assert.deepEqual(look,{x:0,y:0});assert.equal(right.captured.size,0);
right.onpointerdown(event(21,50,50));right.onpointermove(event(21,90,50));b.update(.05);right.onlostpointercapture(event(21));assert.deepEqual(look,{x:0,y:0});
left.onpointerdown(event(11,50,50));right.onpointerdown(event(22,50,50));a.reset();b.reset();assert.deepEqual(walk,{x:0,y:0});assert.deepEqual(look,{x:0,y:0});
enabled=false;right.onpointerdown(event(23,100,50));assert.equal(right.captured.size,0);
enabled=true;right.onpointerdown(event(24,100,50,2));assert.equal(right.captured.size,0);
const shortReach=surface();let shortValue=0;const shortControl=bindJoystick(shortReach,surface(),(x,y)=>shortValue=y,()=>true,{reach:.30});shortReach.onpointerdown(event(31,50,70));shortReach.onpointermove(event(31,50,40));shortControl.update(.5);assert.equal(shortValue,-1);shortControl.reset();
// Same filter response at 30, 60 and 120 Hz; reversals pass continuously through zero.
const samples=[];
for(const fps of [30,60,120]){
 const el=surface();let x=0;const c=bindJoystick(el,surface(),v=>x=v,()=>true);
 el.onpointerdown(event(1,50,50));el.onpointermove(event(1,86,50));
 let previous=0;for(let i=0;i<fps/10;i++){c.update(1/fps);assert(x>=previous);previous=x;}samples.push(x);
 el.onpointermove(event(1,14,50));c.update(1/fps);assert(x>-1&&x<previous);
 c.reset();assert.equal(x,0);
}
assert(Math.max(...samples)-Math.min(...samples)<1e-10);
console.log('PASS: smooth start/stop/reversal, 30/60/120 Hz consistency, no touch-down jump, dual-stick independence, cancellation and reset');
// Look-stick direction is tied to its visible centre, independent of touch-down position.
for(const fps of [30,60,120]){
 const responses=[];
 for(const direction of [-1,1]){
  const el=surface();let value;const c=bindJoystick(el,surface(),(x,y)=>value={x,y},()=>true,{centered:true,horizontalOnly:()=>true});
  el.onpointerdown(event(1,50+direction*28,3));
  for(let i=0;i<fps/5;i++)c.update(1/fps);
  assert.equal(value.y,0);assert.equal(Math.sign(value.x),direction);responses.push(value.x);
  el.onpointermove(event(1,50-direction*28,97));for(let i=0;i<fps/2;i++)c.update(1/fps);
  assert.equal(Math.sign(value.x),-direction);assert.equal(value.y,0);
 }
 assert(Math.abs(responses[0]+responses[1])<1e-10);
}
console.log('PASS: centred look-stick left/right symmetry, vertical-jitter suppression and cross-centre reversal');

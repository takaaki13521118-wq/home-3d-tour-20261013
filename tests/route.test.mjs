import assert from 'node:assert/strict';
import {findWalkRoute} from '../route-core.mjs';

const bounds={minX:0,maxX:10,minZ:0,maxZ:8,step:.2};
const start={x:2,z:4},end={x:8,z:4};
const open=findWalkRoute(start,end,{...bounds,walkable:()=>true});
assert.deepEqual(open[0],start);
assert.deepEqual(open.at(-1),end);

// A dividing wall has a one-metre doorway near the top of the plan.
const walkable=(x,z)=>!(x>4.85&&x<5.15&&z<6.5);
const viaDoor=findWalkRoute(start,end,{...bounds,walkable});
assert.ok(viaDoor?.length>2,'the doorway should provide a route');
assert.ok(viaDoor.some(p=>p.z>6.4),'the route must go through the opening');
for(let i=1;i<viaDoor.length;i++){
 const a=viaDoor[i-1],b=viaDoor[i];
 for(let t=0;t<=1;t+=.005)assert.ok(walkable(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t),'route crossed the wall');
}
assert.equal(findWalkRoute(start,end,{...bounds,walkable:(x,z)=>!(x>4.85&&x<5.15)}),null,'a sealed wall has no route');
assert.equal(findWalkRoute({x:5,z:4},end,{...bounds,walkable}),null,'a start point inside a wall is invalid');
console.log('PASS: clear routes, doorway routing, sealed walls and blocked endpoints');

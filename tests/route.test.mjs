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
// A near-tangent shortcut must not shave through an obstacle between samples.
const obstacles=[{x:2.6183132387782972,z:7.990604146844989,r:.3727435014828776},{x:8.040470763594131,z:2.1921237265654483,r:.4314670240932456},{x:7.500382962869659,z:4.9364569503518085,r:.1819977851780121},{x:2.2284077895937524,z:6.849719702196177,r:.44493967569663173},{x:6.458070932635139,z:6.798164798784146,r:.2897358228218443}];
const clearOfCircles=(x,z)=>!obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.r);
const precise=findWalkRoute({x:.3,z:.3},{x:9.7,z:9.7},{minX:0,maxX:10,minZ:0,maxZ:10,step:.2,walkable:clearOfCircles});
assert(precise,'nearby furniture should still allow a route');
for(let i=1;i<precise.length;i++)for(const o of obstacles){const a=precise[i-1],b=precise[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((o.x-a.x)*dx+(o.z-a.z)*dz)/(dx*dx+dz*dz)));assert(Math.hypot(a.x+dx*t-o.x,a.z+dz*t-o.z)>=o.r-1e-6,'route must not clip the obstacle');}
console.log('PASS: clear routes, doorway routing, sealed walls and blocked endpoints');

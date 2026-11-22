// Derived navigation spaces. Openings are temporarily closed only for room
// separation; walking continues to use the actual door-aware colliders.
const cache=new WeakMap();
const distance=(w,x,z)=>{const dx=w.x2-w.x1,dz=w.z2-w.z1,t=Math.max(0,Math.min(1,((x-w.x1)*dx+(z-w.z1)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-w.x1-t*dx,z-w.z1-t*dz);};
export function planSpaces(d){
 if(cache.has(d))return cache.get(d);
 const xs=d.walls.flatMap(w=>[w.x1,w.x2]),zs=d.walls.flatMap(w=>[w.z1,w.z2]);
 const bounds={minX:Math.min(...xs)-d.thickness/2,maxX:Math.max(...xs)+d.thickness/2,minZ:Math.min(...zs)-d.thickness/2,maxZ:Math.max(...zs)+d.thickness/2};
 const step=Math.max(.08,Math.max(bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ)/150),ox=bounds.minX-step*2,oz=bounds.minZ-step*2;
 const nx=Math.ceil((bounds.maxX-ox)/step)+2,nz=Math.ceil((bounds.maxZ-oz)/step)+2,blocked=new Uint8Array(nx*nz),seen=new Uint8Array(nx*nz);
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const x=ox+(i+.5)*step,z=oz+(j+.5)*step;blocked[j*nx+i]=d.walls.some(w=>distance(w,x,z)<d.thickness/2+step*.55)?1:0;}
 const rooms=[];
 for(let start=0;start<blocked.length;start++){
  if(blocked[start]||seen[start])continue;const cells=[start];seen[start]=1;let outside=false;
  for(let q=0;q<cells.length;q++){const n=cells[q],i=n%nx,j=Math.floor(n/nx);if(!i||!j||i===nx-1||j===nz-1)outside=true;
   for(const m of [i?n-1:-1,i<nx-1?n+1:-1,j?n-nx:-1,j<nz-1?n+nx:-1])if(m>=0&&!blocked[m]&&!seen[m]){seen[m]=1;cells.push(m);}}
  if(outside||cells.length*step*step<.6)continue;
  let best=null,score=-1;for(const n of cells){const x=ox+(n%nx+.5)*step,z=oz+(Math.floor(n/nx)+.5)*step;let c=Infinity;for(const w of d.walls)c=Math.min(c,distance(w,x,z)-d.thickness/2);if(c>score){score=c;best={x,z};}}
  if(score<.16)continue;
  rooms.push({point:best,area:cells.length*step*step,cells,clearance:score});
 }
 rooms.sort((a,b)=>b.area-a.area);
 const result={bounds,rooms,step,nx,nz,ox,oz};cache.set(d,result);return result;
}
export function spaceAt(space,x,z){const i=Math.floor((x-space.ox)/space.step),j=Math.floor((z-space.oz)/space.step);if(i<0||j<0||i>=space.nx||j>=space.nz)return -1;return space.rooms.findIndex(r=>r.cells.includes(j*space.nx+i));}

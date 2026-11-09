// Find a floor-level route using the same walkability rule as the indoor camera.
export function findWalkRoute(start,end,{minX,maxX,minZ,maxZ,walkable,step=.25}={}){
 if(typeof walkable!=='function'||![start?.x,start?.z,end?.x,end?.z,minX,maxX,minZ,maxZ,step].every(Number.isFinite)||maxX<=minX||maxZ<=minZ||step<=0)throw Error('動線の条件が不正です。');
 if(!walkable(start.x,start.z)||!walkable(end.x,end.z))return null;
 const cols=Math.floor((maxX-minX)/step)+1,rows=Math.floor((maxZ-minZ)/step)+1,size=cols*rows;
 if(size>40000)throw Error('動線の探索範囲が広すぎます。');
 const point=id=>({x:minX+(id%cols)*step,z:minZ+Math.floor(id/cols)*step});
 const cache=new Int8Array(size).fill(-1),allowed=id=>{if(cache[id]<0){const p=point(id);cache[id]=walkable(p.x,p.z)?1:0;}return cache[id]===1;};
 const clear=(a,b)=>{const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/(step*.1)));for(let i=0;i<=count;i++){const t=i/count;if(!walkable(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false;}return true;};
 const snap=p=>{const cx=Math.round((p.x-minX)/step),cz=Math.round((p.z-minZ)/step);let best=-1,score=Infinity;for(let radius=0;radius<=8;radius++){for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){if(Math.max(Math.abs(dx),Math.abs(dz))!==radius)continue;const x=cx+dx,z=cz+dz;if(x<0||z<0||x>=cols||z>=rows)continue;const id=z*cols+x;if(!allowed(id))continue;const q=point(id),distance=Math.hypot(q.x-p.x,q.z-p.z);if(distance<score&&clear(p,q)){best=id;score=distance;}}if(best>=0)break;}return best;};
 const startId=snap(start),endId=snap(end);if(startId<0||endId<0)return null;
 const scores=new Float64Array(size).fill(Infinity),previous=new Int32Array(size).fill(-1),closed=new Uint8Array(size),heap=[];
 const push=(id,f)=>{let i=heap.length;heap.push({id,f});while(i>0){const parent=(i-1)>>1;if(heap[parent].f<=f)break;heap[i]=heap[parent];i=parent;}heap[i]={id,f};};
 const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].f<heap[child].f)child++;if(heap[child].f>=last.f)break;heap[i]=heap[child];i=child;}heap[i]=last;}return first.id;};
 const goal=point(endId),heuristic=id=>{const p=point(id);return Math.hypot(p.x-goal.x,p.z-goal.z);};
 scores[startId]=0;push(startId,heuristic(startId));
 const directions=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
 while(heap.length){const id=pop();if(closed[id])continue;if(id===endId)break;closed[id]=1;const x=id%cols,z=Math.floor(id/cols),from=point(id);
  for(const [dx,dz] of directions){const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=cols||nz>=rows)continue;const next=nz*cols+nx;if(closed[next]||!allowed(next))continue;if(dx&&dz&&(!allowed(z*cols+nx)||!allowed(nz*cols+x)))continue;const to=point(next);if(!clear(from,to))continue;const cost=scores[id]+Math.hypot(dx,dz)*step;if(cost>=scores[next])continue;scores[next]=cost;previous[next]=id;push(next,cost+heuristic(next));}
 }
 if(!Number.isFinite(scores[endId]))return null;
 const raw=[];for(let id=endId;id>=0;id=previous[id]){raw.push(point(id));if(id===startId)break;}raw.reverse();
 const path=[{x:start.x,z:start.z},raw[0]];let index=0;
 while(index<raw.length-1){let next=Math.min(raw.length-1,index+25);while(next>index+1&&!clear(path.at(-1),raw[next]))next--;path.push(raw[next]);index=next;}
 if(!clear(path.at(-1),end))return null;
 path.push({x:end.x,z:end.z});
 return path;
}

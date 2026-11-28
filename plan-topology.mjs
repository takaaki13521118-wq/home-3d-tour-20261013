// Room topology in source-image coordinates. Suggestions never silently alter walls.
export const polygonArea=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.y-b.x*a.y;},0)/2;
export function inPolygon(p,x,y){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
export const polygonBounds=p=>({left:Math.min(...p.map(a=>a.x)),right:Math.max(...p.map(a=>a.x)),top:Math.min(...p.map(a=>a.y)),bottom:Math.max(...p.map(a=>a.y))});
export function checkPolygon(p){
 if(!Array.isArray(p)||p.length<3||p.length>160||p.some(a=>!Number.isFinite(a.x)||!Number.isFinite(a.y)))throw Error('部屋の輪郭は3〜160点で指定してください。');
 const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 const between=(a,b,c)=>Math.abs(cross(a,b,c))<1e-9&&c.x>=Math.min(a.x,b.x)-1e-9&&c.x<=Math.max(a.x,b.x)+1e-9&&c.y>=Math.min(a.y,b.y)-1e-9&&c.y<=Math.max(a.y,b.y)+1e-9;
 for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if(Math.hypot(a.x-b.x,a.y-b.y)<1e-7)throw Error('輪郭の同じ点を重ねないでください。');for(let j=i+1;j<p.length;j++){if(j===i+1||i===0&&j===p.length-1)continue;const c=p[j],d=p[(j+1)%p.length];if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||between(a,b,c)||between(a,b,d)||between(c,d,a)||between(c,d,b))throw Error('部屋の輪郭が交差しています。順に角を選び直してください。');}}
 if(Math.abs(polygonArea(p))<1e-8)throw Error('部屋の面積がありません。');return p;
}
export function interiorPoint(p){const r=polygonBounds(p);let best=null,clearance=-1;for(let j=0;j<25;j++)for(let i=0;i<25;i++){const x=r.left+(i+.5)/25*(r.right-r.left),y=r.top+(j+.5)/25*(r.bottom-r.top);if(!inPolygon(p,x,y))continue;let d=Infinity;for(let k=0;k<p.length;k++){const a=p[k],b=p[(k+1)%p.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)));d=Math.min(d,Math.hypot(x-a.x-t*dx,y-a.y-t*dy));}if(d>clearance){best={x,y};clearance=d;}}return best;}

// Exact axis-aligned cell arrangement, rather than rays from a label to furniture.
// Doors/windows close a region only for identifying rooms, not for navigation.
export function traceRooms(lines,width,height){
 const orth=lines.filter(l=>Math.abs(l.x1-l.x2)<.5||Math.abs(l.y1-l.y2)<.5);
 const unique=a=>[...new Set(a.map(v=>Math.round(v*100)/100))].sort((a,b)=>a-b);
 const xs=unique([-2,0,width,width+2,...orth.flatMap(l=>[l.x1,l.x2])]),ys=unique([-2,0,height,height+2,...orth.flatMap(l=>[l.y1,l.y2])]);
 if(xs.length>350||ys.length>350)return [];
 const nx=xs.length-1,ny=ys.length-1,h=new Set(),v=new Set();
 for(const l of orth){if(Math.abs(l.y2-l.y1)<.5){const j=ys.indexOf(Math.round(l.y1*100)/100);for(let i=0;i<nx;i++)if((xs[i]+xs[i+1])/2>Math.min(l.x1,l.x2)&&(xs[i]+xs[i+1])/2<Math.max(l.x1,l.x2))h.add(j*nx+i);}else{const i=xs.indexOf(Math.round(l.x1*100)/100);for(let j=0;j<ny;j++)if((ys[j]+ys[j+1])/2>Math.min(l.y1,l.y2)&&(ys[j]+ys[j+1])/2<Math.max(l.y1,l.y2))v.add(j*(nx+1)+i);}}
 const seen=new Uint8Array(nx*ny),rooms=[];
 for(let start=0;start<seen.length;start++){if(seen[start])continue;const cells=[start];seen[start]=1;let outside=false,area=0;
  for(let q=0;q<cells.length;q++){const n=cells[q],i=n%nx,j=Math.floor(n/nx);area+=(xs[i+1]-xs[i])*(ys[j+1]-ys[j]);if(!i||!j||i===nx-1||j===ny-1)outside=true;
   const near=[[i>0&&!v.has(j*(nx+1)+i),n-1],[i<nx-1&&!v.has(j*(nx+1)+i+1),n+1],[j>0&&!h.has(j*nx+i),n-nx],[j<ny-1&&!h.has((j+1)*nx+i),n+nx]];
   for(const [ok,m]of near)if(ok&&!seen[m]){seen[m]=1;cells.push(m);}}
  if(outside||area<width*height*.0003)continue;
  const members=new Set(cells),edges=new Map(),key=(x,y)=>x+','+y,add=(a,b)=>{const k=key(...a);if(!edges.has(k))edges.set(k,[]);edges.get(k).push(b);};
  for(const n of cells){const i=n%nx,j=Math.floor(n/nx);if(!members.has(n-nx))add([i,j],[i+1,j]);if(i===nx-1||!members.has(n+1))add([i+1,j],[i+1,j+1]);if(!members.has(n+nx))add([i+1,j+1],[i,j+1]);if(i===0||!members.has(n-1))add([i,j+1],[i,j]);}
  const loops=[];while(edges.size){const first=edges.keys().next().value;let k=first,loop=[],guard=0;do{const [i,j]=k.split(',').map(Number);loop.push({x:xs[i],y:ys[j]});const list=edges.get(k);if(!list?.length)break;const b=list.pop();if(!list.length)edges.delete(k);k=key(...b);}while(k!==first&&++guard<20000);
   loop=loop.filter((b,i,p)=>{const a=p[(i+p.length-1)%p.length],c=p[(i+1)%p.length];return Math.abs((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x))>.001;});if(loop.length>=3)loops.push(loop);}
  loops.sort((a,b)=>Math.abs(polygonArea(b))-Math.abs(polygonArea(a)));if(!loops[0]||loops[0].length>160)continue;
  rooms.push({polygon:loops[0],holes:loops.slice(1),area});
 }return rooms;
}

// Rebuild only explicitly reviewed complete room outlines. Unreviewed linework is
// replaced only after the user has seen and accepted the full 2D preview.
export function wallsFromRooms(candidates,openings=[]){
 const polygons=candidates.filter(c=>c.state==='accepted'&&c.polygon).map(c=>checkPolygon(c.polygon));
 if(!polygons.length)throw Error('輪郭を確認・採用した部屋がありません。');
 const segments=polygons.flatMap(p=>p.map((a,i)=>({x1:a.x,y1:a.y,x2:p[(i+1)%p.length].x,y2:p[(i+1)%p.length].y,kind:'wall'})));
 const out=[],keys=new Set();
 for(const l of segments){const dx=l.x2-l.x1,dy=l.y2-l.y1,len=Math.hypot(dx,dy),point=t=>({x:l.x1+t*dx,y:l.y1+t*dy});
  const projection=a=>((a.x-l.x1)*dx+(a.y-l.y1)*dy)/(len*len),on=a=>Math.abs((a.x-l.x1)*dy-(a.y-l.y1)*dx)/len<.1;
  const cuts=[0,1],spans=[];
  for(const s of [...segments,...openings]){const a={x:s.x1,y:s.y1},b={x:s.x2,y:s.y2};if(!on(a)||!on(b))continue;const lo=Math.max(0,Math.min(projection(a),projection(b))),hi=Math.min(1,Math.max(projection(a),projection(b)));if(hi<=lo)continue;cuts.push(lo,hi);if(s.kind!=='wall')spans.push({lo,hi,kind:s.kind});}
  const ts=[...new Set(cuts)].sort((a,b)=>a-b);for(let i=0;i<ts.length-1;i++){const a=point(ts[i]),b=point(ts[i+1]);if(Math.hypot(a.x-b.x,a.y-b.y)<.1)continue;const mid=(ts[i]+ts[i+1])/2,kind=spans.find(s=>s.lo<=mid&&s.hi>=mid)?.kind??'wall';const key=[a,b].map(p=>p.x.toFixed(3)+','+p.y.toFixed(3)).sort().join('|');if(keys.has(key))continue;keys.add(key);out.push({x1:a.x,y1:a.y,x2:b.x,y2:b.y,kind});}
 }
 for(const o of openings)if(o.kind!=='wall'&&!out.some(l=>l.kind===o.kind&&Math.hypot((l.x1+l.x2-o.x1-o.x2)/2,(l.y1+l.y2-o.y1-o.y2)/2)<1))throw Error('指定済みの出入口・窓が部屋の輪郭から外れています。輪郭または開口位置を修正してください。');
 if(out.length>400)throw Error('輪郭が細かすぎます。部屋の角を減らしてください。');return out;
}

export function openingSymbolEvidence(image,o){
 if(!image?.data)return '壁の切れ目';
 const {width,height,data}=image,dx=o.x2-o.x1,dy=o.y2-o.y1,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len;
 const ink=(x,y)=>{for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){const px=Math.round(x)+i,py=Math.round(y)+j;if(px<0||py<0||px>=width||py>=height)continue;const n=(py*width+px)*4;if(data[n+3]>128&&(data[n]+data[n+1]+data[n+2])/3<130)return true;}return false;};
 let best=0;for(const reverse of [false,true])for(const side of [-1,1]){const x=reverse?o.x2:o.x1,y=reverse?o.y2:o.y1,sign=reverse?-1:1;let hits=0;for(let k=1;k<=18;k++){const a=k/19*Math.PI/2;hits+=ink(x+sign*ux*len*Math.cos(a)-side*uy*len*Math.sin(a),y+sign*uy*len*Math.cos(a)+side*ux*len*Math.sin(a))?1:0;}best=Math.max(best,hits/18);}
 return best>=.83?'開閉円弧らしい線と壁の切れ目（要確認）':'壁の切れ目';
}
export function openingCandidates(lines,metresPerPixel,scaleY=metresPerPixel,image=null){
 if(!Number.isFinite(metresPerPixel)||metresPerPixel<=0)return [];
 const result=[];for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
  const a=lines[i],b=lines[j];if(a.kind!=='wall'||b.kind!=='wall')continue;
  const horiz=Math.abs(a.y1-a.y2)<.5&&Math.abs(b.y1-b.y2)<.5&&Math.abs(a.y1-b.y1)<2,vert=Math.abs(a.x1-a.x2)<.5&&Math.abs(b.x1-b.x2)<.5&&Math.abs(a.x1-b.x1)<2;if(!horiz&&!vert)continue;
  const aa=[horiz?a.x1:a.y1,horiz?a.x2:a.y2].sort((a,b)=>a-b),bb=[horiz?b.x1:b.y1,horiz?b.x2:b.y2].sort((a,b)=>a-b);let lo,hi;if(aa[1]<bb[0]){lo=aa[1];hi=bb[0];}else if(bb[1]<aa[0]){lo=bb[1];hi=aa[0];}else continue;
  const width=(hi-lo)*(horiz?metresPerPixel:scaleY);if(width<.55||width>1.8)continue;
  const at=horiz?(a.y1+b.y1)/2:(a.x1+b.x1)/2,l=horiz?{x1:lo,y1:at,x2:hi,y2:at}:{x1:at,y1:lo,x2:at,y2:hi};
  const mx=(l.x1+l.x2)/2,my=(l.y1+l.y2)/2;
  if(lines.some(s=>{const dx=s.x2-s.x1,dy=s.y2-s.y1,t=((mx-s.x1)*dx+(my-s.y1)*dy)/(dx*dx+dy*dy);return t>0&&t<1&&Math.hypot(mx-s.x1-t*dx,my-s.y1-t*dy)<2;}))continue;
  if(result.some(s=>Math.hypot(s.x1-l.x1,s.y1-l.y1)+Math.hypot(s.x2-l.x2,s.y2-l.y2)<6))continue;
  const nearbyParallel=lines.filter(s=>{const dx=s.x2-s.x1,dy=s.y2-s.y1;if(horiz?Math.abs(dy)>.5:Math.abs(dx)>.5)return false;const distance=Math.abs((horiz?s.y1:s.x1)-at),lo2=Math.min(horiz?s.x1:s.y1,horiz?s.x2:s.y2),hi2=Math.max(horiz?s.x1:s.y1,horiz?s.x2:s.y2);return distance>2&&distance<.2/metresPerPixel&&Math.min(hi,hi2)-Math.max(lo,lo2)>(hi-lo)*.65;}).length;
  const evidence=openingSymbolEvidence(image,l)+(nearbyParallel>=2?'／引き戸・窓に似た平行線（種類は要確認）':'');
  result.push({...l,kind:'door',width,evidence,state:'pending'});
 }return result.slice(0,60);
}

export function roomConnections(candidates,lines,metresPerPixel,scaleY=metresPerPixel){
 const rooms=candidates.filter(c=>c.state!=='rejected'&&c.polygon),links=[],issues=[];
 const groups=[];for(const c of rooms){let g=groups.find(g=>inPolygon(g[0].polygon,c.x,c.y)&&inPolygon(c.polygon,g[0].x,g[0].y));if(!g){g=[];groups.push(g);}g.push(c);}
 const names=i=>groups[i].map(c=>c.name).join('・');
 for(const l of lines.filter(l=>l.kind==='door')){const dx=l.x2-l.x1,dy=l.y2-l.y1,len=Math.hypot(dx,dy),x=(l.x1+l.x2)/2,y=(l.y1+l.y2)/2,pad=Math.max(2,.2/metresPerPixel);const side=sign=>groups.findIndex(g=>g.some(c=>inPolygon(c.polygon,x-sign*dy/len*pad,y+sign*dx/len*pad)));const a=side(1),b=side(-1);
  if(a!==b&&(a>=0||b>=0)){links.push({a,b,text:`${a<0?'屋外／未確認の空間':names(a)} ↔ ${b<0?'屋外／未確認の空間':names(b)}`,width:Math.hypot(dx*metresPerPixel,dy*scaleY)});if(Math.hypot(dx*metresPerPixel,dy*scaleY)<.45)issues.push('通り道が狭すぎる候補があります。実寸と幅を確認してください。');}else issues.push('どの部屋につながるか確認できない出入口があります。');}
 for(let i=0;i<groups.length;i++)if(!links.some(l=>l.a===i||l.b===i))issues.push(names(i)+'：出入口が未確認です。');
 const seen=new Set();let components=0;for(let i=0;i<groups.length;i++){if(seen.has(i))continue;components++;const queue=[i];seen.add(i);for(let k=0;k<queue.length;k++)for(const l of links){const n=l.a===queue[k]?l.b:l.b===queue[k]?l.a:-1;if(n>=0&&!seen.has(n)){seen.add(n);queue.push(n);}}}
 if(components>1)issues.push(`室内の通り道が ${components} グループに分かれています。部屋同士の出入口を確認してください。`);
 return {links,issues:[...new Set(issues)],groups:groups.length};
}

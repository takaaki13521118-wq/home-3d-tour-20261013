// Local, deterministic line detection. This is not semantic room/door recognition.
export function detectWalls(image,{threshold=155,minLength=28,merge=5,minStroke=2}={}){
 const {width:w,height:h,data}=image;
 if(!Number.isFinite(minLength)||minLength<10||minLength>200||!Number.isFinite(threshold)||threshold<20||threshold>240)throw Error('読み取り設定を確認してください。');
 if(w<8||h<8||w*h>2000000||data.length!==w*h*4)throw Error('解析する画像サイズが不正です。');
 const ink=new Uint8Array(w*h);
 for(let i=0;i<ink.length;i++){const p=i*4,a=data[p+3]/255;ink[i]=(255*(1-a)+a*(data[p]*.299+data[p+1]*.587+data[p+2]*.114))<threshold?1:0;}
 const result=[];
 for(const axis of ['h','v']){
  const rows=axis==='h'?h:w,cols=axis==='h'?w:h,groups=[];
  for(let row=0;row<rows;row++){
   let start=-1,last=-1;
   const flush=()=>{if(start<0||last-start+1<minLength)return;const end=last;
    let best=null;
    for(let i=groups.length-1;i>=0;i--){const g=groups[i];if(row-g.lastRow>merge)continue;
     const overlap=Math.min(end,g.end)-Math.max(start,g.start);if(overlap>=.7*Math.min(end-start,g.end-g.start)&&(!best||overlap>best.overlap))best={g,overlap};}
    if(best){const g=best.g;g.sum+=row;g.count++;g.coord=g.sum/g.count;g.lastRow=row;g.start=Math.min(g.start,start);g.end=Math.max(g.end,end);}
    else {if(groups.length>3000)throw Error('細かい線が多すぎます。建物を切り抜いてください。');groups.push({axis,coord:row,sum:row,count:1,lastRow:row,start,end});}
   };
   for(let col=0;col<cols;col++){const on=ink[axis==='h'?row*w+col:col*w+row];if(on){if(start<0)start=col;last=col;}else if(start>=0&&col-last>2){flush();start=-1;}}flush();
  }
  result.push(...groups.filter(g=>g.count>=minStroke).map(g=>axis==='h'?{x1:g.start,y1:g.coord,x2:g.end,y2:g.coord,kind:'wall'}:{x1:g.coord,y1:g.start,x2:g.coord,y2:g.end,kind:'wall'}));
 }
 if(result.length>400)throw Error('線が多すぎます。建物だけを切り抜くか、最短の壁を長く設定してください。');
 return result;
}
export function validatePlanDesign(v){
 const n=(a,min,max)=>{if(typeof a!=='number'||!Number.isFinite(a)||a<min||a>max)throw Error('図面モデルの寸法が範囲外です。');return a;};
 if(!v||v.version!==2||!Array.isArray(v.walls)||!v.walls.length||v.walls.length>400)throw Error('図面モデルには1〜400本の壁が必要です。');
 const width=n(v.width,1,60),depth=n(v.depth,1,60),height=n(v.height,2,5);
 const walls=v.walls.map(w=>{const x1=n(w.x1,-width/2,width/2),x2=n(w.x2,-width/2,width/2),z1=n(w.z1,-depth/2,depth/2),z2=n(w.z2,-depth/2,depth/2);
  if(Math.hypot(x2-x1,z2-z1)<.03||!['wall','door','window'].includes(w.kind))throw Error('壁の線または開口部が不正です。');
  return {x1,z1,x2,z2,kind:w.kind};});
 if(!/^#[0-9a-f]{6}$/i.test(v.wall)||!['none','flat'].includes(v.roof))throw Error('外観の指定が不正です。');
 return {version:2,name:typeof v.name==='string'?v.name.slice(0,40):'図面から作成',width,depth,height,thickness:n(v.thickness,.06,.4),wall:v.wall,roof:v.roof,walls};
}
export function makePlanDesign(lines,pixelWidth,pixelHeight,{width=10,height=2.6,thickness=.12,name='図面から作成',roof='none',wall='#e9e4d8'}={}){
 const s=width/pixelWidth,round=v=>Math.round(v*10000)/10000;
 const depth=round(pixelHeight*s);
 return validatePlanDesign({version:2,name,width,depth,height,thickness,wall,roof,walls:lines.map(l=>({x1:round((l.x1-pixelWidth/2)*s),x2:round((l.x2-pixelWidth/2)*s),z1:round((l.y1/pixelHeight-.5)*depth),z2:round((l.y2/pixelHeight-.5)*depth),kind:l.kind||'wall'}))});
}
export function planSolids(d){return d.walls.filter(w=>w.kind!=='door').map(w=>({x:(w.x1+w.x2)/2,z:(w.z1+w.z2)/2,w:Math.hypot(w.x2-w.x1,w.z2-w.z1),d:d.thickness,angle:Math.atan2(w.z2-w.z1,w.x2-w.x1)}));}
export function solidDistance(s,x,z){const c=Math.cos(s.angle||0),t=Math.sin(s.angle||0),dx=x-s.x,dz=z-s.z;return Math.hypot(Math.max(0,Math.abs(c*dx+t*dz)-s.w/2),Math.max(0,Math.abs(-t*dx+c*dz)-s.d/2));}
export function planAllowed(d,x,z,solids=planSolids(d)){
 return Math.abs(x)<d.width/2-.12&&Math.abs(z)<d.depth/2-.12&&!solids.some(s=>solidDistance(s,x,z)<.1);
}
export function planSpawn(d){const solids=planSolids(d);let best=null,score=-1;for(let iz=1;iz<32;iz++)for(let ix=1;ix<32;ix++){const x=(ix/32-.5)*d.width,z=(iz/32-.5)*d.depth;if(!planAllowed(d,x,z,solids))continue;let clearance=Math.min(d.width/2-Math.abs(x),d.depth/2-Math.abs(z));for(const s of solids)clearance=Math.min(clearance,solidDistance(s,x,z));if(clearance>score){best={x,z};score=clearance;}}return best;}
export function closestLine(lines,x,y,maxDistance){let best=null;for(let i=0;i<lines.length;i++){const l=lines[i],dx=l.x2-l.x1,dy=l.y2-l.y1,len=dx*dx+dy*dy;if(!len)continue;const t=Math.max(0,Math.min(1,((x-l.x1)*dx+(y-l.y1)*dy)/len)),distance=Math.hypot(x-l.x1-t*dx,y-l.y1-t*dy);if(distance<=maxDistance&&(!best||distance<best.distance))best={index:i,t,distance};}return best;}
export function addOpening(line,t,span,kind){const len=Math.hypot(line.x2-line.x1,line.y2-line.y1);const margin=Math.max(3,span*.12);if(len<span+2*margin)throw Error('この壁には開口部を追加する長さがありません。');const centre=Math.max(span/2+margin,Math.min(len-span/2-margin,t*len));const a=(centre-span/2)/len,b=(centre+span/2)/len;const part=(u,v,k)=>({x1:line.x1+(line.x2-line.x1)*u,y1:line.y1+(line.y2-line.y1)*u,x2:line.x1+(line.x2-line.x1)*v,y2:line.y1+(line.y2-line.y1)*v,kind:k});return [part(0,a,line.kind),part(a,b,kind),part(b,1,line.kind)];}
// Open both outlines when a CAD wall is drawn as two nearby parallel lines.
export function openParallelWalls(lines,hit,span,kind,tolerance){
 const chosen=lines[hit.index],horizontal=Math.abs(chosen.x2-chosen.x1)>Math.abs(chosen.y2-chosen.y1),x=chosen.x1+(chosen.x2-chosen.x1)*hit.t,y=chosen.y1+(chosen.y2-chosen.y1)*hit.t;
 const primary=addOpening(chosen,hit.t,span,kind);
 return lines.flatMap((l,i)=>{if(i===hit.index)return primary;if(l.kind!=='wall')return [l];const ax=chosen.x2-chosen.x1,ay=chosen.y2-chosen.y1,bx=l.x2-l.x1,by=l.y2-l.y1;if(Math.abs(ax*by-ay*bx)>Math.hypot(ax,ay)*Math.hypot(bx,by)*.01)return [l];const nearby=closestLine([l],x,y,tolerance);if(!nearby)return [l];try{return addOpening(l,nearby.t,span,kind);}catch{return [l];}});
}

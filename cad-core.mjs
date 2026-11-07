// CAD vectors stay vectors: annotations, curves and paper-space entities are not walls.
export const CAD_LIMIT=20000;
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<1e12&&Math.abs(p.y)<1e12;
const identity=[1,0,0,1,0,0];
const point=(m,p)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
const compose=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
export function cadVectors(doc,{format='dxf',notices=[]}={}){
 if(!doc||!Array.isArray(doc.entities))throw Error('CADの図形を読み取れませんでした。');
 const lines=[],skipped={},seen=new Set();let visits=0;
 const skip=t=>{skipped[t]=(skipped[t]||0)+1;};
 function add(a,b,m,layer){
  if(!finite(a)||!finite(b)){skip('不正座標');return;}
  const p=point(m,a),q=point(m,b);if(!finite(p)||!finite(q))throw Error('座標が範囲外です。');
  if(Math.hypot(p.x-q.x,p.y-q.y)<1e-7)return;
  const ends=[`${p.x.toFixed(6)},${p.y.toFixed(6)}`,`${q.x.toFixed(6)},${q.y.toFixed(6)}`].sort();const key=JSON.stringify([layer,...ends]);if(seen.has(key))return;seen.add(key);
  if(lines.length>=CAD_LIMIT)throw Error('線が多すぎます。1フロア・壁レイヤーだけのCADに分けてください。');
  lines.push({x1:p.x,y1:p.y,x2:q.x,y2:q.y,layer,kind:'wall'});
 }
 function walk(entities,m=identity,inherited='0',stack=[]){for(const e of entities){
  if(++visits>100000)throw Error('CADの図形が多すぎます。1フロアに分けてください。');
  if(e.inPaperSpace){skip('ペーパー空間');continue;}
  if(e.visible===false){skip('非表示');continue;}
  const layer=e.layer&&e.layer!=='0'?String(e.layer):inherited;
  // A 2D floor plan must lie in XY. Never flatten tilted 3D geometry silently.
  const ext=e.extrusionDirection||{x:e.extrusionDirectionX||0,y:e.extrusionDirectionY||0,z:e.extrusionDirectionZ??1};
  if(Math.abs(ext.x||0)>1e-8||Math.abs(ext.y||0)>1e-8||(ext.z??1)!==1){skip('傾いた座標系');continue;}
  if(e.type==='INSERT'){
   const block=doc.blocks?.[e.name];if(!block||!Array.isArray(block.entities)){skip('未解決ブロック');continue;}
   if(stack.includes(e.name)||stack.length>=16){skip('循環・深いブロック');continue;}
   const pos=e.position||{x:0,y:0},base=block.position||{x:0,y:0},r=(e.rotation||0)*Math.PI/180,sx=e.xScale??1,sy=e.yScale??1,c=Math.cos(r),s=Math.sin(r);
   if(!finite(pos)||!finite(base)||![r,sx,sy].every(Number.isFinite)){skip('不正ブロック');continue;}
   const rows=Math.max(1,e.rowCount||1),cols=Math.max(1,e.columnCount||1);if(rows*cols>1000)throw Error('配列ブロックが多すぎます。');
   for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const dx=col*(e.columnSpacing||0),dy=row*(e.rowSpacing||0);
    const mat=[c*sx,s*sx,-s*sy,c*sy,pos.x-c*sx*base.x+s*sy*base.y+c*dx-s*dy,pos.y-s*sx*base.x-c*sy*base.y+s*dx+c*dy];
    walk(block.entities,compose(m,mat),layer,[...stack,e.name]);
   }
  }else if(['LINE','LWPOLYLINE','POLYLINE'].includes(e.type)){
   const v=e.vertices||[];if(v.some(p=>Math.abs((p.z||0)-(v[0]?.z||0))>1e-7)||e.is3dPolyline||e.is3dPolygonMesh||e.isPolyfaceMesh){skip('3D図形');continue;}
   const n=e.type==='LINE'?Math.min(1,v.length-1):v.length-1+(e.shape?1:0);
   for(let i=0;i<n;i++){const a=v[i],b=v[(i+1)%v.length];if(a.bulge){skip('曲線');continue;}add(a,b,m,layer);}
  }else skip(e.type||'不明図形');
 }}
 walk(doc.entities);
 if(!lines.length)throw Error('壁に使える直線がありません。平面図のLINE・POLYLINEを含むファイルを選んでください。');
 const counts=new Map();for(const l of lines)counts.set(l.layer,(counts.get(l.layer)||0)+1);
 const table=doc.tables?.layer?.layers||{};
 const layers=[...counts].map(([name,count])=>({name,count,visible:table[name]?.visible!==false&&!table[name]?.frozen}));
 const unitMap={1:.0254,2:.3048,4:.001,5:.01,6:1,7:1000,10:.9144,14:.1};
 return {format,lines,layers,metresPerUnit:format==='jww'?null:unitMap[doc.header?.$INSUNITS]??null,skipped,notices};
}
export function cadPreview(cad,selected,{metresPerUnit=null,paperScale=1}={}){
 const choose=new Set(selected),ls=cad.lines.filter(l=>choose.has(l.layer));
 if(!ls.length)throw Error('壁を含むレイヤーを選んでください。');
 if(ls.length>400)throw Error(`${ls.length}本あります。壁レイヤーを絞って400本以下にしてください。`);
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const l of ls){x0=Math.min(x0,l.x1,l.x2);x1=Math.max(x1,l.x1,l.x2);y0=Math.min(y0,l.y1,l.y2);y1=Math.max(y1,l.y1,l.y2);}
 const w=x1-x0,h=y1-y0;if(w<1e-7||h<1e-7)throw Error('平面図の横幅・奥行きがありません。');
 const pad=Math.max(w,h)*.035,scale=1100/(Math.max(w,h)+2*pad),width=Math.ceil((w+2*pad)*scale),height=Math.ceil((h+2*pad)*scale);
 const m=metresPerUnit===null?null:Number(metresPerUnit)*Number(paperScale);
 if(m!==null&&(!Number.isFinite(m)||m<=0))throw Error('単位と縮尺を確認してください。');
 return {width,height,worldWidth:m===null?null:width/scale*m,lines:ls.map(l=>({x1:(l.x1-x0+pad)*scale,y1:(y1-l.y1+pad)*scale,x2:(l.x2-x0+pad)*scale,y2:(y1-l.y2+pad)*scale,kind:'wall'}))};
}
// Liang–Barsky clipping preserves vector diagonals when the drawing is cropped.
export function clipCADLines(lines,x,y,w,h){return lines.flatMap(l=>{let a=0,b=1;const dx=l.x2-l.x1,dy=l.y2-l.y1;for(const [p,q]of [[-dx,l.x1-x],[dx,x+w-l.x1],[-dy,l.y1-y],[dy,y+h-l.y1]]){if(Math.abs(p)<1e-12){if(q<0)return [];}else{const t=q/p;if(p<0)a=Math.max(a,t);else b=Math.min(b,t);if(a>b)return [];}}if(Math.hypot(dx,dy)*(b-a)<1)return [];return [{...l,x1:l.x1+a*dx-x,y1:l.y1+a*dy-y,x2:l.x1+b*dx-x,y2:l.y1+b*dy-y}];});}

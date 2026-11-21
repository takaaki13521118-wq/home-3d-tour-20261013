// User-marked exclusions, not automatic furniture/room recognition.
// Only the open interior of a rectangle is removed. Its boundary, outside
// segments, doors and windows are retained. Source pixels are never modified.
export function reviewRect(a,b){
 const values=[a?.x,a?.y,b?.x,b?.y];
 if(!values.every(Number.isFinite))throw Error('除外範囲の座標を確認してください。');
 const rect={left:Math.min(a.x,b.x),top:Math.min(a.y,b.y),right:Math.max(a.x,b.x),bottom:Math.max(a.y,b.y)};
 if(rect.right-rect.left<6||rect.bottom-rect.top<6)throw Error('除外する範囲を少し広げてください。');
 return rect;
}
function insideInterval(line,r){
 let start=0,end=1;
 for(const [origin,delta,low,high] of [[line.x1,line.x2-line.x1,r.left,r.right],[line.y1,line.y2-line.y1,r.top,r.bottom]]){
  if(Math.abs(delta)<1e-9){if(origin<=low+1e-9||origin>=high-1e-9)return null;continue;}
  const a=(low-origin)/delta,b=(high-origin)/delta;start=Math.max(start,Math.min(a,b));end=Math.min(end,Math.max(a,b));
 }
 return end-start>1e-9?[start,end]:null;
}
function segment(l,a,b){return {...l,x1:l.x1+(l.x2-l.x1)*a,y1:l.y1+(l.y2-l.y1)*a,x2:l.x1+(l.x2-l.x1)*b,y2:l.y1+(l.y2-l.y1)*b};}
export function excludePlanRegions(lines,regions,{minLength=0}={}){
 if(!Number.isFinite(minLength)||minLength<0)throw Error('除外設定を確認してください。');
 let kept=lines.map(l=>({...l}));const removed=[];
 for(const r of regions){
  if(![r.left,r.top,r.right,r.bottom].every(Number.isFinite)||r.right<=r.left||r.bottom<=r.top)throw Error('除外範囲の座標を確認してください。');
  kept=kept.flatMap(l=>{
   if(l.kind&&l.kind!=='wall')return [l];
   const hit=insideInterval(l,r);if(!hit)return [l];
   const [a,b]=hit;removed.push(segment(l,a,b));
   const result=[];if(a>1e-9)result.push(segment(l,0,a));if(b<1-1e-9)result.push(segment(l,b,1));
   return result.filter(part=>{if(Math.hypot(part.x2-part.x1,part.y2-part.y1)>=minLength)return true;removed.push(part);return false;});
  });
 }
 return {lines:kept,removed};
}
export function cropReviewRegions(regions,x,y,width,height){
 return regions.map(r=>({left:Math.max(0,r.left-x),top:Math.max(0,r.top-y),right:Math.min(width,r.right-x),bottom:Math.min(height,r.bottom-y)})).filter(r=>r.right-r.left>1e-9&&r.bottom-r.top>1e-9);
}

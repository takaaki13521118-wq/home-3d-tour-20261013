import {traceRooms,inPolygon,polygonBounds,checkPolygon,interiorPoint} from './plan-topology.mjs?v=20261128-rooms';
// Suggestions, never authoritative geometry. Coordinates in this module are pixels.
export const semanticKinds={room:{name:'部屋',color:'#347bb5'},kitchen:{name:'キッチン',color:'#da8127'},tatami:{name:'和室',color:'#459452'},storage:{name:'収納',color:'#9861b7'},stairs:{name:'階段',color:'#cb5571'},wet:{name:'水回り',color:'#258e96'},hall:{name:'廊下・玄関',color:'#9b8843'}};
const vocabulary=[['kitchen','キッチン|台所|KITCHEN'],['tatami','和室|TATAMI'],['storage','押入れ?|収納|納戸|物入|WIC|ウォークインクローゼット|クローゼット|CLOSET|STORAGE'],['stairs','階段|STAIRS?|UP|DN'],['wet','洗面(?:所|室)?|脱衣(?:所|室)?|浴室|トイレ|便所|BATHROOM|BATH|WC'],['hall','ホール|廊下|玄関|HALL|ENTRY'],['room','居間[・･]?食事室|居間|食事室|寝室|洋室|子供室|子ども室|書斎|LDK|LIVING|BEDROOM|DINING']];
const norm=s=>String(s??'').normalize('NFKC').replace(/[\s\u3000]/g,'').toUpperCase();
export function textCandidates(tokens){
 const groups=new Map();for(const [i,t]of tokens.entries()){if(!t.bbox||!t.text)continue;const key=t.line??i;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t);}
 const out=[];for(const group of groups.values()){
  group.sort((a,b)=>a.bbox.x0-b.bbox.x0);let text='',chars=[];
  for(const t of group){const word=norm(t.text);for(let i=0;i<word.length;i++){chars.push({x0:t.bbox.x0+(t.bbox.x1-t.bbox.x0)*i/word.length,x1:t.bbox.x0+(t.bbox.x1-t.bbox.x0)*(i+1)/word.length,y0:t.bbox.y0,y1:t.bbox.y1,confidence:t.confidence??100});}text+=word;}
  const occupied=new Set();for(const [kind,pattern]of vocabulary)for(const m of text.matchAll(new RegExp(pattern,'g'))){
   if([...m[0]].some((_,i)=>occupied.has(m.index+i)))continue;
   const letters=chars.slice(m.index,m.index+m[0].length),bbox={x0:Math.min(...letters.map(t=>t.x0)),x1:Math.max(...letters.map(t=>t.x1)),y0:Math.min(...letters.map(t=>t.y0)),y1:Math.max(...letters.map(t=>t.y1))};
   if(!Object.values(bbox).every(Number.isFinite))continue;
   for(let i=0;i<m[0].length;i++)occupied.add(m.index+i);
   out.push({name:['UP','DN'].includes(m[0])?'階段（'+m[0]+'）':m[0],kind,bbox,x:(bbox.x0+bbox.x1)/2,y:(bbox.y0+bbox.y1)/2,confidence:Math.round(Math.min(...letters.map(t=>t.confidence))),evidence:['UP','DN'].includes(m[0])?'昇降記号':'図面の文字'});
  }
 }const unique=[];for(const c of out){const match=unique.findIndex(a=>a.kind===c.kind&&Math.min(a.bbox.x1,c.bbox.x1)>Math.max(a.bbox.x0,c.bbox.x0)&&Math.min(a.bbox.y1,c.bbox.y1)>Math.max(a.bbox.y0,c.bbox.y0));if(match<0)unique.push(c);else if(c.confidence>unique[match].confidence)unique[match]=c;}return unique.slice(0,60);
}
export function proposeRegion(label,lines,width,height){
 const {x,y}=label,eps=Math.max(3,Math.min(width,height)*.004),hits={left:[],right:[],top:[],bottom:[]};
 for(const l of lines){const b=label.bbox;if(b&&[l.x1,l.x2].every(x=>x>=b.x0-4&&x<=b.x1+4)&&[l.y1,l.y2].every(y=>y>=b.y0-4&&y<=b.y1+4))continue;const dx=l.x2-l.x1,dy=l.y2-l.y1;
  if(Math.abs(dy)>eps&&y>=Math.min(l.y1,l.y2)&&y<=Math.max(l.y1,l.y2)){const xx=l.x1+(y-l.y1)*dx/dy;if(xx<x-eps)hits.left.push(xx);if(xx>x+eps)hits.right.push(xx);}
  if(Math.abs(dx)>eps&&x>=Math.min(l.x1,l.x2)&&x<=Math.max(l.x1,l.x2)){const yy=l.y1+(x-l.x1)*dy/dx;if(yy<y-eps)hits.top.push(yy);if(yy>y+eps)hits.bottom.push(yy);}
 }
 const fallback=Math.min(width,height)*.09;
 const rect={left:hits.left.length?Math.max(...hits.left):Math.max(0,x-fallback),right:hits.right.length?Math.min(...hits.right):Math.min(width,x+fallback),top:hits.top.length?Math.max(...hits.top):Math.max(0,y-fallback),bottom:hits.bottom.length?Math.min(...hits.bottom):Math.min(height,y+fallback)};
 const closed=Object.values(hits).every(a=>a.length);return {rect,closed};
}
export function inspectRegion(c,lines){
 const r=c.rect,pad=3,inside=l=>l.x1>r.left+pad&&l.x2>r.left+pad&&l.x1<r.right-pad&&l.x2<r.right-pad&&l.y1>r.top+pad&&l.y2>r.top+pad&&l.y1<r.bottom-pad&&l.y2<r.bottom-pad;
 const inner=lines.filter(l=>l.kind==='wall'&&inside(l)).length;
 const openings=lines.filter(l=>l.kind!=='wall'&&Math.max(l.x1,l.x2)>=r.left-pad&&Math.min(l.x1,l.x2)<=r.right+pad&&Math.max(l.y1,l.y2)>=r.top-pad&&Math.min(l.y1,l.y2)<=r.bottom+pad).length;
 return {inner,openings,message:`${c.polygon?'壁に沿った輪郭候補'+(c.holes?'／内側に別の囲みあり（家具か収納か要確認）':''):'境界が不足・部屋の角を指定してください'}／範囲内の壁候補 ${inner} 本／指定済み出入口・窓 ${openings} 本`};
}
// Repeated short parallel strokes are only a stair *candidate*: terraces and tiles can look alike.
export function stairCandidates(lines,width,height){
 const groups=[];for(const l of lines){if(l.kind!=='wall')continue;const horizontal=Math.abs(l.y2-l.y1)<2,vertical=Math.abs(l.x2-l.x1)<2;if(!horizontal&&!vertical)continue;
  const a=horizontal?Math.min(l.x1,l.x2):Math.min(l.y1,l.y2),b=horizontal?Math.max(l.x1,l.x2):Math.max(l.y1,l.y2),at=horizontal?(l.y1+l.y2)/2:(l.x1+l.x2)/2,len=b-a;
  if(len<Math.min(width,height)*.025||len>Math.min(width,height)*.2)continue;
  let g=groups.find(g=>g.horizontal===horizontal&&Math.abs(g.a-a)<4&&Math.abs(g.b-b)<4);if(!g){g={horizontal,a,b,ats:[]};groups.push(g);}g.ats.push(at);
 }
 const out=[];for(const g of groups){const ats=[...new Set(g.ats.map(Math.round))].sort((a,b)=>a-b);if(ats.length<5)continue;
  let run=[ats[0]],gap=0;const flush=()=>{if(run.length<5)return;const a=run[0],b=run.at(-1);if(b-a>Math.min(width,height)*.3)return;const rect=g.horizontal?{left:g.a,right:g.b,top:a,bottom:b}:{left:a,right:b,top:g.a,bottom:g.b};out.push({name:'階段候補',kind:'stairs',x:(rect.left+rect.right)/2,y:(rect.top+rect.bottom)/2,rect,closed:false,confidence:0,evidence:'平行な段線（畳・テラスとの区別が必要）'});};
  for(let i=1;i<ats.length;i++){const d=ats[i]-ats[i-1];if(d<3)continue;if(d>Math.min(width,height)*.04||gap&&Math.abs(d-gap)>Math.max(2,gap*.3)){flush();run=[ats[i]];gap=0;}else{run.push(ats[i]);gap=gap||d;}}flush();
 }return out.slice(0,15);
}
export function suggestSpaces(tokens,lines,width,height){
 const labels=textCandidates(tokens).filter(c=>c.x>=0&&c.y>=0&&c.x<=width&&c.y<=height);
 const clean=lines.filter(l=>!labels.some(c=>{const b=c.bbox;return [l.x1,l.x2].every(x=>x>=b.x0-4&&x<=b.x1+4)&&[l.y1,l.y2].every(y=>y>=b.y0-4&&y<=b.y1+4);}));
 const regions=traceRooms(clean,width,height);
 const named=labels.map(c=>{const r=regions.filter(r=>inPolygon(r.polygon,c.x,c.y)).sort((a,b)=>a.area-b.area)[0];return {...c,...proposeRegion(c,clean,width,height),...(r?{polygon:r.polygon,holes:r.holes.length,rect:polygonBounds(r.polygon),closed:true}:{closed:false})};});
 const symbols=stairCandidates(lines,width,height).filter(c=>!named.some(n=>n.kind==='stairs'&&Math.hypot(n.x-c.x,n.y-c.y)<Math.min(width,height)*.15));
 return [...named,...symbols].slice(0,60).map((c,i)=>({...c,id:'candidate'+i,state:'pending'}));
}
export function validateAnnotations(input){
 if(input===undefined)return [];if(!Array.isArray(input)||input.length>60)throw Error('部屋候補は60件までです。');
 return input.map(a=>{if(!a||!semanticKinds[a.kind]||typeof a.name!=='string'||!a.name.trim()||a.name.length>32)throw Error('部屋の名称・種類が不正です。');const b={name:a.name.trim(),kind:a.kind};for(const k of ['x','y','left','right','top','bottom']){if(typeof a[k]!=='number'||!Number.isFinite(a[k])||a[k]<0||a[k]>1)throw Error('部屋の範囲が不正です。');b[k]=Math.round(a[k]*10000)/10000;}if(b.left>=b.right||b.top>=b.bottom||b.x<b.left||b.x>b.right||b.y<b.top||b.y>b.bottom)throw Error('部屋の範囲を確認してください。');if(a.polygon!==undefined){checkPolygon(a.polygon);if(a.polygon.some(p=>p.x<0||p.x>1||p.y<0||p.y>1))throw Error('部屋の輪郭が図面の外にあります。');b.polygon=a.polygon.map(p=>({x:Math.round(p.x*10000)/10000,y:Math.round(p.y*10000)/10000}));checkPolygon(b.polygon);if(!inPolygon(b.polygon,b.x,b.y))throw Error('部屋名の位置を輪郭の内側にしてください。');}return b;});
}
export function approvedAnnotations(candidates,w,h){return validateAnnotations(candidates.filter(c=>c.state==='accepted').map(c=>({name:c.name,kind:c.kind,x:c.x/w,y:c.y/h,left:c.rect.left/w,right:c.rect.right/w,top:c.rect.top/h,bottom:c.rect.bottom/h,...(c.polygon?{polygon:c.polygon.map(p=>({x:p.x/w,y:p.y/h}))}:{})})));}
export function restoreAnnotations(annotations,w,h){return validateAnnotations(annotations).map((a,i)=>({id:'candidate'+i,name:a.name,kind:a.kind,x:a.x*w,y:a.y*h,rect:{left:a.left*w,right:a.right*w,top:a.top*h,bottom:a.bottom*h},...(a.polygon?{polygon:a.polygon.map(p=>({x:p.x*w,y:p.y*h}))}:{}),state:'accepted',closed:!!a.polygon,confidence:100,evidence:'確認済みの保存データ'}));}

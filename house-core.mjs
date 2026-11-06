export function validateDesign(v){
 if(!v||v.version!==1)throw Error('この形式のモデルは読み込めません。');
 const number=(key,min,max)=>{const n=v[key];if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw Error(`${key} の値が範囲外です。`);return n;};
 const color=k=>{if(!/^#[0-9a-f]{6}$/i.test(v[k]||''))throw Error('色の指定が不正です。');return v[k];};
 const bedrooms=number('bedrooms',1,3);if(!Number.isInteger(bedrooms))throw Error('個室数は整数で指定してください。');
 if(!['north','south'].includes(v.side)||!['flat','shed'].includes(v.roof))throw Error('配置または屋根の指定が不正です。');
 return {version:1,name:typeof v.name==='string'?v.name.slice(0,40):'新しい家',width:number('width',7,18),depth:number('depth',7,16),height:number('height',2.2,3.5),bedrooms,ratio:number('ratio',.35,.55),side:v.side,roof:v.roof,wall:color('wall'),roofColor:color('roofColor')};
}
export function layoutRooms(d){const w=d.width,h=d.depth,split=-h/2+h*d.ratio,sign=d.side==='north'?1:-1;
 const rect=(id,name,x1,z1,x2,z2)=>({id,name,x1,x2,z1:Math.min(z1*sign,z2*sign),z2:Math.max(z1*sign,z2*sign)});
 const rooms=[];for(let i=0;i<d.bedrooms;i++)rooms.push(rect('custom'+i,'洋室 '+(i+1),-w/2+i*w/d.bedrooms,-h/2,-w/2+(i+1)*w/d.bedrooms,split));
 rooms.push(rect('customLiving','LDK',-w/2,split,w/2,h/2-2));rooms.push(rect('customBath','洗面・浴室',-w/2,h/2-2,-w/2+2.3,h/2));rooms.push(rect('customEntry','玄関・通路',-w/2+2.3,h/2-2,w/2,h/2));return {rooms,split:split*sign,sign};}
export function slideMove(x,z,dx,dz,allowed){const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.035));for(let i=0;i<steps;i++){if(allowed(x+dx/steps,z))x+=dx/steps;if(allowed(x,z+dz/steps))z+=dz/steps;}return {x,z};}

// Each history entry is a built model; null represents the supplied original house.
export function createDesignHistory(limit=30){
 let entries=[null],index=0;
 const copy=v=>v===null?null:{...v};
 return {
  push(value){const next=value===null?null:validateDesign(value);if(JSON.stringify(entries[index])===JSON.stringify(next))return;entries=entries.slice(0,index+1);entries.push(copy(next));if(entries.length>limit)entries.shift();index=entries.length-1;},
  undo(){if(index>0)index--;return copy(entries[index]);},
  redo(){if(index<entries.length-1)index++;return copy(entries[index]);},
  get canUndo(){return index>0;},get canRedo(){return index<entries.length-1;}
 };
}
export function designShareURL(href,design){return href.split('#')[0]+(design?'#design='+encodeURIComponent(JSON.stringify(validateDesign(design))):'');}
export function interiorStartRoom(design){return design?'customLiving':'living';}

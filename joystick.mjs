// Frame-based filtering keeps both sticks independent of touch-event frequency.
export function stickVector(x,y,deadZone=.05){
 const length=Math.hypot(x,y);
 if(length<=deadZone)return {x:0,y:0};
 const strength=Math.pow((Math.min(1,length)-deadZone)/(1-deadZone),1.35);
 return {x:x/length*strength,y:y/length*strength};
}
export function bindJoystick(element,knob,onChange,isEnabled){
 let pointer=null,originX=0,originY=0,radius=38;
 let targetX=0,targetY=0,x=0,y=0;
 function release(){const previous=pointer;pointer=null;if(previous!==null&&element.hasPointerCapture?.(previous))element.releasePointerCapture(previous);}
 function reset(){targetX=targetY=x=y=0;release();onChange(0,0);knob.style.transform='';}
 function update(dt){
  if(!isEnabled()){if(pointer!==null||x||y)reset();return;}
  const alpha=1-Math.exp(-Math.max(0,dt)/(pointer===null?.035:.055));
  x+=(targetX-x)*alpha;y+=(targetY-y)*alpha;
  if(Math.abs(x-targetX)<.001)x=targetX;if(Math.abs(y-targetY)<.001)y=targetY;
  onChange(x,y);
  knob.style.transform=(x||y)?`translate3d(${x*radius*.74}px,${y*radius*.74}px,0)`:'';
 }
 element.onpointerdown=e=>{
  if(!isEnabled()||pointer!==null||(e.button!==undefined&&e.button!==0))return;
  e.preventDefault();reset();
  const r=element.getBoundingClientRect();radius=Math.max(1,Math.min(r.width,r.height)*.36);
  // Starting away from the centre must not cause an immediate speed/heading jump.
  originX=e.clientX;originY=e.clientY;pointer=e.pointerId;element.setPointerCapture(pointer);
 };
 element.onpointermove=e=>{
  if(e.pointerId!==pointer)return;
  const value=stickVector((e.clientX-originX)/radius,(e.clientY-originY)/radius);
  targetX=value.x;targetY=value.y;
 };
 element.onpointerup=e=>{if(e.pointerId===pointer){targetX=targetY=0;release();}};
 element.onpointercancel=element.onlostpointercapture=e=>{if(e.pointerId===pointer)reset();};
 element.addEventListener('contextmenu',e=>e.preventDefault());
 return {reset,update};
}

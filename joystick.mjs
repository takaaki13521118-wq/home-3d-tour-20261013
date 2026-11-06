// Independent pointer ownership allows walking and looking with two fingers.
export function stickVector(x,y,deadZone=.1){
 const length=Math.hypot(x,y);
 if(length<=deadZone)return {x:0,y:0};
 const strength=(Math.min(1,length)-deadZone)/(1-deadZone);
 return {x:x/length*strength,y:y/length*strength};
}
export function bindJoystick(element,knob,onChange,isEnabled){
 let pointer=null;
 function reset(){
  const previous=pointer;pointer=null;
  onChange(0,0);knob.style.transform='';
  if(previous!==null&&element.hasPointerCapture?.(previous))element.releasePointerCapture(previous);
 }
 function update(e){
  const r=element.getBoundingClientRect(),radius=Math.max(1,Math.min(r.width,r.height)*.36);
  const value=stickVector((e.clientX-r.left-r.width/2)/radius,(e.clientY-r.top-r.height/2)/radius);
  onChange(value.x,value.y);
  knob.style.transform=`translate(${value.x*radius*.74}px,${value.y*radius*.74}px)`;
 }
 element.onpointerdown=e=>{
  if(!isEnabled()||pointer!==null||(e.button!==undefined&&e.button!==0))return;
  e.preventDefault();pointer=e.pointerId;element.setPointerCapture(pointer);update(e);
 };
 element.onpointermove=e=>{if(e.pointerId===pointer)update(e);};
 element.onpointerup=element.onpointercancel=element.onlostpointercapture=e=>{if(e.pointerId===pointer)reset();};
 element.addEventListener('contextmenu',e=>e.preventDefault());
 return {reset};
}

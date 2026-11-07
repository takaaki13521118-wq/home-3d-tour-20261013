// DOM/canvas doubles exercise the upload/edit/build wiring, not browser rendering.
import assert from 'node:assert/strict';
import {setupPlanImport} from '../plan-import.mjs';
import {validateDesign} from '../house-core.mjs';
class Element{get selectedOptions(){return this.children.filter(o=>o.selected);}constructor(){this.value='';this.checked=false;this.style={};this.handlers={};this.children=[];}addEventListener(t,f){this.handlers[t]=f;}append(e){this.children.push(e);}replaceChildren(){this.children=[];}getBoundingClientRect(){return {left:0,top:0,width:240,height:180};}setPointerCapture(){}showModal(){this.open=true;}close(){this.open=false;this.handlers.close?.();}}
function pixels(){const data=new Uint8ClampedArray(240*180*4).fill(255);for(let y=20;y<160;y++)for(let x=20;x<220;x++)if(x<24||x>215||y<24||y>155){const i=(y*240+x)*4;data[i]=data[i+1]=data[i+2]=0;}return data;}
class Canvas extends Element{constructor(){super();this.width=240;this.height=180;this.data=pixels();}getContext(){const c=this;return {drawImage(img){if(img.data)c.data=img.data.slice();},fillRect(){c.data=new Uint8ClampedArray(c.width*c.height*4).fill(255);},getImageData(x,y,w,h){const data=new Uint8ClampedArray(w*h*4);for(let j=0;j<h;j++)for(let i=0;i<w;i++){const src=((y+j)*c.width+x+i)*4;data.set(c.data.slice(src,src+4),(j*w+i)*4);}return {width:w,height:h,data};},putImageData(d){c.data=d.data.slice();},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){}};}}
const elements=new Map();const $=s=>{if(!elements.has(s))elements.set(s,s==='#planCanvas'?new Canvas():new Element());return elements.get(s);};
globalThis.document={querySelector:$,createElement:t=>t==='canvas'?new Canvas():new Element()};globalThis.Image=class{constructor(){this.naturalWidth=240;this.naturalHeight=180;this.data=pixels();}async decode(){}};
for(const [id,value]of Object.entries({planWidth:'12',planHeight:'2.6',planThickness:'.12',planRoof:'none',planThreshold:'155',planMinLength:'24',planKnownLength:'5',planTool:'erase'}))$('#'+id).value=value;
let result,opened=0,closed=0;
const pdfLib={GlobalWorkerOptions:{},getDocument(){return {destroy:async()=>{},promise:Promise.resolve({numPages:2,getPage:async()=>({getViewport:()=>({width:240,height:180}),render({canvasContext}){canvasContext.drawImage({data:pixels()});return {promise:Promise.resolve(),cancel(){}};}})})};}};
setupPlanImport({onBuild:d=>result=validateDesign(d),onOpen:()=>opened++,onClose:()=>closed++,loadPDF:async()=>pdfLib,loadCAD:async file=>({format:file.name.split('.').pop(),doc:{header:{$INSUNITS:4},entities:[{type:"LWPOLYLINE",layer:"Walls",shape:true,vertices:[{x:0,y:0},{x:8000,y:0},{x:8000,y:6000},{x:0,y:6000}]},{type:"LINE",layer:"Dims",vertices:[{x:0,y:-1000},{x:8000,y:-1000}]}]}})});
$('#openPlanImport').onclick();assert.equal(opened,1);assert.equal($('#planDialog').open,true);
const file=new Blob(['fixture'],{type:'image/png'});file.name='平面図.png';
await $('#planFile').onchange({target:{files:[file],value:'file'}});assert.equal($('#planBuild').disabled,false);assert.match($('#planCount').textContent,/4 本/);
$('#planBuild').onclick();assert.equal(result.version,2);assert.equal(result.width,12);assert.equal(result.depth,9);assert.equal(result.walls.length,4);assert.equal(closed,1);
const click=(x,y)=>{const e={pointerId:1,clientX:x,clientY:y,preventDefault(){}};$('#planCanvas').handlers.pointerdown(e);$('#planCanvas').handlers.pointerup(e);};
$('#planTool').value='wall';click(120,24);click(120,155);$('#planBuild').onclick();assert.equal(result.walls.length,5);
$('#planUndo').onclick();$('#planBuild').onclick();assert.equal(result.walls.length,4);$('#planRedo').onclick();$('#planBuild').onclick();assert.equal(result.walls.length,5);
$('#planTool').value='door';click(120,90);$('#planBuild').onclick();assert(result.walls.some(w=>w.kind==='door'));
$('#planTool').value='scale';click(20,20);click(220,20);assert.equal(+$('#planWidth').value,6);
const pdf=new Blob(['pdf'],{type:'application/pdf'});pdf.name='plan.pdf';await $('#planFile').onchange({target:{files:[pdf],value:'file'}});assert.equal($('#planPageRow').hidden,false);assert.equal($('#planPage').children.length,2);assert.equal($('#planBuild').disabled,false);
$('#planPage').value='2';await $('#planPage').onchange();assert.equal($('#planBuild').disabled,false);
const invalid=new Blob(['invalid'],{type:'application/zip'});invalid.name='test.zip';await $('#planFile').onchange({target:{files:[invalid],value:'file'}});assert.equal($('#planBuild').disabled,true);assert.match($('#planStatus').textContent,/読み込めません/);
console.log('PASS: image/PDF upload wiring, page selection, editing, undo/redo, scale, model build and failure state');
// Automatic path: no build-button click is required after image selection.
$('#planAutoPreview').checked=true;$('#openPlanImport').onclick();result=null;
await $('#planFile').onchange({target:{files:[file],value:'file'}});assert.equal(result?.version,2);assert.equal($('#planDialog').open,false);assert.equal(result.width,10); // new source never inherits previous calibration
// A multi-page PDF with no readable title stays open rather than showing an arbitrary page as a house.
$('#openPlanImport').onclick();result=null;
await $('#planFile').onchange({target:{files:[pdf],value:'file'}});assert.equal(result,null);assert.equal($('#planDialog').open,true);assert.match($('#planStatus').textContent,/特定できません/);
$('#planPage').value='2';await $('#planPage').onchange();assert.equal(result?.version,2);assert.equal($('#planDialog').open,false);
// Readable title selects the floor-plan page and generates the model automatically.
pdfLib.getDocument=()=>({destroy:async()=>{},promise:Promise.resolve({numPages:3,getPage:async n=>({getTextContent:async()=>({items:[{str:n===2?'１階 平面詳細図':'立面図'}]}),getViewport:()=>({width:240,height:180}),render({canvasContext}){canvasContext.drawImage({data:pixels()});return {promise:Promise.resolve(),cancel(){}};}})})});
$('#openPlanImport').onclick();result=null;
await $('#planFile').onchange({target:{files:[pdf],value:'file'}});assert.equal($('#planPage').value,'2');assert.equal(result?.version,2);assert.equal($('#planDialog').open,false);
// Opting out preserves review-before-build behaviour.
$('#planAutoPreview').checked=false;$('#openPlanImport').onclick();result=null;
await $('#planFile').onchange({target:{files:[file],value:'file'}});assert.equal(result,null);assert.equal($('#planDialog').open,true);
console.log('PASS: automatic image/PDF generation, PDF-page fallback, calibration reset and manual-review option');

// CAD uploads stay open for explicit layer/units review, even with auto-preview enabled.
$('#planAutoPreview').checked=true;
for(const ext of ['dxf','dwg','jww']){
 $('#openPlanImport').onclick();result=null;
 const f=new Blob(['cad']);f.name='house.'+ext;
 await $('#planFile').onchange({target:{files:[f],value:'file'}});
 assert.equal(result,null);assert.equal($('#planDialog').open,true);assert.equal($('#cadOptions').hidden,false);
 assert.equal($('#cadLayers').selectedOptions.length,1);assert.equal($('#cadLayers').selectedOptions[0].value,'Walls');
 if(ext==='jww'){$('#cadScale').value='1';$('#cadApply').onclick();}
 $('#planBuild').onclick();assert.equal(result?.version,2);assert.equal(result.walls.length,4);assert(Math.abs(result.walls[0].x2-result.walls[0].x1-8)<.001);
}
$('#openPlanImport').onclick();$('#cadUnit').value='1';$('#cadUnit').onchange();assert.equal($('#planBuild').disabled,true);
$('#cadUnit').value='0.001';$('#cadApply').onclick();assert.equal($('#planBuild').disabled,false);
await $('#planFile').onchange({target:{files:[file],value:'file'}});assert.equal($('#cadOptions').hidden,true);
console.log('PASS: DXF/DWG/JWW upload, layer selection, JWW scale, review and image switching');

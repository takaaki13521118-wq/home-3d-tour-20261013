// DOM/canvas doubles exercise the upload/edit/build wiring, not browser rendering.
import assert from 'node:assert/strict';
import {setupPlanImport} from '../plan-import.mjs';
import {validateDesign} from '../house-core.mjs';
class Element{get selectedOptions(){return this.children.filter(o=>o.selected);}constructor(){this.value='';this.checked=false;this.style={};this.handlers={};this.children=[];}addEventListener(t,f){this.handlers[t]=f;}append(e){this.children.push(e);}replaceChildren(){this.children=[];}getBoundingClientRect(){return {left:0,top:0,width:240,height:180};}setPointerCapture(){}showModal(){this.open=true;}close(){this.open=false;this.handlers.close?.();}}
function pixels(){const data=new Uint8ClampedArray(240*180*4).fill(255);for(let y=20;y<160;y++)for(let x=20;x<220;x++)if(x<24||x>215||y<24||y>155){const i=(y*240+x)*4;data[i]=data[i+1]=data[i+2]=0;}return data;}
class Canvas extends Element{constructor(){super();this.width=240;this.height=180;this.data=pixels();}getContext(){const c=this;return {drawImage(img){if(img.data)c.data=img.data.slice();},fillRect(){c.data=new Uint8ClampedArray(c.width*c.height*4).fill(255);},getImageData(x,y,w,h){const data=new Uint8ClampedArray(w*h*4);for(let j=0;j<h;j++)for(let i=0;i<w;i++){const src=((y+j)*c.width+x+i)*4;data.set(c.data.slice(src,src+4),(j*w+i)*4);}return {width:w,height:h,data};},putImageData(d){c.data=d.data.slice();},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){}};}}
const elements=new Map();const $=s=>{if(!elements.has(s))elements.set(s,s==='#planCanvas'?new Canvas():new Element());return elements.get(s);};
globalThis.document={querySelector:$,createElement:t=>t==='canvas'?new Canvas():new Element()};globalThis.window={confirm:()=>true};let imagePixels=pixels();globalThis.Image=class{constructor(){this.naturalWidth=240;this.naturalHeight=180;this.data=imagePixels;}async decode(){}};
for(const [id,value]of Object.entries({planWidth:'12',planHeight:'2.6',planThickness:'.12',planRoof:'none',planThreshold:'155',planMinLength:'24',planKnownLength:'5',planTool:'erase',planDoorWidth:'.9',planWindowWidth:'1.6'}))$('#'+id).value=value;
let result,opened=0,closed=0,currentDesign=null;
const pdfLib={GlobalWorkerOptions:{},getDocument(){return {destroy:async()=>{},promise:Promise.resolve({numPages:2,getPage:async()=>({getViewport:()=>({width:240,height:180}),render({canvasContext}){canvasContext.drawImage({data:pixels()});return {promise:Promise.resolve(),cancel(){}};}})})};}};
setupPlanImport({getDesign:()=>currentDesign,onBuild:d=>result=validateDesign(d),onOpen:()=>opened++,onClose:()=>closed++,loadPDF:async()=>pdfLib,loadCAD:async file=>({format:file.name.split('.').pop(),doc:{header:{$INSUNITS:4},entities:[{type:"LWPOLYLINE",layer:"Walls",shape:true,vertices:[{x:0,y:0},{x:8000,y:0},{x:8000,y:6000},{x:0,y:6000}]},{type:"LINE",layer:"Dims",vertices:[{x:0,y:-1000},{x:8000,y:-1000}]}]}})});
$('#openPlanImport').onclick();assert.equal(opened,1);assert.equal($('#planDialog').open,true);
const file=new Blob(['fixture'],{type:'image/png'});file.name='平面図.png';
await $('#planFile').onchange({target:{files:[file],value:'file'}});assert.equal($('#planBuild').disabled,false);assert.match($('#planCount').textContent,/4 本/);
$('#planBuild').onclick();assert.equal(result.version,2);assert.equal(result.width,12);assert.equal(result.depth,9);assert.equal(result.walls.length,4);assert.equal(closed,1);
const click=(x,y)=>{const e={pointerId:1,clientX:x,clientY:y,preventDefault(){}};$('#planCanvas').handlers.pointerdown(e);$('#planCanvas').handlers.pointerup(e);};
$('#planTool').value='wall';click(120,24);click(120,155);$('#planBuild').onclick();assert.equal(result.walls.length,5);
$('#planUndo').onclick();$('#planBuild').onclick();assert.equal(result.walls.length,4);$('#planRedo').onclick();$('#planBuild').onclick();assert.equal(result.walls.length,5);
$('#planTool').value='door';click(120,90);$('#planBuild').onclick();assert(result.walls.some(w=>w.kind==='door'));
$('#planTool').value='scale';click(20,20);click(220,20);assert.equal(+$('#planWidth').value,6);
$('#planKnownLength').value='8';$('#planKnownLength').handlers.input();assert.equal(+$('#planWidth').value,9.6);assert.match($('#planStatus').textContent,/8 m/);
$('#openPlanImport').onclick();const pdf=new Blob(['pdf'],{type:'application/pdf'});pdf.name='plan.pdf';await $('#planFile').onchange({target:{files:[pdf],value:'file'}});assert.equal($('#planPageRow').hidden,false);assert.equal($('#planPage').children.length,3);assert.equal($('#planBuild').disabled,true);assert.equal($('#planCount').textContent.includes('0 本'),true);
$('#planPage').value='2';await $('#planPage').onchange();assert.equal($('#planBuild').disabled,false);assert.equal($('#planDialog').open,true);
const invalid=new Blob(['invalid'],{type:'application/zip'});invalid.name='test.zip';await $('#planFile').onchange({target:{files:[invalid],value:'file'}});assert.equal($('#planBuild').disabled,false);assert.match($('#planStatus').textContent,/読み込めません/);assert.equal($('#planCount').textContent.includes('4 本'),true);
console.log('PASS: image/PDF upload wiring, page selection, editing, undo/redo, scale, model build and failure state');
// Automatic path: no build-button click is required after image selection.
$('#planAutoPreview').checked=true;$('#openPlanImport').onclick();result=null;
await $('#planFile').onchange({target:{files:[file],value:'file'}});assert.equal(result?.version,2);assert.equal($('#planDialog').open,false);assert.equal(result.width,10); // new source never inherits previous calibration
const crowdedPixels=()=>{const data=new Uint8ClampedArray(240*180*4).fill(255);const rect=(x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){const p=(j*240+i)*4;data[p]=data[p+1]=data[p+2]=0;}};for(let k=0;k<26;k++){rect(6,6+k*6,200,3);rect(6+k*8,6,3,160);}return data;};
imagePixels=crowdedPixels();$('#openPlanImport').onclick();result=null;await $('#planFile').onchange({target:{files:[file],value:'file'}});
assert.equal(result,null);assert.equal($('#planDialog').open,true);assert.equal($('#planReviewTools').hidden,false);assert.match($('#planStatus').textContent,/自動3D化を止めました/);
$('#planQuickCrop').onclick();assert.equal($('#planTool').value,'crop');assert.match($('#planStatus').textContent,/対角2点|左上と右下/);
click(30,20);click(210,160);assert.equal($('#planWidth').value,'10.000');assert.equal($('#planTool').value,'pan');
imagePixels=pixels();await $('#planFile').onchange({target:{files:[file],value:'file'}});assert.equal(result?.version,2);
// A multi-page PDF with no readable title stays open rather than showing an arbitrary page as a house.
$('#openPlanImport').onclick();result=null;
await $('#planFile').onchange({target:{files:[pdf],value:'file'}});assert.equal(result,null);assert.equal($('#planDialog').open,true);assert.match($('#planStatus').textContent,/特定できません/);
$('#planPage').value='2';await $('#planPage').onchange();assert.equal(result,null);assert.equal($('#planDialog').open,true);$('#planBuild').onclick();assert.equal(result?.version,2);assert.equal($('#planDialog').open,false);
// A single-page PDF without floor-plan text also needs review before 3D generation.
pdfLib.getDocument=()=>({destroy:async()=>{},promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[{str:'照明計画'}]}),getViewport:()=>({width:240,height:180}),render({canvasContext}){canvasContext.drawImage({data:pixels()});return {promise:Promise.resolve(),cancel(){}};}})})});
$('#openPlanImport').onclick();result=null;
await $('#planFile').onchange({target:{files:[pdf],value:'file'}});assert.equal(result,null);assert.equal($('#planDialog').open,true);assert.equal($('#planPage').value,'1');assert.equal($('#planBuild').disabled,false);assert.match($('#planStatus').textContent,/平面図と判定できませんでした/);
$('#planBuild').onclick();assert.equal(result?.version,2);assert.equal($('#planDialog').open,false);
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

// Zoom changes display size, while all edits still use source-image coordinates.
$('#planAutoPreview').checked=false;$('#openPlanImport').onclick();
await $('#planFile').onchange({target:{files:[file],value:'file'}});
$('#planZoomIn').onclick();$('#planZoomIn').onclick();assert.equal($('#planCanvas').style.width,'200%');
$('#planCanvas').getBoundingClientRect=()=>({left:-120,top:-90,width:480,height:360});
$('#planTool').value='door';$('#planDoorWidth').value='1.2';click(120,-47);
$('#planBuild').onclick();let opening=result.walls.find(w=>w.kind==='door');assert(opening);assert(Math.abs(Math.hypot(opening.x2-opening.x1,opening.z2-opening.z1)-1.2)<.001);
$('#planUndo').onclick();$('#planTool').value='window';$('#planWindowWidth').value='2';click(120,-47);$('#planBuild').onclick();opening=result.walls.find(w=>w.kind==='window');assert(Math.abs(Math.hypot(opening.x2-opening.x1,opening.z2-opening.z1)-2)<.001);
$('#planUndo').onclick();$('#planDoorWidth').value='0';$('#planTool').value='door';click(120,-47);assert.match($('#planStatus').textContent,/0.3〜6/);
const beforePan=$('#planCount').textContent;$('#planTool').value='pan';$('#planTool').onchange();click(120,-47);assert.equal($('#planCount').textContent,beforePan);assert.equal($('#planCanvas').style.touchAction,'pan-x pan-y');
$('#planZoomFit').onclick();assert.equal($('#planCanvas').style.width,'100%');assert.equal($('#planZoomOut').disabled,true);
$('#planCanvas').getBoundingClientRect=()=>({left:0,top:0,width:240,height:180});
$('#planTool').value='erase';$('#planTool').onchange();
console.log('PASS: zoomed coordinate picking, variable door/window sizes, invalid width rejection and pan without edits');

const tick=()=>new Promise(resolve=>setImmediate(resolve));
// Closing an image load and reopening must not allow its late completion to build.
let finishImage;globalThis.Image.prototype.decode=()=>new Promise(resolve=>{finishImage=resolve;});
$('#planAutoPreview').checked=true;$('#openPlanImport').onclick();result=null;
let pendingLoad=$('#planFile').onchange({target:{files:[file],value:'file'}});await tick();
assert.equal($('#planBuild').disabled,true);assert.equal($('#planUndo').disabled,true);
$('#closePlanImport').onclick();assert.equal($('#planFile').disabled,false);$('#openPlanImport').onclick();finishImage();await pendingLoad;
assert.equal(result,null);assert.equal($('#planBuild').disabled,false);assert.match($('#planStatus').textContent,/中止/);
globalThis.Image.prototype.decode=async()=>{};
await $('#planFile').onchange({target:{files:[file],value:'file'}});assert.equal(result?.version,2);
// Closing while PDF bytes are being read must prevent creation of a late PDF task.
let finishBytes,starts=0;const validGetDocument=pdfLib.getDocument;
pdfLib.getDocument=(...args)=>{starts++;return validGetDocument(...args);};
const slowPDF={name:'slow.pdf',size:3,type:'application/pdf',arrayBuffer:()=>new Promise(resolve=>{finishBytes=resolve;})};
$('#openPlanImport').onclick();result=null;pendingLoad=$('#planFile').onchange({target:{files:[slowPDF],value:'file'}});await tick();$('#closePlanImport').onclick();$('#openPlanImport').onclick();finishBytes(new ArrayBuffer(3));await pendingLoad;assert.equal(starts,0);assert.equal(result,null);
// Closing an active PDF load destroys its task and ignores late resolution.
let finishDocument,destroyed=0;
pdfLib.getDocument=()=>({destroy:async()=>{destroyed++;},promise:new Promise(resolve=>{finishDocument=resolve;})});
pendingLoad=$('#planFile').onchange({target:{files:[pdf],value:'file'}});await tick();$('#closePlanImport').onclick();$('#openPlanImport').onclick();finishDocument({numPages:99});await pendingLoad;assert.equal(destroyed,1);assert.equal(result,null);assert.equal($('#planPageRow').hidden,true);
pdfLib.getDocument=validGetDocument;result=null;await $('#planFile').onchange({target:{files:[pdf],value:'file'}});assert.equal(result?.version,2);
console.log('PASS: image/PDF cancellation, late bytes/task suppression, clean controls and retry after cancellation');

// Reopen saved/shared JSON wall models without referring to a previous PDF/image.
currentDesign={version:2,name:'保存から再編集',width:10.123,depth:8.237,height:2.8,thickness:.18,roof:'flat',wall:'#557799',walls:[{x1:-4,z1:-3,x2:4,z2:-3,kind:'wall'},{x1:-4,z1:3,x2:4,z2:3,kind:'wall'},{x1:-4,z1:-3,x2:-4,z2:3,kind:'wall'},{x1:4,z1:-3,x2:4,z2:3,kind:'wall'},{x1:0,z1:-3,x2:0,z2:0,kind:'wall'},{x1:0,z1:0,x2:0,z2:1,kind:'door'},{x1:0,z1:1,x2:0,z2:3,kind:'window'},{x1:-3,z1:-2,x2:-1,z2:1,kind:'wall'}]};
const original=JSON.stringify(currentDesign);result=null;$('#editCurrentPlan').onclick();
assert.equal($('#planDialog').open,true);assert.equal($('#cadOptions').hidden,true);assert.equal($('#planPageRow').hidden,true);assert.equal($('#planDetect').disabled,true);assert.equal($('#planShowOriginal').disabled,true);assert.match($('#planSourceInfo').textContent,/保存から再編集/);
$('#planBuild').onclick();assert.equal(result.name,currentDesign.name);assert.equal(result.wall,currentDesign.wall);assert.equal(result.roof,'flat');assert.equal(result.height,2.8);assert.equal(result.thickness,.18);assert(Math.abs(result.depth-currentDesign.depth)<1e-9);assert.deepEqual(result.walls,currentDesign.walls);assert.equal(JSON.stringify(currentDesign),original);
// Editing uses restored geometry; cancel/undo do not mutate the saved input.
$('#editCurrentPlan').onclick();$('#planTool').value='erase';click(120,24);$('#planUndo').onclick();$('#planBuild').onclick();assert.deepEqual(result.walls,currentDesign.walls);
$('#editCurrentPlan').onclick();$('#planTool').value='solid';click(120,(.5+.5/currentDesign.depth)*180);$('#planBuild').onclick();assert.equal(result.walls.filter(w=>w.kind==='door').length,0);assert.equal(result.walls.length,currentDesign.walls.length);$('#planUndo').onclick();$('#planBuild').onclick();assert.deepEqual(result.walls,currentDesign.walls);
// A physically specified opening remains exact despite integer preview aspect rounding.
$('#editCurrentPlan').onclick();$('#planTool').value='door';$('#planDoorWidth').value='1.3';
const px=120,py=(.5-3/currentDesign.depth)*180;click(px,py);$('#planBuild').onclick();
assert(result.walls.some(w=>w.kind==='door'&&Math.abs(Math.hypot(w.x2-w.x1,w.z2-w.z1)-1.3)<.0002));
// Starting a different image resets native dimensions, colour and direct-vector mode.
$('#openPlanImport').onclick();await $('#planFile').onchange({target:{files:[file],value:'file'}});assert.equal(result.wall,'#e9e4d8');assert.equal(result.width,10);assert.equal(result.depth,7.5);assert.equal($('#planDetect').disabled,false);
console.log('PASS: restored plan editing preserves dimensions, colour, roof, diagonal walls and openings; new sources reset correctly');

// A worker setup failure must preserve an edited source and retry with a fresh worker URL.
$('#planAutoPreview').checked=false;$('#openPlanImport').onclick();
$('#planName').value='編集中の図面';$('#planWidth').value='12.667';
const beforeFailure=$('#planCount').textContent;
const workingPDF=pdfLib.getDocument;
pdfLib.getDocument=()=>({destroy:async()=>{},promise:Promise.reject(new Error('Setting up fake worker failed'))});
await $('#planFile').onchange({target:{files:[pdf],value:'file'}});
assert.equal($('#planName').value,'編集中の図面');assert.equal($('#planWidth').value,'12.667');assert.equal($('#planCount').textContent,beforeFailure);
assert.match($('#planStatus').textContent,/編集内容を保持/);assert.doesNotMatch($('#planStatus').textContent,/fake worker/);
pdfLib.getDocument=workingPDF;
await $('#planFile').onchange({target:{files:[pdf],value:'file'}});
assert.match(pdfLib.GlobalWorkerOptions.workerSrc,/pdf\.worker\.mjs\?retry=/);
const afterRetry=$('#planCount').textContent;
window.confirm=()=>false;
await $('#planFile').onchange({target:{files:[file],value:'file'}});
assert.equal($('#planCount').textContent,afterRetry);
window.confirm=()=>true;
$('#closePlanImport').onclick();
// After design undo, reopening the editor must use the model currently on screen.
currentDesign={...currentDesign,name:'履歴から戻した案',walls:currentDesign.walls.slice(0,-1)};
$('#openPlanImport').onclick();
assert.match($('#planSourceInfo').textContent,/履歴から戻した案/);
assert.match($('#planCount').textContent,new RegExp(`${currentDesign.walls.length} 本`));
console.log('PASS: PDF worker retry, failed-load rollback, replacement confirmation and undo editor sync');

// A PDF page rendering error also rolls back the source that was being edited.
const renderedName=$('#planName').value,renderedCount=$('#planCount').textContent;
pdfLib.getDocument=()=>({destroy:async()=>{},promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[{str:'平面図'}]}),getViewport:()=>({width:240,height:180}),render:()=>({promise:Promise.reject(new Error('render failed')),cancel(){}})})})});
await $('#planFile').onchange({target:{files:[pdf],value:'file'}});
assert.equal($('#planName').value,renderedName);assert.equal($('#planCount').textContent,renderedCount);
assert.match($('#planStatus').textContent,/編集内容を保持/);
console.log('PASS: PDF render failure rolls back source editing state');

// Review a rectangular furniture exclusion before touching the model.
const furniturePixels=pixels();
for(let y=60;y<120;y++)for(let x=70;x<170;x++)if(x<74||x>=166||y<64||y>=116){const i=(y*240+x)*4;furniturePixels[i]=furniturePixels[i+1]=furniturePixels[i+2]=0;}
imagePixels=furniturePixels;$('#planAutoPreview').checked=false;currentDesign=null;
await $('#planFile').onchange({target:{files:[file],value:'file'}});
assert.match($('#planCount').textContent,/8 本/);
$('#planExclude').onclick();click(40,40);click(200,140);
assert.equal($('#planExclusionReview').hidden,false);assert.equal($('#planBuild').disabled,true);assert.match($('#planCount').textContent,/8 本/);
assert.match($('#planExclusionSummary').textContent,/4 区間/);
result=null;$('#planBuild').onclick();assert.equal(result,null);
$('#planCancelExclusion').onclick();assert.match($('#planCount').textContent,/8 本/);assert.equal($('#planBuild').disabled,false);
click(40,40);click(200,140);$('#planApplyExclusion').onclick();assert.match($('#planCount').textContent,/4 本/);assert.match($('#planExcludedCount').textContent,/1 か所/);
$('#planUndo').onclick();assert.match($('#planCount').textContent,/8 本/);assert.equal($('#planExcludedCount').textContent,'');
$('#planRedo').onclick();assert.match($('#planCount').textContent,/4 本/);assert.match($('#planExcludedCount').textContent,/1 か所/);
$('#planDetect').onclick();assert.match($('#planCount').textContent,/4 本/);assert.match($('#planExcludedCount').textContent,/1 か所/);
$('#planShowOriginal').checked=true;$('#planShowOriginal').onchange();const noEdit=$('#planCount').textContent;
$('#planTool').value='erase';click(21,90);assert.equal($('#planCount').textContent,noEdit); // original-only mode cannot invisibly edit
$('#planShowOriginal').checked=false;
// Cropping keeps the reviewed vectors and exclusion, rather than detecting furniture again.
$('#planTool').value='crop';click(10,10);click(230,170);assert.match($('#planCount').textContent,/4 本/);assert.match($('#planExcludedCount').textContent,/1 か所/);
$('#planDetect').onclick();assert.match($('#planCount').textContent,/4 本/);
$('#planBuild').onclick();assert.equal(result.walls.length,4);
// A failed replacement preserves the exclusion as well as the lines.
await $('#planFile').onchange({target:{files:[invalid],value:'file'}});assert.match($('#planExcludedCount').textContent,/1 か所/);$('#planDetect').onclick();assert.match($('#planCount').textContent,/4 本/);
imagePixels=pixels();await $('#planFile').onchange({target:{files:[file],value:'file'}});assert.equal($('#planExcludedCount').textContent,'');
console.log('PASS: exclusion preview/confirm/cancel, build guard, undo/redo, reanalysis, source-only view, crop preservation and failed-load rollback');

$('#planExclude').onclick();click(10,10);click(60,60);assert.equal($('#planBuild').disabled,true);$('#closePlanImport').onclick();$('#openPlanImport').onclick();assert.equal($('#planExclusionReview').hidden,true);assert.equal($('#planBuild').disabled,false);
console.log('PASS: closing an unconfirmed exclusion leaves no stale preview or build lock');

$('#planExclude').onclick();const beforeFirstPointStatus=$('#planStatus').textContent;click(30,30);assert.equal($('#planStatus').textContent,beforeFirstPointStatus);assert.match($('#planCount').textContent,/1点目/);
console.log('PASS: first-point selection does not resize the instructions above the canvas');

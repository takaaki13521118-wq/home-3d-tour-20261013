import {cadVectors,cadPreview,clipCADLines} from './cad-core.mjs';
import {readCAD} from './cad-runtime.mjs';
import {chooseFloorPlanPage} from './plan-pages.mjs';
import {detectWalls,makePlanDesign,closestLine,openParallelWalls} from './plan-core.mjs?v=20261107-cad';
const PDF_BASE='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/';
export function setupPlanImport({onBuild,onOpen,onClose,loadCAD=readCAD,loadPDF=()=>import(PDF_BASE+'build/pdf.mjs')}){
 const $=s=>document.querySelector(s),dialog=$('#planDialog'),canvas=$('#planCanvas'),ctx=canvas.getContext('2d');
 const source=document.createElement('canvas'),sx=source.getContext('2d',{willReadFrequently:true});
 let lines=[],pending=null,pointer=null,pdf=null,pdfTask=null,renderTask=null,epoch=0,busy=false,undo=[],redo=[],hasSource=false,cad=null,cadAbort=null,cadDirty=false;
 const status=t=>{$('#planStatus').textContent=t;};
 const setBusy=v=>{busy=v;$('#planBuild').disabled=v||!lines.length;$('#planDetect').disabled=v||!source.width;$('#planFile').disabled=v;$('#planPage').disabled=v;$('#cadApply').disabled=v;$('#cadLayers').disabled=v;$('#cadUnit').disabled=v;$('#cadScale').disabled=v;};
 function history(){undo.push(JSON.stringify(lines));if(undo.length>30)undo.shift();redo=[];}
 function draw(){
  canvas.hidden=source.width<8;canvas.width=source.width;canvas.height=source.height;ctx.drawImage(source,0,0);ctx.lineWidth=Math.max(2,source.width/400);
  for(const l of lines){ctx.strokeStyle=l.kind==='door'?'#d07a13':l.kind==='window'?'#2283b4':'#e13447';ctx.beginPath();ctx.moveTo(l.x1,l.y1);ctx.lineTo(l.x2,l.y2);ctx.stroke();}
  if(pending){ctx.fillStyle='#305cda';ctx.beginPath();ctx.arc(pending.x,pending.y,6,0,Math.PI*2);ctx.fill();}
  $('#planCount').textContent=`検出・編集済み：${lines.length} 本（赤：壁／橙：出入口／青：窓）`;
  $('#planUndo').disabled=!undo.length;$('#planRedo').disabled=!redo.length;$('#planBuild').disabled=busy||cadDirty||!lines.length;
 }
 function clearEdits(){lines=[];undo=[];redo=[];pending=null;pointer=null;}
 function detect(){
  if(cad){applyCAD();return;}
  const candidate=detectWalls(sx.getImageData(0,0,source.width,source.height),{threshold:+$('#planThreshold').value,minLength:+$('#planMinLength').value,merge:Math.max(2,Math.min(source.width,source.height)*.012),minStroke:$('#planThinLines').checked?1:2});
  history();lines=candidate;pending=null;draw();status(lines.length?'線を自動検出しました。寸法線や家具の線は削除し、実寸を設定して「3Dを作る」を押してください。':'壁の線が見つかりません。読み取り濃さを上げるか、「壁を追加」で補ってください。');
 }
 function applyCAD(){
  try{
   const selected=[...$('#cadLayers').selectedOptions].map(o=>o.value),unit=$('#cadUnit').value;
   const preview=cadPreview(cad,selected,{metresPerUnit:unit==='manual'?null:+unit,paperScale:cad.format==='jww'?+$('#cadScale').value:1});
   source.width=preview.width;source.height=preview.height;sx.fillStyle='white';sx.fillRect(0,0,source.width,source.height);
   sx.lineWidth=1;sx.strokeStyle='#777';for(const l of preview.lines){sx.beginPath();sx.moveTo(l.x1,l.y1);sx.lineTo(l.x2,l.y2);sx.stroke();}
   clearEdits();lines=preview.lines;cadDirty=false;
   $('#planWidth').value=preview.worldWidth===null?'10':preview.worldWidth.toFixed(3);
   draw();status('CADの直線を取り込みました。赤い線・縮尺・横幅を確認し「修正を反映して3Dを表示」を押してください。'+(preview.worldWidth===null?'単位が不明のため横幅10mは仮の値です。2点で実寸を指定してください。':''));
  }catch(e){clearEdits();draw();status(e.message);}
 }
 function showCAD(result){
  cad=cadVectors(result.doc,result);$('#cadOptions').hidden=false;$('#cadLayers').replaceChildren();
  const preferred=cad.layers.filter(l=>l.visible&&/wall|壁|躯体/i.test(l.name));
  for(const layer of cad.layers){const o=document.createElement('option');o.value=layer.name;o.textContent=`${layer.name}（${layer.count}本）`;o.selected=preferred.length?preferred.includes(layer):layer.visible;$('#cadLayers').append(o);}
  $('#cadUnit').value=cad.format==='jww'?'.001':cad.metresPerUnit===null?'manual':String(cad.metresPerUnit);
  // Normalize numeric option values (0.001 rather than .001).
  if(cad.format==='jww')$('#cadUnit').value='0.001';
  $('#cadScale').value='100';$('#cadScaleRow').hidden=cad.format!=='jww';
  const excluded=Object.entries(cad.skipped).map(([type,n])=>`${type} ${n}個`).join('、');
  $('#cadNotice').textContent=[...cad.notices,'曲線・文字・寸法・外部参照・3Dソリッドは壁にしません。斜めの直線とブロック内の直線に対応します。',excluded?'除外した図形：'+excluded:'',cad.format==='jww'?'縮尺は仮に1/100です。原図の縮尺へ変更してください。':'CAD単位が正しいか原図の寸法と照合してください。'].filter(Boolean).join(' ');
  applyCAD();
 }
 function buildPreview(automatic=false){
  if(cadDirty){status('CAD設定を反映してから3Dを作成してください。');return;}
  if(automatic&&(!dialog.open||!$('#planAutoPreview').checked||!lines.length))return;
  try{const d=makePlanDesign(lines,source.width,source.height,{name:$('#planName').value,width:+$('#planWidth').value,height:+$('#planHeight').value,thickness:+$('#planThickness').value,roof:$('#planRoof').value});
   onBuild(d,{automatic});status('3Dを生成しました。ページ・壁線・実寸を確認し、必要に応じて修正して更新してください。');$('#openPlanImport').textContent='図面を選ぶ・読取結果を修正';dialog.close();
  }catch(e){status('3D化できませんでした。壁線と寸法を修正してください。'+e.message);}
 }
 async function renderPage({auto=true}={}){
  const id=++epoch;setBusy(true);status('PDFのページを読み込んでいます…');
  try{const page=await pdf.getPage(+$('#planPage').value);if(id!==epoch)return;const view=page.getViewport({scale:1});const viewport=page.getViewport({scale:Math.min(2,1200/Math.max(view.width,view.height))});source.width=Math.ceil(viewport.width);source.height=Math.ceil(viewport.height);renderTask=page.render({canvasContext:sx,viewport,background:'#ffffff'});await renderTask.promise;if(id!==epoch)return;renderTask=null;clearEdits();detect();if(auto)buildPreview(true);else status('平面図のページを特定できませんでした。上のページ選択から平面図を選んでください。');}catch(e){if(id===epoch){clearEdits();draw();status('PDFを表示できませんでした。画像にして読み込む方法も使えます。');}}finally{if(id===epoch)setBusy(false);}
 }
 async function load(file){
  if(!file)return;if(file.size>25*1024*1024){status('25MB以下のPDF・画像・CADを選んでください。');return;}
  cadAbort?.abort();cadAbort=null;cad=null;cadDirty=false;$('#cadOptions').hidden=true;const id=++epoch;setBusy(true);if(hasSource)$('#planWidth').value='10';hasSource=true;clearEdits();source.width=source.height=1;sx.fillStyle='white';sx.fillRect(0,0,1,1);draw();$('#planName').value=file.name.replace(/\.[^.]+$/,'').slice(0,40);$('#planPageRow').hidden=true;status('図面を読み込んでいます…');
  try{
   renderTask?.cancel();renderTask=null;await pdfTask?.destroy();pdfTask=null;pdf=null;
   if(/\.(dxf|dwg|jww)$/i.test(file.name)){cadAbort=new AbortController();const result=await loadCAD(file,{signal:cadAbort.signal,onProgress:status});if(id!==epoch)return;showCAD(result);return;}
   if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
    status('PDF表示機能を準備しています（初回は通信が必要です）…');
    const lib=await loadPDF();if(id!==epoch)return;
    lib.GlobalWorkerOptions.workerSrc=PDF_BASE+'build/pdf.worker.mjs';
    pdfTask=lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,cMapUrl:PDF_BASE+'cmaps/',cMapPacked:true,standardFontDataUrl:PDF_BASE+'standard_fonts/'});
    pdfTask.onPassword=()=>{pdfTask.destroy();};pdf=await pdfTask.promise;if(id!==epoch)return;
    $('#planPage').replaceChildren();for(let i=1;i<=pdf.numPages;i++){const o=document.createElement('option');o.value=i;o.textContent=`${i} / ${pdf.numPages} ページ`;$('#planPage').append(o);}$('#planPageRow').hidden=false;
    const chosen=await chooseFloorPlanPage(pdf,(n,total)=>status(`平面図のページを探しています… ${n}/${total}`),()=>id===epoch);if(id!==epoch)return;
    $('#planPage').value=String(chosen.pageNumber);await renderPage({auto:chosen.matched||pdf.numPages===1});return;
   }
   if(!/^image\/(png|jpeg|webp)$/.test(file.type)&&!(/\.(png|jpe?g|webp)$/i.test(file.name)))throw Error('PDF・JPG・PNG・WebP・DXF・DWG・JWWに対応しています。');
   const url=URL.createObjectURL(file);
   try{const img=new Image();img.src=url;await img.decode();if(id!==epoch)return;if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>50000000)throw Error('画像が大きすぎます。縮小して読み込んでください。');const scale=Math.min(1,1200/Math.max(img.naturalWidth,img.naturalHeight));source.width=Math.max(8,Math.round(img.naturalWidth*scale));source.height=Math.max(8,Math.round(img.naturalHeight*scale));sx.fillStyle='white';sx.fillRect(0,0,source.width,source.height);sx.drawImage(img,0,0,source.width,source.height);}finally{URL.revokeObjectURL(url);}
   draw();detect();buildPreview(true);
  }catch(e){if(id!==epoch)return;status('読み込めませんでした。'+(e.message||'PDFは通信・パスワード保護の有無も確認してください。'));}finally{if(id===epoch)setBusy(false);}
 }
 function point(e){const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(source.width-1,(e.clientX-r.left)*source.width/r.width)),y:Math.max(0,Math.min(source.height-1,(e.clientY-r.top)*source.height/r.height))};}
 function applyPoint(p){
  const tool=$('#planTool').value;
  if(tool==='crop'||tool==='wall'||tool==='scale'){
   if(!pending){pending=p;draw();status(tool==='crop'?'切り抜く範囲の反対の角をタップしてください。':tool==='scale'?'長さが分かる線のもう一方の端をタップしてください。':'追加する壁のもう一方の端をタップしてください。');return;}
   const a=pending;pending=null;
   if(tool==='crop'){
    const x=Math.floor(Math.min(a.x,p.x)),y=Math.floor(Math.min(a.y,p.y)),w=Math.floor(Math.abs(a.x-p.x)),h=Math.floor(Math.abs(a.y-p.y));if(w<30||h<30)throw Error('切り抜く範囲を広げてください。');
    const pixels=sx.getImageData(x,y,w,h);const previousWidth=source.width;source.width=w;source.height=h;sx.putImageData(pixels,0,0);$('#planWidth').value=(+$('#planWidth').value*w/previousWidth).toFixed(3);const cropped=cad?clipCADLines(lines,x,y,w,h):null;clearEdits();if(cropped){lines=cropped;draw();}else detect();status('切り抜いて再解析しました。寸法を確認してください。元に戻すには図面を再読込してください。');return;
   }
   if(tool==='scale'){const length=Math.hypot(a.x-p.x,a.y-p.y),metres=+$('#planKnownLength').value;if(length<10||!Number.isFinite(metres)||metres<=0)throw Error('既知の長さと2点を確認してください。');$('#planWidth').value=(source.width*metres/length).toFixed(3);draw();status('指定した2点の長さから実寸を設定しました。');return;}
   if(Math.hypot(a.x-p.x,a.y-p.y)<6)throw Error('壁の線をもう少し長くしてください。');history();const horizontal=Math.abs(p.x-a.x)>=Math.abs(p.y-a.y);lines.push({x1:a.x,y1:a.y,x2:cad?p.x:horizontal?p.x:a.x,y2:cad?p.y:horizontal?a.y:p.y,kind:'wall'});
  }else{
   const hit=closestLine(lines,p.x,p.y,Math.max(8,source.width/canvas.getBoundingClientRect().width*15));if(!hit){status('編集する線をタップしてください。');return;}
   if(tool==='erase'){history();lines.splice(hit.index,1);}
   else if(tool==='door'||tool==='window'){const span=(tool==='door'?.9:1.6)*source.width/(+$('#planWidth').value||10);const replacement=openParallelWalls(lines,hit,span,tool,(+$('#planThickness').value||.12)*1.5*source.width/(+$('#planWidth').value||10));history();lines=replacement;}
  }
  draw();status('編集しました。赤い線が実際の壁に合うように調整してください。');
 }
 canvas.addEventListener('pointerdown',e=>{if(busy||pointer!==null)return;e.preventDefault();pointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointerup',e=>{if(e.pointerId!==pointer?.id)return;const start=pointer;pointer=null;if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>12)return;try{applyPoint(point(e));}catch(err){pending=null;draw();status(err.message);}});
 canvas.addEventListener('pointercancel',()=>{pointer=null;pending=null;draw();});
 $('#planFile').onchange=async e=>{const file=e.target.files[0];e.target.value='';await load(file);};$('#planPage').onchange=renderPage;
 $('#planDetect').onclick=()=>{try{detect();}catch(e){status(e.message);}};
 $('#planTool').onchange=()=>{pending=null;draw();status('図面上をタップして編集します。切抜・壁追加・実寸指定は2点を選びます。');};
 $('#planUndo').onclick=()=>{if(!undo.length)return;redo.push(JSON.stringify(lines));lines=JSON.parse(undo.pop());pending=null;draw();};
 $('#planRedo').onclick=()=>{if(!redo.length)return;undo.push(JSON.stringify(lines));lines=JSON.parse(redo.pop());pending=null;draw();};
 $('#cadApply').onclick=()=>{if(!busy&&cad)applyCAD();};
 for(const id of ['cadLayers','cadUnit','cadScale'])$('#'+id).onchange=()=>{cadDirty=true;$('#planBuild').disabled=true;status('設定を変更しました。「CAD設定を反映」で線と実寸を更新してください。');};
 $('#planBuild').onclick=()=>buildPreview(false);
 $('#openPlanImport').onclick=()=>{onOpen();dialog.showModal();};$('#closePlanImport').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{if(busy&&cadAbort){++epoch;cadAbort.abort();cadAbort=null;setBusy(false);status('CADの読み取りを中止しました。もう一度図面を選べます。');}onClose();});
 source.width=source.height=1;sx.fillStyle='white';sx.fillRect(0,0,1,1);draw();$('#planDetect').disabled=true;
}

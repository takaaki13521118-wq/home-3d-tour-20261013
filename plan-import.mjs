import {detectWalls,makePlanDesign,closestLine,addOpening} from './plan-core.mjs';
const PDF_BASE='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/';
export function setupPlanImport({onBuild,onOpen,onClose,loadPDF=()=>import(PDF_BASE+'build/pdf.mjs')}){
 const $=s=>document.querySelector(s),dialog=$('#planDialog'),canvas=$('#planCanvas'),ctx=canvas.getContext('2d');
 const source=document.createElement('canvas'),sx=source.getContext('2d',{willReadFrequently:true});
 let lines=[],pending=null,pointer=null,pdf=null,pdfTask=null,renderTask=null,epoch=0,busy=false,undo=[],redo=[];
 const status=t=>{$('#planStatus').textContent=t;};
 const setBusy=v=>{busy=v;$('#planBuild').disabled=v||!lines.length;$('#planDetect').disabled=v||!source.width;$('#planFile').disabled=v;$('#planPage').disabled=v;};
 function history(){undo.push(JSON.stringify(lines));if(undo.length>30)undo.shift();redo=[];}
 function draw(){
  canvas.hidden=source.width<8;canvas.width=source.width;canvas.height=source.height;ctx.drawImage(source,0,0);ctx.lineWidth=Math.max(2,source.width/400);
  for(const l of lines){ctx.strokeStyle=l.kind==='door'?'#d07a13':l.kind==='window'?'#2283b4':'#e13447';ctx.beginPath();ctx.moveTo(l.x1,l.y1);ctx.lineTo(l.x2,l.y2);ctx.stroke();}
  if(pending){ctx.fillStyle='#305cda';ctx.beginPath();ctx.arc(pending.x,pending.y,6,0,Math.PI*2);ctx.fill();}
  $('#planCount').textContent=`検出・編集済み：${lines.length} 本（赤：壁／橙：出入口／青：窓）`;
  $('#planUndo').disabled=!undo.length;$('#planRedo').disabled=!redo.length;$('#planBuild').disabled=busy||!lines.length;
 }
 function clearEdits(){lines=[];undo=[];redo=[];pending=null;pointer=null;}
 function detect(){
  const candidate=detectWalls(sx.getImageData(0,0,source.width,source.height),{threshold:+$('#planThreshold').value,minLength:+$('#planMinLength').value,merge:Math.max(2,Math.min(source.width,source.height)*.006),minStroke:$('#planThinLines').checked?1:2});
  history();lines=candidate;pending=null;draw();status(lines.length?'線を自動検出しました。寸法線や家具の線は削除し、実寸を設定して「3Dを作る」を押してください。':'壁の線が見つかりません。読み取り濃さを上げるか、「壁を追加」で補ってください。');
 }
 async function renderPage(){
  const id=++epoch;setBusy(true);status('PDFのページを読み込んでいます…');
  try{const page=await pdf.getPage(+$('#planPage').value);if(id!==epoch)return;const view=page.getViewport({scale:1});const viewport=page.getViewport({scale:Math.min(2,1200/Math.max(view.width,view.height))});source.width=Math.ceil(viewport.width);source.height=Math.ceil(viewport.height);renderTask=page.render({canvasContext:sx,viewport,background:'#ffffff'});await renderTask.promise;if(id!==epoch)return;renderTask=null;clearEdits();detect();}catch(e){if(id===epoch){clearEdits();draw();status('PDFを表示できませんでした。画像にして読み込む方法も使えます。');}}finally{if(id===epoch)setBusy(false);}
 }
 async function load(file){
  if(!file)return;if(file.size>25*1024*1024){status('25MB以下のPDF・画像を選んでください。');return;}
  const id=++epoch;setBusy(true);clearEdits();source.width=source.height=1;sx.fillStyle='white';sx.fillRect(0,0,1,1);draw();$('#planName').value=file.name.replace(/\.[^.]+$/,'').slice(0,40);$('#planPageRow').hidden=true;status('図面を読み込んでいます…');
  try{
   renderTask?.cancel();renderTask=null;await pdfTask?.destroy();pdfTask=null;pdf=null;
   if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
    status('PDF表示機能を準備しています（初回は通信が必要です）…');
    const lib=await loadPDF();if(id!==epoch)return;
    lib.GlobalWorkerOptions.workerSrc=PDF_BASE+'build/pdf.worker.mjs';
    pdfTask=lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,cMapUrl:PDF_BASE+'cmaps/',cMapPacked:true,standardFontDataUrl:PDF_BASE+'standard_fonts/'});
    pdfTask.onPassword=()=>{pdfTask.destroy();};pdf=await pdfTask.promise;if(id!==epoch)return;
    $('#planPage').replaceChildren();for(let i=1;i<=pdf.numPages;i++){const o=document.createElement('option');o.value=i;o.textContent=`${i} / ${pdf.numPages} ページ`;$('#planPage').append(o);}$('#planPage').value='1';$('#planPageRow').hidden=false;await renderPage();return;
   }
   if(!/^image\/(png|jpeg|webp)$/.test(file.type)&&!(/\.(png|jpe?g|webp)$/i.test(file.name)))throw Error('PDF・JPG・PNG・WebPに対応しています。');
   const url=URL.createObjectURL(file);
   try{const img=new Image();img.src=url;await img.decode();if(id!==epoch)return;if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>50000000)throw Error('画像が大きすぎます。縮小して読み込んでください。');const scale=Math.min(1,1200/Math.max(img.naturalWidth,img.naturalHeight));source.width=Math.max(8,Math.round(img.naturalWidth*scale));source.height=Math.max(8,Math.round(img.naturalHeight*scale));sx.fillStyle='white';sx.fillRect(0,0,source.width,source.height);sx.drawImage(img,0,0,source.width,source.height);}finally{URL.revokeObjectURL(url);}
   draw();detect();
  }catch(e){status('読み込めませんでした。'+(e.message||'PDFは通信・パスワード保護の有無も確認してください。'));}finally{if(id===epoch)setBusy(false);}
 }
 function point(e){const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(source.width-1,(e.clientX-r.left)*source.width/r.width)),y:Math.max(0,Math.min(source.height-1,(e.clientY-r.top)*source.height/r.height))};}
 function applyPoint(p){
  const tool=$('#planTool').value;
  if(tool==='crop'||tool==='wall'||tool==='scale'){
   if(!pending){pending=p;draw();status(tool==='crop'?'切り抜く範囲の反対の角をタップしてください。':tool==='scale'?'長さが分かる線のもう一方の端をタップしてください。':'追加する壁のもう一方の端をタップしてください。');return;}
   const a=pending;pending=null;
   if(tool==='crop'){
    const x=Math.floor(Math.min(a.x,p.x)),y=Math.floor(Math.min(a.y,p.y)),w=Math.floor(Math.abs(a.x-p.x)),h=Math.floor(Math.abs(a.y-p.y));if(w<30||h<30)throw Error('切り抜く範囲を広げてください。');
    const pixels=sx.getImageData(x,y,w,h);const previousWidth=source.width;source.width=w;source.height=h;sx.putImageData(pixels,0,0);$('#planWidth').value=(+$('#planWidth').value*w/previousWidth).toFixed(3);clearEdits();detect();status('切り抜いて再解析しました。寸法を確認してください。元に戻すには図面を再読込してください。');return;
   }
   if(tool==='scale'){const length=Math.hypot(a.x-p.x,a.y-p.y),metres=+$('#planKnownLength').value;if(length<10||!Number.isFinite(metres)||metres<=0)throw Error('既知の長さと2点を確認してください。');$('#planWidth').value=(source.width*metres/length).toFixed(3);draw();status('指定した2点の長さから実寸を設定しました。');return;}
   if(Math.hypot(a.x-p.x,a.y-p.y)<6)throw Error('壁の線をもう少し長くしてください。');history();const horizontal=Math.abs(p.x-a.x)>=Math.abs(p.y-a.y);lines.push({x1:a.x,y1:a.y,x2:horizontal?p.x:a.x,y2:horizontal?a.y:p.y,kind:'wall'});
  }else{
   const hit=closestLine(lines,p.x,p.y,Math.max(8,source.width/canvas.getBoundingClientRect().width*15));if(!hit){status('編集する線をタップしてください。');return;}
   if(tool==='erase'){history();lines.splice(hit.index,1);}
   else if(tool==='door'||tool==='window'){const span=(tool==='door'?.9:1.6)*source.width/(+$('#planWidth').value||10);const replacement=addOpening(lines[hit.index],hit.t,span,tool);history();lines.splice(hit.index,1,...replacement);}
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
 $('#planBuild').onclick=()=>{try{const d=makePlanDesign(lines,source.width,source.height,{name:$('#planName').value,width:+$('#planWidth').value,height:+$('#planHeight').value,thickness:+$('#planThickness').value,roof:$('#planRoof').value});onBuild(d);dialog.close();}catch(e){status(e.message);}};
 $('#openPlanImport').onclick=()=>{onOpen();dialog.showModal();};$('#closePlanImport').onclick=()=>dialog.close();dialog.addEventListener('close',onClose);
 source.width=source.height=1;sx.fillStyle='white';sx.fillRect(0,0,1,1);draw();$('#planDetect').disabled=true;
}

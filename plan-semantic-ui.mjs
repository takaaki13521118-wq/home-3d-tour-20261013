import {traceRooms,inPolygon,polygonBounds,checkPolygon,interiorPoint} from './plan-topology.mjs?v=20261128-rooms';
import {semanticKinds,suggestSpaces,inspectRegion,approvedAnnotations,restoreAnnotations} from './plan-semantic.mjs?v=20261128-rooms';
import {recognizePlan} from './plan-ocr.mjs?v=20261128-rooms';
export function setupSemanticReview({getSource,getLines,changed,setTool,previewExclusion,readOCR=recognizePlan}){
 const $=s=>document.querySelector(s);let candidates=[],selected=null,busy=false,abort=null,job=0,pdfTokens=[],drawing=[];
 const selectedCandidate=()=>candidates.find(c=>c.id===selected);
 function render(){
  const src=getSource();$('#semanticAnalyze').disabled=busy||!src.canRead;$('#semanticAdd').disabled=busy||src.width<8;$('#semanticCancel').hidden=!busy;
  $('#semanticList').replaceChildren();for(const c of candidates){const b=document.createElement('button');b.type='button';b.textContent=`${c.state==='accepted'?'✓':c.state==='rejected'?'除外':'要確認'} ${c.name}`;b.style.borderLeft=`8px solid ${semanticKinds[c.kind].color}`;b.setAttribute?.('aria-pressed',String(selected===c.id));b.onclick=()=>{selected=c.id;render();changed();};$('#semanticList').append(b);}
  const c=selectedCandidate();$('#semanticDetails').hidden=!c;
  if(c){$('#semanticName').value=c.name;$('#semanticKind').value=c.kind;$('#semanticEvidence').textContent=`${c.evidence}${c.confidence?'／文字認識スコア '+c.confidence+'%（部屋判定の確率ではありません）':''}。${inspectRegion(c,getLines()).message}`;}
  for(const id of ['semanticTrace','semanticPolygon','semanticFinish','semanticName','semanticKind','semanticRect','semanticAccept','semanticReject','semanticInner'])$('#'+id).disabled=busy||!c;
  $('#semanticFinish').disabled=busy||drawing.length<3;$('#semanticFinishCanvas').disabled=busy||drawing.length<3;$('#semanticFinishCanvas').textContent='輪郭を閉じる'+(drawing.length?'（'+drawing.length+'点）':'');$('#semanticUndoPoint').disabled=busy||!drawing.length;$('#semanticCancelShape').disabled=busy||!drawing.length;$('#semanticInner').disabled=busy||!c||!!c.polygon&&c.polygon.length!==4;
  const pending=candidates.filter(c=>c.state==='pending').length;$('#semanticSummary').textContent=candidates.length?`候補 ${candidates.length} 件／確認待ち ${pending} 件。各候補の名称・色の範囲・赤い線を確認してください。`:'候補はまだありません。文字を読み取るか、手動で追加できます。';
 }
 function change(){render();changed();}
 function cancel(){job++;abort?.abort();abort=null;busy=false;render();changed();}
 async function analyze(){
  const src=getSource();if(busy||!src.canRead)return;
  if(candidates.length&&!window.confirm('文字と記号を読み直し、候補の確認状態を置き換えますか？ 壁の編集は保持します。'))return;
  drawing=[];const id=++job;abort=new AbortController();busy=true;change();$('#semanticMessage').textContent='文字と記号を読み取っています…';
  try{let tokens=pdfTokens;let next=suggestSpaces(tokens,getLines(),src.width,src.height);
   if(!tokens.length||!next.some(c=>c.evidence==='図面の文字')){tokens=await readOCR(src.canvas,{signal:abort.signal,onProgress:t=>{if(id===job)$('#semanticMessage').textContent=t;}});}
   if(id!==job)return;candidates=suggestSpaces(tokens,getLines(),src.width,src.height);selected=candidates[0]?.id??null;
   $('#semanticMessage').textContent=candidates.length?'色は仮の範囲です。家具・畳・階段の線はまだ削除していません。壁と出入口を照合して1件ずつ確認してください。':'名称を読み取れませんでした。拡大・切り抜き後の再試行、または「候補を手動追加」を使ってください。';
  }catch(e){if(id===job)$('#semanticMessage').textContent='文字を読み取れませんでした。候補と壁の編集を保持しました。通信を確認して再試行するか、手動で候補を追加してください。';}
  finally{if(id===job){busy=false;abort=null;change();}}
 }
 $('#semanticAnalyze').onclick=analyze;$('#semanticCancel').onclick=()=>{cancel();$('#semanticMessage').textContent='読み取りを中止しました。再試行できます。';};
 $('#semanticAdd').onclick=()=>{if(busy)return;const s=getSource();if(candidates.length>=60)return;const x=s.width/2,y=s.height/2;candidates.push({id:'manual'+Date.now()+candidates.length,name:'部屋',kind:'room',x,y,rect:{left:x-s.width*.1,right:x+s.width*.1,top:y-s.height*.1,bottom:y+s.height*.1},state:'pending',closed:false,confidence:0,evidence:'手動追加'});selected=candidates.at(-1).id;change();setTool('semantic');$('#semanticMessage').textContent='図面上で、この空間を囲む対角2点を選んでください。';};
 $('#semanticName').oninput=()=>{const c=selectedCandidate();if(!c)return;c.name=$('#semanticName').value.trim().slice(0,32);c.state='pending';changed();};
 $('#semanticName').onchange=change;
 $('#semanticKind').onchange=()=>{const c=selectedCandidate();if(c){c.kind=$('#semanticKind').value;c.state='pending';change();}};
 $('#semanticTrace').onclick=()=>{const c=selectedCandidate(),src=getSource();if(!c)return;const r=traceRooms(getLines(),src.width,src.height).filter(r=>inPolygon(r.polygon,c.x,c.y)).sort((a,b)=>a.area-b.area)[0];if(!r){$('#semanticMessage').textContent='壁の囲みがつながっていません。出入口を指定するか「部屋の角を順に指定」で輪郭を作ってください。';return;}Object.assign(c,{polygon:r.polygon,rect:polygonBounds(r.polygon),holes:r.holes.length,closed:true,state:'pending'});change();};
 $('#semanticPolygon').onclick=()=>{drawing=[];setTool('roomPolygon');$('#semanticMessage').textContent='壁の中心に沿って部屋の角を順にタップしてください。最後に「輪郭を閉じる」を押します。居間とキッチンが一続きなら一つの輪郭にします。';};
 $('#semanticFinish').onclick=()=>{const c=selectedCandidate();if(!c)return;try{checkPolygon(drawing);const point=interiorPoint(drawing);if(!point)throw Error('輪郭の内側を確認できません。');Object.assign(c,{polygon:[...drawing],rect:polygonBounds(drawing),...point,state:'pending',closed:true,evidence:'輪郭を手動指定'});drawing=[];setTool('pan');change();$('#semanticMessage').textContent='輪郭を閉じました。原図と重ねて確認・採用してください。';}catch(e){$('#semanticMessage').textContent=e.message;}};
 $('#semanticFinishCanvas').onclick=()=>$('#semanticFinish').onclick();$('#semanticUndoPoint').onclick=()=>{drawing.pop();change();};$('#semanticCancelShape').onclick=()=>{drawing=[];setTool('pan');change();};
 $('#semanticRect').onclick=()=>{setTool('semantic');$('#semanticMessage').textContent='候補範囲の左上と右下を図面上で選んでください。赤い壁線は変更しません。';};
 $('#semanticAccept').onclick=()=>{const c=selectedCandidate();if(!c||!c.name){$('#semanticMessage').textContent='名称を入力してください。';return;}if(!c.polygon){$('#semanticMessage').textContent='先に壁に沿った輪郭を読むか、部屋の角・範囲を指定してください。';return;}c.state='accepted';change();};
 $('#semanticReject').onclick=()=>{const c=selectedCandidate();if(c){c.state='rejected';change();}};
 $('#semanticInner').onclick=()=>{const c=selectedCandidate();if(!c)return;const r=c.rect,pad=Math.max(4,Math.min(r.right-r.left,r.bottom-r.top)*.08);if(r.right-r.left<=pad*2||r.bottom-r.top<=pad*2)return;previewExclusion({left:r.left+pad,right:r.right-pad,top:r.top+pad,bottom:r.bottom-pad});$('#semanticMessage').textContent='候補の内側の線を灰色にしました。実際の間仕切り壁が含まれることがあります。線を確認してから除外を反映してください。';};
 return {
  analyze,cancel,render,
  candidates(){return structuredClone(candidates);},
  addPoint(p){if(drawing.length>=160)throw Error('輪郭は160点までです。');const corners=[...getLines().flatMap(l=>[{x:l.x1,y:l.y1},{x:l.x2,y:l.y2}]),...candidates.flatMap(c=>c.polygon??[])];const near=corners.filter(a=>Math.hypot(a.x-p.x,a.y-p.y)<getSource().width*.008).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];drawing.push(near??p);change();},
  get busy(){return busy;},get isDrawing(){return drawing.length>0;},get pending(){return drawing.length>0||candidates.some(c=>c.state==='pending');},
  reviewPending(){const c=candidates.find(c=>c.state==='pending');if(!c)return;selected=c.id;change();$('#semanticDetails').scrollIntoView?.({block:'start',behavior:'instant'});},
  setPDF(tokens){pdfTokens=tokens;},
  snapshot(){return {candidates:structuredClone(candidates),selected,pdfTokens:structuredClone(pdfTokens)};},
  restore(s){drawing=[];candidates=s?.candidates??[];selected=s?.selected??null;pdfTokens=s?.pdfTokens??[];render();},
  reset(){cancel();drawing=[];candidates=[];selected=null;pdfTokens=[];$('#semanticMessage').textContent='①文字・記号 → ②色の範囲 → ③壁・出入口を照合 → ④確認して3D化';render();},
  invalidate(){for(const c of candidates)if(c.state==='accepted'){c.state='pending';c.closed=false;}render();},
  crop(x,y,w,h){candidates=candidates.filter(c=>c.x>=x&&c.x<=x+w&&c.y>=y&&c.y<=y+h).map(c=>({...c,polygon:undefined,x:c.x-x,y:c.y-y,state:'pending',rect:{left:Math.max(0,c.rect.left-x),top:Math.max(0,c.rect.top-y),right:Math.min(w,c.rect.right-x),bottom:Math.min(h,c.rect.bottom-y)}}));pdfTokens=[];selected=candidates[0]?.id??null;render();},
  loadAnnotations(a){const s=getSource();candidates=restoreAnnotations(a,s.width,s.height);selected=candidates[0]?.id??null;render();},
  annotations(){const s=getSource();return approvedAnnotations(candidates,s.width,s.height);},
  setRect(a,b){const c=selectedCandidate();if(!c)return;const rect={left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)};if(rect.right-rect.left<8||rect.bottom-rect.top<8)throw Error('候補範囲をもう少し広く指定してください。');Object.assign(c,{polygon:[{x:rect.left,y:rect.top},{x:rect.right,y:rect.top},{x:rect.right,y:rect.bottom},{x:rect.left,y:rect.bottom}],rect,x:(rect.left+rect.right)/2,y:(rect.top+rect.bottom)/2,state:'pending',closed:false,evidence:'範囲を手動修正'});change();},
  draw(ctx){for(const c of candidates){if(c.state==='rejected')continue;const r=c.rect,color=semanticKinds[c.kind].color;ctx.fillStyle=color+'28';if(!c.polygon)ctx.fillRect(r.left,r.top,r.right-r.left,r.bottom-r.top);ctx.strokeStyle=color;ctx.lineWidth=c.id===selected?4:2;ctx.beginPath();const p=c.polygon??[{x:r.left,y:r.top},{x:r.right,y:r.top},{x:r.right,y:r.bottom},{x:r.left,y:r.bottom}];ctx.moveTo(p[0].x,p[0].y);for(const a of [...p.slice(1),p[0]])ctx.lineTo(a.x,a.y);if(c.polygon)ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.font=Math.max(12,getSource().width/75)+'px sans-serif';ctx.fillText?.(c.name+(c.state==='accepted'?' ✓':' ?'),r.left+3,r.top+16);}if(drawing.length){ctx.strokeStyle='#7442b0';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(drawing[0].x,drawing[0].y);for(const p of drawing)ctx.lineTo(p.x,p.y);ctx.stroke();}},
 };
}

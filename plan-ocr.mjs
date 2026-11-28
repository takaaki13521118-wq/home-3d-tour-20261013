let attempt=0;
export const OCR_VERSION='6.0.1';
// Remove long horizontal/vertical rules only in the OCR copy, never in the plan.
export function textOnlyImage(image){
 const {width:w,height:h}=image,data=new Uint8ClampedArray(image.data),mask=new Uint8Array(w*h),threshold=Math.max(45,Math.max(w,h)*.055);
 const ink=i=>data[i*4]<180&&data[i*4+1]<180&&data[i*4+2]<180&&data[i*4+3]>100;
 for(const horizontal of [true,false]){const rows=horizontal?h:w,cols=horizontal?w:h;for(let row=0;row<rows;row++){let start=-1;for(let col=0;col<=cols;col++){const i=horizontal?row*w+col:col*w+row;if(col<cols&&ink(i)){if(start<0)start=col;}else if(start>=0){if(col-start>=threshold)for(let k=start;k<col;k++)for(let d=-1;d<=1;d++){const r=row+d;if(r>=0&&r<rows)mask[horizontal?r*w+k:k*w+r]=1;}start=-1;}}}}
 for(let i=0;i<mask.length;i++)if(mask[i])data.fill(255,i*4,i*4+4);return {width:w,height:h,data};
}
export function ocrTokens(data,scale=1){const out=[];let id=0;for(const block of data.blocks??[])for(const paragraph of block.paragraphs??[])for(const line of paragraph.lines??[]){id++;for(const word of line.words??[])if(word.bbox)out.push({text:word.text,line:id,confidence:word.confidence,bbox:Object.fromEntries(Object.entries(word.bbox).map(([k,v])=>[k,v/scale]))});}return out;}
export async function recognizePlan(source,{signal,onProgress=()=>{},load=()=>import('https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.esm.min.js?attempt='+attempt)}={}){
 let worker,timer,abort,ended=false;const stopped=()=>{if(ended||signal?.aborted)throw Error('読み取りを中止しました。');};
 const cancelled=new Promise((_,reject)=>{abort=()=>{worker?.terminate().catch(()=>{});reject(Error('読み取りを中止しました。'));};signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>{worker?.terminate().catch(()=>{});reject(Error('文字の読み取りが時間内に完了しませんでした。図面を小さく切り抜いて再試行してください。'));},120000);});
 try{return await Promise.race([cancelled,(async()=>{stopped();const lib=await load();stopped();worker=await (lib.default??lib).createWorker('jpn+eng',1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',logger:m=>onProgress(m.status==='recognizing text'?`文字を読み取り中… ${Math.round((m.progress||0)*100)}%`:'文字認識を準備しています（初回は通信が必要です）…')});if(ended||signal?.aborted){await worker.terminate().catch(()=>{});throw Error('読み取りを中止しました。');}
  await worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});stopped();
  const enlarged=document.createElement('canvas'),scale=Math.min(2,2400/Math.max(source.width,source.height));enlarged.width=Math.round(source.width*scale);enlarged.height=Math.round(source.height*scale);enlarged.getContext('2d').drawImage(source,0,0,enlarged.width,enlarged.height);
  const context=enlarged.getContext('2d');if(context.getImageData){const image=context.getImageData(0,0,enlarged.width,enlarged.height),clean=textOnlyImage(image);image.data.set(clean.data);context.putImageData(image,0,0);}
  const {data}=await worker.recognize(enlarged,{}, {blocks:true,text:true});stopped();const cleanTokens=ocrTokens(data,scale);
  onProgress('元画像の文字も照合しています…');context.drawImage(source,0,0,enlarged.width,enlarged.height);const raw=await worker.recognize(enlarged,{}, {blocks:true,text:true});stopped();const combined=[...cleanTokens,...ocrTokens(raw.data,scale).map(t=>({...t,line:'original-'+t.line}))];
  // Overlapping crops give small Japanese labels their own recognition context.
  if(Math.max(source.width,source.height)>800){let tile=0;for(const fy of [0,.4])for(const fx of [0,.4]){stopped();onProgress(`小さい文字を部分ごとに照合しています… ${++tile}/4`);const x=Math.round(source.width*fx),y=Math.round(source.height*fy),w=Math.min(source.width-x,Math.ceil(source.width*.6)),h=Math.min(source.height-y,Math.ceil(source.height*.6)),ratio=Math.min(3,1800/Math.max(w,h));enlarged.width=Math.round(w*ratio);enlarged.height=Math.round(h*ratio);context.drawImage(source,x,y,w,h,0,0,enlarged.width,enlarged.height);const part=await worker.recognize(enlarged,{}, {blocks:true,text:true});stopped();combined.push(...ocrTokens(part.data,ratio).map(t=>({...t,line:'tile'+tile+'-'+t.line,bbox:{x0:t.bbox.x0+x,x1:t.bbox.x1+x,y0:t.bbox.y0+y,y1:t.bbox.y1+y}})));}}
  return combined;
 })()]);}catch(e){attempt++;throw e;}finally{ended=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);await worker?.terminate().catch(()=>{});}
}
export async function pdfPlanTokens(page,viewport){
 const content=await page.getTextContent(),t=viewport.transform;if(!Array.isArray(t))return [];
 const out=[];for(const [i,item]of content.items.entries()){const a=item.transform;if(!item.str||!a)continue;const size=Math.hypot(a[0],a[1]);if(!size)continue;const width=item.width||size*item.str.length,dx=a[0]/size*width,dy=a[1]/size*width;
  const points=[[a[4],a[5]],[a[4]+dx,a[5]+dy],[a[4]+a[2],a[5]+a[3]],[a[4]+dx+a[2],a[5]+dy+a[3]]].map(([x,y])=>[t[0]*x+t[2]*y+t[4],t[1]*x+t[3]*y+t[5]]);
  const bbox={x0:Math.max(0,Math.min(...points.map(p=>p[0]))),x1:Math.min(viewport.width,Math.max(...points.map(p=>p[0]))),y0:Math.max(0,Math.min(...points.map(p=>p[1]))),y1:Math.min(viewport.height,Math.max(...points.map(p=>p[1])))};
  if(!Object.values(bbox).every(Number.isFinite)||bbox.x1<=bbox.x0||bbox.y1<=bbox.y0)continue;out.push({text:item.str,line:i,confidence:100,bbox});
 }return out;
}

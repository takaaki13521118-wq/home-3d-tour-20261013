let attempt=0;
export const OCR_VERSION='6.0.1';
export function ocrTokens(data,scale=1){const out=[];let id=0;for(const block of data.blocks??[])for(const paragraph of block.paragraphs??[])for(const line of paragraph.lines??[]){id++;for(const word of line.words??[])if(word.bbox)out.push({text:word.text,line:id,confidence:word.confidence,bbox:Object.fromEntries(Object.entries(word.bbox).map(([k,v])=>[k,v/scale]))});}return out;}
export async function recognizePlan(source,{signal,onProgress=()=>{},load=()=>import('https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.esm.min.js?attempt='+attempt)}={}){
 let worker,timer,abort,ended=false;const stopped=()=>{if(ended||signal?.aborted)throw Error('読み取りを中止しました。');};
 const cancelled=new Promise((_,reject)=>{abort=()=>{worker?.terminate().catch(()=>{});reject(Error('読み取りを中止しました。'));};signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>{worker?.terminate().catch(()=>{});reject(Error('文字の読み取りが時間内に完了しませんでした。図面を小さく切り抜いて再試行してください。'));},120000);});
 try{return await Promise.race([cancelled,(async()=>{stopped();const lib=await load();stopped();worker=await (lib.default??lib).createWorker('jpn+eng',1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',logger:m=>onProgress(m.status==='recognizing text'?`文字を読み取り中… ${Math.round((m.progress||0)*100)}%`:'文字認識を準備しています（初回は通信が必要です）…')});if(ended||signal?.aborted){await worker.terminate().catch(()=>{});throw Error('読み取りを中止しました。');}
  await worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});stopped();
  const enlarged=document.createElement('canvas'),scale=Math.min(2,2400/Math.max(source.width,source.height));enlarged.width=Math.round(source.width*scale);enlarged.height=Math.round(source.height*scale);enlarged.getContext('2d').drawImage(source,0,0,enlarged.width,enlarged.height);
  const {data}=await worker.recognize(enlarged,{}, {blocks:true,text:true});stopped();return ocrTokens(data,scale);
 })()]);}catch(e){attempt++;throw e;}finally{ended=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);await worker?.terminate().catch(()=>{});}
}
export async function pdfPlanTokens(page,viewport){
 const content=await page.getTextContent(),t=viewport.transform;if(!Array.isArray(t))return [];
 const out=[];for(const [i,item]of content.items.entries()){const a=item.transform;if(!item.str||!a)continue;const x=t[0]*a[4]+t[2]*a[5]+t[4],y=t[1]*a[4]+t[3]*a[5]+t[5],scale=Math.hypot(t[0],t[1]),h=Math.hypot(a[2],a[3])*scale,w=(item.width||Math.hypot(a[0],a[1])*item.str.length)*scale;
  if(!Number.isFinite(x+y+w+h)||!w||!h)continue;out.push({text:item.str,line:i,confidence:100,bbox:{x0:Math.max(0,x),x1:Math.min(viewport.width,x+w),y0:Math.max(0,y-h),y1:Math.min(viewport.height,y)}});
 }return out;
}

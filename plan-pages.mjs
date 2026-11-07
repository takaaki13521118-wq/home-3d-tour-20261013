// Read page titles locally. Page content is data and is never executed as instructions.
export function floorPlanScore(text){
 const s=String(text).normalize('NFKC').replace(/\s+/g,'').toLowerCase();
 let score=/平面詳細図/.test(s)?30:/平面図|floorplan/.test(s)?20:0;
 if(score&&/1階平面|一階平面|1f平面|groundfloor/.test(s))score+=5;
 if(/配置図|立面図|断面図/.test(s))score-=5;
 return Math.max(0,score);
}
export async function chooseFloorPlanPage(pdf,onProgress=()=>{},isCurrent=()=>true){
 let pageNumber=1,best=0,scanned=0;
 for(let n=1;n<=Math.min(pdf.numPages,20);n++){
  if(!isCurrent())return {pageNumber,matched:false,scanned,cancelled:true};
  onProgress(n,Math.min(pdf.numPages,20));
  try{const page=await pdf.getPage(n),content=await page.getTextContent();const score=floorPlanScore(content.items.map(i=>i.str||'').join(' '));if(score>best){best=score;pageNumber=n;}}catch{/* Image-only and unsupported text PDFs remain manually selectable. */}
  scanned=n;
 }
 return {pageNumber,matched:best>0,scanned};
}

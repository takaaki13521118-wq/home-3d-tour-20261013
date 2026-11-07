// Pinned, lazily loaded converters. Original drawings never leave the worker.
export function jwwBrowserModule(source){
 const tail="const wasmPath = `${__dirname}/ezjww_wasm_bg.wasm`;\nconst wasmBytes = require('fs').readFileSync(wasmPath);";
 if(!source.includes(tail))throw Error('JWW読取機能の構成を確認できません。');
 const body=source.replace(tail,'').replace('const wasmModule = new WebAssembly.Module(wasmBytes);','const wasmModule = await WebAssembly.compile(wasmBytes);');
 if(/\brequire\s*\(/.test(body)||/\b__dirname\b/.test(body))throw Error('JWW読取機能に非対応の依存があります。');
 return 'export default async function(wasmBytes){\nconst exports={};\n'+body+'\nreturn exports;\n}';
}
export async function convertCADBytes(bytes,format,deps={}){
 const fetchOK=async u=>{const r=await fetch(u);if(!r.ok)throw Error('読取機能をダウンロードできません。通信を確認してください。');return r;};
 const loadJWW=deps.loadJWW||async function(){
  const base='https://cdn.jsdelivr.net/npm/ezjww@0.7.11/wasm/';
  const [source,binary]=await Promise.all([(await fetchOK(base+'ezjww_wasm.js')).text(),(await fetchOK(base+'ezjww_wasm_bg.wasm')).arrayBuffer()]);
  const url=URL.createObjectURL(new Blob([jwwBrowserModule(source)],{type:'text/javascript'}));
  try{return await (await import(url)).default(binary);}finally{URL.revokeObjectURL(url);}
 };
 const notices=[];let text;
 if(format==='dwg'){
  if(!/^AC10\d\d/.test(new TextDecoder().decode(bytes.subarray(0,6))))throw Error('DWGのファイル形式を確認できません。');
  const dwg=await (deps.loadDWG?deps.loadDWG():import('https://cdn.jsdelivr.net/npm/dwgdxf@2.0.1/dist/index.js'));
  const converted=await dwg.convertDwgToDxf(bytes,{wasmBase:'https://cdn.jsdelivr.net/npm/dwgdxf@2.0.1/dist/wasm'});
  text=typeof converted==='string'?converted:new TextDecoder().decode(converted);
  notices.push('DWG内の専用オブジェクト・外部参照・3Dソリッドは再現しません。原図と照合してください。');
 }else if(format==='jww'){
  const j=await loadJWW();if(!j.isJwwFile(bytes))throw Error('JWWのファイル形式を確認できません。');
  const document=j.readDocument(bytes);const conversion=j.readDxfDocument(bytes,true,16);
  text=j.readDxfString(bytes,true,16);
  const diagnostics=document.diagnostics||[];
  if(diagnostics.length)notices.push(`JWWの読み取りに${diagnostics.length}件の注意があります。欠けた線がないか原図と照合してください。`);
  if(conversion.unsupported_entities?.length)notices.push(`JWW変換で${conversion.unsupported_entities.length}個の非対応図形を除外しました。`);
  const scales=[...new Set((document.header?.layer_groups||[]).map(g=>g.scale).filter(n=>Number.isFinite(n)&&n>0))];
  notices.push('JWWは紙上mmです。取り込む平面図の縮尺（例：1/100なら100）を指定してください。');
  if(scales.length)notices.push('ファイル内の縮尺候補：'+scales.map(n=>'1/'+n).join('、'));
 }else{
  if(new TextDecoder().decode(bytes.subarray(0,22)).startsWith('AutoCAD Binary DXF'))throw Error('バイナリDXFは未対応です。CADソフトでASCII DXFとして保存してください。');
  text=new TextDecoder().decode(bytes);
  if(text.includes('\ufffd'))text=new TextDecoder('shift_jis').decode(bytes);
 }
 if(text.length>80*1024*1024)throw Error('変換後の図面が大きすぎます。1フロアに分けてください。');
 const Parser=deps.DxfParser||(await import('https://cdn.jsdelivr.net/npm/dxf-parser@1.1.2/+esm')).default;
 const doc=new Parser().parseSync(text);
 if(!doc?.entities?.length)throw Error('CAD内に平面図の図形が見つかりません。');
 if(doc.entities.length>100000)throw Error('図形が多すぎます。壁レイヤーだけに分けてください。');
 return {doc,format,notices};
}
export async function readCAD(file,{signal,onProgress=()=>{}}={}){
 if(typeof Worker==='undefined')throw Error('このブラウザーはCAD読取に対応していません。Safari・Chromeで開いてください。');
 const format=file.name.split('.').pop().toLowerCase();
 const buffer=await file.arrayBuffer();if(signal?.aborted)throw new DOMException('読取を中止しました','AbortError');
 const code=jwwBrowserModule.toString()+'\n'+convertCADBytes.toString()+`\nonmessage=async e=>{try{const r=await convertCADBytes(new Uint8Array(e.data.buffer),e.data.format);postMessage({result:r});}catch(error){postMessage({error:String(error?.message||error)});}};`;
 const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
 return new Promise((resolve,reject)=>{
  let worker,timer;
  const cleanup=()=>{clearTimeout(timer);worker?.terminate();URL.revokeObjectURL(url);signal?.removeEventListener('abort',abort);};
  const fail=e=>{cleanup();reject(e);};
  const abort=()=>fail(new DOMException('読取を中止しました','AbortError'));
  try{worker=new Worker(url,{type:'module'});signal?.addEventListener('abort',abort,{once:true});
   timer=setTimeout(()=>fail(Error('読取が60秒を超えました。1フロアに分けるかDXF・PDFに書き出してください。')),60000);
   worker.onmessage=e=>{cleanup();e.data.error?reject(Error(e.data.error)):resolve(e.data.result);};
   worker.onerror=()=>fail(Error('CAD読取機能を起動できません。通信・ブラウザーを確認するか、DXF・PDFで再読込してください。'));
   onProgress('CADを端末内で解析しています。初回は読取機能のダウンロードに時間がかかります…');
   worker.postMessage({buffer,format},[buffer]);
  }catch(e){fail(e);}
 });
}

import assert from 'node:assert/strict';
import {setupDesignLibrary} from '../design-library-ui.mjs';
import {readLibrary,LIBRARY_KEY} from '../design-library.mjs';
class Element{constructor(){this.value='';this.children=[];this.handlers={};}append(o){this.children.push(o);}replaceChildren(){this.children=[];}addEventListener(k,f){this.handlers[k]=f;}showModal(){this.open=true;}close(){this.open=false;this.handlers.close?.();}}
const els=new Map(),$=s=>{if(!els.has(s))els.set(s,new Element());return els.get(s);};
globalThis.document={querySelector:$,createElement:()=>new Element()};
const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
let model={version:1,name:'保存A',width:10,depth:9,height:2.6,bedrooms:2,ratio:.45,side:'north',roof:'shed',wall:'#778855',roofColor:'#aa7744'},opened=0,closed=0,loaded,downloaded,notice;
setupDesignLibrary({getDesign:()=>model,onLoad:d=>loaded=d,onDownload:d=>downloaded=d,onOpen:()=>opened++,onClose:()=>closed++,notify:t=>notice=t,getStorage:()=>storage});
$('#saveDesign').onclick();model={...model,name:'保存B',width:12};$('#saveDesign').onclick();assert.equal(readLibrary(storage).items.length,2);
$('#loadDesign').onclick();assert.equal(opened,1);assert.equal($('#libraryDialog').open,true);assert.equal($('#libraryName').value,'保存B');assert.equal($('#librarySelect').children.length,2);
$('#libraryName').value='比較用';$('#libraryRename').onclick();assert.equal(readLibrary(storage).items[0].design.name,'比較用');assert.equal(model.name,'保存B');
$('#libraryExport').onclick();assert.equal(downloaded.name,'比較用');$('#libraryDelete').onclick();assert.equal($('#libraryRestore').disabled,false);$('#libraryExportDeleted').onclick();assert.equal(downloaded.name,'比較用');
$('#libraryRestore').onclick();assert.equal($('#libraryName').value,'比較用');$('#libraryOpen').onclick();assert.equal(loaded.name,'比較用');assert.equal(closed,1);
$('#loadDesign').onclick();const selected=$('#librarySelect').value;storage.setItem(LIBRARY_KEY,JSON.stringify({version:1,items:[],deleted:null}));loaded=null;$('#libraryOpen').onclick();assert.equal(loaded,null);assert.match($('#libraryStatus').textContent,/見つかりません/);
$('#closeLibrary').onclick();storage.setItem(LIBRARY_KEY,'bad');$('#loadDesign').onclick();assert.equal($('#libraryOpen').disabled,true);assert.match($('#libraryStatus').textContent,/変更していません/);assert.equal(storage.getItem(LIBRARY_KEY),'bad');
console.log('PASS: library dialog save/list/rename/export/delete/restore/load, stale selection and damaged storage');

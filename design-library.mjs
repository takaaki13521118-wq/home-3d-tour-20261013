import {validateDesign} from './house-core.mjs?v=20261107-cad';
export const LIBRARY_KEY='home3dSavedDesignsV1';
export const LIBRARY_LIMIT=20;
const clone=v=>JSON.parse(JSON.stringify(v));
const blank=()=>({version:1,items:[],deleted:null});
function entry(v){
 if(!v||typeof v.id!=='string'||!v.id.length||v.id.length>100||!Number.isSafeInteger(v.savedAt)||v.savedAt<0||v.savedAt>8640000000000000)throw Error('保存一覧の形式を読み取れません。既存データは変更していません。');
 return {id:v.id,savedAt:v.savedAt,design:validateDesign(v.design)};
}
export function readLibrary(storage){
 const raw=storage.getItem(LIBRARY_KEY);
 if(raw!==null){
  if(raw.length>2000000)throw Error('保存一覧が大きすぎます。既存データは変更していません。');
  let v;try{v=JSON.parse(raw);}catch{throw Error('保存一覧を読み取れません。既存データは変更していません。');}
  if(v?.version!==1||!Array.isArray(v.items)||v.items.length>LIBRARY_LIMIT)throw Error('保存一覧の形式が不正です。');
  const items=v.items.map(entry),deleted=v.deleted?entry(v.deleted):null;
  if(new Set(items.map(i=>i.id)).size!==items.length||deleted&&items.some(i=>i.id===deleted.id))throw Error('保存一覧の識別情報が重複しています。');
  return {version:1,items,deleted};
 }
 const old=storage.getItem('houseDesignV1');if(old===null)return blank();
 if(old.length>200000)throw Error('以前の保存モデルが大きすぎます。');
 try{return {version:1,items:[{id:'legacy',savedAt:0,design:validateDesign(JSON.parse(old))}],deleted:null};}catch{throw Error('以前の保存モデルを読み取れません。既存データは変更していません。');}
}
function write(storage,library){
 try{storage.setItem(LIBRARY_KEY,JSON.stringify(library));}catch{throw Error('端末に保存できません。「モデルを書き出す」でファイルに保存してください。');}
 return clone(library);
}
export function saveToLibrary(storage,design,{id=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2),now=Date.now()}={}){
 const d=validateDesign(design),library=readLibrary(storage),same=library.items.find(i=>JSON.stringify(i.design)===JSON.stringify(d));
 if(same){write(storage,library);return {id:same.id,duplicate:true};}
 if(library.items.length>=LIBRARY_LIMIT)throw Error('保存できるのは20件までです。不要な案を一覧から削除するか、モデルを書き出してください。');
 if(library.items.some(i=>i.id===id)||library.deleted?.id===id)throw Error('保存番号が重複しました。もう一度保存してください。');
 library.items.unshift(entry({id,savedAt:now,design:d}));write(storage,library);return {id,duplicate:false};
}
export function renameInLibrary(storage,id,name){
 const library=readLibrary(storage),item=library.items.find(i=>i.id===id),value=String(name).trim();
 if(!item)throw Error('選んだ案が見つかりません。一覧を開き直してください。');
 if(!value||value.length>40)throw Error('名前は1〜40文字で入力してください。');
 item.design.name=value;return write(storage,library);
}
export function deleteFromLibrary(storage,id){
 const library=readLibrary(storage),item=library.items.find(i=>i.id===id);if(!item)throw Error('選んだ案が見つかりません。');
 library.items=library.items.filter(i=>i.id!==id);library.deleted=item;return write(storage,library);
}
export function restoreDeletedDesign(storage){
 const library=readLibrary(storage);if(!library.deleted)throw Error('取り消せる削除はありません。');
 if(library.items.length>=LIBRARY_LIMIT)throw Error('20件保存されています。削除した案は「削除した案を書き出す」でファイルに退避できます。');
 library.items.unshift(library.deleted);library.deleted=null;return write(storage,library);
}

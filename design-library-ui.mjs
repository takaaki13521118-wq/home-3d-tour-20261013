import {readLibrary,saveToLibrary,renameInLibrary,deleteFromLibrary,restoreDeletedDesign} from './design-library.mjs';
export function setupDesignLibrary({getDesign,onLoad,onDownload,onOpen,onClose,notify,getStorage=()=>localStorage}){
 const $=s=>document.querySelector(s),dialog=$('#libraryDialog'),select=$('#librarySelect');
 const status=t=>{$('#libraryStatus').textContent=t;};
 let library={items:[],deleted:null};
 const selected=()=>library.items.find(i=>i.id===select.value);
 function details(){
  const item=selected();for(const id of ['libraryOpen','libraryExport','libraryRename','libraryDelete'])$('#'+id).disabled=!item;
  $('#libraryName').disabled=!item;$('#libraryName').value=item?.design.name||'';
  $('#libraryRestore').disabled=$('#libraryExportDeleted').disabled=!library.deleted;
  $('#libraryDetail').textContent=item?`${item.design.version===2?'図面から作成':'条件から作成'} · ${item.design.width.toFixed(2)} × ${item.design.depth.toFixed(2)} m · 壁高 ${item.design.height.toFixed(2)} m`: '保存した案はまだありません。家を作成して「案を追加保存」を押してください。';
  $('#libraryRestore').textContent=library.deleted?`削除を取り消す：${library.deleted.design.name||'名前なし'}`:'削除を取り消す';
 }
 function refresh(preferred=select.value){
  library=readLibrary(getStorage());select.replaceChildren();
  for(const item of library.items){const option=document.createElement('option');option.value=item.id;option.textContent=`${item.design.name||'名前なし'} — ${item.savedAt?new Date(item.savedAt).toLocaleString('ja-JP'):'以前の保存案'}`;select.append(option);}
  select.value=library.items.some(i=>i.id===preferred)?preferred:library.items[0]?.id||'';select.disabled=!library.items.length;
  $('#libraryCount').textContent=`${library.items.length} / 20件`;details();
 }
 function action(run){try{run();}catch(e){status(e.message||'処理できませんでした。');}}
 $('#saveDesign').onclick=()=>{try{const d=getDesign();if(!d)return;const result=saveToLibrary(getStorage(),d);notify(result.duplicate?'同じ内容の案は保存済みです。':'別の案として端末に追加保存しました。');}catch(e){notify(e.message||'保存できません。モデルを書き出してください。');}};
 $('#loadDesign').onclick=()=>{
  status('案を選ぶと寸法を確認できます。「この案を開く」で3Dを表示します。');
  try{refresh();}catch(e){library={items:[],deleted:null};select.replaceChildren();select.value='';select.disabled=true;$('#libraryCount').textContent='読込エラー';details();status(e.message||'端末の保存機能を利用できません。');}
  onOpen();dialog.showModal();
 };
 select.onchange=details;
 $('#libraryOpen').onclick=()=>action(()=>{const item=readLibrary(getStorage()).items.find(i=>i.id===select.value);if(!item)throw Error('選んだ案が見つかりません。');onLoad(item.design);dialog.close();});
 $('#libraryExport').onclick=()=>action(()=>{const item=readLibrary(getStorage()).items.find(i=>i.id===select.value);if(!item)throw Error('選んだ案が見つかりません。');onDownload(item.design);status('選んだ案をファイルに書き出しました。');});
 $('#libraryRename').onclick=()=>action(()=>{renameInLibrary(getStorage(),select.value,$('#libraryName').value);refresh();status('保存した案の名前を変更しました。表示中の3Dは変更していません。');});
 $('#libraryDelete').onclick=()=>action(()=>{deleteFromLibrary(getStorage(),select.value);refresh();status('一覧から削除しました。直前の1件は「削除を取り消す」で戻せます。');});
 $('#libraryRestore').onclick=()=>action(()=>{const restored=restoreDeletedDesign(getStorage());refresh(restored.items[0].id);status('削除した案を復元しました。');});
 $('#libraryExportDeleted').onclick=()=>action(()=>{const item=readLibrary(getStorage()).deleted;if(!item)throw Error('削除した案はありません。');onDownload(item.design);status('削除した案をファイルに書き出しました。「モデルを読込」で開けます。');});
 $('#closeLibrary').onclick=()=>dialog.close();dialog.addEventListener('close',onClose);
}

import {openingCandidates,wallsFromRooms,roomConnections} from './plan-topology.mjs?v=20261128-rooms';
export function setupTopologyReview({getState,getImage=()=>null,replaceLines,changed}){
 const $=s=>document.querySelector(s);let openings=[],preview=null,signature='',connections=null,selectedOpening=-1;
 const message=t=>{$('#topologyMessage').textContent=t;};
 function render(){const s=getState();const next=JSON.stringify([s.lines,s.candidates,s.scale,s.scaleY]);if(next!==signature){signature=next;preview=null;openings=[];connections=roomConnections(s.candidates,s.lines,s.scale,s.scaleY);}
  $('#topologyApply').hidden=!preview;$('#topologyCancel').hidden=!preview;
  const waiting=s.candidates.filter(c=>c.state==='pending').length,hasOutline=s.candidates.some(c=>c.state==='accepted'&&c.polygon);$('#topologyRebuild').disabled=s.busy||!hasOutline||!!waiting;$('#topologyBuildReason').textContent=waiting?`部屋候補 ${waiting} 件が確認待ちです。輪郭を確認・採用するか、使わない候補を除外してください。`:!hasOutline?'先に部屋の輪郭を確認・採用してください。':'';
  $('#topologyFindDoors').disabled=s.busy||!s.lines.length;
  $('#topologyApply').disabled=s.busy;$('#topologyCancel').disabled=s.busy;
  $('#topologyOpenings').replaceChildren();for(const [i,o]of openings.entries()){
   const row=document.createElement('div');row.className='openingRow';const label=document.createElement('p');label.textContent=`候補 ${i+1}：幅 ${o.width.toFixed(2)} m（${o.evidence}）`;row.append(label);const locate=document.createElement('button');locate.type='button';locate.textContent='図面で位置を確認';locate.onclick=()=>{selectedOpening=i;changed();$('#planViewport').scrollIntoView?.({block:'center',behavior:'instant'});};row.append(locate);
   for(const [name,kind]of [['出入口にする','door'],['窓にする','window'],['使わない',null]]){const b=document.createElement('button');b.type='button';b.textContent=name;b.disabled=s.busy;b.onclick=()=>{if(!kind){openings.splice(i,1);render();changed();return;}try{replaceLines(null,{opening:{...o,kind}});message('開口部を追加しました。部屋候補の輪郭とつながりを再確認してください。');}catch(e){message(e.message);}changed();};row.append(b);}$('#topologyOpenings').append(row);
  }
  if(connections){$('#topologyConnections').textContent=`空間 ${connections.groups} ／ 接続 ${connections.links.length}\n`+connections.links.map(l=>l.text+`（${l.width.toFixed(2)} m）`).join('\n');$('#topologyIssues').textContent=connections.groups?(connections.issues.join('\n')||'出入口の不足は検出されていません。原図との照合は必要です。'):'部屋の輪郭が未確認です。先に部屋の輪郭を読み取るか、角を指定してください。';}
 }
 $('#topologyFindDoors').onclick=()=>{const s=getState();openings=openingCandidates(s.lines,s.scale,s.scaleY,getImage());preview=null;message(openings.length?'紫の点線は出入口の候補です。原図のドア・引き戸・窓と見比べて種類を選んでください。実寸が仮のままだと候補の幅も変わります。':'壁の切れ目から候補が見つかりませんでした。「ドア・通り道を追加（2点）」で原図の位置を指定できます。');render();changed();};
 $('#topologyRebuild').onclick=()=>{try{const s=getState();preview=wallsFromRooms(s.candidates,s.lines.filter(l=>l.kind!=='wall'));message(`確認した部屋の輪郭から ${preview.length} 本の壁・開口を作りました。赤い線が置き換え後です。家具・畳などの内側の線と、採用した部屋の外の線は引き継ぎません。全ての部屋・収納・階段を囲めているか確認して「この2D間取りを採用」を押してください。`);connections=roomConnections(s.candidates,preview,s.scale,s.scaleY);render();changed();}catch(e){message(e.message);}};
 $('#topologyApply').onclick=()=>{if(!preview)return;const lines=preview;preview=null;replaceLines(lines,{keepCandidates:true});message('確認した2D間取りを採用しました。この壁と開口部を3D表示と移動判定の両方に使います。「戻す」で以前の線に戻せます。');changed();};
 $('#topologyCancel').onclick=()=>{preview=null;signature='';render();message('壁の組み直しを取り消しました。元の線は変更していません。');changed();};
 return {render,get pending(){return !!preview;},get preview(){return preview;},reset(){openings=[];preview=null;signature='';},draw(ctx){for(const [i,o]of openings.entries()){ctx.strokeStyle='#793ca6';ctx.lineWidth=i===selectedOpening?8:3;ctx.setLineDash?.([8,4]);ctx.beginPath();ctx.moveTo(o.x1,o.y1);ctx.lineTo(o.x2,o.y2);ctx.stroke();ctx.setLineDash?.([]);ctx.fillStyle='#793ca6';ctx.fillText?.(String(i+1),(o.x1+o.x2)/2,(o.y1+o.y2)/2-5);}}};
}

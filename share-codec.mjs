import {validateDesign} from './house-core.mjs?v=20261107-cad';
// Compact, versioned floor-plan fragment. Coordinates are stored at 0.1 mm.
const SCALE=10000;
const kinds=['wall','door','window'];
export function encodePlanFragment(input){
 const d=validateDesign(input);if(d.version!==2)throw Error('図面モデルだけを短縮できます。');
 const bytes=[1];
 const unsigned=value=>{let n=Math.round(value);if(!Number.isSafeInteger(n)||n<0||n>1_000_000)throw Error('共有する寸法が範囲外です。');do{let b=n&127;n=Math.floor(n/128);bytes.push(n?b|128:b);}while(n);};
 const signed=value=>{const n=Math.round(value*SCALE);if(!Number.isSafeInteger(n)||Math.abs(n)>1_000_000)throw Error('共有する座標が範囲外です。');unsigned(n<0?-2*n-1:2*n);};
 for(const n of [d.width,d.depth,d.height,d.thickness])unsigned(n*SCALE);
 bytes.push(d.roof==='flat'?1:0);
 for(let i=1;i<7;i+=2)bytes.push(Number.parseInt(d.wall.slice(i,i+2),16));
 const name=new TextEncoder().encode(d.name);unsigned(name.length);bytes.push(...name);unsigned(d.walls.length);
 for(const w of d.walls){for(const n of [w.x1,w.z1,w.x2,w.z2])signed(n);bytes.push(kinds.indexOf(w.kind));}
 let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
 return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function decodePlanFragment(fragment){
 if(typeof fragment!=='string'||fragment.length>12000||!/^[A-Za-z0-9_-]+$/.test(fragment))throw Error('共有リンクの形式が不正です。');
 let bytes;try{const binary=atob(fragment.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((fragment.length+3)%4));bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));}catch{throw Error('共有リンクを読み取れません。');}
 let pos=0;const byte=()=>{if(pos>=bytes.length)throw Error('共有リンクが途中で切れています。');return bytes[pos++];};
 const unsigned=()=>{let value=0,factor=1;for(let i=0;i<5;i++){const b=byte();value+=(b&127)*factor;if(value>1_000_000)throw Error('共有リンクの数値が不正です。');if(!(b&128))return value;factor*=128;}throw Error('共有リンクの数値が長すぎます。');};
 const signed=()=>{const n=unsigned();return (n%2?-(n+1)/2:n/2)/SCALE;};
 if(byte()!==1)throw Error('この共有リンクの版に対応していません。');
 const [width,depth,height,thickness]=[unsigned(),unsigned(),unsigned(),unsigned()].map(n=>n/SCALE);
 const roofCode=byte();if(roofCode>1)throw Error('屋根の指定が不正です。');const roof=roofCode?'flat':'none';
 const wall='#'+[byte(),byte(),byte()].map(n=>n.toString(16).padStart(2,'0')).join('');
 const nameLength=unsigned();if(nameLength>160||pos+nameLength>bytes.length)throw Error('名前の長さが不正です。');
 const name=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(pos,pos+nameLength));pos+=nameLength;
 const count=unsigned();if(count<1||count>400)throw Error('壁の本数が不正です。');
 const walls=[];for(let i=0;i<count;i++){const [x1,z1,x2,z2]=[signed(),signed(),signed(),signed()];const kind=kinds[byte()];if(!kind)throw Error('壁の種類が不正です。');walls.push({x1,z1,x2,z2,kind});}
 if(pos!==bytes.length)throw Error('共有リンクに余分なデータがあります。');
 return validateDesign({version:2,name,width,depth,height,thickness,roof,wall,walls});
}
export function shareURL(href,design){
 const base=href.split('#')[0];if(!design)return base;
 const d=validateDesign(design);
 return d.version===2?base+'#plan='+encodePlanFragment(d):base+'#design='+encodeURIComponent(JSON.stringify(d));
}
export function designFromHash(hash){
 if(hash.startsWith('#plan='))return decodePlanFragment(hash.slice(6));
 if(hash.startsWith('#design='))return validateDesign(JSON.parse(decodeURIComponent(hash.slice(8))));
 return null;
}

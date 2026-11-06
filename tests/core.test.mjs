import assert from 'node:assert/strict';
import {validateDesign,layoutRooms,slideMove} from '../house-core.mjs';
const base={version:1,name:'test',width:10,depth:9,height:2.6,bedrooms:2,ratio:.45,side:'north',roof:'shed',wall:'#778855',roofColor:'#aa7744'};
for(const bedrooms of [1,2,3])for(const side of ['north','south'])for(const width of [7,18])for(const depth of [7,16]){
 const d=validateDesign({...base,bedrooms,side,width,depth}),{rooms}=layoutRooms(d);assert.equal(rooms.length,bedrooms+3);let area=0;
 for(const r of rooms){assert(r.x2>r.x1&&r.z2>r.z1);area+=(r.x2-r.x1)*(r.z2-r.z1);}assert(Math.abs(area-width*depth)<1e-8);
 for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){const a=rooms[i],b=rooms[j];assert(Math.min(a.x2,b.x2)<=Math.max(a.x1,b.x1)+1e-9||Math.min(a.z2,b.z2)<=Math.max(a.z1,b.z1)+1e-9);}
}
for(const invalid of [{width:NaN},{bedrooms:1.5},{wall:'red'},{depth:100},{version:99}])assert.throws(()=>validateDesign({...base,...invalid}));
assert.deepEqual(validateDesign(JSON.parse(JSON.stringify(base))),base);
const pos=slideMove(0,0,2,1,x=>!(x>.4&&x<.6));assert(pos.x<.4);assert(Math.abs(pos.z-1)<1e-8);
console.log('24 layouts: area, overlap, validation, save round-trip, wall sliding: PASS');

const {createDesignHistory,designShareURL,interiorStartRoom}=await import('../house-core.mjs');
const history=createDesignHistory(3);
assert.equal(history.canUndo,false);history.push(base);history.push({...base,width:12});
assert.deepEqual(history.undo(),base);assert.equal(history.canRedo,true);
assert.equal(history.undo(),null);assert.deepEqual(history.redo(),base);
history.push({...base,depth:10});assert.equal(history.canRedo,false);
const snapshot=history.undo();snapshot.width=99;assert.equal(history.redo().depth,10);assert.equal(history.undo().width,10);
history.push(base);assert.equal(history.canRedo,true); // unchanged builds preserve redo
history.redo();history.push(null);assert.equal(history.redo(),null);assert.equal(history.undo().depth,10);
assert.equal(history.undo().width,10);assert.equal(history.canUndo,false); // bounded history
assert.throws(()=>history.push({...base,width:100}));
const oldURL='https://example.test/house/#design=old';
assert.equal(designShareURL(oldURL,null),'https://example.test/house/');
assert.deepEqual(JSON.parse(decodeURIComponent(designShareURL(oldURL,base).split('#design=')[1])),base);
assert.equal(interiorStartRoom(null),'living');assert.equal(interiorStartRoom(base),'customLiving');
console.log('History, branching, bounded snapshots, share URL and interior entry: PASS');

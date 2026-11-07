import assert from 'node:assert/strict';
import {makePlanDesign,planEditorSnapshot,planSegmentMetres} from '../plan-core.mjs';
for(const [width,depth]of [[10.123,8.237],[1,60],[60,1],[7.12345,9.87654]]){
 const d={version:2,name:'復元',width,depth,height:2.7,thickness:.18,wall:'#123456',roof:'flat',walls:[{x1:-width/2,z1:-depth/2,x2:width/2,z2:depth/2,kind:'wall'},{x1:0,z1:-.4,x2:0,z2:.4,kind:'door'},{x1:-.4,z1:0,x2:.4,z2:0,kind:'window'}]};
 const e=planEditorSnapshot(d);assert(e.pixelWidth<=1000&&e.pixelHeight<=1000);assert(e.pixelWidth>=8&&e.pixelHeight>=8);
 const restored=makePlanDesign(e.lines,e.pixelWidth,e.pixelHeight,d);assert.equal(restored.width,width);assert.equal(restored.depth,depth);assert.equal(restored.wall,d.wall);assert.equal(restored.roof,d.roof);
 for(let i=0;i<d.walls.length;i++){assert.equal(restored.walls[i].kind,d.walls[i].kind);for(const k of ['x1','x2','z1','z2'])assert(Math.abs(restored.walls[i][k]-d.walls[i][k])<=.000051);}
 const l=e.lines[0];assert(Math.abs(planSegmentMetres({x:l.x1,y:l.y1},{x:l.x2,y:l.y2},e.pixelWidth,e.pixelHeight,width,depth)-Math.hypot(width,depth))<1e-9);
 e.lines[0].x1=99999;assert.equal(d.walls[0].x1,-width/2);
 assert.throws(()=>makePlanDesign(e.lines,e.pixelWidth,e.pixelHeight,d));
}
assert.throws(()=>planEditorSnapshot({version:1}));
console.log('PASS: model/editor round trip, extreme aspect ratios, physical distances, boundary rounding and isolation');

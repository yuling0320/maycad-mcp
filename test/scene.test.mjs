import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createCipheriv } from 'node:crypto';
import { createScene, createFrame, addProfile, editProfile, inspectScene, encodeScene, decodeScene } from '../src/scene.mjs';
import { sceneForSharing } from '../src/share.mjs';

test('600x400x500 frame has 12 profiles, exact bounds and no intersecting material', () => {
  const doc=createFrame({width_mm:600,depth_mm:400,height_mm:500});
  const parts=inspectScene(decodeScene(Buffer.from(encodeScene(doc)))).objects;
  assert.equal(parts.length,12);
  assert.deepEqual(parts.map(p=>p.length_mm).sort((a,b)=>a-b),[320,320,320,320,500,500,500,500,520,520,520,520]);
  const boxes=parts.map(p=>p.origin_mm.map((v,i)=>p.direction[i] ? [v,p.end_mm[i]] : [v-20,v+20]));
  assert.deepEqual([0,1,2].map(i=>Math.min(...boxes.map(b=>b[i][0]))),[0,0,0]);
  assert.deepEqual([0,1,2].map(i=>Math.max(...boxes.map(b=>b[i][1]))),[600,500,400]);
  for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++) {
    assert.ok(![0,1,2].every(i=>Math.min(boxes[a][i][1],boxes[b][i][1])-Math.max(boxes[a][i][0],boxes[b][i][0])>0),`overlap ${a},${b}`);
  }
});
test('profile edits preserve unrelated XML and handle escaping and world translation',()=>{
  const d=createScene('A < B & C');
  addProfile(d,{length_mm:200,axis:'x',origin_mm:[10,20,30]});
  d.documentElement.appendChild(d.createElement('future_metadata')).textContent='keep';
  editProfile(d,{id:'1',length_mm:350,translate_mm:[20,-10,50],name:'铝型材 & <test>'});
  const copy=decodeScene(Buffer.from(encodeScene(d)));
  const p=inspectScene(copy).objects[0];
  assert.equal(p.name,'铝型材 & <test>');
  assert.deepEqual(p.origin_mm,[30,10,80]);
  assert.deepEqual(p.end_mm,[380,10,80]);
  assert.equal(copy.getElementsByTagName('future_metadata')[0].textContent,'keep');
});
test('legacy encoded file decoding and malformed inputs',()=>{
  const xml=Buffer.from(encodeScene(createScene()));
  const padded=Buffer.concat([xml,Buffer.alloc((8-xml.length%8)%8,32)]);
  const c=createCipheriv('des-ede3',Buffer.from('28.04.20'.repeat(3)),null);c.setAutoPadding(false);
  assert.equal(inspectScene(decodeScene(Buffer.concat([c.update(padded),c.final()]))).object_count,0);
  assert.throws(()=>decodeScene(Buffer.from('not a scene')));
  assert.throws(()=>decodeScene(Buffer.from('<?xml version="1.0"?><!DOCTYPE scene><scene><objects/></scene>')),/DTD/);
  assert.throws(()=>decodeScene(Buffer.from('<?xml version="1.0"?><scene><objects></scene>')));
  assert.throws(()=>createFrame({width_mm:40,depth_mm:400,height_mm:500}));
});
test('geometry editing refuses connection relationships',()=>{
  const d=createScene();addProfile(d,{length_mm:100});
  const conn=d.createElement('connectorset');
  for(const [tag,value] of [['src_id','1'],['dst_id','2']]){const n=d.createElement(tag);n.textContent=value;conn.appendChild(n);}
  d.getElementsByTagName('connection_data')[0].appendChild(conn);
  assert.throws(()=>editProfile(d,{id:'1',length_mm:200}),/connections/);
});
test('installed legacy sample can be read when MayCAD is installed',async t=>{
  let b;try{b=await fs.readFile('C:/Program Files/MayTec/MayCad-64/samples/Simple Stand.scene');}catch{t.skip('MayCAD sample absent');return;}
  const s=inspectScene(decodeScene(b));assert.equal(s.profile_count,5);assert.equal(s.connection_count,4);
});
test('MayCAD 11.200 save roundtrip retains all 12 lengths and 16 connections',async()=>{
  const b=await fs.readFile(new URL('../examples/frame-600x400x500.scene',import.meta.url));
  const s=inspectScene(decodeScene(b));
  assert.equal(s.format_version,'14');
  assert.equal(s.profile_count,12);assert.equal(s.connection_count,16);
  assert.deepEqual(s.objects.filter(p=>p.type==='Profile').map(p=>p.length_mm).sort((a,b)=>a-b),[320,320,320,320,500,500,500,500,520,520,520,520]);
});

test('distribution removes device/session/author metadata and preserves geometry and connections',async()=>{
  const original=decodeScene(await fs.readFile(new URL('../examples/frame-600x400x500.scene',import.meta.url)));
  for(const [key,value] of [['software_computer_id','private-device'],['software_session_id','private-session'],['AuthorEmail','private@example.invalid'],['AuthorUUID','private-author']]){
    const el=original.createElement(key);el.textContent=value;original.documentElement.appendChild(el);
  }
  const shared=sceneForSharing(Buffer.from(encodeScene(original)));
  assert.doesNotMatch(shared,/private-device|private-session|private@example\.invalid|private-author|<Author|<software_(computer|session)_id/);
  const copy=decodeScene(Buffer.from(shared));
  assert.deepEqual(inspectScene(copy),inspectScene(original));
  for(const tag of ['objects','connection_data','JSON']) {
    assert.equal(copy.getElementsByTagName(tag)[0]?.toString(),original.getElementsByTagName(tag)[0]?.toString());
  }
});

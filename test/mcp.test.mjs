import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

test('stdio MCP: discover, create, edit, inspect, validate paths and prevent overwrites', {timeout:20000}, async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const output=path.join(root,'test-output');await fs.mkdir(output,{recursive:true});
  const work=await fs.mkdtemp(path.join(output,'run-'));
  const c=new Client({name:'maycad-test',version:'1.0.0'});
  const transport=new StdioClientTransport({command:process.execPath,args:[path.join(root,'src/server.mjs')],env:{...process.env,MAYCAD_WORKSPACE:work},stderr:'pipe'});
  let stderr='';transport.stderr.on('data',b=>stderr+=b);
  try{
    await c.connect(transport);
    assert.equal((await c.listTools()).tools.length,7);
    const call=(name,args)=>c.callTool({name,arguments:args});
    let r=await call('maycad_create_frame',{output:'frame.scene',width_mm:600,depth_mm:400,height_mm:500});
    assert.ok(!r.isError,JSON.stringify(r));assert.equal(JSON.parse(r.content[0].text).profile_count,12);
    const original=await fs.readFile(path.join(work,'frame.scene'),'utf8');
    r=await call('maycad_edit_profile',{path:'frame.scene',output:'edit.scene',id:'1',length_mm:650,translate_mm:[10,0,0]});
    assert.ok(!r.isError,JSON.stringify(r));
    r=await call('maycad_inspect_scene',{path:'edit.scene'});
    assert.equal(JSON.parse(r.content[0].text).objects[0].length_mm,650);
    assert.equal(await fs.readFile(path.join(work,'frame.scene'),'utf8'),original);
    assert.ok((await call('maycad_create_scene',{output:'frame.scene',profiles:[]})).isError);
    assert.ok((await call('maycad_create_scene',{output:'../escape.scene',profiles:[]})).isError);
    assert.ok((await call('maycad_create_scene',{output:'bad.scene',profiles:[{length_mm:-1}]})).isError);
    assert.ok((await call('maycad_edit_profile',{path:'frame.scene',output:'bad.scene',id:'999',length_mm:10})).isError);
    assert.equal(stderr,'');
  }finally{await c.close();}
});

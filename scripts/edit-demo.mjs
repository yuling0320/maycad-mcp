import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';

const client=new Client({name:'maycad-demo',version:'1.0.0'});
try {
  await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../src/server.mjs',import.meta.url))]}));
  const result=await client.callTool({name:'maycad_edit_profile',arguments:{path:'examples/frame-600x400x500-generated.scene',output:'examples/frame-edited.scene',id:'1',length_mm:650,name:'MCP edited post 650mm'}});
  if(result.isError)throw new Error(result.content[0].text);
  const data=JSON.parse(result.content[0].text);
  console.log(JSON.stringify({path:data.path,edited:data.objects.find(o=>o.id==='1')},null,2));
} finally { await client.close(); }

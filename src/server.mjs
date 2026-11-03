import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { PROFILES, createScene, createFrame, addProfile, editProfile, inspectScene } from './scene.mjs';
import { workspace, readScene, writeScene } from './files.mjs';

const server = new McpServer({ name: 'maycad-mcp', version: '0.1.0' });
const coord = z.number().finite().min(-1000000).max(1000000);
const vector = z.tuple([coord,coord,coord]);
const length = z.number().finite().positive().max(100000);
const profile = z.enum(Object.keys(PROFILES));
const file = z.string().min(1).max(1000).describe('Path inside MAYCAD_WORKSPACE. Output must be a new .scene file; its parent must exist.');
const part = z.object({ profile: profile.default('PROF40-4040L'), length_mm: length, origin_mm: vector.default([0,0,0]), axis: z.enum(['x','y','z']).default('y'), name: z.string().max(200).optional() });
function register(name, description, schema, handler, readOnly = false) {
  server.registerTool(name, { description, inputSchema: schema, annotations: { readOnlyHint: readOnly, destructiveHint: false, idempotentHint: readOnly, openWorldHint: false } }, async args => {
    try {
      const result = await handler(args);
      return { content: [{type:'text',text:JSON.stringify(result,null,2)}] };
    } catch (error) {
      return { isError: true, content: [{type:'text',text:error.message}] };
    }
  });
}
async function save(output, doc) {
  return { path: await writeScene(output,doc), ...inspectScene(doc), note: 'Native scene written. Open in MayCAD to see it. This does not change the live application; connectors are not generated.' };
}
register('maycad_status','Report workspace and supported capabilities.',z.object({}),async()=>({workspace,version:'0.1.0',mode:'native-scene-files',units:'mm',vertical_axis:'y',live_ui_control:false,connectors:false,formats:['XML scene','legacy encoded scene (read)']}),true);
register('maycad_list_profiles','List the small set of profile IDs verified in installed MayCAD samples; not the complete catalogue.',z.object({}),async()=>PROFILES,true);
register('maycad_inspect_scene','Read a native MayCAD scene and list objects, profile lengths and transforms in mm.',z.object({path:file}),async a=>inspectScene(await readScene(a.path)),true);
register('maycad_create_scene','Create a new native scene from profiles. Origin is the centre of the starting end; local Y is the extrusion axis. All input dimensions are mm.',z.object({output:file,title:z.string().max(200).default('MayCAD MCP model'),profiles:z.array(part).max(2000)}),async a=>{
  const doc=createScene(a.title); for(const p of a.profiles)addProfile(doc,p); return save(a.output,doc);
});
register('maycad_create_frame','Create a 12-profile rectangular frame with exterior X width, Z depth and Y height in mm. Posts are full height; rails fit between posts. Square profiles only; no connectors.',z.object({output:file,width_mm:length,depth_mm:length,height_mm:length,profile:profile.default('PROF40-4040L'),title:z.string().max(200).default('Rectangular frame')}),async a=>save(a.output,createFrame(a)));
register('maycad_add_profile','Add a profile to a saved scene and write a new file. Does not calculate joints or connections.',z.object({path:file,output:file,part}),async a=>{
  const doc=await readScene(a.path); addProfile(doc,a.part); return save(a.output,doc);
});
register('maycad_edit_profile','Change profile length from its starting end, translate in world coordinates, or rename. Writes a new file. Geometry changes require simple disconnected profiles; attached or parametric assemblies are rejected.',z.object({path:file,output:file,id:z.string().min(1),length_mm:length.optional(),translate_mm:vector.optional(),name:z.string().max(200).optional()}).refine(a=>a.length_mm!==undefined||a.translate_mm!==undefined||a.name!==undefined,'Specify at least one edit'),async a=>{
  const doc=await readScene(a.path); editProfile(doc,a); return save(a.output,doc);
});

await server.connect(new StdioServerTransport());

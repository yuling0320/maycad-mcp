import fs from 'node:fs/promises';
import { createFrame } from '../src/scene.mjs';
import { writeScene, workspace } from '../src/files.mjs';
await fs.mkdir(`${workspace}/examples`,{recursive:true});
console.log(await writeScene('examples/frame-600x400x500.scene',createFrame({width_mm:600,depth_mm:400,height_mm:500,title:'MCP 600x400x500 test frame'})));

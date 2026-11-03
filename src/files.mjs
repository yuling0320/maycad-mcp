import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeScene, encodeScene } from './scene.mjs';

export const workspace = path.resolve(process.env.MAYCAD_WORKSPACE || fileURLToPath(new URL('../', import.meta.url)));
function within(root, target) {
  const rel = path.relative(root, target);
  return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}
export async function scenePath(name, writing = false) {
  if (typeof name !== 'string' || !name || name.includes('\0')) throw new Error('Invalid scene path');
  const target = path.resolve(workspace, name);
  if (!within(workspace, target) || path.extname(target).toLowerCase() !== '.scene') throw new Error('Use a .scene file inside MAYCAD_WORKSPACE');
  const rootReal = await fs.realpath(workspace);
  if (writing) {
    // Parents must already exist. This avoids following junctions while creating folders.
    const parentReal = await fs.realpath(path.dirname(target));
    if (!within(rootReal, parentReal)) throw new Error('Output parent escapes workspace');
  } else {
    if (!within(rootReal, await fs.realpath(target))) throw new Error('Input escapes workspace');
  }
  return target;
}
export async function readScene(name) {
  const p = await scenePath(name);
  const stat = await fs.stat(p);
  if (!stat.isFile() || stat.size > 20*1024*1024) throw new Error('Invalid scene file or file exceeds 20 MB');
  return decodeScene(await fs.readFile(p));
}
export async function writeScene(name, doc) {
  const p = await scenePath(name, true);
  const data = encodeScene(doc);
  // Reparse before writing; wx makes accidental overwrite impossible.
  decodeScene(Buffer.from(data));
  await fs.writeFile(p, data, { encoding: 'utf8', flag: 'wx' });
  return p;
}

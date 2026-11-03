// Create a relocatable directory from the installed dependency graph.
// Fail on multiple versions of one package instead of silently flattening them.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sceneForSharing } from '../src/share.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const target = path.join(root, 'dist', `maycad-mcp-${pkg.version}-portable`);
await fs.mkdir(path.dirname(target), { recursive: true });
await fs.mkdir(target); // Refuse to overwrite an existing export.

const included = [
  'src', 'test', 'examples', 'package.json', 'pnpm-lock.yaml',
  'INSTALL-zh-CN.md', 'configure.cmd', 'scripts/configure.mjs',
  'scripts/export-package.mjs', 'scripts/demo.mjs', 'scripts/edit-demo.mjs',
];
for (const file of included) {
  await fs.mkdir(path.dirname(path.join(target, file)), { recursive: true });
  await fs.cp(path.join(root, file), path.join(target, file), { recursive: true, dereference: true });
}
for (const dir of ['examples']) {
  for (const name of await fs.readdir(path.join(target, dir))) {
    if (!name.endsWith('.scene')) continue;
    const file = path.join(target, dir, name);
    await fs.writeFile(file, sceneForSharing(await fs.readFile(file)));
  }
}

async function resolvePackage(from, name) {
  let current = from;
  for (;;) {
    const candidate = path.join(current, 'node_modules', name);
    try {
      await fs.access(path.join(candidate, 'package.json'));
      return await fs.realpath(candidate);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(current);
    if (parent === current) throw new Error(`Missing dependency: ${name}`);
    current = parent;
  }
}
const packages = new Map();
async function collect(from, name) {
  const source = await resolvePackage(from, name);
  const metadata = JSON.parse(await fs.readFile(path.join(source, 'package.json'), 'utf8'));
  const previous = packages.get(name);
  if (previous) {
    if (previous.version !== metadata.version) throw new Error(`Cannot flatten multiple versions of ${name}`);
    return;
  }
  packages.set(name, { name, version: metadata.version, license: metadata.license, source });
  for (const dep of Object.keys(metadata.dependencies || {})) await collect(source, dep);
  for (const dep of Object.keys(metadata.optionalDependencies || {})) {
    try { await resolvePackage(source, dep); } catch (error) {
      if (error.message.startsWith('Missing dependency:')) continue;
      throw error;
    }
    await collect(source, dep);
  }
}
for (const name of Object.keys(pkg.dependencies)) await collect(root, name);
for (const item of packages.values()) {
  const dest = path.join(target, 'node_modules', item.name);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.cp(item.source, dest, { recursive: true, dereference: true,
    filter: source => !path.relative(item.source, source).split(path.sep).some(p => p === 'node_modules' || p === '.git'),
  });
}
await fs.writeFile(path.join(target, 'DEPENDENCIES.json'), JSON.stringify(
  [...packages.values()].map(({ source, ...metadata }) => metadata), null, 2) + '\n');
await fs.copyFile(path.join(target, 'INSTALL-zh-CN.md'), path.join(target, 'README.md'));
console.log(JSON.stringify({ directory: target, dependencies: packages.size }, null, 2));

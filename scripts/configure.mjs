// Run on the destination computer after extracting the portable package.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

if (Number(process.versions.node.split('.')[0]) < 22) {
  throw new Error('Node.js 22 or newer is required.');
}
const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(process.execPath, ['--test', 'test/scene.test.mjs', 'test/mcp.test.mjs'], {
  cwd: root, stdio: 'inherit', windowsHide: true,
});
if (result.error) throw result.error;
if (result.status !== 0) throw new Error('Self-check failed; configuration was not generated.');

const command = process.execPath;
const serverPath = path.join(root, 'src', 'server.mjs');
const workspace = path.resolve(root);
const config = { mcpServers: { maycad: {
  command, args: [serverPath], env: { MAYCAD_WORKSPACE: workspace },
} } };
// JSON quoted strings are also valid TOML basic strings for these paths.
const toml = `[mcp_servers.maycad]\ncommand = ${JSON.stringify(command)}\nargs = [${JSON.stringify(serverPath)}]\n\n[mcp_servers.maycad.env]\nMAYCAD_WORKSPACE = ${JSON.stringify(workspace)}\n`;
await fs.writeFile(path.join(root, 'mcp.generated.json'), JSON.stringify(config, null, 2) + '\n');
await fs.writeFile(path.join(root, 'codex.generated.toml'), toml);
console.log('\n配置已生成：mcp.generated.json / codex.generated.toml');
console.log('Codex：把 codex.generated.toml 中的 maycad 配置合并到用户的 .codex/config.toml。');
console.log('若已有同名 maycad 配置，请替换该段，避免重复；保留其他服务设置。');
console.log('本脚本没有修改任何客户端配置。重新移动文件夹后，请再次运行。');


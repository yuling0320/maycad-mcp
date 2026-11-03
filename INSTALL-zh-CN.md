# MayCAD MCP 安装说明

公开仓库提供通用 MCP 源码、测试和矩形框架示例。猫柜设计未包含在公开版本中。

## 安装步骤

1. 安装 Node.js 22 或以上版本。查看和编辑模型还需单独安装 MayCAD；本项目在 Windows MayCAD 11.200.00 中验证过。
2. 克隆仓库或使用 Code → Download ZIP 完整解压，在项目目录安装依赖：

```sh
git clone https://github.com/yuling0320/maycad-mcp.git
cd maycad-mcp
npm install
node scripts/configure.mjs
```

如使用锁文件，可用 `pnpm install --frozen-lockfile` 替代 `npm install`。Windows 安装依赖后，也可双击 `configure.cmd` 运行自检和生成配置。

3. Codex：将生成的 `codex.generated.toml` 合并到用户的 `.codex/config.toml`；设置了 CODEX_HOME 时使用该目录的 config.toml。已有 maycad 配置时替换该服务段，保留其他设置。其他支持 mcpServers JSON 的客户端可合并 `mcp.generated.json`。
4. 重启客户端或重新连接 MCP，调用 `maycad_status`，确认工作目录是这台电脑上的项目目录。

配置器只生成配置，不自动修改客户端设置。移动文件夹后需重新运行配置器并更新客户端路径。

[Codex 官方 MCP 配置说明](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

## 验证

> 用 MayCAD MCP 创建宽 600、深 400、高 500 mm 的框架，另存为 install-check.scene。

在 MayCAD 打开生成的文件查看。再次验证需换一个新文件名，工具不会覆盖已有文件。所有文件限定在 MAYCAD_WORKSPACE 中，父目录需已存在。

当前提供 7 个工具：状态、型材目录、读取场景、创建型材场景、创建矩形框架、添加型材、修改型材。MCP 是文件接口，不包含屏幕控制，也不会刷新当前打开的场景。已有连接关系的复杂装配会拒绝几何修改。

## 生成便携包

安装依赖后运行 `node scripts/export-package.mjs`。输出位于 `dist/maycad-mcp-0.1.0-portable/`，包含依赖及其许可证。将该目录压缩即可复制给其他电脑；目标电脑仍需 Node.js 22+，无需重新安装 npm 依赖。导出目录已存在时会停止，避免覆盖。

不要把 MayCAD 程序本体或生成的本机配置文件加入公开分发包。框架测试场景已清理设备、会话和作者信息。

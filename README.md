# MayCAD MCP

通过本地 MCP 工具创建、读取和修改 MayCAD 原生 `.scene` 模型。已在 Windows 上的 MayCAD 11.200.00 中验证文件生成、加载、修改和保存回读。

这是独立的非官方项目，格式兼容性来自本地样例和实际加载验证，不是 MayTec 官方公开 API。仓库不包含 MayCAD 程序。

## 安装

需要 **Node.js 22 或以上版本**。查看和编辑模型还需单独安装 MayCAD。

### 从源码安装

GitHub 的 **Code → Download ZIP** 和 `git clone` 得到的是源码，不包含 `node_modules`，需要先安装依赖：

```sh
git clone https://github.com/yuling0320/maycad-mcp.git
cd maycad-mcp
npm install
node scripts/configure.mjs
```

需要严格按锁文件安装时，可用 `pnpm install --frozen-lockfile` 替代 `npm install`。

Codex 使用生成的 TOML 配置；支持 `mcpServers` JSON 的客户端可使用生成的 JSON 配置。移动目录后重新运行配置器并更新客户端中的路径。MCP 使用 stdio，由客户端启动；直接运行 `node src/server.mjs` 后等待输入是正常的。

完整接入步骤见 [安装说明](INSTALL-zh-CN.md)。

## 工具

| 工具 | 功能 |
| --- | --- |
| `maycad_status` | 工作目录、版本、支持范围 |
| `maycad_list_profiles` | 已验证的 4 种型材 ID |
| `maycad_inspect_scene` | 对象、型材长度、位置和方向 |
| `maycad_create_scene` | 用若干型材创建原生场景 |
| `maycad_create_frame` | 创建 12 根型材组成的矩形框架 |
| `maycad_add_profile` | 添加型材并另存新文件 |
| `maycad_edit_profile` | 修改长度、平移或重命名，另存新文件 |

示例提示词：

> 用 MayCAD MCP 创建宽 800、深 500、高 700 mm 的 4040 轻型铝型材框架，保存为 workbench.scene。

> 读取 workbench.scene，把 ID 1 的型材长度改成 850 mm，另存为 workbench-v2.scene。

创建支持 `PROF20-2020`、`PROF40-4040`、`PROF40-4040L`、`PROF40-4080L`，矩形框架使用正方形截面。这不是 MayCAD 的完整目录。

## 坐标与文件约定

- 对外单位为 mm；XML 内部单位为 cm。
- Y 向上，宽度沿 X，深度沿 Z。
- `origin_mm` 是型材起始端截面的中心；改变长度时固定起始端。
- 新增型材沿正向 X、Y 或 Z；自由旋转尚未暴露为工具。
- 文件限制在 `MAYCAD_WORKSPACE` 内；输出文件必须不存在，父目录必须已存在。
- 模型修改始终另存新文件，不覆盖输入。

## 当前限制

MCP 是文件接口：调用后在 MayCAD 打开生成的 `.scene` 查看效果，不会自动刷新当前场景，也不包含鼠标键盘控制功能。界面自动化需要客户端另行具备电脑控制能力。

MCP 不计算或指定连接件。MayCAD 打开模型时可能自动生成连接关系，需要在软件内核查。已有连接件、附件、加工或参数关系的型材会拒绝几何修改；可读取、重命名，或添加新型材。

保留 `*-generated.scene` 原始文件用于继续修改。MayCAD 保存后可能升级为格式 14 并补入连接关系。完整目录、复杂装配编辑、门、STEP 导出尚未实现。源码包含面板辅助模块，目前未注册为 MCP 面板工具。

## 开发与打包

```sh
node --test test/scene.test.mjs test/mcp.test.mjs
node scripts/export-package.mjs
```

测试覆盖真实 stdio MCP 握手、7 个工具的发现、创建/修改/读取调用、路径限制、不覆盖写入、框架几何、XML 保留和格式兼容。

导出脚本生成 `dist/maycad-mcp-0.1.0-portable/`，包含源码、依赖和框架示例。已有导出目录时会停止。将该目录压缩即可分发；打包前不要在其中运行配置器，以免加入本机路径。

原生保存过的框架示例位于 `examples/`。相关源码：`src/server.mjs`、`src/scene.mjs`、`src/panels.mjs`、`src/files.mjs`。

[MCP 官方 SDK](https://github.com/modelcontextprotocol/typescript-sdk) · [Codex MCP 配置说明](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)


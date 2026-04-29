# Agent Toolbox

Agent Toolbox 是一个面向 AI Agent 的工具箱运行时，目标是让 AI 可以通过 API、CLI 和插件机制安全地发现、调用、组合工具。

当前仓库处于 Phase 0：先跑通最小闭环。

```text
插件 manifest -> 工具注册 -> 工具搜索 -> 工具详情 -> 工具执行 -> 审计日志 -> Web 控制台
```

## 当前包含什么

- `apps/api`：Fastify 本地 API 服务。
- `apps/cli`：Commander 开发 CLI，命令名为 `aitbx`。
- `apps/web`：React + Vite Web 控制台，给人操作和演示用。
- `packages/core`：内存版插件注册表、工具运行时、输入校验和审计日志。
- `packages/plugin-sdk`：插件定义辅助包。
- `plugins/json-basic`：Phase 0 示例插件，包含 `json.format` 和 `json.validate`。
- `tests/integration`：Phase 0 集成测试。

## 环境要求

- Node.js 24.x
- pnpm 10.30.3

## 安装与验证

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

## 启动 API

默认 API 端口是 `8787`：

```powershell
pnpm --filter @agent-toolbox/api dev
```

如果 `8787` 被占用，可以换端口，例如：

```powershell
$env:PORT = "18788"
pnpm --filter @agent-toolbox/api dev
```

健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:18788/health
```

## 启动 Web 控制台

Web 控制台默认通过 Vite proxy 访问 API，默认代理目标是：

```text
http://127.0.0.1:18788
```

如果你的 API 正在 `18788` 端口运行，直接启动：

```powershell
pnpm --filter @agent-toolbox/web dev
```

打开：

```text
http://127.0.0.1:5173
```

如果 API 使用其他端口，启动 Web 前设置代理目标：

```powershell
$env:AITBX_API_TARGET = "http://127.0.0.1:8787"
pnpm --filter @agent-toolbox/web dev
```

## Web 操作界面能做什么

Web 界面参考了 MagicalBox 一类在线工具箱的首页、图片压缩页和正则大全页，目标是“人打开就能用”，同时保留 Agent Toolbox 的 API 和审计能力。

当前界面支持：

- 顶部工具栏：品牌、功能列表、全局搜索、刷新、筛选和登录入口。
- 左侧分类：日常应用、查询应用、文档应用、智能应用、图片应用、音频应用、视频应用、文字应用等。
- 首页网格：参考工具箱站点的灰底卡片布局，展示可用工具和规划中工具。
- 页面切换：首页、图片压缩、正则大全、JSON 工具、审计，并支持浏览器前进后退。
- 全局搜索：按图片、正则、JSON、PDF、二维码等关键词查找入口。
- 图片压缩：上传图片后在浏览器本地压缩，支持质量、最大宽高、JPG/PNG/WebP 输出、预览和下载。
- 正则大全：搜索常用正则，编辑/复制表达式，输入测试文本并查看匹配结果。
- API 工具：`json.format`、`json.validate`。
- 审计记录：查看 API 工具调用和浏览器本地工具调用。

## CLI 示例

查看插件：

```powershell
pnpm --filter @agent-toolbox/cli dev -- plugin list
```

搜索工具：

```powershell
pnpm --filter @agent-toolbox/cli dev -- tool search json
```

查看工具：

```powershell
pnpm --filter @agent-toolbox/cli dev -- tool info json.format
```

运行工具：

```powershell
pnpm --filter @agent-toolbox/cli dev -- tool run json.format --json '{"text":"{\"name\":\"aitbx\"}","indent":2}'
```

验证 JSON：

```powershell
pnpm --filter @agent-toolbox/cli dev -- tool run json.validate --json '{"text":"{\"name\":\"aitbx\"}"}'
```

## 文档

- [开发文档](docs/开发文档.md)
- [项目开发计划](docs/PROJECT_PLAN.md)
- [Phase 0 执行计划](docs/PHASE_0_PLAN.md)
- [Phase 0 验证清单](docs/PHASE_0_VALIDATION.md)
- [Web 控制台设计方向](docs/UI_DESIGN_DIRECTIONS.md)
- [多 Agent 开发分工计划](docs/AGENT_DEVELOPMENT_PLAN.md)

## 当前 Phase 0 能力

- 人可以通过 Web 界面搜索工具、压缩图片、测试正则、编辑 JSON 输入、运行工具、查看结果和审计日志。
- AI 或脚本可以通过 API 调用工具。
- 开发者可以通过 CLI 调试工具。
- 运行时会做基础输入校验，并记录工具调用审计。

## 下一步

- Phase 1：持久化插件安装、SQLite 存储、更多 API/CLI 能力。
- Phase 2：File Artifact Service，支持文件上传、下载和 `file_id`。
- Phase 3：PDF、批量图片等真实工具插件。
- Phase 4：AI Gateway，支持低 token 工具搜索和 schema 懒加载。
- Phase 5：MCP 与 Skill 适配。

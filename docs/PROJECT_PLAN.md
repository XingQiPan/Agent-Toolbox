# Agent Toolbox 项目开发计划

本文档把 `docs/开发文档.md` 中的产品愿景拆成可执行的开发阶段。当前项目采用 API-first、CLI-first、Plugin-first 的方向，Phase 0 先完成最小工程闭环，再逐步扩展到文件、AI Gateway、MCP、SDK 和 Web 控制台。

## Phase 0：工程基线与最小工具闭环

目标：

- 建立 TypeScript monorepo 工程骨架。
- 拆分 API、CLI、Core、Plugin SDK 的基本包边界。
- 定义插件 manifest、工具注册、工具搜索、工具执行、权限审批、文件产物、Skill 列表、MCP 适配和审计日志的最小实现。
- 提供 `json-basic` 示例插件，跑通 `json.format` 和 `json.validate`。
- 提供中文 Web 控制台，支持工具箱首页、图片压缩、正则大全、数据工具、文件产物、权限审批、Skills/MCP、智能体接入和审计查看。
- 建立多 Agent worktree 开发规则与任务分工方式。

验收命令：

```powershell
pnpm install
pnpm build
pnpm test
pnpm --filter @agent-toolbox/cli dev -- tool search json
pnpm --filter @agent-toolbox/cli dev -- tool run json.format --json '{"text":"{\"name\":\"aitbx\"}","indent":2}'
pnpm --filter @agent-toolbox/api dev
```

## Phase 1：本地 API 与 CLI MVP

目标：

- 完成 Fastify API 服务。
- 完成 Commander CLI。
- 支持插件安装、启用、禁用、列表、工具搜索、工具详情、工具执行。
- 支持本地 JSON 文件持久化或 SQLite 轻量存储。
- 支持基础审计日志查询。

核心交付：

- `GET /v1/tools/search`
- `GET /v1/tools/:name`
- `GET /v1/tools/:name/security`
- `GET /v1/security/policy`
- `GET /v1/approvals`
- `POST /v1/approvals`
- `GET /v1/skills`
- `GET /v1/skills/:id`
- `GET /mcp`
- `POST /mcp`
- `POST /v1/tools/:name/run`
- `GET /v1/plugins`
- `aitbx plugin install`
- `aitbx tool search`
- `aitbx tool run`

## Phase 2：File Artifact Service

目标：

- 支持文件上传、本地 artifact 存储、文件信息查询、下载。
- 工具输入输出统一使用 `file_id` 表示文件。
- 增加 `file.zip`、`file.unzip` 的基础工具。

核心交付：

- `POST /v1/files`
- `GET /v1/files/:id`
- `GET /v1/files/:id/download`
- `aitbx file upload`
- `aitbx file get`

## Phase 3：媒体与文档工具

目标：

- 增加 PDF 和图片基础工具。
- 工具运行时支持 Python CLI 工具。
- artifact 输出结构稳定。

首批工具：

- `pdf.extract_text`
- `pdf.split`
- `pdf.merge`
- `image.compress`
- `image.resize`
- `image.convert`

## Phase 4：AI Gateway

目标：

- 面向 AI 暴露低 token 的工具搜索、schema 懒加载和工具执行接口。
- 记录 provider、model、token/cost 等调用信息。
- 对外部内容标记 `untrusted_content`。

核心交付：

- `toolbox.search_tools`
- `toolbox.get_tool_schema`
- `toolbox.get_tool_security`
- `toolbox.create_approval`
- `toolbox.run_tool`
- `toolbox.list_skills`
- `toolbox.get_skill`
- MCP `initialize`
- MCP `tools/list`
- MCP `tools/call`
- Provider Adapter 基础接口。

## Phase 5：MCP 与 Skill 适配

目标：

- 将内部工具注册表映射为 MCP tools。
- 支持 safe/dev/media profile。
- 输出 Skill Pack 模板，方便 AI 客户端按需加载工具工作流。

核心交付：

- `aitbx serve mcp`
- MCP `tools/list`
- MCP `tools/call`
- Skill 模板生成。

## Phase 6：Plugin SDK 与 Web 控制台

目标：

- 提供插件创建、测试、打包能力。
- 提供 Web 控制台查看插件、工具、文件、日志。
- 形成稳定插件协议和开发者体验。

核心交付：

- `aitbx plugin create`
- `aitbx plugin test`
- `aitbx plugin pack`
- Web dashboard。

# Phase 0 执行计划

Phase 0 的目标不是一次性做完整平台，而是建立一个可以持续扩展、可以被多 Agent 并行开发的工程基线。

## 目标

完成以下最小闭环：

```text
插件 manifest -> 工具注册 -> 工具搜索 -> 工具详情 -> 工具执行 -> 审计记录
```

优先支持本地开发，不引入数据库、队列、Docker 沙箱或 Web 控制台。

## 技术选择

- Runtime：Node.js + TypeScript。
- Monorepo：pnpm workspace。
- API：Fastify。
- CLI：Commander。
- 测试：Vitest。
- 数据：Phase 0 使用内存和本地文件，后续再引入 SQLite/PostgreSQL。
- 插件运行：Phase 0 优先支持内置 TypeScript handler，随后扩展 CLI runtime。

## 工程结构

```text
apps/
  api/
  cli/
packages/
  core/
  plugin-sdk/
plugins/
  json-basic/
tests/
  integration/
docs/
```

## Phase 0 任务列表

1. 建立 monorepo、TypeScript、lint/test/build 脚本。
2. 在 `packages/core` 定义插件、工具、运行结果、审计日志等核心类型。
3. 实现内存版 Plugin Registry。
4. 实现 Tool Runtime，支持执行注册的 handler。
5. 实现 `json-basic` 示例插件。
6. 实现 Fastify API 的工具搜索、详情、执行、插件列表接口。
7. 实现 Commander CLI 的工具搜索、详情、执行、插件列表命令。
8. 增加最小测试覆盖。
9. 写清多 Agent worktree 分工和汇报格式。

## 暂不做

- 不做 Web UI。
- 不做真实插件市场。
- 不做 Docker/gVisor 沙箱。
- 不做数据库迁移系统。
- 不做 PDF、图片、OCR 等重依赖工具。
- 不做 MCP Server 的完整协议实现。

## 验收标准

命令行验收：

```powershell
pnpm build
pnpm test
pnpm --filter @agent-toolbox/cli dev -- plugin list
pnpm --filter @agent-toolbox/cli dev -- tool search json
pnpm --filter @agent-toolbox/cli dev -- tool info json.format
pnpm --filter @agent-toolbox/cli dev -- tool run json.format --json '{"text":"{\"name\":\"aitbx\"}","indent":2}'
```

API 验收：

```powershell
pnpm --filter @agent-toolbox/api dev
```

然后访问：

```text
GET http://localhost:8787/health
GET http://localhost:8787/v1/plugins
GET http://localhost:8787/v1/tools/search?q=json
GET http://localhost:8787/v1/tools/json.format
POST http://localhost:8787/v1/tools/json.format/run
```

## 完成定义

Phase 0 完成时，仓库应该具备以下能力：

- 新开发者可以通过 `pnpm install` 和 `pnpm build` 启动工程。
- AI Agent 可以通过 CLI 或 API 找到并执行示例工具。
- 后续 Agent 可以围绕 Core、API、CLI、Plugin SDK 分支并行开发。
- 所有改动可通过 Git worktree 独立隔离和合并。

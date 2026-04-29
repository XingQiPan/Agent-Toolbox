# 架构决策记录

## ADR-0001：Phase 0 使用 TypeScript monorepo

决策：

Phase 0 使用 Node.js、TypeScript 和 pnpm workspace。

原因：

- 与开发文档中的推荐技术栈一致。
- API、CLI、Plugin SDK 可以共享类型。
- Fastify、Commander、Vitest 的组合足够轻量。
- 适合后续拆分 package 和多 Agent 并行开发。

## ADR-0002：Phase 0 先用内存注册表

决策：

Phase 0 的 Plugin Registry、Tool Registry 和 Audit Logger 先使用内存实现。

原因：

- 最小闭环优先于持久化。
- 可以先稳定核心接口，再替换为 SQLite/PostgreSQL。
- 降低早期迁移和 schema 设计成本。

后续：

Phase 1 或 Phase 2 引入 SQLite，正式部署再迁移到 PostgreSQL。

## ADR-0003：核心包不依赖 API 和 CLI

决策：

`packages/core` 只提供类型、注册表、运行时、审计、策略等核心能力，不依赖 `apps/api` 或 `apps/cli`。

原因：

- API 和 CLI 都应该只是 Core 的适配层。
- MCP、Skill、Web 控制台后续也可以复用同一套 Core。
- 有利于单元测试和多 Agent 分工。

## ADR-0004：Phase 0 插件先以内置 handler 表示

决策：

Phase 0 的 `json-basic` 插件先通过 TypeScript handler 注册工具，不强制实现完整 CLI sandbox。

原因：

- 能最快跑通工具搜索和执行闭环。
- JSON 工具没有外部依赖，适合作为基线插件。
- CLI runtime、Python runtime、沙箱策略可以在 Phase 1/2 演进。

## ADR-0005：API 返回统一 envelope

决策：

API 响应统一使用：

```json
{
  "ok": true,
  "data": {}
}
```

失败响应统一使用：

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误说明"
  }
}
```

原因：

- 与开发文档保持一致。
- AI 客户端更容易解析。
- 后续可以统一加入 `request_id`、`usage`、`audit_id`。

# 多 Agent 开发分工计划

本文档用于指导主控 Agent 使用 Git worktree 派遣多个子 Agent 并行开发。

## 基线分支

所有 Agent 分支从 `main` 的 Phase 0 基线提交创建。当前 Phase 0
分支基线为同一提交，主控 Agent 合并前应确认各 worktree 状态干净。

创建子任务前，主控 Agent 先执行：

```powershell
git status --short --branch
git fetch origin
```

## Agent A：Core Runtime

分支：

```text
agent/core/phase-0-runtime
```

worktree：

```text
../Agent-Toolbox-agent-core-phase-0-runtime
```

负责范围：

- `packages/core/**`
- `tests/integration/**` 中与 core 直接相关的测试。

任务：

- 完善插件 manifest 类型与校验。
- 完善内存 Plugin Registry。
- 完善 Tool Runtime。
- 完善 Audit Logger。
- 覆盖 `json.format`、`json.validate` 的 core 测试。

## Agent B：API Service

分支：

```text
agent/api/phase-0-service
```

worktree：

```text
../Agent-Toolbox-agent-api-phase-0-service
```

负责范围：

- `apps/api/**`
- `tests/integration/**` 中与 API 相关的测试。

任务：

- 实现 Fastify app factory。
- 实现 `/health`。
- 实现 `/v1/plugins`。
- 实现 `/v1/tools/search`。
- 实现 `/v1/tools/:name`。
- 实现 `/v1/tools/:name/run`。
- 统一 API 响应格式。

## Agent C：CLI 与示例插件

分支：

```text
agent/cli/phase-0-json-plugin
```

worktree：

```text
../Agent-Toolbox-agent-cli-phase-0-json-plugin
```

负责范围：

- `apps/cli/**`
- `plugins/json-basic/**`
- `packages/plugin-sdk/**`

任务：

- 实现 Commander CLI。
- 实现 `plugin list`。
- 实现 `tool search`。
- 实现 `tool info`。
- 实现 `tool run --json`。
- 完善 `json-basic` 插件 manifest 和示例。

## Agent D：Docs 与验证

分支：

```text
agent/docs/phase-0-validation
```

worktree：

```text
../Agent-Toolbox-agent-docs-phase-0-validation
```

负责范围：

- `docs/**`
- `README.md`

任务：

- 更新开发启动说明。
- 更新 Phase 0 验收流程。
- 检查文档与实际命令是否一致。
- 汇总各 Agent 的验证结果。

## 当前 Phase 0 Worktree 对照

```text
Agent A  E:/Codes/Agent-Toolbox-agent-core-phase-0-runtime     agent/core/phase-0-runtime
Agent B  E:/Codes/Agent-Toolbox-agent-api-phase-0-service      agent/api/phase-0-service
Agent C  E:/Codes/Agent-Toolbox-agent-cli-phase-0-json-plugin  agent/cli/phase-0-json-plugin
Agent D  E:/Codes/Agent-Toolbox-agent-docs-phase-0-validation  agent/docs/phase-0-validation
```

Agent D 只修改 `docs/**` 和 `README.md`。验证命令和预期行为以
`docs/PHASE_0_VALIDATION.md` 为准，主控 Agent 合并 A/C/B 后再用该清单做
最终验收。

## 合并顺序

推荐顺序：

1. Agent A：Core Runtime。
2. Agent C：CLI 与示例插件。
3. Agent B：API Service。
4. Agent D：Docs 与验证。

如果出现冲突，主控 Agent 负责判断保留哪一侧改动，并记录处理方式。

## 子 Agent 汇报要求

每个 Agent 完成后必须汇报：

```text
Agent:
Branch:
Worktree:
Changed files:
Validation:
Risks:
Next steps:
```

## 主控 Agent 验收命令

主控 Agent 合并后统一运行：

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm --filter @agent-toolbox/cli dev -- plugin list
pnpm --filter @agent-toolbox/cli dev -- tool search json
pnpm --filter @agent-toolbox/cli dev -- tool info json.format
pnpm --filter @agent-toolbox/cli dev -- tool run json.format --json '{"text":"{\"name\":\"aitbx\"}","indent":2}'
pnpm --filter @agent-toolbox/cli dev -- tool run json.validate --json '{"text":"{\"name\":\"aitbx\"}"}'
pnpm --filter @agent-toolbox/api dev
```

如果 `8787` 端口已被占用，API 验收可临时使用：

```powershell
$env:PORT = "18787"
pnpm --filter @agent-toolbox/api dev
```

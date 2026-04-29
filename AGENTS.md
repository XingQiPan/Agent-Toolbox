# Codex 多 Agent Worktree 开发规则

## 核心原则

当多个 Codex/AI Agent 并行开发本仓库时，每个 Agent 必须使用独立的 Git worktree。

一个 Agent 对应一个 worktree，一个 worktree 对应一个专属任务分支。除主控 Agent 或人类维护者明确要求外，Agent 不直接在 `main` 分支上开发。

## 启动前检查

开始任务前，先确认仓库状态：

```powershell
git status --short --branch
git worktree list
```

如果当前目录已有未提交改动，必须先判断这些改动是否属于当前任务。不要覆盖、回滚或清理未知来源的改动。

## 创建 worktree

新任务使用独立分支和独立目录：

```powershell
git worktree add ../Agent-Toolbox-agent-<name>-<task> -b agent/<name>/<task>
```

如果任务分支已经存在：

```powershell
git worktree add ../Agent-Toolbox-agent-<name>-<task> agent/<name>/<task>
```

进入对应 worktree 后再开始开发：

```powershell
Set-Location ../Agent-Toolbox-agent-<name>-<task>
```

## 命名规则

分支命名：

```text
agent/<agent-name>/<task-name>
```

目录命名：

```text
../Agent-Toolbox-agent-<agent-name>-<task-name>
```

示例：

```powershell
git worktree add ../Agent-Toolbox-agent-docs-worktree-rules -b agent/docs/worktree-rules
git worktree add ../Agent-Toolbox-agent-api-plugin-runtime -b agent/api/plugin-runtime
```

## 开发边界

每个 Agent 只修改自己任务范围内的文件。

如果必须修改其他 Agent 负责的文件，先在最终汇报中明确说明原因、影响范围和验证方式。

推荐按模块分配：

- `docs/**` 由文档 Agent 负责。
- `src/api/**` 由 API Agent 负责。
- `src/plugins/**` 由插件 Agent 负责。
- `tests/**` 由测试 Agent 负责。
- 根目录配置文件由主控 Agent 协调。

## 同步规则

创建任务 worktree 前，主 worktree 应同步最新主分支：

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
```

任务 worktree 需要同步主分支更新时：

```powershell
git fetch origin
git merge origin/main
```

如果出现冲突，保留双方意图并谨慎解决。解决后在最终汇报中列出冲突文件和处理方式。

## 提交规则

Agent 在自己的任务分支内提交：

```powershell
git status --short
git add <files>
git commit -m "<type>: <short summary>"
```

提交信息示例：

```text
feat: add plugin runtime scaffold
fix: handle tool execution errors
docs: add worktree collaboration rules
test: cover plugin loader
refactor: simplify tool registry
```

Agent 不直接推送到 `main`。如需推送任务分支：

```powershell
git push -u origin agent/<name>/<task>
```

## 主控 Agent 整合规则

主控 Agent 负责审查、合并和清理其他 Agent 的分支。

合并前检查：

- Agent 最终汇报是否清楚。
- 任务 worktree 的 `git status --short` 是否干净。
- 改动是否符合任务范围。
- 测试或验证命令是否已经运行。
- 是否存在未说明的冲突处理。

推荐合并流程：

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git merge --no-ff agent/<name>/<task>
```

## 清理规则

任务完成且分支已合并后，删除对应 worktree：

```powershell
git worktree remove ../Agent-Toolbox-agent-<name>-<task>
```

如果 worktree 目录已经被手动删除，清理 Git 记录：

```powershell
git worktree prune
```

删除已合并的本地分支：

```powershell
git branch -d agent/<name>/<task>
```

## 禁止事项

除非人类维护者明确要求，Agent 不得执行以下操作：

- 在共享主目录中来回切换分支开发多个任务。
- 直接在 `main` 上开发功能。
- 使用 `git reset --hard` 清除改动。
- 使用 `git checkout -- <file>` 回滚未知来源的改动。
- 强推共享分支。
- 删除其他 Agent 的 worktree。
- 修改未分配给自己的模块并且不说明原因。

## 最终汇报格式

Agent 完成任务后，按以下格式汇报：

```text
Agent: <name>
Worktree: <path>
Branch: agent/<name>/<task>
Commit: <commit-sha>
Changed files:
- <file>
- <file>
Validation:
- <command>: <result>
Notes:
- <important note>
```

## 一句话规则

多 Agent 并行开发时，所有 Agent 使用独立 Git worktree 和独立任务分支；主控 Agent 负责同步、审查、合并与清理。

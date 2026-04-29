# Agent Toolbox

Agent Toolbox is an API-first, CLI-first, plugin-first runtime for tools that AI
agents can discover and execute. Phase 0 is a TypeScript pnpm monorepo baseline
that proves the smallest loop:

```text
plugin manifest -> registry -> tool search -> tool info -> tool run -> audit log
```

## What Is In This Repo

- `apps/api`: Fastify local API service.
- `apps/cli`: Commander-based `aitbx` development CLI.
- `packages/core`: in-memory plugin registry, tool runtime, and audit log.
- `packages/plugin-sdk`: small helper package for defining plugins.
- `plugins/json-basic`: built-in Phase 0 plugin with `json.format` and `json.validate`.
- `tests/integration`: Vitest coverage for the JSON plugin loop.

## Requirements

- Node.js 24.x.
- pnpm 10.30.3, matching `packageManager` in `package.json`.

## Quickstart

From the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

Run the Phase 0 CLI smoke checks:

```powershell
pnpm --filter @agent-toolbox/cli dev -- plugin list
pnpm --filter @agent-toolbox/cli dev -- tool search json
pnpm --filter @agent-toolbox/cli dev -- tool info json.format
pnpm --filter @agent-toolbox/cli dev -- tool run json.format --json '{"text":"{\"name\":\"aitbx\"}","indent":2}'
pnpm --filter @agent-toolbox/cli dev -- tool run json.validate --json '{"text":"{\"name\":\"aitbx\"}"}'
```

Run the API service:

```powershell
pnpm --filter @agent-toolbox/api dev
```

The API listens on `http://127.0.0.1:8787` by default. If that port is already in
use, set another port and use the same port in the probes below:

```powershell
$env:PORT = "18787"
pnpm --filter @agent-toolbox/api dev
```

Probe the Phase 0 API:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
Invoke-RestMethod http://127.0.0.1:8787/v1/plugins
Invoke-RestMethod "http://127.0.0.1:8787/v1/tools/search?q=json"
Invoke-RestMethod http://127.0.0.1:8787/v1/tools/json.format

$body = @{ input = @{ text = '{"name":"aitbx"}'; indent = 2 } } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:8787/v1/tools/json.format/run `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

For the full expected output checklist, see
[`docs/PHASE_0_VALIDATION.md`](docs/PHASE_0_VALIDATION.md).

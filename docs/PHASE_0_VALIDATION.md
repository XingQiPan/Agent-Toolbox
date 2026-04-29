# Phase 0 Validation

This checklist validates the current Phase 0 TypeScript pnpm monorepo after the
Core, CLI, API, and docs worktrees are integrated.

## Environment

Run from the repository root.

Expected tools:

- Node.js 24.x.
- pnpm 10.30.3.

Install dependencies from the committed lockfile:

```powershell
pnpm install --frozen-lockfile
```

## Repository Checks

Confirm you are in the expected worktree or integration branch and that no
unrelated changes are mixed in:

```powershell
git status --short --branch
git worktree list
```

Expected Phase 0 worktrees:

```text
E:/Codes/Agent-Toolbox-agent-core-phase-0-runtime    agent/core/phase-0-runtime
E:/Codes/Agent-Toolbox-agent-api-phase-0-service     agent/api/phase-0-service
E:/Codes/Agent-Toolbox-agent-cli-phase-0-json-plugin agent/cli/phase-0-json-plugin
E:/Codes/Agent-Toolbox-agent-docs-phase-0-validation agent/docs/phase-0-validation
```

## Build And Tests

```powershell
pnpm build
pnpm test
```

Expected result:

- `pnpm build` runs `tsc` for `packages/core`, `packages/plugin-sdk`,
  `plugins/json-basic`, `apps/api`, and `apps/cli`.
- `pnpm test` runs `pnpm build` and Vitest.
- Vitest reports `2 passed` test files and `17 passed` tests in the integrated
  Phase 0 tree.

## CLI Validation

List plugins:

```powershell
pnpm --filter @agent-toolbox/cli dev -- plugin list
```

Expected behavior:

- Exit code is `0`.
- Output has `ok: true`.
- `data.plugins` includes one plugin with `id: "json.basic"`.
- `data.plugins[0].tools_count` is `2`.

Search JSON tools:

```powershell
pnpm --filter @agent-toolbox/cli dev -- tool search json
```

Expected behavior:

- Exit code is `0`.
- Output has `ok: true`.
- `data.tools` includes `json.format` and `json.validate`.
- Each tool includes `name`, `title`, `description`, `category`,
  `risk_level`, `input_schema`, `output_schema`, and `plugin_id`.
- `plugin_id` is `json.basic`.

Inspect a tool:

```powershell
pnpm --filter @agent-toolbox/cli dev -- tool info json.format
```

Expected behavior:

- Exit code is `0`.
- Output has `ok: true`.
- `data.tool` describes `json.format`.
- `data.tool.input_schema.required` includes `text`.
- `data.tool.output_schema.required` includes `formatted`.

Run JSON formatting:

```powershell
pnpm --filter @agent-toolbox/cli dev -- tool run json.format --json '{"text":"{\"name\":\"aitbx\"}","indent":2}'
```

Expected behavior:

- Exit code is `0`.
- Output has `ok: true`.
- `result.summary` is `JSON formatted successfully.`
- `result.artifacts` is an empty array.
- `result.data.formatted` equals:

```json
"{\n  \"name\": \"aitbx\"\n}"
```

Run JSON validation:

```powershell
pnpm --filter @agent-toolbox/cli dev -- tool run json.validate --json '{"text":"{\"name\":\"aitbx\"}"}'
```

Expected behavior:

- Exit code is `0`.
- Output has `ok: true`.
- `result.summary` is `JSON is valid.`
- `result.data.valid` is `true`.

Negative CLI smoke check:

```powershell
pnpm --filter @agent-toolbox/cli dev -- tool info missing.tool
```

Expected behavior:

- Exit code is non-zero.
- stdout is a JSON error envelope.
- stderr is empty.
- `error.code` is `TOOL_NOT_FOUND`.

## API Validation

Start the API:

```powershell
pnpm --filter @agent-toolbox/api dev
```

The API listens on `http://127.0.0.1:8787` by default. If that port is occupied,
run on another port and use that port in the probes below:

```powershell
$env:PORT = "18787"
pnpm --filter @agent-toolbox/api dev
```

Health:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
```

Expected response:

```json
{
  "ok": true,
  "data": {
    "status": "ok"
  }
}
```

List plugins:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/v1/plugins
```

Expected behavior:

- Response has `ok: true`.
- `data.plugins` includes `json.basic`.
- The plugin has `enabled: true` and `tools_count: 2`.

Search tools:

```powershell
Invoke-RestMethod "http://127.0.0.1:8787/v1/tools/search?q=json"
```

Expected behavior:

- Response has `ok: true`.
- `data.tools` includes `json.format` and `json.validate`.

Get tool details:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/v1/tools/json.format
```

Expected behavior:

- Response has `ok: true`.
- `data.name` is `json.format`.
- `data.plugin_id` is `json.basic`.
- `data.input_schema.required` includes `text`.

Run a tool:

```powershell
$body = @{ input = @{ text = '{"name":"aitbx"}'; indent = 2 } } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:8787/v1/tools/json.format/run `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

Expected behavior:

- Response has top-level `ok: true`.
- `data.result.data.formatted` equals `"{\n  \"name\": \"aitbx\"\n}"`.
- `data.usage.cost_usd` is `0`.

Read audit calls:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/v1/audit/calls
```

Expected behavior:

- Response has top-level `ok: true`.
- `data.calls` contains the tool call made above.
- Each call includes `id`, `tool_name`, `plugin_id`, `status`, `duration_ms`,
  `created_at`, and `finished_at`.

Missing tool:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/v1/tools/missing.tool
```

Expected behavior:

- HTTP status is `404`.
- Response has `ok: false`.
- `error.code` is `TOOL_NOT_FOUND`.

## Phase 0 Completion Criteria

Phase 0 is valid when:

- Build and tests pass from a clean install.
- CLI can list the `json.basic` plugin, search tools, inspect tool metadata, and
  run both JSON tools.
- API can serve health, plugin list, tool search, tool detail, tool run, and
  audit log endpoints using the unified `{ ok, data, error }` envelope.
- `json.format` and `json.validate` are low-risk built-in tools with no file,
  network, secret, or shell permissions.
- Runtime tool calls return structured results with `summary`, `artifacts`,
  `data`, and `usage`.

## Web Validation

Start the API first. If port `8787` is occupied, use the same fallback port used
by the Web proxy:

```powershell
$env:PORT = "18788"
pnpm --filter @agent-toolbox/api dev
```

Start the Web console:

```powershell
pnpm --filter @agent-toolbox/web dev
```

Expected behavior:

- Vite serves the console on `http://127.0.0.1:5173` or the next available port.
- The console shows API status as connected.
- The top bar shows brand, function list, global search, refresh, and
  Runtime/API status controls.
- The left sidebar switches home categories such as daily, query, document,
  intelligent, image, audio, video, text, encryption, unit, and life tools.
- The home page shows a gray-card tool grid with usable tools and planned tools.
- Navigation updates the address bar, so `/image-compress` and
  `/regex-collection` can be refreshed or shared during demos.
- The image compression page lets a user upload an image, adjust quality,
  maximum dimensions, and output format, preview before/after images, and
  download the compressed file.
- The regex collection page lets a user search common regex recipes, edit or
  copy a pattern, edit flags and test text, and view match results.
- Selecting `json.format` shows editable JSON input.
- Running the tool displays the formatted JSON result and appends an audit call.
- Local image compression and regex testing can run without API calls.

import {
  Activity,
  Braces,
  CheckCircle2,
  Clock3,
  Database,
  FileJson2,
  Gauge,
  Layers3,
  Play,
  PlugZap,
  RefreshCcw,
  Search,
  ShieldCheck,
  TerminalSquare,
  Wrench
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, type AuditCall, type PluginSummary, type ToolRunResponse, type ToolSummary } from "./api.js";

const examples: Record<string, string> = {
  "json.format": JSON.stringify({ text: "{\"name\":\"aitbx\"}", indent: 2 }, null, 2),
  "json.validate": JSON.stringify({ text: "{\"name\":\"aitbx\"}" }, null, 2)
};

const navItems = [
  { label: "总览", icon: Gauge },
  { label: "工具", icon: Wrench },
  { label: "插件", icon: PlugZap },
  { label: "审计", icon: Activity }
];

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function riskLabel(risk: ToolSummary["risk_level"]): string {
  if (risk === "low") return "低风险";
  if (risk === "medium") return "中风险";
  return "高风险";
}

export function App() {
  const [health, setHealth] = useState<"checking" | "ok" | "error">("checking");
  const [plugins, setPlugins] = useState<PluginSummary[]>([]);
  const [tools, setTools] = useState<ToolSummary[]>([]);
  const [auditCalls, setAuditCalls] = useState<AuditCall[]>([]);
  const [query, setQuery] = useState("json");
  const [selectedToolName, setSelectedToolName] = useState("json.format");
  const [toolInput, setToolInput] = useState(examples["json.format"]);
  const [runResult, setRunResult] = useState<ToolRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const selectedTool = useMemo(
    () => tools.find((tool) => tool.name === selectedToolName) ?? tools[0],
    [selectedToolName, tools]
  );

  async function refresh() {
    setError(null);
    try {
      const [healthResult, pluginResult, toolResult, auditResult] = await Promise.all([
        api.health(),
        api.plugins(),
        api.tools(query),
        api.auditCalls()
      ]);
      setHealth(healthResult.status === "ok" ? "ok" : "error");
      setPlugins(pluginResult.plugins);
      setTools(toolResult.tools);
      setAuditCalls(auditResult.calls);
      if (!selectedToolName && toolResult.tools[0]) {
        setSelectedToolName(toolResult.tools[0].name);
      }
    } catch (caught) {
      setHealth("error");
      setError(caught instanceof Error ? caught.message : "无法连接 API 服务");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void api.tools(query).then((result) => setTools(result.tools)).catch(() => undefined);
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [query]);

  function selectTool(tool: ToolSummary) {
    setSelectedToolName(tool.name);
    setToolInput(examples[tool.name] ?? "{}");
    setRunResult(null);
    setError(null);
  }

  async function runSelectedTool() {
    if (!selectedTool) return;

    setIsRunning(true);
    setError(null);
    try {
      const parsed = JSON.parse(toolInput) as Record<string, unknown>;
      const result = await api.runTool(selectedTool.name, parsed);
      setRunResult(result);
      const auditResult = await api.auditCalls();
      setAuditCalls(auditResult.calls);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "执行失败");
    } finally {
      setIsRunning(false);
    }
  }

  const totalTools = tools.length;
  const latestCall = auditCalls.at(-1);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Braces size={22} />
          </div>
          <div>
            <strong>Agent Toolbox</strong>
            <span>AI 工具运行时</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="主导航">
          {navItems.map((item) => (
            <button key={item.label} type="button" className="nav-item" title={item.label}>
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-status">
          <span className={`status-dot ${health}`} />
          <div>
            <strong>{health === "ok" ? "API 已连接" : health === "checking" ? "正在检查" : "API 未连接"}</strong>
            <span>通过 Vite proxy 访问本地服务</span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Phase 0 控制台</p>
            <h1>工具发现、执行与审计</h1>
          </div>
          <button type="button" className="icon-button" onClick={refresh} title="刷新数据">
            <RefreshCcw size={18} />
          </button>
        </header>

        {error ? (
          <section className="notice" role="alert">
            <TerminalSquare size={18} />
            <span>{error}</span>
          </section>
        ) : null}

        <section className="metrics-grid" aria-label="运行指标">
          <div className="metric">
            <PlugZap size={18} />
            <span>插件</span>
            <strong>{plugins.length}</strong>
          </div>
          <div className="metric">
            <Wrench size={18} />
            <span>工具</span>
            <strong>{totalTools}</strong>
          </div>
          <div className="metric">
            <Activity size={18} />
            <span>调用</span>
            <strong>{auditCalls.length}</strong>
          </div>
          <div className="metric">
            <Clock3 size={18} />
            <span>最近耗时</span>
            <strong>{latestCall ? `${latestCall.duration_ms}ms` : "0ms"}</strong>
          </div>
        </section>

        <section className="console-layout">
          <div className="tool-column">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Tool Registry</p>
                <h2>可用工具</h2>
              </div>
              <div className="search-box">
                <Search size={16} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜索工具" />
              </div>
            </div>

            <div className="tool-list">
              {tools.map((tool) => (
                <button
                  key={tool.name}
                  type="button"
                  className={`tool-row ${selectedTool?.name === tool.name ? "active" : ""}`}
                  onClick={() => selectTool(tool)}
                >
                  <FileJson2 size={18} />
                  <span>
                    <strong>{tool.name}</strong>
                    <small>{tool.description}</small>
                  </span>
                  <em>{riskLabel(tool.risk_level)}</em>
                </button>
              ))}
            </div>

            <div className="plugin-strip">
              {plugins.map((plugin) => (
                <div className="plugin-row" key={plugin.id}>
                  <Layers3 size={18} />
                  <span>
                    <strong>{plugin.name}</strong>
                    <small>
                      {plugin.id} · v{plugin.version}
                    </small>
                  </span>
                  <em>{plugin.tools_count} tools</em>
                </div>
              ))}
            </div>
          </div>

          <div className="runner-column">
            <div className="runner-head">
              <div>
                <p className="eyebrow">Tool Runner</p>
                <h2>{selectedTool?.title ?? "选择工具"}</h2>
              </div>
              {selectedTool ? (
                <span className="risk-pill">
                  <ShieldCheck size={15} />
                  {riskLabel(selectedTool.risk_level)}
                </span>
              ) : null}
            </div>

            {selectedTool ? (
              <>
                <p className="tool-description">{selectedTool.description}</p>
                <div className="schema-block">
                  <span>输入 Schema</span>
                  <pre>{pretty(selectedTool.input_schema)}</pre>
                </div>
                <label className="input-editor">
                  <span>输入 JSON</span>
                  <textarea value={toolInput} onChange={(event) => setToolInput(event.target.value)} spellCheck={false} />
                </label>
                <button type="button" className="run-button" onClick={runSelectedTool} disabled={isRunning}>
                  <Play size={18} />
                  {isRunning ? "执行中" : "运行工具"}
                </button>
              </>
            ) : (
              <div className="empty-state">没有匹配的工具</div>
            )}
          </div>

          <div className="result-column">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Result</p>
                <h2>执行结果</h2>
              </div>
              <CheckCircle2 size={20} />
            </div>

            <pre className="result-view">{runResult ? pretty(runResult) : "等待工具执行..."}</pre>

            <div className="audit-panel">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">Audit</p>
                  <h2>最近调用</h2>
                </div>
                <Database size={18} />
              </div>
              <div className="audit-list">
                {auditCalls.slice(-5).reverse().map((call) => (
                  <div className="audit-row" key={call.id}>
                    <span className={`status-dot ${call.status === "success" ? "ok" : "error"}`} />
                    <div>
                      <strong>{call.tool_name}</strong>
                      <small>
                        {call.status} · {call.duration_ms}ms
                      </small>
                    </div>
                  </div>
                ))}
                {auditCalls.length === 0 ? <div className="empty-state small">暂无调用记录</div> : null}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

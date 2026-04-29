import {
  Activity,
  BadgeCheck,
  Boxes,
  Braces,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Code2,
  Database,
  FileJson2,
  Hash,
  Image,
  Layers3,
  Link2,
  Palette,
  Play,
  PlugZap,
  QrCode,
  RefreshCcw,
  Search,
  Settings2,
  Sparkles,
  TextCursorInput,
  Wand2,
  Wrench
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, type AuditCall, type PluginSummary, type ToolRunResponse, type ToolSummary } from "./api.js";

type ViewId = "tools" | "runner" | "plugins" | "audit";
type ToolKind = "api" | "local" | "planned";

interface LocalHistoryItem {
  id: string;
  tool_name: string;
  source: string;
  status: "success" | "error";
  duration_ms: number;
  created_at: string;
}

interface ToolboxItem {
  id: string;
  title: string;
  description: string;
  category: string;
  kind: ToolKind;
  badge: string;
  icon: typeof Wrench;
  inputLabel: string;
  defaultInput: string;
  placeholder?: string;
  run?: (input: string) => unknown;
}

const views: Array<{ id: ViewId; label: string; icon: typeof Wrench }> = [
  { id: "tools", label: "工具箱", icon: Boxes },
  { id: "runner", label: "运行台", icon: Play },
  { id: "plugins", label: "插件", icon: PlugZap },
  { id: "audit", label: "审计", icon: Activity }
];

const categories = [
  { id: "all", label: "全部" },
  { id: "json", label: "JSON" },
  { id: "encoding", label: "编码转换" },
  { id: "text", label: "文本处理" },
  { id: "time", label: "时间日期" },
  { id: "dev", label: "开发工具" },
  { id: "design", label: "颜色设计" },
  { id: "media", label: "图片音视频" },
  { id: "document", label: "PDF 文档" },
  { id: "qrcode", label: "二维码" }
];

const magicalBoxReferences = [
  "视频压缩",
  "图片处理",
  "PDF 操作",
  "二维码生成",
  "文本处理",
  "单位转换",
  "音频转换"
];

const apiExamples: Record<string, string> = {
  "json.format": JSON.stringify({ text: "{\"name\":\"aitbx\"}", indent: 2 }, null, 2),
  "json.validate": JSON.stringify({ text: "{\"name\":\"aitbx\"}" }, null, 2)
};

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function encodeBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64(input: string): string {
  const binary = atob(input.trim());
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function toWords(input: string): string[] {
  return input
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9\u4e00-\u9fa5]+/)
    .filter(Boolean);
}

function toCamel(words: string[]): string {
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

function parseHexColor(input: string) {
  const normalized = input.trim().replace(/^#/, "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error("请输入 3 位或 6 位 HEX 颜色，例如 #409eff");
  }

  const r = Number.parseInt(expanded.slice(0, 2), 16);
  const g = Number.parseInt(expanded.slice(2, 4), 16);
  const b = Number.parseInt(expanded.slice(4, 6), 16);
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === r / 255) hue = ((g - b) / 255 / delta) % 6;
    if (max === g / 255) hue = (b - r) / 255 / delta + 2;
    if (max === b / 255) hue = (r - g) / 255 / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }

  return {
    hex: `#${expanded.toUpperCase()}`,
    rgb: `rgb(${r}, ${g}, ${b})`,
    hsl: `hsl(${hue}, ${Math.round(saturation * 100)}%, ${Math.round(lightness * 100)}%)`
  };
}

const localTools: ToolboxItem[] = [
  {
    id: "base64.encode",
    title: "Base64 编码",
    description: "把文本转换成 Base64，适合配置、接口调试和轻量传输。",
    category: "encoding",
    kind: "local",
    badge: "浏览器本地",
    icon: Hash,
    inputLabel: "待编码文本",
    defaultInput: "Agent Toolbox 你好",
    run: (input) => ({ encoded: encodeBase64(input) })
  },
  {
    id: "base64.decode",
    title: "Base64 解码",
    description: "把 Base64 内容还原成可读文本，支持中文。",
    category: "encoding",
    kind: "local",
    badge: "浏览器本地",
    icon: Hash,
    inputLabel: "Base64 内容",
    defaultInput: "QWdlbnQgVG9vbGJveCDkvaDlpb0=",
    run: (input) => ({ decoded: decodeBase64(input) })
  },
  {
    id: "url.encode",
    title: "URL 编码",
    description: "对链接参数或中文路径做 encodeURIComponent 编码。",
    category: "encoding",
    kind: "local",
    badge: "浏览器本地",
    icon: Link2,
    inputLabel: "待编码内容",
    defaultInput: "https://example.com/search?q=奇妙工具箱",
    run: (input) => ({ encoded: encodeURIComponent(input) })
  },
  {
    id: "url.decode",
    title: "URL 解码",
    description: "还原 URL 编码后的参数或文本。",
    category: "encoding",
    kind: "local",
    badge: "浏览器本地",
    icon: Link2,
    inputLabel: "待解码内容",
    defaultInput: "https%3A%2F%2Fexample.com%2Fsearch%3Fq%3D%E5%A5%87%E5%A6%99%E5%B7%A5%E5%85%B7%E7%AE%B1",
    run: (input) => ({ decoded: decodeURIComponent(input) })
  },
  {
    id: "text.stats",
    title: "文本统计",
    description: "统计字符、非空字符、行数、词数，适合内容处理。",
    category: "text",
    kind: "local",
    badge: "浏览器本地",
    icon: TextCursorInput,
    inputLabel: "待统计文本",
    defaultInput: "Agent Toolbox\n让 AI 安全调用工具。",
    run: (input) => ({
      characters: input.length,
      characters_without_spaces: input.replace(/\s/g, "").length,
      lines: input.length === 0 ? 0 : input.split(/\r?\n/).length,
      words: toWords(input).length
    })
  },
  {
    id: "timestamp.convert",
    title: "时间戳转换",
    description: "Unix 秒、毫秒和日期字符串互转。",
    category: "time",
    kind: "local",
    badge: "浏览器本地",
    icon: CalendarClock,
    inputLabel: "时间戳或日期",
    defaultInput: String(Math.floor(Date.now() / 1000)),
    run: (input) => {
      const trimmed = input.trim();
      const numeric = Number(trimmed);
      const date = Number.isFinite(numeric)
        ? new Date(trimmed.length <= 10 ? numeric * 1000 : numeric)
        : new Date(trimmed);

      if (Number.isNaN(date.getTime())) {
        throw new Error("请输入 Unix 时间戳、毫秒时间戳或可解析的日期字符串");
      }

      return {
        iso: date.toISOString(),
        local: date.toLocaleString(),
        unix_seconds: Math.floor(date.getTime() / 1000),
        unix_milliseconds: date.getTime()
      };
    }
  },
  {
    id: "uuid.generate",
    title: "UUID 生成",
    description: "快速生成 UUID v4，可用于测试数据、请求 ID 和临时标识。",
    category: "dev",
    kind: "local",
    badge: "浏览器本地",
    icon: Code2,
    inputLabel: "生成数量",
    defaultInput: "5",
    run: (input) => {
      const count = Math.min(Math.max(Number.parseInt(input.trim(), 10) || 1, 1), 20);
      return {
        count,
        uuids: Array.from({ length: count }, () => crypto.randomUUID())
      };
    }
  },
  {
    id: "case.convert",
    title: "命名格式转换",
    description: "驼峰、下划线、短横线、标题格式一键转换。",
    category: "dev",
    kind: "local",
    badge: "浏览器本地",
    icon: Code2,
    inputLabel: "变量名或短语",
    defaultInput: "agent toolbox runtime",
    run: (input) => {
      const words = toWords(input);
      const lowerWords = words.map((word) => word.toLowerCase());
      return {
        camelCase: toCamel(words),
        PascalCase: toCamel(words).replace(/^./, (char) => char.toUpperCase()),
        snake_case: lowerWords.join("_"),
        kebab_case: lowerWords.join("-"),
        TitleCase: lowerWords.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
      };
    }
  },
  {
    id: "color.convert",
    title: "颜色格式转换",
    description: "HEX 转 RGB/HSL，适合前端和设计调色。",
    category: "design",
    kind: "local",
    badge: "浏览器本地",
    icon: Palette,
    inputLabel: "HEX 颜色",
    defaultInput: "#409eff",
    run: parseHexColor
  },
  {
    id: "image.compress",
    title: "图片压缩",
    description: "参考 MagicalBox 的图片处理方向，后续接入插件和文件 artifact。",
    category: "media",
    kind: "planned",
    badge: "计划插件",
    icon: Image,
    inputLabel: "说明",
    defaultInput: "Phase 2 接入 File Artifact Service 后开放"
  },
  {
    id: "pdf.merge",
    title: "PDF 合并",
    description: "把多个 PDF 合并为一个文件，后续由 PDF 插件实现。",
    category: "document",
    kind: "planned",
    badge: "计划插件",
    icon: ClipboardList,
    inputLabel: "说明",
    defaultInput: "Phase 3 接入 PDF 插件后开放"
  },
  {
    id: "qr.generate",
    title: "二维码生成",
    description: "生成文本或链接二维码，后续可做成本地浏览器工具。",
    category: "qrcode",
    kind: "planned",
    badge: "计划插件",
    icon: QrCode,
    inputLabel: "说明",
    defaultInput: "计划作为前端本地工具或插件工具接入"
  }
];

function apiToolToItem(tool: ToolSummary): ToolboxItem {
  return {
    id: tool.name,
    title: tool.title,
    description: tool.description,
    category: "json",
    kind: "api",
    badge: "API 工具",
    icon: FileJson2,
    inputLabel: "输入 JSON",
    defaultInput: apiExamples[tool.name] ?? "{}"
  };
}

function kindLabel(kind: ToolKind): string {
  if (kind === "api") return "后端执行";
  if (kind === "local") return "本地执行";
  return "待接入";
}

export function App() {
  const [activeView, setActiveView] = useState<ViewId>("tools");
  const [activeCategory, setActiveCategory] = useState("all");
  const [health, setHealth] = useState<"checking" | "ok" | "error">("checking");
  const [plugins, setPlugins] = useState<PluginSummary[]>([]);
  const [apiTools, setApiTools] = useState<ToolSummary[]>([]);
  const [auditCalls, setAuditCalls] = useState<AuditCall[]>([]);
  const [localHistory, setLocalHistory] = useState<LocalHistoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [selectedToolId, setSelectedToolId] = useState("json.format");
  const [toolInput, setToolInput] = useState(apiExamples["json.format"]);
  const [runResult, setRunResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const allTools = useMemo(() => [...apiTools.map(apiToolToItem), ...localTools], [apiTools]);
  const selectedTool = useMemo(
    () => allTools.find((tool) => tool.id === selectedToolId) ?? allTools[0],
    [allTools, selectedToolId]
  );
  const selectedApiTool = useMemo(() => apiTools.find((tool) => tool.name === selectedTool?.id), [apiTools, selectedTool]);

  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return allTools.filter((tool) => {
      const matchesCategory = activeCategory === "all" || tool.category === activeCategory;
      const matchesQuery =
        !normalized ||
        [tool.id, tool.title, tool.description, tool.badge].join(" ").toLowerCase().includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, allTools, query]);

  async function refresh() {
    setError(null);
    try {
      const [healthResult, pluginResult, toolResult, auditResult] = await Promise.all([
        api.health(),
        api.plugins(),
        api.tools(""),
        api.auditCalls()
      ]);
      setHealth(healthResult.status === "ok" ? "ok" : "error");
      setPlugins(pluginResult.plugins);
      setApiTools(toolResult.tools);
      setAuditCalls(auditResult.calls);
    } catch (caught) {
      setHealth("error");
      setError(caught instanceof Error ? caught.message : "无法连接 API 服务，本地工具仍可使用");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function selectTool(tool: ToolboxItem) {
    setSelectedToolId(tool.id);
    setToolInput(tool.defaultInput);
    setRunResult(null);
    setError(null);
    setActiveView("runner");
  }

  async function runSelectedTool() {
    if (!selectedTool) return;
    if (selectedTool.kind === "planned") {
      setError("这个工具还在插件规划中，当前可先使用 JSON、编码、文本、时间和开发类工具。");
      return;
    }

    setIsRunning(true);
    setError(null);
    const started = performance.now();
    try {
      let result: unknown;
      if (selectedTool.kind === "api") {
        const parsed = JSON.parse(toolInput) as Record<string, unknown>;
        result = await api.runTool(selectedTool.id, parsed);
        const auditResult = await api.auditCalls();
        setAuditCalls(auditResult.calls);
      } else {
        result = selectedTool.run?.(toolInput) ?? null;
        setLocalHistory((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            tool_name: selectedTool.id,
            source: "local",
            status: "success",
            duration_ms: Math.round(performance.now() - started),
            created_at: new Date().toISOString()
          }
        ]);
      }
      setRunResult(result);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "执行失败";
      setError(message);
      if (selectedTool.kind === "local") {
        setLocalHistory((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            tool_name: selectedTool.id,
            source: "local",
            status: "error",
            duration_ms: Math.round(performance.now() - started),
            created_at: new Date().toISOString()
          }
        ]);
      }
    } finally {
      setIsRunning(false);
    }
  }

  const apiToolCount = apiTools.length;
  const runnableCount = allTools.filter((tool) => tool.kind !== "planned").length;
  const totalAuditCount = auditCalls.length + localHistory.length;
  const latestBackendCall = auditCalls.at(-1);
  const latestLocalCall = localHistory.at(-1);
  const latestDuration = latestLocalCall?.duration_ms ?? latestBackendCall?.duration_ms ?? 0;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">
            <Wand2 size={24} />
          </div>
          <div>
            <strong>Agent Toolbox</strong>
            <span>AI 可调用，也能给人直接用</span>
          </div>
        </div>

        <nav className="top-nav" aria-label="主导航">
          {views.map((view) => (
            <button
              key={view.id}
              type="button"
              className={`nav-item ${activeView === view.id ? "active" : ""}`}
              onClick={() => setActiveView(view.id)}
              title={view.label}
            >
              <view.icon size={18} />
              <span>{view.label}</span>
            </button>
          ))}
        </nav>

        <button type="button" className="refresh-button" onClick={refresh} title="刷新数据">
          <RefreshCcw size={18} />
        </button>
      </header>

      <main className="workspace">
        <section className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">MagicalBox 风格工具集合 + Agent Runtime</p>
            <h1>一个界面里搜索、运行、审计工具</h1>
            <p>
              参考在线工具箱的分类和搜索体验，同时保留 Agent Toolbox 的插件、API 和审计能力。
            </p>
            <div className="reference-list">
              {magicalBoxReferences.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
          <div className="hero-status">
            <span className={`status-dot ${health}`} />
            <strong>{health === "ok" ? "API 已连接" : health === "checking" ? "正在检查 API" : "API 未连接"}</strong>
            <small>本地工具无需 API 也可运行</small>
          </div>
        </section>

        {error ? (
          <section className="notice" role="alert">
            <Settings2 size={18} />
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
            <span>可运行工具</span>
            <strong>{runnableCount}</strong>
          </div>
          <div className="metric">
            <Braces size={18} />
            <span>API 工具</span>
            <strong>{apiToolCount}</strong>
          </div>
          <div className="metric">
            <Activity size={18} />
            <span>调用记录</span>
            <strong>{totalAuditCount}</strong>
          </div>
        </section>

        {activeView === "tools" ? (
          <section className="toolbox-view">
            <div className="toolbox-toolbar">
              <div className="search-box">
                <Search size={18} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索 JSON、Base64、时间戳、PDF、图片..."
                  aria-label="搜索工具"
                />
              </div>
              <div className="category-tabs" aria-label="工具分类">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={activeCategory === category.id ? "active" : ""}
                    onClick={() => setActiveCategory(category.id)}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="tool-grid">
              {filteredTools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  className={`tool-card ${tool.kind}`}
                  onClick={() => selectTool(tool)}
                >
                  <span className="tool-icon">
                    <tool.icon size={22} />
                  </span>
                  <span className="tool-card-main">
                    <span className="tool-card-title">{tool.title}</span>
                    <span className="tool-card-desc">{tool.description}</span>
                  </span>
                  <span className="tool-card-foot">
                    <em>{tool.badge}</em>
                    <ChevronRight size={17} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {activeView === "runner" ? (
          <section className="runner-view">
            <div className="runner-main">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{kindLabel(selectedTool?.kind ?? "local")}</p>
                  <h2>{selectedTool?.title ?? "选择工具"}</h2>
                </div>
                <span className={`kind-pill ${selectedTool?.kind ?? "local"}`}>{selectedTool?.badge}</span>
              </div>

              <p className="tool-description">{selectedTool?.description}</p>

              {selectedApiTool ? (
                <div className="schema-block">
                  <span>输入 Schema</span>
                  <pre>{pretty(selectedApiTool.input_schema)}</pre>
                </div>
              ) : null}

              <label className="input-editor">
                <span>{selectedTool?.inputLabel ?? "输入"}</span>
                <textarea
                  value={toolInput}
                  onChange={(event) => setToolInput(event.target.value)}
                  placeholder={selectedTool?.placeholder}
                  spellCheck={false}
                />
              </label>

              <button
                type="button"
                className="run-button"
                onClick={runSelectedTool}
                disabled={isRunning || selectedTool?.kind === "planned"}
              >
                <Play size={18} />
                {selectedTool?.kind === "planned" ? "等待插件接入" : isRunning ? "执行中" : "运行工具"}
              </button>
            </div>

            <div className="result-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Result</p>
                  <h2>执行结果</h2>
                </div>
                <CheckCircle2 size={20} />
              </div>
              <pre className="result-view">{runResult ? pretty(runResult) : "选择一个工具并点击运行..."}</pre>
            </div>
          </section>
        ) : null}

        {activeView === "plugins" ? (
          <section className="plugin-view">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Plugin Registry</p>
                <h2>插件和后续能力</h2>
              </div>
              <Layers3 size={20} />
            </div>
            <div className="plugin-grid">
              {plugins.map((plugin) => (
                <article className="plugin-card" key={plugin.id}>
                  <PlugZap size={22} />
                  <strong>{plugin.name}</strong>
                  <span>{plugin.id}</span>
                  <small>
                    v{plugin.version} · {plugin.tools_count} tools · {plugin.enabled ? "已启用" : "未启用"}
                  </small>
                </article>
              ))}
              <article className="plugin-card muted">
                <Image size={22} />
                <strong>image.basic</strong>
                <span>图片压缩、格式转换、去背景</span>
                <small>参考 MagicalBox 图片工具，Phase 3 接入</small>
              </article>
              <article className="plugin-card muted">
                <ClipboardList size={22} />
                <strong>pdf.basic</strong>
                <span>PDF 合并、压缩、转图片、转 Word</span>
                <small>File Artifact Service 完成后接入</small>
              </article>
            </div>
          </section>
        ) : null}

        {activeView === "audit" ? (
          <section className="audit-view">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Audit</p>
                <h2>工具调用记录</h2>
              </div>
              <Database size={20} />
            </div>
            <div className="audit-list">
              {[...auditCalls.map((call) => ({
                id: call.id,
                tool_name: call.tool_name,
                source: "api",
                status: call.status,
                duration_ms: call.duration_ms,
                created_at: call.created_at
              })), ...localHistory]
                .slice()
                .reverse()
                .map((call) => (
                  <div className="audit-row" key={call.id}>
                    <span className={`status-dot ${call.status === "success" ? "ok" : "error"}`} />
                    <div>
                      <strong>{call.tool_name}</strong>
                      <small>
                        {call.source} · {call.status} · {call.duration_ms}ms · {new Date(call.created_at).toLocaleString()}
                      </small>
                    </div>
                    <BadgeCheck size={18} />
                  </div>
                ))}
              {totalAuditCount === 0 ? <div className="empty-state">暂无调用记录，先运行一个工具吧。</div> : null}
            </div>
            <div className="latest-duration">最近耗时：{latestDuration}ms</div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

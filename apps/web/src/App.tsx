import {
  Activity,
  Braces,
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileJson2,
  Home,
  Image,
  Play,
  RefreshCcw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UploadCloud
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { api, type AuditCall, type PluginSummary, type ToolRunResponse, type ToolSummary } from "./api.js";

type PageId = "home" | "image-compress" | "regex-collection" | "json-tools" | "audit";
type ImageFormat = "image/jpeg" | "image/png" | "image/webp";

interface LocalHistoryItem {
  id: string;
  tool_name: string;
  source: string;
  status: "success" | "error";
  duration_ms: number;
  created_at: string;
}

interface CompressedImage {
  url: string;
  blob: Blob;
  name: string;
  size: number;
  width: number;
  height: number;
}

interface RegexRecipe {
  id: string;
  title: string;
  category: string;
  pattern: string;
  flags: string;
  sample: string;
  description: string;
}

const pages: Array<{ id: PageId; label: string; icon: typeof Home }> = [
  { id: "home", label: "首页", icon: Home },
  { id: "image-compress", label: "图片压缩", icon: Image },
  { id: "regex-collection", label: "正则大全", icon: Braces },
  { id: "json-tools", label: "JSON 工具", icon: FileJson2 },
  { id: "audit", label: "审计", icon: Activity }
];

const toolGroups = [
  {
    title: "图片处理",
    items: ["图片压缩", "格式转换", "图片裁剪", "图片转 Base64", "图片转 PDF"],
    accent: "cyan"
  },
  {
    title: "开发工具",
    items: ["正则大全", "JSON 格式化", "JSON 验证", "Base64", "URL 编码", "UUID 生成"],
    accent: "blue"
  },
  {
    title: "文档工具",
    items: ["PDF 合并", "PDF 压缩", "PDF 转图片", "Word 转 PDF", "Markdown 转换"],
    accent: "violet"
  },
  {
    title: "日常工具",
    items: ["二维码生成", "时间戳转换", "单位转换", "颜色转换", "文本统计"],
    accent: "green"
  }
];

const regexRecipes: RegexRecipe[] = [
  {
    id: "email",
    title: "邮箱地址",
    category: "常用",
    pattern: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}",
    flags: "g",
    sample: "联系我：hello@example.com 或 support@agent-toolbox.dev",
    description: "匹配常见邮箱地址。"
  },
  {
    id: "phone-cn",
    title: "中国大陆手机号",
    category: "常用",
    pattern: "1[3-9]\\d{9}",
    flags: "g",
    sample: "用户手机号：13800138000，备用：19912345678",
    description: "匹配 11 位大陆手机号。"
  },
  {
    id: "url",
    title: "URL 链接",
    category: "网络",
    pattern: "https?:\\/\\/[^\\s]+",
    flags: "g",
    sample: "官网 https://www.magicalbox.cn/ 文档 https://example.com/docs?a=1",
    description: "匹配 http 和 https 链接。"
  },
  {
    id: "ipv4",
    title: "IPv4 地址",
    category: "网络",
    pattern: "\\b(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\b",
    flags: "g",
    sample: "本机 127.0.0.1，网关 192.168.1.1，错误 999.1.1.1",
    description: "匹配合法 IPv4 地址。"
  },
  {
    id: "date",
    title: "日期 yyyy-mm-dd",
    category: "时间",
    pattern: "\\b\\d{4}-(0[1-9]|1[0-2])-([0-2]\\d|3[01])\\b",
    flags: "g",
    sample: "发布日期 2026-04-29，下次计划 2026-05-10",
    description: "匹配基础 ISO 日期格式。"
  },
  {
    id: "hex-color",
    title: "HEX 颜色",
    category: "前端",
    pattern: "#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b",
    flags: "g",
    sample: "主题色 #409eff，强调色 #12B981，错误色 #f04438",
    description: "匹配 3 位或 6 位 HEX 颜色。"
  },
  {
    id: "chinese",
    title: "中文字符",
    category: "文本",
    pattern: "[\\u4e00-\\u9fa5]+",
    flags: "g",
    sample: "Agent Toolbox 是一个 AI 工具箱 Runtime。",
    description: "提取连续中文字符。"
  },
  {
    id: "number",
    title: "数字",
    category: "文本",
    pattern: "-?\\d+(?:\\.\\d+)?",
    flags: "g",
    sample: "压缩前 2.8MB，压缩后 680KB，比例 75.7%",
    description: "匹配整数和小数。"
  }
];

const apiExamples: Record<string, string> = {
  "json.format": JSON.stringify({ text: "{\"name\":\"aitbx\"}", indent: 2 }, null, 2),
  "json.validate": JSON.stringify({ text: "{\"name\":\"aitbx\"}" }, null, 2)
};

const homeToolRoutes: Record<string, PageId> = {
  图片压缩: "image-compress",
  正则大全: "regex-collection",
  "JSON 格式化": "json-tools",
  "JSON 验证": "json-tools"
};

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function outputExtension(format: ImageFormat): string {
  if (format === "image/png") return "png";
  if (format === "image/webp") return "webp";
  return "jpg";
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function isPageId(value: string): value is PageId {
  return pages.some((page) => page.id === value);
}

function pageFromLocation(): PageId {
  const pathSegment = window.location.pathname.split("/").filter(Boolean).at(-1) ?? "";
  const hashSegment = window.location.hash.replace(/^#/, "");
  if (isPageId(pathSegment)) return pathSegment;
  if (isPageId(hashSegment)) return hashSegment;
  return "home";
}

export function App() {
  const [activePage, setActivePage] = useState<PageId>(() => pageFromLocation());
  const [health, setHealth] = useState<"checking" | "ok" | "error">("checking");
  const [plugins, setPlugins] = useState<PluginSummary[]>([]);
  const [apiTools, setApiTools] = useState<ToolSummary[]>([]);
  const [auditCalls, setAuditCalls] = useState<AuditCall[]>([]);
  const [localHistory, setLocalHistory] = useState<LocalHistoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [selectedApiTool, setSelectedApiTool] = useState("json.format");
  const [jsonInput, setJsonInput] = useState(apiExamples["json.format"]);
  const [jsonResult, setJsonResult] = useState<ToolRunResponse | null>(null);
  const [isJsonRunning, setIsJsonRunning] = useState(false);

  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [sourceSize, setSourceSize] = useState<{ width: number; height: number } | null>(null);
  const [quality, setQuality] = useState(72);
  const [maxWidth, setMaxWidth] = useState(1600);
  const [maxHeight, setMaxHeight] = useState(1600);
  const [format, setFormat] = useState<ImageFormat>("image/jpeg");
  const [compressedImage, setCompressedImage] = useState<CompressedImage | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedRegexId, setSelectedRegexId] = useState(regexRecipes[0].id);
  const [regexSearch, setRegexSearch] = useState("");
  const [regexPattern, setRegexPattern] = useState(regexRecipes[0].pattern);
  const [regexFlags, setRegexFlags] = useState(regexRecipes[0].flags);
  const [regexText, setRegexText] = useState(regexRecipes[0].sample);
  const [copied, setCopied] = useState(false);

  const selectedRegex = useMemo(
    () => regexRecipes.find((item) => item.id === selectedRegexId) ?? regexRecipes[0],
    [selectedRegexId]
  );
  const selectedTool = useMemo(
    () => apiTools.find((tool) => tool.name === selectedApiTool),
    [apiTools, selectedApiTool]
  );
  const filteredHomeGroups = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return toolGroups;
    return toolGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => `${group.title} ${item}`.toLowerCase().includes(normalized))
      }))
      .filter((group) => group.items.length > 0);
  }, [search]);
  const filteredRegexRecipes = useMemo(() => {
    const normalized = regexSearch.trim().toLowerCase();
    if (!normalized) return regexRecipes;
    return regexRecipes.filter((item) =>
      [item.title, item.category, item.description, item.pattern].join(" ").toLowerCase().includes(normalized)
    );
  }, [regexSearch]);
  const regexMatches = useMemo(() => {
    try {
      const flags = regexFlags.includes("g") ? regexFlags : `${regexFlags}g`;
      const regexp = new RegExp(regexPattern, flags);
      return Array.from(regexText.matchAll(regexp)).map((match) => ({
        value: match[0],
        index: match.index ?? 0
      }));
    } catch {
      return [];
    }
  }, [regexFlags, regexPattern, regexText]);

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
      setError(caught instanceof Error ? caught.message : "API 未连接，图片压缩和正则工具仍可本地使用");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const handleNavigation = () => setActivePage(pageFromLocation());
    window.addEventListener("popstate", handleNavigation);
    window.addEventListener("hashchange", handleNavigation);
    return () => {
      window.removeEventListener("popstate", handleNavigation);
      window.removeEventListener("hashchange", handleNavigation);
    };
  }, []);

  function recordLocal(toolName: string, started: number, status: "success" | "error") {
    setLocalHistory((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        tool_name: toolName,
        source: "local",
        status,
        duration_ms: Math.round(performance.now() - started),
        created_at: new Date().toISOString()
      }
    ]);
  }

  function navigate(page: PageId) {
    setActivePage(page);
    const nextPath = page === "home" ? "/" : `/${page}`;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ page }, "", nextPath);
    }
  }

  function openToolByName(name: string) {
    if (name === "JSON 验证") {
      setSelectedApiTool("json.validate");
      setJsonInput(apiExamples["json.validate"]);
    } else if (name === "JSON 格式化") {
      setSelectedApiTool("json.format");
      setJsonInput(apiExamples["json.format"]);
    }

    const route = homeToolRoutes[name];
    if (route) navigate(route);
  }

  async function runJsonTool() {
    setIsJsonRunning(true);
    setError(null);
    try {
      const parsed = JSON.parse(jsonInput) as Record<string, unknown>;
      const result = await api.runTool(selectedApiTool, parsed);
      setJsonResult(result);
      const auditResult = await api.auditCalls();
      setAuditCalls(auditResult.calls);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "JSON 工具执行失败");
    } finally {
      setIsJsonRunning(false);
    }
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }

    if (sourcePreview) URL.revokeObjectURL(sourcePreview);
    if (compressedImage) URL.revokeObjectURL(compressedImage.url);

    const preview = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      setSourceSize({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(image.src);
    };
    image.src = URL.createObjectURL(file);
    setSourceImage(file);
    setSourcePreview(preview);
    setCompressedImage(null);
    setError(null);
  }

  async function compressImage() {
    if (!sourceImage) {
      setError("请先上传图片");
      return;
    }

    setIsCompressing(true);
    setError(null);
    const started = performance.now();

    try {
      const bitmap = await createImageBitmap(sourceImage);
      const ratio = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
      const width = Math.max(1, Math.round(bitmap.width * ratio));
      const height = Math.max(1, Math.round(bitmap.height * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("浏览器不支持 Canvas 压缩");
      context.drawImage(bitmap, 0, 0, width, height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (value) => {
            if (value) resolve(value);
            else reject(new Error("图片压缩失败"));
          },
          format,
          format === "image/png" ? undefined : quality / 100
        );
      });

      const url = URL.createObjectURL(blob);
      const baseName = sourceImage.name.replace(/\.[^.]+$/, "");
      if (compressedImage) URL.revokeObjectURL(compressedImage.url);
      setCompressedImage({
        url,
        blob,
        name: `${baseName}-compressed.${outputExtension(format)}`,
        size: blob.size,
        width,
        height
      });
      recordLocal("image.compress", started, "success");
    } catch (caught) {
      recordLocal("image.compress", started, "error");
      setError(caught instanceof Error ? caught.message : "图片压缩失败");
    } finally {
      setIsCompressing(false);
    }
  }

  async function copyRegex() {
    await copyText(regexPattern);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  function selectRegex(recipe: RegexRecipe) {
    setSelectedRegexId(recipe.id);
    setRegexPattern(recipe.pattern);
    setRegexFlags(recipe.flags);
    setRegexText(recipe.sample);
    setCopied(false);
  }

  const totalAuditCount = auditCalls.length + localHistory.length;

  return (
    <div className="app-shell">
      <header className="app-header">
        <button type="button" className="brand" onClick={() => navigate("home")}>
          <span className="brand-mark">
            <Sparkles size={22} />
          </span>
          <span>
            <strong>Agent Toolbox</strong>
            <small>AI 工具箱 · 人也能直接操作</small>
          </span>
        </button>

        <nav className="top-nav" aria-label="主导航">
          {pages.map((page) => (
            <button
              key={page.id}
              type="button"
              className={activePage === page.id ? "active" : ""}
              onClick={() => navigate(page.id)}
            >
              <page.icon size={17} />
              <span>{page.label}</span>
            </button>
          ))}
        </nav>

        <button type="button" className="refresh-button" onClick={refresh} title="刷新 API">
          <RefreshCcw size={18} />
        </button>
      </header>

      <main className="workspace">
        {error ? (
          <section className="notice" role="alert">
            <Settings2 size={18} />
            <span>{error}</span>
          </section>
        ) : null}

        {activePage === "home" ? (
          <section className="home-page">
            <div className="hero">
              <div>
                <p className="eyebrow">参考 MagicalBox 的在线工具操作体验</p>
                <h1>像工具箱一样打开即用，像 Agent Runtime 一样可编排</h1>
                <p>
                  首页提供搜索、分类和工具卡片；具体工具页提供上传、参数、预览、复制、下载等真实操作。
                </p>
              </div>
              <div className="status-card">
                <span className={`status-dot ${health}`} />
                <strong>{health === "ok" ? "API 已连接" : health === "checking" ? "检查 API 中" : "API 未连接"}</strong>
                <small>本地图片压缩和正则工具无需 API</small>
              </div>
            </div>

            <div className="home-search">
              <Search size={20} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索图片压缩、正则、JSON、PDF、二维码..." />
            </div>

            <div className="stats-grid">
              <div>
                <strong>{plugins.length}</strong>
                <span>已注册插件</span>
              </div>
              <div>
                <strong>{apiTools.length + 2}</strong>
                <span>可操作工具</span>
              </div>
              <div>
                <strong>{totalAuditCount}</strong>
                <span>调用记录</span>
              </div>
            </div>

            <div className="group-grid">
              {filteredHomeGroups.map((group) => (
                <article className={`tool-group ${group.accent}`} key={group.title}>
                  <h2>{group.title}</h2>
                  <div className="group-items">
                    {group.items.map((item) => {
                      const isRunnable = Boolean(homeToolRoutes[item]);
                      return (
                        <button
                          type="button"
                          key={item}
                          className={isRunnable ? "runnable" : "planned"}
                          disabled={!isRunnable}
                          onClick={() => openToolByName(item)}
                        >
                          <span>{item}</span>
                          <small>{isRunnable ? "可使用" : "规划中"}</small>
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activePage === "image-compress" ? (
          <section className="tool-page image-page">
            <div className="page-title">
              <div>
                <p className="eyebrow">Image Compress</p>
                <h1>图片压缩</h1>
                <p>上传图片后在浏览器本地压缩，支持质量、最大宽高、输出格式和下载。</p>
              </div>
              <ShieldCheck size={26} />
            </div>

            <div className="image-workbench">
              <div className="upload-panel">
                <button type="button" className="upload-box" onClick={() => imageInputRef.current?.click()}>
                  <UploadCloud size={34} />
                  <strong>{sourceImage ? sourceImage.name : "点击上传图片"}</strong>
                  <span>支持 JPG、PNG、WebP 等浏览器可读取格式</span>
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageChange} hidden />

                <div className="control-grid">
                  <label>
                    <span>压缩质量：{quality}%</span>
                    <input type="range" min="1" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))} />
                  </label>
                  <label>
                    <span>最大宽度</span>
                    <input type="number" min="1" value={maxWidth} onChange={(event) => setMaxWidth(Number(event.target.value) || 1)} />
                  </label>
                  <label>
                    <span>最大高度</span>
                    <input type="number" min="1" value={maxHeight} onChange={(event) => setMaxHeight(Number(event.target.value) || 1)} />
                  </label>
                  <label>
                    <span>输出格式</span>
                    <select value={format} onChange={(event) => setFormat(event.target.value as ImageFormat)}>
                      <option value="image/jpeg">JPG</option>
                      <option value="image/png">PNG</option>
                      <option value="image/webp">WebP</option>
                    </select>
                  </label>
                </div>

                <button type="button" className="primary-action" onClick={compressImage} disabled={!sourceImage || isCompressing}>
                  <SlidersHorizontal size={18} />
                  {isCompressing ? "压缩中..." : "开始压缩"}
                </button>
              </div>

              <div className="preview-panel">
                <div className="preview-card">
                  <h2>原图</h2>
                  {sourcePreview ? <img src={sourcePreview} alt="原图预览" /> : <div className="empty-preview">等待上传</div>}
                  <div className="info-list">
                    <span>大小：{sourceImage ? formatBytes(sourceImage.size) : "-"}</span>
                    <span>尺寸：{sourceSize ? `${sourceSize.width} x ${sourceSize.height}` : "-"}</span>
                  </div>
                </div>

                <div className="preview-card">
                  <h2>压缩后</h2>
                  {compressedImage ? <img src={compressedImage.url} alt="压缩后预览" /> : <div className="empty-preview">等待压缩</div>}
                  <div className="info-list">
                    <span>大小：{compressedImage ? formatBytes(compressedImage.size) : "-"}</span>
                    <span>尺寸：{compressedImage ? `${compressedImage.width} x ${compressedImage.height}` : "-"}</span>
                    <span>
                      节省：
                      {sourceImage && compressedImage
                        ? `${Math.max(0, 100 - (compressedImage.size / sourceImage.size) * 100).toFixed(1)}%`
                        : "-"}
                    </span>
                  </div>
                  {compressedImage ? (
                    <a className="download-button" href={compressedImage.url} download={compressedImage.name}>
                      <Download size={18} />
                      下载图片
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activePage === "regex-collection" ? (
          <section className="tool-page regex-page">
            <div className="page-title">
              <div>
                <p className="eyebrow">Regex Collection</p>
                <h1>正则大全</h1>
                <p>搜索常用正则，复制表达式，并直接用测试文本验证匹配结果。</p>
              </div>
              <Braces size={28} />
            </div>

            <div className="regex-layout">
              <aside className="regex-list">
                <div className="mini-search">
                  <Search size={17} />
                  <input value={regexSearch} onChange={(event) => setRegexSearch(event.target.value)} placeholder="搜索邮箱、手机号、URL..." />
                </div>
                {filteredRegexRecipes.map((recipe) => (
                  <button
                    type="button"
                    key={recipe.id}
                    className={recipe.id === selectedRegexId ? "active" : ""}
                    onClick={() => selectRegex(recipe)}
                  >
                    <strong>{recipe.title}</strong>
                    <span>{recipe.category}</span>
                  </button>
                ))}
              </aside>

              <div className="regex-detail">
                <div className="regex-header">
                  <div>
                    <h2>{selectedRegex.title}</h2>
                    <p>{selectedRegex.description}</p>
                  </div>
                  <button type="button" className="copy-button" onClick={copyRegex}>
                    <Copy size={17} />
                    {copied ? "已复制" : "复制"}
                  </button>
                </div>

                <label className="pattern-box">
                  <span>正则表达式</span>
                  <input value={regexPattern} onChange={(event) => setRegexPattern(event.target.value)} />
                </label>

                <label className="pattern-box short">
                  <span>Flags</span>
                  <input value={regexFlags} onChange={(event) => setRegexFlags(event.target.value)} />
                </label>

                <label className="test-area">
                  <span>测试文本</span>
                  <textarea value={regexText} onChange={(event) => setRegexText(event.target.value)} />
                </label>

                <div className="match-panel">
                  <h3>匹配结果：{regexMatches.length}</h3>
                  {regexMatches.length > 0 ? (
                    regexMatches.map((match, index) => (
                      <div className="match-row" key={`${match.value}-${match.index}-${index}`}>
                        <strong>{match.value}</strong>
                        <span>index {match.index}</span>
                      </div>
                    ))
                  ) : (
                    <div className="empty-preview">暂无匹配</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activePage === "json-tools" ? (
          <section className="tool-page json-page">
            <div className="page-title">
              <div>
                <p className="eyebrow">API Tools</p>
                <h1>JSON 工具</h1>
                <p>这里使用后端 Runtime 执行工具，会记录审计日志。</p>
              </div>
              <FileJson2 size={28} />
            </div>

            <div className="json-layout">
              <div className="json-tools">
                {apiTools.map((tool) => (
                  <button
                    type="button"
                    key={tool.name}
                    className={tool.name === selectedApiTool ? "active" : ""}
                    onClick={() => {
                      setSelectedApiTool(tool.name);
                      setJsonInput(apiExamples[tool.name] ?? "{}");
                      setJsonResult(null);
                    }}
                  >
                    <strong>{tool.title}</strong>
                    <span>{tool.description}</span>
                  </button>
                ))}
              </div>

              <div className="json-runner">
                {selectedTool ? (
                  <div className="tool-note">
                    <strong>{selectedTool.title}</strong>
                    <span>{selectedTool.description}</span>
                  </div>
                ) : null}
                <label>
                  <span>输入 JSON</span>
                  <textarea value={jsonInput} onChange={(event) => setJsonInput(event.target.value)} />
                </label>
                <button type="button" className="primary-action" onClick={runJsonTool} disabled={isJsonRunning}>
                  <Play size={18} />
                  {isJsonRunning ? "执行中..." : "运行工具"}
                </button>
              </div>

              <pre className="result-view">{jsonResult ? pretty(jsonResult) : "等待执行..."}</pre>
            </div>
          </section>
        ) : null}

        {activePage === "audit" ? (
          <section className="tool-page audit-page">
            <div className="page-title">
              <div>
                <p className="eyebrow">Audit</p>
                <h1>调用审计</h1>
                <p>展示 API 工具和浏览器本地工具的最近调用。</p>
              </div>
              <Database size={28} />
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
                    <CheckCircle2 size={18} />
                  </div>
                ))}
              {totalAuditCount === 0 ? <div className="empty-preview">暂无调用记录</div> : null}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

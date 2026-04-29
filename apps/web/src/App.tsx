import {
  Activity,
  BarChart3,
  Bot,
  Box,
  Braces,
  Building2,
  CalendarDays,
  CheckCircle2,
  CloudSun,
  Code2,
  Coins,
  Copy,
  Database,
  Download,
  Droplets,
  FileImage,
  FileJson2,
  FileText,
  Fuel,
  Hash,
  Headphones,
  Home,
  Image,
  Link2,
  List,
  LockKeyhole,
  MapPin,
  Music,
  Newspaper,
  Paintbrush,
  Palette,
  Play,
  Plus,
  QrCode,
  RefreshCcw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Type,
  UploadCloud,
  Video
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { api, type AuditCall, type PluginSummary, type ToolRunResponse, type ToolSummary } from "./api.js";

type PageId = "home" | "image-compress" | "regex-collection" | "json-tools" | "audit";
type ImageFormat = "image/jpeg" | "image/png" | "image/webp";
type AppIcon = typeof Home;

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

interface HomeTool {
  title: string;
  description: string;
  icon: AppIcon;
  page?: PageId;
  apiTool?: string;
  planned?: boolean;
}

interface HomeSection {
  title: string;
  tools: HomeTool[];
}

const pages: Array<{ id: PageId; label: string }> = [
  { id: "home", label: "首页" },
  { id: "image-compress", label: "图片压缩" },
  { id: "regex-collection", label: "正则大全" },
  { id: "json-tools", label: "数据工具" },
  { id: "audit", label: "审计" }
];

const sidebarItems: Array<{ label: string; icon: AppIcon }> = [
  { label: "首页", icon: Home },
  { label: "日常应用", icon: Sun },
  { label: "查询应用", icon: Search },
  { label: "文档应用", icon: FileText },
  { label: "智能应用", icon: Bot },
  { label: "图片应用", icon: Image },
  { label: "音频应用", icon: Headphones },
  { label: "视频应用", icon: Video },
  { label: "文字应用", icon: Type },
  { label: "加密应用", icon: LockKeyhole },
  { label: "单位转换", icon: Coins },
  { label: "生活应用", icon: Droplets }
];

const jsonTextExamples: Record<string, string> = {
  "json.format": '{\n  "name": "aitbx",\n  "kind": "toolbox"\n}',
  "json.validate": '{"name":"aitbx"}'
};

const pinnedTools: HomeTool[] = [
  {
    title: "图片压缩",
    description: "上传图片，本地压缩并下载",
    icon: Image,
    page: "image-compress"
  },
  {
    title: "正则大全",
    description: "常用正则查询、复制和测试",
    icon: Braces,
    page: "regex-collection"
  },
  {
    title: "数据格式化",
    description: "把结构化数据整理成易读格式",
    icon: FileJson2,
    page: "json-tools",
    apiTool: "json.format"
  },
  {
    title: "添加功能",
    description: "后续接入插件市场和收藏",
    icon: Plus,
    planned: true
  }
];

const homeSections: HomeSection[] = [
  {
    title: "日常应用",
    tools: [
      { title: "调用审计", description: "查看工具调用记录", icon: Activity, page: "audit" },
      { title: "数据验证", description: "检查结构化数据是否合法", icon: CheckCircle2, page: "json-tools", apiTool: "json.validate" },
      { title: "二维码生成", description: "输入文本生成二维码", icon: QrCode, planned: true },
      { title: "今日黄金价格", description: "实时查看黄金价格行情", icon: Coins, planned: true },
      { title: "今日电影票房榜", description: "查看电影票房排行", icon: Video, planned: true },
      { title: "全国油价查询", description: "查询全国最新油价信息", icon: Fuel, planned: true },
      { title: "配色大全", description: "提供丰富的配色方案", icon: Palette, planned: true },
      { title: "万年历", description: "查询公历、农历、节气信息", icon: CalendarDays, planned: true },
      { title: "天气预报", description: "查看天气预报", icon: CloudSun, planned: true },
      { title: "每日早报", description: "每日新闻早报", icon: Newspaper, planned: true }
    ]
  },
  {
    title: "查询应用",
    tools: [
      { title: "企业查询", description: "查询企业工商信息", icon: Building2, planned: true },
      { title: "归属地查询", description: "查询手机号、网络地址归属地", icon: MapPin, planned: true },
      { title: "邮编查询", description: "查询全国邮政编码", icon: Hash, planned: true },
      { title: "经纬度查询", description: "根据经纬度查询地理位置", icon: MapPin, planned: true },
      { title: "世界时间", description: "全球主要城市时间查询", icon: CalendarDays, planned: true },
      { title: "汇率查询", description: "常用币种汇率换算", icon: Coins, planned: true },
      { title: "网络地址查询", description: "查询网络地址信息", icon: Search, planned: true },
      { title: "域名查询", description: "查看域名基础信息", icon: Link2, planned: true }
    ]
  },
  {
    title: "文档应用",
    tools: [
      { title: "PDF 合并", description: "合并多个 PDF 文件", icon: FileText, planned: true },
      { title: "PDF 压缩", description: "减小 PDF 文件体积", icon: FileText, planned: true },
      { title: "PDF 转图片", description: "把 PDF 页面导出为图片", icon: FileImage, planned: true },
      { title: "Word 转 PDF", description: "转换文档格式", icon: FileText, planned: true },
      { title: "Markdown 转换", description: "转换 Markdown 内容", icon: Code2, planned: true }
    ]
  },
  {
    title: "智能应用",
    tools: [
      { title: "数据格式化", description: "格式化结构化文本", icon: FileJson2, page: "json-tools", apiTool: "json.format" },
      { title: "数据验证", description: "验证结构化文本", icon: CheckCircle2, page: "json-tools", apiTool: "json.validate" },
      { title: "调用审计", description: "查看接口和本地工具调用", icon: Database, page: "audit" },
      { title: "工具搜索", description: "按能力搜索工具", icon: Search, planned: true },
      { title: "插件市场", description: "安装和管理插件", icon: Box, planned: true }
    ]
  },
  {
    title: "图片应用",
    tools: [
      { title: "图片压缩", description: "压缩图片并下载", icon: Image, page: "image-compress" },
      { title: "图片格式转换", description: "JPG、PNG、WebP 互转", icon: FileImage, planned: true },
      { title: "图片裁剪", description: "裁剪图片尺寸", icon: Image, planned: true },
      { title: "图片转 Base64", description: "转换图片为 Base64", icon: Hash, planned: true },
      { title: "图片转 PDF", description: "多张图片生成 PDF", icon: FileText, planned: true }
    ]
  },
  {
    title: "音频应用",
    tools: [
      { title: "视频提取音频", description: "提取视频中的音频", icon: Music, planned: true },
      { title: "音频格式转换", description: "常见音频格式互转", icon: Headphones, planned: true },
      { title: "音频压缩", description: "降低音频文件体积", icon: Headphones, planned: true }
    ]
  },
  {
    title: "视频应用",
    tools: [
      { title: "视频压缩", description: "降低视频文件体积", icon: Video, planned: true },
      { title: "视频转 GIF", description: "截取视频生成 GIF", icon: Video, planned: true },
      { title: "视频提取音频", description: "从视频中分离音频", icon: Music, planned: true }
    ]
  },
  {
    title: "文字应用",
    tools: [
      { title: "正则大全", description: "搜索、编辑并测试正则", icon: Braces, page: "regex-collection" },
      { title: "文本统计", description: "统计字数、行数和字符数", icon: BarChart3, planned: true },
      { title: "链接编码", description: "链接内容编码和解码", icon: Link2, planned: true },
      { title: "Base64", description: "Base64 编码和解码", icon: Hash, planned: true },
      { title: "命名转换", description: "camelCase、snake_case 互转", icon: Code2, planned: true }
    ]
  },
  {
    title: "加密应用",
    tools: [
      { title: "哈希计算", description: "计算文本摘要", icon: ShieldCheck, planned: true },
      { title: "令牌解码", description: "解析令牌内容", icon: LockKeyhole, planned: true },
      { title: "密码生成", description: "生成安全随机密码", icon: LockKeyhole, planned: true }
    ]
  },
  {
    title: "单位转换",
    tools: [
      { title: "长度转换", description: "常用长度单位换算", icon: Coins, planned: true },
      { title: "重量转换", description: "常用重量单位换算", icon: Coins, planned: true },
      { title: "时间戳转换", description: "时间戳和日期互转", icon: CalendarDays, planned: true }
    ]
  },
  {
    title: "生活应用",
    tools: [
      { title: "天气预报", description: "查看城市天气", icon: CloudSun, planned: true },
      { title: "配色大全", description: "浏览配色方案", icon: Paintbrush, planned: true },
      { title: "世界时间", description: "全球城市时间查询", icon: CalendarDays, planned: true }
    ]
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
    title: "网页链接",
    category: "网络",
    pattern: "https?:\\/\\/[^\\s]+",
    flags: "g",
    sample: "官网 https://www.magicalbox.cn/ 文档 https://example.com/docs?a=1",
    description: "匹配常见网页链接。"
  },
  {
    id: "ipv4",
    title: "网络地址",
    category: "网络",
    pattern: "\\b(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\b",
    flags: "g",
    sample: "本机 127.0.0.1，网关 192.168.1.1，错误 999.1.1.1",
    description: "匹配合法网络地址。"
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
    title: "十六进制颜色",
    category: "前端",
    pattern: "#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b",
    flags: "g",
    sample: "主题色 #409eff，强调色 #12B981，错误色 #f04438",
    description: "匹配 3 位或 6 位十六进制颜色。"
  },
  {
    id: "chinese",
    title: "中文字符",
    category: "文本",
    pattern: "[\\u4e00-\\u9fa5]+",
    flags: "g",
    sample: "智能体工具箱是一个可被智能体调用的本地工具运行时。",
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

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function localizeToolName(name: string): string {
  const names: Record<string, string> = {
    "json.format": "数据格式化",
    "json.validate": "数据验证",
    "image.compress": "图片压缩"
  };
  return names[name] ?? name;
}

function localizeToolDescription(tool: ToolSummary): string {
  const descriptions: Record<string, string> = {
    "json.format": "把结构化数据解析后整理成带缩进的易读格式。",
    "json.validate": "检查一段结构化数据是否可以被正常解析。"
  };
  return descriptions[tool.name] ?? tool.description;
}

function localizeSummary(summary: string, toolName: string): string {
  if (toolName === "json.format") return "格式化完成。";
  if (toolName === "json.validate" && summary.includes("invalid")) return "数据内容无效。";
  if (toolName === "json.validate") return "数据内容有效。";
  return summary;
}

function localizeCallStatus(status: "success" | "error"): string {
  return status === "success" ? "成功" : "失败";
}

function localizeCallSource(source: string): string {
  if (source === "api") return "接口";
  if (source === "local") return "浏览器本地";
  return source;
}

function resultText(result: ToolRunResponse | null, toolName: string): string {
  if (!result) return "";
  const data = result.result.data;
  if (toolName === "json.format" && typeof data.formatted === "string") return data.formatted;
  if (toolName === "json.validate") {
    if (data.valid === true) return "数据内容有效，可以正常解析。";
    const error = data.error;
    if (error && typeof error === "object" && "message" in error) {
      return `数据内容无效：${String(error.message)}`;
    }
    return "数据内容无效。";
  }
  return pretty(result.result.data);
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

function pageCategory(page: PageId, homeCategory: string): string {
  if (page === "home") return homeCategory;
  if (page === "image-compress") return "图片应用";
  if (page === "regex-collection") return "文字应用";
  if (page === "json-tools" || page === "audit") return "智能应用";
  return "首页";
}

function toolMatches(tool: HomeTool, query: string, sectionTitle: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return `${sectionTitle} ${tool.title} ${tool.description}`.toLowerCase().includes(normalized);
}

export function App() {
  const [activePage, setActivePage] = useState<PageId>(() => pageFromLocation());
  const [homeCategory, setHomeCategory] = useState("首页");
  const [health, setHealth] = useState<"checking" | "ok" | "error">("checking");
  const [plugins, setPlugins] = useState<PluginSummary[]>([]);
  const [apiTools, setApiTools] = useState<ToolSummary[]>([]);
  const [auditCalls, setAuditCalls] = useState<AuditCall[]>([]);
  const [localHistory, setLocalHistory] = useState<LocalHistoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [selectedApiTool, setSelectedApiTool] = useState("json.format");
  const [jsonText, setJsonText] = useState(jsonTextExamples["json.format"]);
  const [jsonIndent, setJsonIndent] = useState(2);
  const [jsonResult, setJsonResult] = useState<ToolRunResponse | null>(null);
  const [isJsonRunning, setIsJsonRunning] = useState(false);
  const [resultCopied, setResultCopied] = useState(false);

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
  const visiblePinnedTools = useMemo(() => {
    if (homeCategory !== "首页") return [];
    return pinnedTools.filter((tool) => toolMatches(tool, search, "首页"));
  }, [homeCategory, search]);
  const visibleHomeSections = useMemo(() => {
    const sections = homeCategory === "首页" ? homeSections : homeSections.filter((section) => section.title === homeCategory);
    return sections
      .map((section) => ({
        ...section,
        tools: section.tools.filter((tool) => toolMatches(tool, search, section.title))
      }))
      .filter((section) => section.tools.length > 0);
  }, [homeCategory, search]);
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

  const totalAuditCount = auditCalls.length + localHistory.length;
  const totalToolCount = pinnedTools.length + homeSections.reduce((count, section) => count + section.tools.length, 0);
  const activeCategory = pageCategory(activePage, homeCategory);

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
      setError(caught instanceof Error ? caught.message : "接口未连接，图片压缩和正则工具仍可本地使用");
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

  function selectSidebar(label: string) {
    setHomeCategory(label);
    navigate("home");
  }

  function openHomeTool(tool: HomeTool) {
    if (tool.planned || !tool.page) return;
    if (tool.apiTool) {
      setSelectedApiTool(tool.apiTool);
      setJsonText(jsonTextExamples[tool.apiTool] ?? "{}");
      setJsonResult(null);
      setResultCopied(false);
    }
    navigate(tool.page);
  }

  function handleHeaderSearch(value: string) {
    setSearch(value);
    setHomeCategory("首页");
    if (activePage !== "home") navigate("home");
  }

  async function runJsonTool() {
    setIsJsonRunning(true);
    setError(null);
    setResultCopied(false);
    try {
      const input =
        selectedApiTool === "json.format"
          ? { text: jsonText, indent: jsonIndent }
          : selectedApiTool === "json.validate"
            ? { text: jsonText }
            : (JSON.parse(jsonText) as Record<string, unknown>);
      const result = await api.runTool(selectedApiTool, input);
      setJsonResult(result);
      const auditResult = await api.auditCalls();
      setAuditCalls(auditResult.calls);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "数据工具执行失败");
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

  async function copyResult() {
    const text = resultText(jsonResult, selectedApiTool);
    if (!text) return;
    await copyText(text);
    setResultCopied(true);
    window.setTimeout(() => setResultCopied(false), 1200);
  }

  function selectRegex(recipe: RegexRecipe) {
    setSelectedRegexId(recipe.id);
    setRegexPattern(recipe.pattern);
    setRegexFlags(recipe.flags);
    setRegexText(recipe.sample);
    setCopied(false);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button type="button" className="brand" onClick={() => selectSidebar("首页")}>
          <span className="brand-mark">
            <Box size={21} />
          </span>
          <strong>智能体工具箱</strong>
        </button>

        <div className="top-meta">
          <span>本地工具运行时</span>
          <button type="button" className="function-list" onClick={() => selectSidebar("首页")}>
            <List size={15} />
            功能列表
          </button>
        </div>

        <div className="top-actions">
          <label className="top-search">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => handleHeaderSearch(event.target.value)}
              onFocus={() => {
                setHomeCategory("首页");
                if (activePage !== "home") navigate("home");
              }}
              placeholder={`搜索${totalToolCount}项功能`}
            />
          </label>
          <button type="button" className="icon-button" title="刷新接口状态" onClick={refresh}>
            <RefreshCcw size={18} />
          </button>
          <button type="button" className={`runtime-pill ${health}`} onClick={() => navigate("audit")} title="查看工具运行审计">
            <span className={`status-dot ${health}`} />
            <span>{health === "ok" ? "接口已连接" : health === "checking" ? "检查中" : "接口未连接"}</span>
            <small>{plugins.length} 插件 · {apiTools.length} 工具</small>
          </button>
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          {sidebarItems.map((item) => (
            <button
              type="button"
              key={item.label}
              className={activeCategory === item.label ? "active" : ""}
              onClick={() => selectSidebar(item.label)}
            >
              <item.icon size={21} />
              <span>{item.label}</span>
            </button>
          ))}
        </aside>

        <main className="workspace">
          {error ? (
            <section className="notice" role="alert">
              <Settings2 size={18} />
              <span>{error}</span>
            </section>
          ) : null}

          {activePage === "home" ? (
            <section className="home-page">
              <div className="content-toolbar">
                <h1>{homeCategory}</h1>
                <button type="button" className="ghost-tool">
                  <List size={18} />
                  <Sparkles size={14} />
                </button>
              </div>

              {visiblePinnedTools.length > 0 ? (
                <section className="pinned-grid" aria-label="常用功能">
                  {visiblePinnedTools.map((tool) => (
                    <button
                      type="button"
                      key={tool.title}
                      className={`tool-tile ${tool.planned ? "planned" : ""}`}
                      disabled={tool.planned}
                      onClick={() => openHomeTool(tool)}
                    >
                      <tool.icon size={23} />
                      <strong>{tool.title}</strong>
                      <span>{tool.description}</span>
                    </button>
                  ))}
                </section>
              ) : null}

              <div className="stats-strip">
                <span>插件 {plugins.length}</span>
                <span>接口工具 {apiTools.length}</span>
                <span>调用 {totalAuditCount}</span>
                <span className={health === "ok" ? "ok" : health === "error" ? "error" : ""}>
                  {health === "ok" ? "接口已连接" : health === "checking" ? "接口检查中" : "接口未连接"}
                </span>
              </div>

              {visibleHomeSections.map((section) => (
                <section className="tool-section" key={section.title}>
                  <h2>{section.title}</h2>
                  <div className="tool-card-grid">
                    {section.tools.map((tool) => (
                      <button
                        type="button"
                        key={`${section.title}-${tool.title}`}
                        className={`tool-tile ${tool.planned ? "planned" : ""}`}
                        disabled={tool.planned}
                        onClick={() => openHomeTool(tool)}
                      >
                        <tool.icon size={23} />
                        <strong>{tool.title}</strong>
                        <span>{tool.description}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </section>
          ) : null}

          {activePage === "image-compress" ? (
            <section className="tool-page image-page">
              <div className="page-title">
                <div>
                  <p className="eyebrow">图片应用</p>
                  <h1>图片压缩</h1>
                  <p>上传图片后在浏览器本地压缩，支持质量、最大宽高、输出格式和下载。</p>
                </div>
                <ShieldCheck size={24} />
              </div>

              <div className="image-workbench">
                <div className="upload-panel">
                  <button type="button" className="upload-box" onClick={() => imageInputRef.current?.click()}>
                    <UploadCloud size={32} />
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
                  <p className="eyebrow">文字应用</p>
                  <h1>正则大全</h1>
                  <p>搜索常用正则，复制表达式，并直接用测试文本验证匹配结果。</p>
                </div>
                <Braces size={26} />
              </div>

              <div className="regex-layout">
                <aside className="regex-list">
                  <div className="mini-search">
                    <Search size={17} />
                    <input value={regexSearch} onChange={(event) => setRegexSearch(event.target.value)} placeholder="搜索邮箱、手机号、链接..." />
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
                  <span>匹配选项</span>
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
                          <span>位置 {match.index}</span>
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
                  <p className="eyebrow">智能应用</p>
                  <h1>数据工具</h1>
                  <p>这里使用后端工具运行时执行任务，会记录审计日志；页面展示给人看的结果。</p>
                </div>
                <FileJson2 size={26} />
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
                        setJsonText(jsonTextExamples[tool.name] ?? "{}");
                        setJsonResult(null);
                        setResultCopied(false);
                      }}
                    >
                      <strong>{localizeToolName(tool.name)}</strong>
                      <span>{localizeToolDescription(tool)}</span>
                    </button>
                  ))}
                </div>

                <div className="json-runner">
                  {selectedTool ? (
                    <div className="tool-note">
                      <strong>{localizeToolName(selectedTool.name)}</strong>
                      <span>{localizeToolDescription(selectedTool)}</span>
                    </div>
                  ) : null}
                  <label>
                    <span>粘贴需要处理的数据内容</span>
                    <textarea value={jsonText} onChange={(event) => setJsonText(event.target.value)} />
                  </label>
                  {selectedApiTool === "json.format" ? (
                    <label className="indent-field">
                      <span>缩进空格</span>
                      <select value={jsonIndent} onChange={(event) => setJsonIndent(Number(event.target.value))}>
                        <option value={0}>不缩进</option>
                        <option value={2}>2 个空格</option>
                        <option value={4}>4 个空格</option>
                        <option value={8}>8 个空格</option>
                      </select>
                    </label>
                  ) : null}
                  <button type="button" className="primary-action" onClick={runJsonTool} disabled={isJsonRunning}>
                    <Play size={18} />
                    {isJsonRunning ? "执行中..." : "运行工具"}
                  </button>
                </div>

                <div className="result-panel">
                  <div className="result-header">
                    <div>
                      <span className="result-kicker">运行结果</span>
                      <h2>{jsonResult ? localizeSummary(jsonResult.result.summary, selectedApiTool) : "等待执行"}</h2>
                    </div>
                    {jsonResult ? (
                      <button type="button" className="copy-button" onClick={copyResult}>
                        <Copy size={17} />
                        {resultCopied ? "已复制" : "复制结果"}
                      </button>
                    ) : null}
                  </div>

                  {!jsonResult ? (
                    <div className="result-empty">
                      <FileJson2 size={28} />
                      <strong>还没有运行结果</strong>
                      <span>点击“运行工具”后，这里会显示适合用户阅读的结果卡片。</span>
                    </div>
                  ) : selectedApiTool === "json.format" ? (
                    <label className="human-output">
                      <span>格式化后的内容</span>
                      <textarea readOnly value={resultText(jsonResult, selectedApiTool)} />
                    </label>
                  ) : (
                    <div className={`validation-result ${jsonResult.result.data.valid === true ? "valid" : "invalid"}`}>
                      <CheckCircle2 size={26} />
                      <div>
                        <strong>{jsonResult.result.data.valid === true ? "数据内容有效" : "数据内容无效"}</strong>
                        <span>
                          {jsonResult.result.data.valid === true
                            ? "这段内容可以被正常解析。"
                            : "请根据错误信息修正后再试。"}
                        </span>
                        {jsonResult.result.data.valid === false &&
                        jsonResult.result.data.error &&
                        typeof jsonResult.result.data.error === "object" ? (
                          <dl>
                            {"message" in jsonResult.result.data.error ? (
                              <>
                                <dt>错误信息</dt>
                                <dd>{String(jsonResult.result.data.error.message)}</dd>
                              </>
                            ) : null}
                            {"position" in jsonResult.result.data.error ? (
                              <>
                                <dt>错误位置</dt>
                                <dd>{String(jsonResult.result.data.error.position)}</dd>
                              </>
                            ) : null}
                          </dl>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {jsonResult ? (
                    <div className="result-meta">
                      <span>工具：{localizeToolName(jsonResult.tool_name)}</span>
                      <span>耗时：{jsonResult.usage.duration_ms}ms</span>
                      <span>费用：{jsonResult.usage.cost_usd === 0 ? "无" : `$${jsonResult.usage.cost_usd}`}</span>
                    </div>
                  ) : null}

                  {jsonResult ? (
                    <details className="raw-result">
                      <summary>给智能体或调试使用的原始数据</summary>
                      <pre>{pretty(jsonResult)}</pre>
                    </details>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {activePage === "audit" ? (
            <section className="tool-page audit-page">
              <div className="page-title">
                <div>
                  <p className="eyebrow">智能应用</p>
                  <h1>调用审计</h1>
                  <p>展示接口工具和浏览器本地工具的最近调用。</p>
                </div>
                <Database size={26} />
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
                        <strong>{localizeToolName(call.tool_name)}</strong>
                        <small>
                          {localizeCallSource(call.source)} · {localizeCallStatus(call.status)} · {call.duration_ms}ms ·{" "}
                          {new Date(call.created_at).toLocaleString()}
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

      <footer className="app-footer">
        <span>版权所有 © 2026 智能体工具箱</span>
        <span>本地优先 · 插件化工具运行时 · 智能体可调用</span>
      </footer>
    </div>
  );
}

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PluginSummary {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  tools_count: number;
}

export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  description?: string;
  [key: string]: unknown;
}

export interface ToolSummary {
  name: string;
  title: string;
  description: string;
  category: string;
  risk_level: "low" | "medium" | "high";
  input_schema: JsonSchema;
  output_schema?: JsonSchema;
  plugin_id: string;
}

export interface ToolRunResponse {
  tool_name: string;
  plugin_id: string;
  result: {
    summary: string;
    artifacts: unknown[];
    data: Record<string, unknown>;
  };
  usage: {
    duration_ms: number;
    cost_usd: number;
  };
}

export interface AuditCall {
  id: string;
  tool_name: string;
  plugin_id: string;
  input_json: unknown;
  output_json: unknown;
  status: "success" | "error";
  duration_ms: number;
  error_code?: string;
  created_at: string;
  finished_at: string;
}

export interface AiInterface {
  id: string;
  title: string;
  description: string;
  method: "GET" | "POST";
  path: string;
  status: "available" | "planned";
  ai_tool_name?: string;
  example_request?: unknown;
  example_response?: unknown;
}

export interface AiInterfacesResponse {
  recommended_flow: string[];
  guidance: {
    principle: string;
    first_stage_tools: string[];
  };
  interfaces: AiInterface[];
}

export interface FileSummary {
  file_id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  kind: "input_file" | "output_file" | "temp_file" | "log_file" | "preview_file" | "archive_file";
  created_at: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("文件读取失败"));
        return;
      }

      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });
  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !body.ok) {
    const message = body.error?.message ?? `请求失败：${response.status}`;
    throw new Error(message);
  }

  return body.data as T;
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  aiInterfaces: () => request<AiInterfacesResponse>("/v1/ai/interfaces"),
  files: () => request<{ files: FileSummary[] }>("/v1/files"),
  uploadFile: async (file: File) =>
    request<FileSummary>("/v1/files", {
      method: "POST",
      body: JSON.stringify({
        name: file.name,
        mime_type: file.type || "application/octet-stream",
        content_base64: await fileToBase64(file)
      })
    }),
  plugins: () => request<{ plugins: PluginSummary[] }>("/v1/plugins"),
  tools: (query = "") =>
    request<{ tools: ToolSummary[] }>(`/v1/tools/search?q=${encodeURIComponent(query)}`),
  tool: (name: string) => request<ToolSummary>(`/v1/tools/${encodeURIComponent(name)}`),
  runTool: (name: string, input: Record<string, unknown>) =>
    request<ToolRunResponse>(`/v1/tools/${encodeURIComponent(name)}/run`, {
      method: "POST",
      body: JSON.stringify({ input })
    }),
  auditCalls: () => request<{ calls: AuditCall[] }>("/v1/audit/calls")
};

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

export interface ToolPermissions {
  filesystem: string[];
  network: boolean;
  secrets: string[];
  shell: boolean;
  max_runtime_seconds: number;
  max_memory_mb: number;
}

export interface ToolSecurityProfile {
  tool_name: string;
  plugin_id: string;
  risk_level: "low" | "medium" | "high";
  approval_required: boolean;
  approval_reason: string;
  permissions: ToolPermissions;
  policy: {
    decision: "allow" | "require_approval";
    approval_ttl_seconds: number;
  };
}

export interface SecurityPolicy {
  approval_ttl_seconds: number;
  risk_levels: Array<{
    risk_level: "low" | "medium" | "high";
    label: string;
    description: string;
    approval_required: boolean;
  }>;
  permission_types: Array<{
    key: string;
    label: string;
    description: string;
  }>;
  rules: Array<{
    id: string;
    title: string;
    description: string;
  }>;
}

export interface ApprovalSummary {
  approval_id: string;
  tool_name: string;
  plugin_id: string;
  risk_level: "low" | "medium" | "high";
  reason: string;
  status: "active" | "used" | "expired";
  created_at: string;
  expires_at: string;
  used_at?: string;
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

export interface ApprovalCreateResponse extends ApprovalSummary {
  approval_required: boolean;
  approval_token?: string;
  message?: string;
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
  securityPolicy: () => request<SecurityPolicy>("/v1/security/policy"),
  approvals: () => request<{ approvals: ApprovalSummary[] }>("/v1/approvals"),
  createApproval: (toolName: string, reason?: string) =>
    request<ApprovalCreateResponse>("/v1/approvals", {
      method: "POST",
      body: JSON.stringify({
        tool_name: toolName,
        ...(reason ? { reason } : {})
      })
    }),
  tools: (query = "") =>
    request<{ tools: ToolSummary[] }>(`/v1/tools/search?q=${encodeURIComponent(query)}`),
  tool: (name: string) => request<ToolSummary>(`/v1/tools/${encodeURIComponent(name)}`),
  toolSecurity: (name: string) =>
    request<ToolSecurityProfile>(`/v1/tools/${encodeURIComponent(name)}/security`),
  runTool: (name: string, input: Record<string, unknown>, approvalToken?: string) =>
    request<ToolRunResponse>(`/v1/tools/${encodeURIComponent(name)}/run`, {
      method: "POST",
      body: JSON.stringify({
        input,
        ...(approvalToken ? { approval_token: approvalToken } : {})
      })
    }),
  auditCalls: () => request<{ calls: AuditCall[] }>("/v1/audit/calls")
};

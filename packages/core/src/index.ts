export type RiskLevel = "low" | "medium" | "high";

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

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  category: string;
  risk_level: RiskLevel;
  input_schema: JsonSchema;
  output_schema?: JsonSchema;
}

export interface PluginManifest {
  schema_version: string;
  id: string;
  name: string;
  version: string;
  description: string;
  runtime: {
    type: "builtin" | "cli" | "python";
    entry?: string;
  };
  permissions: {
    filesystem: string[];
    network: boolean;
    secrets: string[];
    shell: boolean;
    max_runtime_seconds: number;
    max_memory_mb: number;
  };
  tools: ToolDefinition[];
}

export interface ToolSuccess {
  ok: true;
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

export interface ToolFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
  usage: {
    duration_ms: number;
    cost_usd: number;
  };
}

export type ToolResult = ToolSuccess | ToolFailure;

export interface ToolContext {
  toolName: string;
  pluginId: string;
}

export type ToolHandler = (
  input: Record<string, unknown>,
  context: ToolContext
) => Promise<ToolResult> | ToolResult;

export interface ToolboxPlugin {
  manifest: PluginManifest;
  handlers: Record<string, ToolHandler>;
}

export interface RegisteredTool extends ToolDefinition {
  plugin_id: string;
}

export interface ToolCallLog {
  id: string;
  tool_name: string;
  plugin_id: string;
  input_json: Record<string, unknown>;
  output_json: ToolResult;
  status: "success" | "error";
  duration_ms: number;
  created_at: string;
}

export class InMemoryAuditLog {
  private readonly calls: ToolCallLog[] = [];

  record(call: Omit<ToolCallLog, "id" | "created_at">): ToolCallLog {
    const entry: ToolCallLog = {
      ...call,
      id: `call_${crypto.randomUUID()}`,
      created_at: new Date().toISOString()
    };
    this.calls.push(entry);
    return entry;
  }

  list(): ToolCallLog[] {
    return [...this.calls];
  }
}

export class ToolboxRuntime {
  private readonly plugins = new Map<string, PluginManifest>();
  private readonly handlers = new Map<string, ToolHandler>();
  private readonly tools = new Map<string, RegisteredTool>();

  constructor(private readonly auditLog = new InMemoryAuditLog()) {}

  registerPlugin(plugin: ToolboxPlugin): void {
    this.plugins.set(plugin.manifest.id, plugin.manifest);

    for (const tool of plugin.manifest.tools) {
      const handler = plugin.handlers[tool.name];
      if (!handler) {
        throw new Error(`Missing handler for tool ${tool.name}`);
      }

      this.tools.set(tool.name, {
        ...tool,
        plugin_id: plugin.manifest.id
      });
      this.handlers.set(tool.name, handler);
    }
  }

  listPlugins(): PluginManifest[] {
    return [...this.plugins.values()];
  }

  searchTools(query: string): RegisteredTool[] {
    const normalized = query.trim().toLowerCase();
    const tools = [...this.tools.values()];

    if (!normalized) {
      return tools;
    }

    return tools.filter((tool) => {
      return [tool.name, tool.title, tool.description, tool.category]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }

  getTool(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  getAuditLog(): ToolCallLog[] {
    return this.auditLog.list();
  }

  async runTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    const handler = this.handlers.get(name);

    if (!tool || !handler) {
      return {
        ok: false,
        error: {
          code: "TOOL_NOT_FOUND",
          message: `Tool not found: ${name}`,
          retryable: false
        },
        usage: {
          duration_ms: 0,
          cost_usd: 0
        }
      };
    }

    const started = performance.now();
    const result = await handler(input, {
      toolName: name,
      pluginId: tool.plugin_id
    });
    const durationMs = Math.round(performance.now() - started);

    const output = {
      ...result,
      usage: {
        ...result.usage,
        duration_ms: result.usage.duration_ms || durationMs
      }
    } as ToolResult;

    this.auditLog.record({
      tool_name: name,
      plugin_id: tool.plugin_id,
      input_json: input,
      output_json: output,
      status: output.ok ? "success" : "error",
      duration_ms: output.usage.duration_ms
    });

    return output;
  }
}

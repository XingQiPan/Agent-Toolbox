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
  input_json: unknown;
  output_json: ToolResult;
  status: "success" | "error";
  duration_ms: number;
  error_code?: string;
  created_at: string;
  finished_at: string;
}

type AuditLogInput = Omit<ToolCallLog, "id" | "created_at" | "finished_at"> & {
  created_at?: string;
  finished_at?: string;
};

export class ToolboxValidationError extends Error {
  constructor(
    message: string,
    readonly issues: string[]
  ) {
    super(message);
    this.name = "ToolboxValidationError";
  }
}

const SUPPORTED_RUNTIME_TYPES = new Set(["builtin", "cli", "python"]);
const SUPPORTED_RISK_LEVELS = new Set(["low", "medium", "high"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function requireManifestString(
  record: Record<string, unknown>,
  field: string,
  issues: string[],
  path = "Plugin manifest"
): void {
  if (!hasOwn(record, field)) {
    issues.push(`${path} is missing required field "${field}".`);
    return;
  }

  if (!isNonEmptyString(record[field])) {
    issues.push(`${path} field "${field}" must be a non-empty string.`);
  }
}

export function validatePluginManifest(manifest: unknown): asserts manifest is PluginManifest {
  const issues: string[] = [];

  if (!isRecord(manifest)) {
    throw new ToolboxValidationError("Invalid plugin manifest: manifest must be an object.", [
      "Plugin manifest must be an object."
    ]);
  }

  requireManifestString(manifest, "id", issues);
  requireManifestString(manifest, "name", issues);
  requireManifestString(manifest, "version", issues);

  if (!hasOwn(manifest, "runtime")) {
    issues.push('Plugin manifest is missing required field "runtime".');
  } else if (!isRecord(manifest.runtime)) {
    issues.push('Plugin manifest field "runtime" must be an object.');
  } else {
    const runtimeType = manifest.runtime.type;
    if (!isNonEmptyString(runtimeType)) {
      issues.push('Plugin manifest field "runtime.type" must be a non-empty string.');
    } else if (!SUPPORTED_RUNTIME_TYPES.has(runtimeType)) {
      issues.push(
        `Plugin manifest field "runtime.type" must be one of: ${[...SUPPORTED_RUNTIME_TYPES].join(", ")}.`
      );
    }
  }

  if (!hasOwn(manifest, "tools")) {
    issues.push('Plugin manifest is missing required field "tools".');
  } else if (!Array.isArray(manifest.tools)) {
    issues.push('Plugin manifest field "tools" must be an array.');
  } else {
    const toolNames = new Set<string>();

    manifest.tools.forEach((tool, index) => {
      const path = `Plugin manifest tool at index ${index}`;

      if (!isRecord(tool)) {
        issues.push(`${path} must be an object.`);
        return;
      }

      requireManifestString(tool, "name", issues, path);
      requireManifestString(tool, "title", issues, path);
      requireManifestString(tool, "description", issues, path);
      requireManifestString(tool, "category", issues, path);

      if (!hasOwn(tool, "risk_level")) {
        issues.push(`${path} is missing required field "risk_level".`);
      } else if (!isNonEmptyString(tool.risk_level) || !SUPPORTED_RISK_LEVELS.has(tool.risk_level)) {
        issues.push(`${path} field "risk_level" must be one of: ${[...SUPPORTED_RISK_LEVELS].join(", ")}.`);
      }

      if (!hasOwn(tool, "input_schema")) {
        issues.push(`${path} is missing required field "input_schema".`);
      } else if (!isRecord(tool.input_schema)) {
        issues.push(`${path} field "input_schema" must be an object.`);
      }

      if (isNonEmptyString(tool.name)) {
        if (toolNames.has(tool.name)) {
          issues.push(`${path} uses duplicate tool name "${tool.name}".`);
        }
        toolNames.add(tool.name);
      }
    });
  }

  if (issues.length > 0) {
    throw new ToolboxValidationError(`Invalid plugin manifest: ${issues.join(" ")}`, issues);
  }
}

export function validateToolInput(schema: JsonSchema, input: unknown): string[] {
  return validateJsonSchemaValue(schema, input, "input");
}

function validateJsonSchemaValue(schema: JsonSchema, value: unknown, path: string): string[] {
  const issues: string[] = [];
  const types = getSchemaTypes(schema);

  if (types.length > 0 && !types.some((type) => matchesJsonSchemaType(type, value))) {
    issues.push(`${path} must be ${formatSchemaTypes(types)}.`);
    return issues;
  }

  const shouldValidateObject =
    types.includes("object") ||
    schema.properties !== undefined ||
    schema.required !== undefined ||
    schema.additionalProperties === false;

  if (shouldValidateObject) {
    if (!isRecord(value)) {
      issues.push(`${path} must be an object.`);
      return issues;
    }

    const properties = schema.properties ?? {};

    for (const requiredProperty of schema.required ?? []) {
      if (!hasOwn(value, requiredProperty)) {
        issues.push(`${path} is missing required property "${requiredProperty}".`);
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!hasOwn(properties, key)) {
          issues.push(`${path} has unknown property "${key}".`);
        }
      }
    }

    for (const [key, propertySchema] of Object.entries(properties)) {
      if (hasOwn(value, key)) {
        issues.push(...validateJsonSchemaValue(propertySchema, value[key], `${path}.${key}`));
      }
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      issues.push(`${path} must be greater than or equal to ${schema.minimum}.`);
    }

    if (typeof schema.maximum === "number" && value > schema.maximum) {
      issues.push(`${path} must be less than or equal to ${schema.maximum}.`);
    }
  }

  return issues;
}

function getSchemaTypes(schema: JsonSchema): string[] {
  if (typeof schema.type === "string") {
    return [schema.type];
  }

  if (Array.isArray(schema.type)) {
    return schema.type.filter((type): type is string => typeof type === "string");
  }

  if (schema.properties !== undefined || schema.required !== undefined || schema.additionalProperties !== undefined) {
    return ["object"];
  }

  return [];
}

function matchesJsonSchemaType(type: string, value: unknown): boolean {
  switch (type) {
    case "array":
      return Array.isArray(value);
    case "boolean":
      return typeof value === "boolean";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "null":
      return value === null;
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "object":
      return isRecord(value);
    case "string":
      return typeof value === "string";
    default:
      return true;
  }
}

function formatSchemaTypes(types: string[]): string {
  const formatted = types.map((type) => {
    switch (type) {
      case "array":
        return "an array";
      case "boolean":
        return "a boolean";
      case "integer":
        return "an integer";
      case "null":
        return "null";
      case "number":
        return "a number";
      case "object":
        return "an object";
      case "string":
        return "a string";
      default:
        return type;
    }
  });

  if (formatted.length <= 1) {
    return formatted[0] ?? "a valid value";
  }

  return `${formatted.slice(0, -1).join(", ")} or ${formatted.at(-1)}`;
}

function createFailure(code: string, message: string, retryable = false): ToolFailure {
  return {
    ok: false,
    error: {
      code,
      message,
      retryable
    },
    usage: {
      duration_ms: 0,
      cost_usd: 0
    }
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function isToolResult(value: unknown): value is ToolResult {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return false;
  }

  if (value.ok === true) {
    return isRecord(value.result);
  }

  return (
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    typeof value.error.message === "string" &&
    typeof value.error.retryable === "boolean"
  );
}

function getCostUsd(result: ToolResult): number {
  const usage = isRecord(result.usage) ? result.usage : undefined;
  const costUsd = usage?.cost_usd;

  return typeof costUsd === "number" && Number.isFinite(costUsd) ? costUsd : 0;
}

function withMeasuredDuration(result: ToolResult, durationMs: number): ToolResult {
  return {
    ...result,
    usage: {
      duration_ms: durationMs,
      cost_usd: getCostUsd(result)
    }
  };
}

export class InMemoryAuditLog {
  private readonly calls: ToolCallLog[] = [];

  record(call: AuditLogInput): ToolCallLog {
    const now = new Date().toISOString();
    const entry: ToolCallLog = {
      ...call,
      id: `call_${crypto.randomUUID()}`,
      created_at: call.created_at ?? now,
      finished_at: call.finished_at ?? now
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
    validatePluginManifest(plugin.manifest);

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
    const startedAt = new Date();
    const started = performance.now();
    const tool = this.tools.get(name);
    const handler = this.handlers.get(name);

    const finish = (pluginId: string, result: ToolResult): ToolResult => {
      const durationMs = Math.max(0, Math.round(performance.now() - started));
      const output = withMeasuredDuration(result, durationMs);

      this.auditLog.record({
        tool_name: name,
        plugin_id: pluginId,
        input_json: input,
        output_json: output,
        status: output.ok ? "success" : "error",
        duration_ms: durationMs,
        error_code: output.ok ? undefined : output.error.code,
        created_at: startedAt.toISOString(),
        finished_at: new Date().toISOString()
      });

      return output;
    };

    if (!tool || !handler) {
      return finish(tool?.plugin_id ?? "unknown", createFailure("TOOL_NOT_FOUND", `Tool not found: ${name}`));
    }

    const validationIssues = validateToolInput(tool.input_schema, input);
    if (validationIssues.length > 0) {
      return finish(
        tool.plugin_id,
        createFailure("SCHEMA_VALIDATION_FAILED", `Invalid input for ${name}: ${validationIssues.join(" ")}`)
      );
    }

    try {
      const result = await handler(input, {
        toolName: name,
        pluginId: tool.plugin_id
      });

      if (!isToolResult(result)) {
        return finish(tool.plugin_id, createFailure("TOOL_RUNTIME_ERROR", `Tool handler for ${name} returned an invalid result.`));
      }

      return finish(tool.plugin_id, result);
    } catch (error) {
      return finish(
        tool.plugin_id,
        createFailure("TOOL_RUNTIME_ERROR", `Tool handler for ${name} failed: ${getErrorMessage(error)}`)
      );
    }
  }
}

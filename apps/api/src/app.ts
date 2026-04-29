import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyServerOptions
} from "fastify";
import type { JsonSchema } from "@agent-toolbox/core";
import { ToolboxRuntime } from "@agent-toolbox/core";
import { jsonBasicPlugin } from "@agent-toolbox/plugin-json-basic";

interface ApiSuccess<TData> {
  ok: true;
  data: TData;
}

interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

type ApiEnvelope<TData> = ApiSuccess<TData> | ApiFailure;

interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

interface AiInterface {
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

type FileKind = "input_file" | "output_file" | "temp_file" | "log_file" | "preview_file" | "archive_file";

interface StoredFile {
  file_id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  kind: FileKind;
  created_at: string;
  content: Buffer;
}

interface FileSummary {
  file_id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  kind: FileKind;
  created_at: string;
}

export interface BuildAppOptions {
  logger?: FastifyServerOptions["logger"];
  runtime?: ToolboxRuntime;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function createRuntime(): ToolboxRuntime {
  const runtime = new ToolboxRuntime();
  runtime.registerPlugin(jsonBasicPlugin);
  return runtime;
}

function success<TData>(data: TData): ApiEnvelope<TData> {
  return {
    ok: true,
    data
  };
}

function failure(code: string, message: string, details?: unknown): ApiFailure {
  return {
    ok: false,
    error: details === undefined ? { code, message } : { code, message, details }
  };
}

function sendFailure(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
) {
  return reply.code(statusCode).send(failure(code, message, details));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFileSummary(file: StoredFile): FileSummary {
  return {
    file_id: file.file_id,
    name: file.name,
    mime_type: file.mime_type,
    size_bytes: file.size_bytes,
    kind: file.kind,
    created_at: file.created_at
  };
}

function sanitizeFileName(name: string): string {
  const sanitized = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  return sanitized.length > 0 ? sanitized.slice(0, 180) : "untitled";
}

function decodeBase64Content(value: string): Buffer | undefined {
  const content = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  const normalized = content.replace(/\s/g, "");

  if (normalized.length === 0 || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    return undefined;
  }

  const buffer = Buffer.from(normalized, "base64");
  return buffer.length > 0 ? buffer : undefined;
}

class InMemoryFileStore {
  private readonly files = new Map<string, StoredFile>();

  create(input: {
    name: string;
    mime_type?: string;
    kind?: FileKind;
    content: Buffer;
  }): StoredFile {
    const now = new Date().toISOString();
    const file: StoredFile = {
      file_id: `file_${crypto.randomUUID()}`,
      name: sanitizeFileName(input.name),
      mime_type: input.mime_type?.trim() || "application/octet-stream",
      kind: input.kind ?? "input_file",
      size_bytes: input.content.byteLength,
      created_at: now,
      content: input.content
    };

    this.files.set(file.file_id, file);
    return file;
  }

  list(): FileSummary[] {
    return [...this.files.values()].map(toFileSummary);
  }

  get(fileId: string): StoredFile | undefined {
    return this.files.get(fileId);
  }
}

function buildAiInterfaces(): AiInterface[] {
  return [
    {
      id: "toolbox.search_tools",
      title: "搜索工具",
      description: "智能体先用短关键词搜索候选工具，避免一次性加载全部参数结构。",
      method: "GET",
      path: "/v1/tools/search?q={query}",
      status: "available",
      ai_tool_name: "toolbox.search_tools",
      example_request: {
        query: "格式化 JSON"
      },
      example_response: {
        tools: [
          {
            name: "json.format",
            title: "数据格式化",
            risk_level: "low",
            plugin_id: "json.basic"
          }
        ]
      }
    },
    {
      id: "toolbox.get_tool_schema",
      title: "获取工具详情",
      description: "智能体只在需要时加载少量工具参数结构，用于生成准确参数。",
      method: "GET",
      path: "/v1/tools/{tool_name}",
      status: "available",
      ai_tool_name: "toolbox.get_tool_schema",
      example_request: {
        tool_name: "json.format"
      },
      example_response: {
        name: "json.format",
        input_schema: {
          type: "object",
          required: ["text"]
        }
      }
    },
    {
      id: "toolbox.run_tool",
      title: "执行工具",
      description: "智能体根据工具参数结构传入结构化输入，运行时校验、执行并记录审计。",
      method: "POST",
      path: "/v1/tools/{tool_name}/run",
      status: "available",
      ai_tool_name: "toolbox.run_tool",
      example_request: {
        input: {
          text: "{\"name\":\"aitbx\"}",
          indent: 2
        },
        session_id: "sess_001"
      },
      example_response: {
        tool_name: "json.format",
        result: {
          summary: "格式化完成。",
          artifacts: [],
          data: {
            formatted: "{\n  \"name\": \"aitbx\"\n}"
          }
        }
      }
    },
    {
      id: "toolbox.list_plugins",
      title: "查看插件",
      description: "列出当前已注册插件和工具数量，适合运行前健康检查。",
      method: "GET",
      path: "/v1/plugins",
      status: "available",
      example_response: {
        plugins: [
          {
            id: "json.basic",
            enabled: true,
            tools_count: 2
          }
        ]
      }
    },
    {
      id: "toolbox.list_audit_calls",
      title: "查看审计",
      description: "查看工具调用记录，用于调试、追踪和治理。",
      method: "GET",
      path: "/v1/audit/calls",
      status: "available",
      example_response: {
        calls: []
      }
    },
    {
      id: "toolbox.list_files",
      title: "列出文件",
      description: "查看当前运行时内存中的输入文件和工具产物。",
      method: "GET",
      path: "/v1/files",
      status: "available",
      ai_tool_name: "toolbox.list_files",
      example_response: {
        files: []
      }
    },
    {
      id: "toolbox.upload_file",
      title: "上传文件",
      description: "把用户文件转换为文件标识，后续工具只引用文件标识。",
      method: "POST",
      path: "/v1/files",
      status: "available",
      ai_tool_name: "toolbox.upload_file",
      example_request: {
        name: "input.txt",
        mime_type: "text/plain",
        content_base64: "SGVsbG8="
      },
      example_response: {
        file_id: "file_abc123",
        name: "input.txt",
        mime_type: "text/plain",
        size_bytes: 5
      }
    },
    {
      id: "toolbox.get_file",
      title: "获取文件信息",
      description: "查询产物或输入文件元数据，避免把大文件塞进模型上下文。",
      method: "GET",
      path: "/v1/files/{file_id}",
      status: "available",
      ai_tool_name: "toolbox.get_file"
    },
    {
      id: "toolbox.download_file",
      title: "下载文件",
      description: "按文件标识下载原始文件内容，通常给用户或后续工具使用。",
      method: "GET",
      path: "/v1/files/{file_id}/download",
      status: "available",
      ai_tool_name: "toolbox.download_file"
    },
    {
      id: "toolbox.mcp_tools",
      title: "MCP 工具列表与调用",
      description: "把工具箱作为 MCP 服务暴露给支持 MCP 的客户端。",
      method: "POST",
      path: "/mcp",
      status: "planned"
    }
  ];
}

function toTypeList(schema: JsonSchema): string[] {
  if (typeof schema.type === "string") {
    return [schema.type];
  }

  if (Array.isArray(schema.type)) {
    return schema.type;
  }

  return [];
}

function matchesType(value: unknown, type: string): boolean {
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

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateJsonSchema(value: unknown, schema: JsonSchema, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const expectedTypes = toTypeList(schema);

  if (expectedTypes.length > 0 && !expectedTypes.some((type) => matchesType(value, type))) {
    issues.push({
      path,
      code: "INVALID_TYPE",
      message: `Expected ${path} to be ${expectedTypes.join(" or ")}.`
    });
    return issues;
  }

  if (schema.enum && !schema.enum.some((allowedValue) => valuesEqual(value, allowedValue))) {
    issues.push({
      path,
      code: "INVALID_ENUM_VALUE",
      message: `Expected ${path} to match one of the allowed values.`
    });
  }

  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      issues.push({
        path,
        code: "NUMBER_TOO_SMALL",
        message: `Expected ${path} to be greater than or equal to ${schema.minimum}.`
      });
    }

    if (typeof schema.maximum === "number" && value > schema.maximum) {
      issues.push({
        path,
        code: "NUMBER_TOO_LARGE",
        message: `Expected ${path} to be less than or equal to ${schema.maximum}.`
      });
    }
  }

  if (!isRecord(value)) {
    return issues;
  }

  const properties = schema.properties ?? {};

  for (const requiredKey of schema.required ?? []) {
    if (!(requiredKey in value)) {
      issues.push({
        path: `${path}.${requiredKey}`,
        code: "REQUIRED",
        message: `Missing required property ${path}.${requiredKey}.`
      });
    }
  }

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(value)) {
      if (!(key in properties)) {
        issues.push({
          path: `${path}.${key}`,
          code: "UNKNOWN_PROPERTY",
          message: `Unknown property ${path}.${key}.`
        });
      }
    }
  }

  for (const [key, propertySchema] of Object.entries(properties)) {
    if (key in value) {
      issues.push(...validateJsonSchema(value[key], propertySchema, `${path}.${key}`));
    }
  }

  return issues;
}

function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    return sendFailure(reply, 404, "ROUTE_NOT_FOUND", `Route not found: ${request.method} ${request.url}`);
  });

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error.validation) {
      return sendFailure(reply, 400, "VALIDATION_ERROR", "Request failed validation.", {
        issues: error.validation.map((issue) => ({
          path: issue.instancePath || issue.schemaPath,
          message: issue.message
        }))
      });
    }

    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    const code = statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR";
    const message = statusCode >= 500 ? "Unexpected server error." : error.message;

    return sendFailure(reply, statusCode, code, message);
  });
}

export function buildApp(options: BuildAppOptions = {}) {
  const runtime = options.runtime ?? createRuntime();
  const fileStore = new InMemoryFileStore();
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 8 * 1024 * 1024
  });

  registerErrorHandlers(app);

  app.get("/health", async () => {
    return success({
      status: "ok"
    });
  });

  app.get("/v1/ai/interfaces", async () => {
    return success({
      recommended_flow: [
        "toolbox.search_tools",
        "toolbox.get_tool_schema",
        "toolbox.run_tool"
      ],
      guidance: {
        principle: "不要一次性把全部工具参数结构暴露给模型，先搜索，再懒加载参数结构，最后精准执行。",
        first_stage_tools: [
          "toolbox.search_tools",
          "toolbox.get_tool_schema",
          "toolbox.run_tool"
        ]
      },
      interfaces: buildAiInterfaces()
    });
  });

  app.get("/v1/files", async () => {
    return success({
      files: fileStore.list()
    });
  });

  app.post<{
    Body: {
      name: string;
      mime_type?: string;
      kind?: FileKind;
      content_base64: string;
    };
  }>(
    "/v1/files",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "content_base64"],
          properties: {
            name: {
              type: "string",
              minLength: 1
            },
            mime_type: {
              type: "string",
              minLength: 1
            },
            kind: {
              type: "string",
              enum: ["input_file", "output_file", "temp_file", "log_file", "preview_file", "archive_file"]
            },
            content_base64: {
              type: "string",
              minLength: 1
            }
          },
          additionalProperties: false
        }
      }
    },
    async (request, reply) => {
      const content = decodeBase64Content(request.body.content_base64);

      if (!content) {
        return sendFailure(reply, 400, "INVALID_FILE_CONTENT", "content_base64 must be valid base64.");
      }

      if (content.byteLength > MAX_FILE_BYTES) {
        return sendFailure(reply, 413, "FILE_TOO_LARGE", `File exceeds ${MAX_FILE_BYTES} bytes.`);
      }

      const file = fileStore.create({
        name: request.body.name,
        mime_type: request.body.mime_type,
        kind: request.body.kind,
        content
      });

      return success(toFileSummary(file));
    }
  );

  app.get<{ Params: { file_id: string } }>(
    "/v1/files/:file_id",
    {
      schema: {
        params: {
          type: "object",
          required: ["file_id"],
          properties: {
            file_id: {
              type: "string",
              minLength: 1
            }
          }
        }
      }
    },
    async (request, reply) => {
      const file = fileStore.get(request.params.file_id);

      if (!file) {
        return sendFailure(reply, 404, "FILE_NOT_FOUND", `File not found: ${request.params.file_id}`);
      }

      return success(toFileSummary(file));
    }
  );

  app.get<{ Params: { file_id: string } }>(
    "/v1/files/:file_id/download",
    {
      schema: {
        params: {
          type: "object",
          required: ["file_id"],
          properties: {
            file_id: {
              type: "string",
              minLength: 1
            }
          }
        }
      }
    },
    async (request, reply) => {
      const file = fileStore.get(request.params.file_id);

      if (!file) {
        return sendFailure(reply, 404, "FILE_NOT_FOUND", `File not found: ${request.params.file_id}`);
      }

      return reply
        .header("Content-Type", file.mime_type)
        .header("Content-Length", String(file.size_bytes))
        .header("Content-Disposition", `attachment; filename="${encodeURIComponent(file.name)}"`)
        .send(file.content);
    }
  );

  app.get("/v1/plugins", async () => {
    return success({
      plugins: runtime.listPlugins().map((plugin) => ({
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        enabled: true,
        tools_count: plugin.tools.length
      }))
    });
  });

  app.get<{ Querystring: { q?: string } }>(
    "/v1/tools/search",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            q: {
              type: "string"
            }
          },
          additionalProperties: false
        }
      }
    },
    async (request) => {
      return success({
        tools: runtime.searchTools(request.query.q ?? "")
      });
    }
  );

  app.get<{ Params: { name: string } }>(
    "/v1/tools/:name",
    {
      schema: {
        params: {
          type: "object",
          required: ["name"],
          properties: {
            name: {
              type: "string",
              minLength: 1
            }
          }
        }
      }
    },
    async (request, reply) => {
      const tool = runtime.getTool(request.params.name);

      if (!tool) {
        return sendFailure(reply, 404, "TOOL_NOT_FOUND", `Tool not found: ${request.params.name}`);
      }

      return success(tool);
    }
  );

  app.post<{
    Body: { input: Record<string, unknown>; session_id?: string };
    Params: { name: string };
  }>(
    "/v1/tools/:name/run",
    {
      schema: {
        params: {
          type: "object",
          required: ["name"],
          properties: {
            name: {
              type: "string",
              minLength: 1
            }
          }
        },
        body: {
          type: "object",
          required: ["input"],
          properties: {
            input: {
              type: "object",
              additionalProperties: true
            },
            session_id: {
              type: "string",
              minLength: 1
            }
          },
          additionalProperties: false
        }
      }
    },
    async (request, reply) => {
      const tool = runtime.getTool(request.params.name);

      if (!tool) {
        return sendFailure(reply, 404, "TOOL_NOT_FOUND", `Tool not found: ${request.params.name}`);
      }

      const issues = validateJsonSchema(request.body.input, tool.input_schema, "input");

      if (issues.length > 0) {
        return sendFailure(reply, 400, "INVALID_INPUT", "Tool input failed validation.", {
          issues
        });
      }

      try {
        const result = await runtime.runTool(request.params.name, request.body.input);

        if (!result.ok) {
          return sendFailure(reply, 422, result.error.code, result.error.message, {
            retryable: result.error.retryable,
            usage: result.usage
          });
        }

        return success({
          tool_name: request.params.name,
          plugin_id: tool.plugin_id,
          result: result.result,
          usage: result.usage
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Tool execution failed.";

        return sendFailure(reply, 500, "TOOL_RUNTIME_ERROR", message);
      }
    }
  );

  app.get("/v1/audit/calls", async () => {
    return success({
      calls: runtime.getAuditLog()
    });
  });

  return app;
}

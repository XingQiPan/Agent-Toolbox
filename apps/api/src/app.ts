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

export interface BuildAppOptions {
  logger?: FastifyServerOptions["logger"];
  runtime?: ToolboxRuntime;
}

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
  const app = Fastify({
    logger: options.logger ?? false
  });

  registerErrorHandlers(app);

  app.get("/health", async () => {
    return success({
      status: "ok"
    });
  });

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

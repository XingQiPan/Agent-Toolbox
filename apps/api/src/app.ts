import Fastify from "fastify";
import { ToolboxRuntime } from "@agent-toolbox/core";
import { jsonBasicPlugin } from "@agent-toolbox/plugin-json-basic";

export function createRuntime(): ToolboxRuntime {
  const runtime = new ToolboxRuntime();
  runtime.registerPlugin(jsonBasicPlugin);
  return runtime;
}

export function buildApp(runtime = createRuntime()) {
  const app = Fastify({
    logger: true
  });

  app.get("/health", async () => {
    return {
      ok: true,
      data: {
        status: "ok"
      }
    };
  });

  app.get("/v1/plugins", async () => {
    return {
      ok: true,
      data: {
        plugins: runtime.listPlugins().map((plugin) => ({
          id: plugin.id,
          name: plugin.name,
          version: plugin.version,
          enabled: true,
          tools_count: plugin.tools.length
        }))
      }
    };
  });

  app.get<{ Querystring: { q?: string } }>("/v1/tools/search", async (request) => {
    return {
      ok: true,
      data: {
        tools: runtime.searchTools(request.query.q ?? "")
      }
    };
  });

  app.get<{ Params: { name: string } }>("/v1/tools/:name", async (request, reply) => {
    const tool = runtime.getTool(request.params.name);

    if (!tool) {
      return reply.code(404).send({
        ok: false,
        error: {
          code: "TOOL_NOT_FOUND",
          message: `Tool not found: ${request.params.name}`
        }
      });
    }

    return {
      ok: true,
      data: tool
    };
  });

  app.post<{ Body: { input?: Record<string, unknown> }; Params: { name: string } }>(
    "/v1/tools/:name/run",
    async (request) => {
      const result = await runtime.runTool(request.params.name, request.body.input ?? {});

      return {
        ok: result.ok,
        data: result.ok ? result : undefined,
        error: result.ok ? undefined : result.error
      };
    }
  );

  return app;
}

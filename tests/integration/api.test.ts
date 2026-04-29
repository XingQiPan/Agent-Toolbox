import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../apps/api/src/app.js";

async function withApp<T>(run: (app: FastifyInstance) => Promise<T>): Promise<T> {
  const app = buildApp();

  try {
    await app.ready();
    return await run(app);
  } finally {
    await app.close();
  }
}

describe("api service", () => {
  it("reports health", async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: "GET",
        url: "/health"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ok: true,
        data: {
          status: "ok"
        }
      });
    });
  });

  it("lists installed plugins", async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/plugins"
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.plugins).toContainEqual({
        id: "json.basic",
        name: "JSON Basic Tools",
        version: "0.1.0",
        enabled: true,
        tools_count: 2
      });
    });
  });

  it("lists AI integration interfaces", async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/ai/interfaces"
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.recommended_flow).toEqual([
        "toolbox.search_tools",
        "toolbox.get_tool_schema",
        "toolbox.run_tool"
      ]);
      expect(body.data.interfaces).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "toolbox.search_tools",
            method: "GET",
            path: "/v1/tools/search?q={query}",
            status: "available"
          }),
          expect.objectContaining({
            id: "toolbox.run_tool",
            method: "POST",
            path: "/v1/tools/{tool_name}/run",
            status: "available"
          }),
          expect.objectContaining({
            id: "toolbox.upload_file",
            status: "planned"
          })
        ])
      );
    });
  });

  it("searches tools", async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/tools/search?q=json"
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.tools.map((tool: { name: string }) => tool.name)).toEqual([
        "json.format",
        "json.validate"
      ]);
    });
  });

  it("returns tool info", async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/tools/json.format"
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data).toMatchObject({
        name: "json.format",
        title: "Format JSON",
        plugin_id: "json.basic",
        risk_level: "low"
      });
      expect(body.data.input_schema.required).toEqual(["text"]);
    });
  });

  it("runs a tool with a success envelope", async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/tools/json.format/run",
        payload: {
          input: {
            text: "{\"name\":\"aitbx\"}",
            indent: 2
          },
          session_id: "sess_test"
        }
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.tool_name).toBe("json.format");
      expect(body.data.plugin_id).toBe("json.basic");
      expect(body.data.result.data.formatted).toBe("{\n  \"name\": \"aitbx\"\n}");
      expect(body.data.usage.duration_ms).toEqual(expect.any(Number));
    });
  });

  it("rejects invalid tool input before execution", async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/tools/json.format/run",
        payload: {
          input: {
            text: "{\"name\":\"aitbx\"}",
            indent: 9
          }
        }
      });
      const body = response.json();

      expect(response.statusCode).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("INVALID_INPUT");
      expect(body.error.details.issues).toContainEqual({
        path: "input.indent",
        code: "NUMBER_TOO_LARGE",
        message: "Expected input.indent to be less than or equal to 8."
      });
    });
  });

  it("exposes in-memory audit calls", async () => {
    await withApp(async (app) => {
      await app.inject({
        method: "POST",
        url: "/v1/tools/json.validate/run",
        payload: {
          input: {
            text: "{\"name\":\"aitbx\"}"
          }
        }
      });

      const response = await app.inject({
        method: "GET",
        url: "/v1/audit/calls"
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.calls).toHaveLength(1);
      expect(body.data.calls[0]).toMatchObject({
        tool_name: "json.validate",
        plugin_id: "json.basic",
        input_json: {
          text: "{\"name\":\"aitbx\"}"
        },
        status: "success"
      });
      expect(body.data.calls[0].id).toEqual(expect.stringMatching(/^call_/));
      expect(body.data.calls[0].created_at).toEqual(expect.any(String));
    });
  });
});

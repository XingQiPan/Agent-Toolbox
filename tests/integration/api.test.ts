import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { ToolboxRuntime, type ToolboxPlugin, type ToolResult } from "@agent-toolbox/core";
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

function createSuccessResult(summary: string): ToolResult {
  return {
    ok: true,
    result: {
      summary,
      artifacts: [],
      data: {
        delivered: true
      }
    },
    usage: {
      duration_ms: 0,
      cost_usd: 0
    }
  };
}

function createApprovalRuntime(): ToolboxRuntime {
  const runtime = new ToolboxRuntime();
  const plugin: ToolboxPlugin = {
    manifest: {
      schema_version: "0.1",
      id: "approval.demo",
      name: "Approval Demo",
      version: "0.1.0",
      description: "Demo plugin for approval protected tools.",
      runtime: {
        type: "builtin"
      },
      permissions: {
        filesystem: [],
        network: true,
        secrets: ["SMTP_TOKEN"],
        shell: false,
        max_runtime_seconds: 10,
        max_memory_mb: 128
      },
      tools: [
        {
          name: "email.send_with_approval",
          title: "Send Email With Approval",
          description: "Send a user-approved email.",
          category: "email",
          risk_level: "high",
          input_schema: {
            type: "object",
            properties: {
              to: {
                type: "string"
              },
              body: {
                type: "string"
              }
            },
            required: ["to", "body"],
            additionalProperties: false
          }
        }
      ]
    },
    handlers: {
      "email.send_with_approval": () => createSuccessResult("Email sent.")
    }
  };

  runtime.registerPlugin(plugin);
  return runtime;
}

async function withCustomApp<T>(runtime: ToolboxRuntime, run: (app: FastifyInstance) => Promise<T>): Promise<T> {
  const app = buildApp({ runtime });

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
        "toolbox.get_tool_security",
        "toolbox.create_approval",
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
            status: "available"
          }),
          expect.objectContaining({
            id: "toolbox.get_tool_security",
            status: "available"
          }),
          expect.objectContaining({
            id: "toolbox.create_approval",
            status: "available"
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

  it("describes security policy and low risk tool security", async () => {
    await withApp(async (app) => {
      const policyResponse = await app.inject({
        method: "GET",
        url: "/v1/security/policy"
      });
      const policyBody = policyResponse.json();

      expect(policyResponse.statusCode).toBe(200);
      expect(policyBody.ok).toBe(true);
      expect(policyBody.data.risk_levels).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            risk_level: "low",
            approval_required: false
          }),
          expect.objectContaining({
            risk_level: "high",
            approval_required: true
          })
        ])
      );

      const securityResponse = await app.inject({
        method: "GET",
        url: "/v1/tools/json.format/security"
      });
      const securityBody = securityResponse.json();

      expect(securityResponse.statusCode).toBe(200);
      expect(securityBody.ok).toBe(true);
      expect(securityBody.data).toMatchObject({
        tool_name: "json.format",
        plugin_id: "json.basic",
        risk_level: "low",
        approval_required: false
      });
      expect(securityBody.data.permissions.network).toBe(false);
    });
  });

  it("requires and consumes approval tokens for high risk tools", async () => {
    await withCustomApp(createApprovalRuntime(), async (app) => {
      const blockedResponse = await app.inject({
        method: "POST",
        url: "/v1/tools/email.send_with_approval/run",
        payload: {
          input: {
            to: "user@example.com",
            body: "hello"
          }
        }
      });
      const blockedBody = blockedResponse.json();

      expect(blockedResponse.statusCode).toBe(403);
      expect(blockedBody.ok).toBe(false);
      expect(blockedBody.error.code).toBe("APPROVAL_REQUIRED");
      expect(blockedBody.error.details.security).toMatchObject({
        tool_name: "email.send_with_approval",
        approval_required: true
      });

      const approvalResponse = await app.inject({
        method: "POST",
        url: "/v1/approvals",
        payload: {
          tool_name: "email.send_with_approval",
          reason: "User approved this email in the console."
        }
      });
      const approvalBody = approvalResponse.json();

      expect(approvalResponse.statusCode).toBe(201);
      expect(approvalBody.ok).toBe(true);
      expect(approvalBody.data.approval_token).toEqual(expect.stringMatching(/^apprtok_/));
      expect(approvalBody.data.status).toBe("active");

      const runResponse = await app.inject({
        method: "POST",
        url: "/v1/tools/email.send_with_approval/run",
        payload: {
          input: {
            to: "user@example.com",
            body: "hello"
          },
          approval_token: approvalBody.data.approval_token
        }
      });
      const runBody = runResponse.json();

      expect(runResponse.statusCode).toBe(200);
      expect(runBody.ok).toBe(true);
      expect(runBody.data.result.data.delivered).toBe(true);

      const reuseResponse = await app.inject({
        method: "POST",
        url: "/v1/tools/email.send_with_approval/run",
        payload: {
          input: {
            to: "user@example.com",
            body: "hello"
          },
          approval_token: approvalBody.data.approval_token
        }
      });

      expect(reuseResponse.statusCode).toBe(403);

      const approvalsResponse = await app.inject({
        method: "GET",
        url: "/v1/approvals"
      });
      const approvalsBody = approvalsResponse.json();

      expect(approvalsResponse.statusCode).toBe(200);
      expect(approvalsBody.data.approvals[0]).toMatchObject({
        tool_name: "email.send_with_approval",
        status: "used"
      });
      expect(approvalsBody.data.approvals[0].approval_token).toBeUndefined();
    });
  });

  it("uploads, reads, lists, and downloads files", async () => {
    await withApp(async (app) => {
      const uploadResponse = await app.inject({
        method: "POST",
        url: "/v1/files",
        payload: {
          name: "hello.txt",
          mime_type: "text/plain",
          content_base64: Buffer.from("hello toolbox", "utf8").toString("base64")
        }
      });
      const uploadBody = uploadResponse.json();

      expect(uploadResponse.statusCode).toBe(200);
      expect(uploadBody.ok).toBe(true);
      expect(uploadBody.data).toMatchObject({
        name: "hello.txt",
        mime_type: "text/plain",
        size_bytes: 13,
        kind: "input_file"
      });
      expect(uploadBody.data.file_id).toEqual(expect.stringMatching(/^file_/));

      const infoResponse = await app.inject({
        method: "GET",
        url: `/v1/files/${uploadBody.data.file_id}`
      });
      const infoBody = infoResponse.json();

      expect(infoResponse.statusCode).toBe(200);
      expect(infoBody.data.file_id).toBe(uploadBody.data.file_id);

      const listResponse = await app.inject({
        method: "GET",
        url: "/v1/files"
      });
      const listBody = listResponse.json();

      expect(listResponse.statusCode).toBe(200);
      expect(listBody.data.files).toContainEqual(infoBody.data);

      const downloadResponse = await app.inject({
        method: "GET",
        url: `/v1/files/${uploadBody.data.file_id}/download`
      });

      expect(downloadResponse.statusCode).toBe(200);
      expect(downloadResponse.headers["content-type"]).toContain("text/plain");
      expect(downloadResponse.body).toBe("hello toolbox");
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

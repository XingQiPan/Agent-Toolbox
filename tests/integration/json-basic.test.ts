import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ToolboxRuntime,
  ToolboxValidationError,
  type ToolboxPlugin,
  type ToolResult
} from "@agent-toolbox/core";
import { jsonBasicPlugin } from "@agent-toolbox/plugin-json-basic";

interface CliRunResult {
  code: number;
  stdout: string;
  stderr: string;
}

function createRuntime(): ToolboxRuntime {
  const runtime = new ToolboxRuntime();
  runtime.registerPlugin(jsonBasicPlugin);
  return runtime;
}

function runCli(args: string[]): Promise<CliRunResult> {
  const tsxCli = resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs");
  const cliEntrypoint = resolve(process.cwd(), "apps/cli/src/index.ts");

  return new Promise((resolveRun, reject) => {
    execFile(
      process.execPath,
      [tsxCli, cliEntrypoint, ...args],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 30000
      },
      (error, stdout, stderr) => {
        if (error?.killed) {
          reject(error);
          return;
        }

        resolveRun({
          code: error && typeof error.code === "number" ? error.code : 0,
          stdout,
          stderr
        });
      }
    );
  });
}

describe("json-basic plugin", () => {
  it("formats JSON", async () => {
    const runtime = createRuntime();

    const result = await runtime.runTool("json.format", {
      text: "{\"name\":\"aitbx\"}",
      indent: 2
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.data.formatted).toBe("{\n  \"name\": \"aitbx\"\n}");
    }

    const [auditEntry] = runtime.getAuditLog();
    expect(auditEntry?.status).toBe("success");
    expect(auditEntry?.duration_ms).toBe(result.usage.duration_ms);
  });

  it("searches JSON tools", () => {
    const runtime = createRuntime();

    expect(runtime.searchTools("json").map((tool) => tool.name)).toContain("json.format");
  });

  it("reports invalid JSON as validation data", async () => {
    const runtime = createRuntime();

    const result = await runtime.runTool("json.validate", {
      text: "{\"name\":\"aitbx\",}"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.data.valid).toBe(false);
      expect(result.result.data.error).toMatchObject({
        name: "SyntaxError"
      });
      expect(String((result.result.data.error as Record<string, unknown>).message)).not.toHaveLength(0);
    }

    const [auditEntry] = runtime.getAuditLog();
    expect(auditEntry?.status).toBe("success");
  });

  it("returns a schema failure for invalid validate input shape", async () => {
    const runtime = createRuntime();

    const result = await runtime.runTool("json.validate", {
      text: 42
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SCHEMA_VALIDATION_FAILED");
      expect(result.error.message).toContain("input.text must be a string.");
    }
  });

  it("rejects plugin manifests with clear missing field errors", () => {
    const runtime = new ToolboxRuntime();
    const invalidPlugin = {
      manifest: {},
      handlers: {}
    } as unknown as ToolboxPlugin;

    expect(() => runtime.registerPlugin(invalidPlugin)).toThrow(ToolboxValidationError);

    try {
      runtime.registerPlugin(invalidPlugin);
    } catch (error) {
      expect(error).toBeInstanceOf(ToolboxValidationError);
      expect((error as ToolboxValidationError).issues).toEqual(
        expect.arrayContaining([
          'Plugin manifest is missing required field "id".',
          'Plugin manifest is missing required field "name".',
          'Plugin manifest is missing required field "version".',
          'Plugin manifest is missing required field "runtime".',
          'Plugin manifest is missing required field "tools".'
        ])
      );
    }
  });

  it("validates tool input against the manifest JSON-schema subset", async () => {
    const runtime = createRuntime();

    const invalidCases: Array<{ input: Record<string, unknown>; messages: string[] }> = [
      {
        input: "not an object" as unknown as Record<string, unknown>,
        messages: ["input must be an object."]
      },
      {
        input: {
          indent: 2
        },
        messages: ['input is missing required property "text".']
      },
      {
        input: {
          text: 42
        },
        messages: ["input.text must be a string."]
      },
      {
        input: {
          text: "{}",
          indent: 9,
          extra: true
        },
        messages: ['input has unknown property "extra".', "input.indent must be less than or equal to 8."]
      }
    ];
    const results: ToolResult[] = [];

    for (const invalidCase of invalidCases) {
      const result = await runtime.runTool("json.format", invalidCase.input);
      results.push(result);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SCHEMA_VALIDATION_FAILED");
        for (const message of invalidCase.messages) {
          expect(result.error.message).toContain(message);
        }
      }
    }

    const auditLog = runtime.getAuditLog();
    expect(auditLog).toHaveLength(invalidCases.length);

    auditLog.forEach((auditEntry, index) => {
      expect(auditEntry.status).toBe("error");
      expect(auditEntry.error_code).toBe("SCHEMA_VALIDATION_FAILED");
      expect(auditEntry.duration_ms).toBe(results[index]?.usage.duration_ms);
    });
  });

  it("audits handler exceptions as structured tool failures", async () => {
    const runtime = new ToolboxRuntime();
    runtime.registerPlugin({
      manifest: {
        schema_version: "0.1",
        id: "throw.basic",
        name: "Throw Basic Tools",
        version: "0.1.0",
        description: "Test plugin with a throwing handler.",
        runtime: {
          type: "builtin"
        },
        permissions: {
          filesystem: [],
          network: false,
          secrets: [],
          shell: false,
          max_runtime_seconds: 5,
          max_memory_mb: 128
        },
        tools: [
          {
            name: "throw.fail",
            title: "Throw Failure",
            description: "Throws an error.",
            category: "test",
            risk_level: "low",
            input_schema: {
              type: "object",
              additionalProperties: false
            }
          }
        ]
      },
      handlers: {
        "throw.fail": () => {
          throw new Error("boom");
        }
      }
    });

    const result = await runtime.runTool("throw.fail", {});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TOOL_RUNTIME_ERROR");
      expect(result.error.message).toContain("Tool handler for throw.fail failed: boom");
    }

    const [auditEntry] = runtime.getAuditLog();
    expect(auditEntry?.status).toBe("error");
    expect(auditEntry?.error_code).toBe("TOOL_RUNTIME_ERROR");
    expect(auditEntry?.output_json).toEqual(result);
    expect(auditEntry?.duration_ms).toBe(result.usage.duration_ms);
    expect(new Date(auditEntry?.finished_at ?? 0).getTime()).toBeGreaterThanOrEqual(
      new Date(auditEntry?.created_at ?? 0).getTime()
    );
  });
});

describe("CLI integration", () => {
  it("validates a local plugin install source with JSON output", async () => {
    const result = await runCli(["plugin", "install", "plugins/json-basic"]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");

    const output = JSON.parse(result.stdout) as {
      ok: boolean;
      data: {
        source_type: string;
        installed: boolean;
        persistent_install_implemented: boolean;
        manifest: {
          id: string;
          tools_count: number;
        };
      };
    };

    expect(output.ok).toBe(true);
    expect(output.data.source_type).toBe("local_path");
    expect(output.data.installed).toBe(false);
    expect(output.data.persistent_install_implemented).toBe(false);
    expect(output.data.manifest.id).toBe("json.basic");
    expect(output.data.manifest.tools_count).toBeGreaterThan(0);
  }, 30000);

  it("returns non-zero JSON errors for unknown tools", async () => {
    const result = await runCli(["tool", "info", "missing.tool"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toBe("");

    const output = JSON.parse(result.stdout) as {
      ok: boolean;
      error: {
        code: string;
      };
    };

    expect(output.ok).toBe(false);
    expect(output.error.code).toBe("TOOL_NOT_FOUND");
  }, 30000);

  it("returns non-zero JSON errors for invalid tool input JSON", async () => {
    const result = await runCli(["tool", "run", "json.validate", "--json", "{bad"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toBe("");

    const output = JSON.parse(result.stdout) as {
      ok: boolean;
      error: {
        code: string;
      };
    };

    expect(output.ok).toBe(false);
    expect(output.error.code).toBe("INVALID_JSON");
  }, 30000);
});

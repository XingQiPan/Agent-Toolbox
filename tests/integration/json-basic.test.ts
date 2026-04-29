import { describe, expect, it } from "vitest";
import { ToolboxRuntime, ToolboxValidationError, type ToolboxPlugin, type ToolResult } from "@agent-toolbox/core";
import { jsonBasicPlugin } from "@agent-toolbox/plugin-json-basic";

describe("json-basic plugin", () => {
  it("formats JSON", async () => {
    const runtime = new ToolboxRuntime();
    runtime.registerPlugin(jsonBasicPlugin);

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
    const runtime = new ToolboxRuntime();
    runtime.registerPlugin(jsonBasicPlugin);

    expect(runtime.searchTools("json").map((tool) => tool.name)).toContain("json.format");
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
    const runtime = new ToolboxRuntime();
    runtime.registerPlugin(jsonBasicPlugin);

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
    runtime.registerPlugin(jsonBasicPlugin);

    const result = await runtime.runTool("json.validate", {
      text: "{not valid json"
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TOOL_RUNTIME_ERROR");
      expect(result.error.message).toContain("Tool handler for json.validate failed:");
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

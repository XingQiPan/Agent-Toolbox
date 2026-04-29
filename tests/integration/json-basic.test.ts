import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ToolboxRuntime } from "@agent-toolbox/core";
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

  return new Promise((resolve, reject) => {
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

        resolve({
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
  });

  it("returns a tool failure for invalid validate input shape", async () => {
    const runtime = createRuntime();

    const result = await runtime.runTool("json.validate", {
      text: 42
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
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

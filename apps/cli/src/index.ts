#!/usr/bin/env node
import type { Stats } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { ToolboxRuntime } from "@agent-toolbox/core";
import { jsonBasicPlugin } from "@agent-toolbox/plugin-json-basic";

function createRuntime(): ToolboxRuntime {
  const runtime = new ToolboxRuntime();
  runtime.registerPlugin(jsonBasicPlugin);
  return runtime;
}

interface CliErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

class CliCommandError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly exitCode = 1
  ) {
    super(message);
    this.name = "CliCommandError";
  }
}

function printJson(value: unknown, stream: NodeJS.WritableStream = process.stdout): void {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printData(data: Record<string, unknown>): void {
  printJson({
    ok: true,
    data
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseToolInput(raw: string): Record<string, unknown> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new CliCommandError("INVALID_JSON", "Failed to parse --json input.", {
      parse_error: error instanceof Error ? error.message : String(error)
    });
  }

  if (!isRecord(parsed)) {
    throw new CliCommandError("INVALID_TOOL_INPUT", "Tool input JSON must be an object.", {
      received_type: Array.isArray(parsed) ? "array" : typeof parsed
    });
  }

  return parsed;
}

function looksLikeLocalPath(source: string): boolean {
  return (
    isAbsolute(source) ||
    source.startsWith(".") ||
    source.includes("/") ||
    source.includes("\\")
  );
}

function getInvocationCwd(): string {
  return process.env.INIT_CWD ? resolve(process.env.INIT_CWD) : process.cwd();
}

async function existsAtInvocationPath(source: string): Promise<boolean> {
  try {
    await stat(resolve(getInvocationCwd(), source));
    return true;
  } catch {
    return false;
  }
}

interface LocalPluginValidation {
  source_path: string;
  manifest_path: string;
  manifest: {
    id: string;
    name: string;
    version: string;
    tools_count: number;
  };
}

function readManifestSummary(value: unknown, manifestPath: string): LocalPluginValidation["manifest"] {
  if (!isRecord(value)) {
    throw new CliCommandError("INVALID_PLUGIN_MANIFEST", "Plugin manifest must be a JSON object.", {
      manifest_path: manifestPath
    });
  }

  const { id, name, version, tools } = value;

  if (typeof id !== "string" || typeof name !== "string" || typeof version !== "string") {
    throw new CliCommandError(
      "INVALID_PLUGIN_MANIFEST",
      "Plugin manifest must include string id, name, and version fields.",
      {
        manifest_path: manifestPath
      }
    );
  }

  if (!Array.isArray(tools)) {
    throw new CliCommandError("INVALID_PLUGIN_MANIFEST", "Plugin manifest must include a tools array.", {
      manifest_path: manifestPath
    });
  }

  return {
    id,
    name,
    version,
    tools_count: tools.length
  };
}

async function validateLocalPluginSource(source: string): Promise<LocalPluginValidation> {
  const basePath = getInvocationCwd();
  const sourcePath = resolve(basePath, source);
  let sourceStats: Stats;

  try {
    sourceStats = await stat(sourcePath);
  } catch {
    throw new CliCommandError("PLUGIN_SOURCE_NOT_FOUND", "Local plugin path does not exist.", {
      source,
      base_path: basePath,
      resolved_path: sourcePath
    });
  }

  const manifestPath = sourceStats.isDirectory()
    ? join(sourcePath, "toolbox.plugin.json")
    : sourcePath;

  if (!sourceStats.isDirectory() && basename(sourcePath) !== "toolbox.plugin.json") {
    throw new CliCommandError(
      "INVALID_PLUGIN_SOURCE",
      "Local plugin source must be a plugin directory or toolbox.plugin.json file.",
      {
        source,
        base_path: basePath,
        resolved_path: sourcePath
      }
    );
  }

  let manifestText: string;

  try {
    manifestText = await readFile(manifestPath, "utf8");
  } catch {
    throw new CliCommandError("PLUGIN_MANIFEST_NOT_FOUND", "Local plugin manifest was not found.", {
      source,
      manifest_path: manifestPath
    });
  }

  let manifestJson: unknown;

  try {
    manifestJson = JSON.parse(manifestText);
  } catch (error) {
    throw new CliCommandError("INVALID_PLUGIN_MANIFEST_JSON", "Local plugin manifest is not valid JSON.", {
      manifest_path: manifestPath,
      parse_error: error instanceof Error ? error.message : String(error)
    });
  }

  return {
    source_path: sourcePath,
    manifest_path: manifestPath,
    manifest: readManifestSummary(manifestJson, manifestPath)
  };
}

function cliErrorBody(error: unknown): { body: CliErrorBody; exitCode: number } {
  if (error instanceof CliCommandError) {
    return {
      body: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {})
      },
      exitCode: error.exitCode
    };
  }

  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return {
      body: {
        code: "CLI_USAGE_ERROR",
        message: error.message.replace(/^error:\s*/i, ""),
        details: {
          commander_code: error.code
        }
      },
      exitCode: "exitCode" in error && typeof error.exitCode === "number" ? error.exitCode : 1
    };
  }

  return {
    body: {
      code: "UNEXPECTED_ERROR",
      message: error instanceof Error ? error.message : String(error)
    },
    exitCode: 1
  };
}

export function createProgram(runtime = createRuntime()): Command {
  const program = new Command();

  program
    .name("aitbx")
    .description("AI Toolbox Runtime")
    .version("0.1.0")
    .exitOverride()
    .configureOutput({
      writeErr: () => {
        // Command-level errors are emitted as structured JSON in main().
      }
    });

  const plugin = program.command("plugin").description("Manage plugins");

  plugin.command("list").description("List installed plugins").action(() => {
    printData({
      plugins: runtime.listPlugins().map((item) => ({
        id: item.id,
        name: item.name,
        version: item.version,
        tools_count: item.tools.length
      }))
    });
  });

  plugin
    .command("install")
    .argument("<source>", "Plugin id or local plugin path")
    .description("Validate a plugin source for Phase 0")
    .action(async (source: string) => {
      if (looksLikeLocalPath(source) || (await existsAtInvocationPath(source))) {
        const validation = await validateLocalPluginSource(source);
        printData({
          source,
          source_type: "local_path",
          ...validation,
          installed: false,
          persistent_install_implemented: false,
          message: "Local plugin source is valid. Persistent plugin install is not implemented in Phase 0."
        });
        return;
      }

      printData({
        source,
        source_type: "registry",
        installed: false,
        persistent_install_implemented: false,
        message: "Registry plugin install is not implemented in Phase 0."
      });
    });

  const tool = program.command("tool").description("Search, inspect, and run tools");

  tool.command("search")
    .argument("[query]", "Search query", "")
    .description("Search tools")
    .action((query: string) => {
      printData({
        tools: runtime.searchTools(query)
      });
    });

  tool.command("info")
    .argument("<name>", "Tool name")
    .description("Show tool details")
    .action((name: string) => {
      const found = runtime.getTool(name);
      if (!found) {
        throw new CliCommandError("TOOL_NOT_FOUND", `Tool not found: ${name}`, {
          tool: name
        });
      }

      printData({
        tool: found
      });
    });

  tool.command("run")
    .argument("<name>", "Tool name")
    .requiredOption("--json <json>", "Tool input JSON")
    .description("Run a tool")
    .action(async (name: string, options: { json: string }) => {
      const input = parseToolInput(options.json);
      const result = await runtime.runTool(name, input);
      printJson(result);
      if (!result.ok) {
        process.exitCode = 1;
      }
    });

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  try {
    await createProgram().parseAsync(argv);
  } catch (error) {
    const { body, exitCode } = cliErrorBody(error);

    if (exitCode === 0) {
      return;
    }

    printJson(
      {
        ok: false,
        error: body
      }
    );
    process.exitCode = exitCode;
  }
}

const isEntrypoint = process.argv[1]
  ? resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
  : false;

if (isEntrypoint) {
  await main();
}

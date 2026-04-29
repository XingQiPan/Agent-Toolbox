#!/usr/bin/env node
import { Command } from "commander";
import { ToolboxRuntime } from "@agent-toolbox/core";
import { jsonBasicPlugin } from "@agent-toolbox/plugin-json-basic";

function createRuntime(): ToolboxRuntime {
  const runtime = new ToolboxRuntime();
  runtime.registerPlugin(jsonBasicPlugin);
  return runtime;
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

const runtime = createRuntime();
const program = new Command();

program
  .name("aitbx")
  .description("AI Toolbox Runtime")
  .version("0.1.0");

const plugin = program.command("plugin").description("Manage plugins");

plugin.command("list").description("List installed plugins").action(() => {
  printJson({
    plugins: runtime.listPlugins().map((item) => ({
      id: item.id,
      name: item.name,
      version: item.version,
      tools_count: item.tools.length
    }))
  });
});

const tool = program.command("tool").description("Search, inspect, and run tools");

tool.command("search")
  .argument("[query]", "Search query", "")
  .description("Search tools")
  .action((query: string) => {
    printJson({
      tools: runtime.searchTools(query)
    });
  });

tool.command("info")
  .argument("<name>", "Tool name")
  .description("Show tool details")
  .action((name: string) => {
    const found = runtime.getTool(name);
    if (!found) {
      console.error(`Tool not found: ${name}`);
      process.exitCode = 1;
      return;
    }

    printJson(found);
  });

tool.command("run")
  .argument("<name>", "Tool name")
  .requiredOption("--json <json>", "Tool input JSON")
  .description("Run a tool")
  .action(async (name: string, options: { json: string }) => {
    const input = JSON.parse(options.json) as Record<string, unknown>;
    const result = await runtime.runTool(name, input);
    printJson(result);
    if (!result.ok) {
      process.exitCode = 1;
    }
  });

await program.parseAsync();

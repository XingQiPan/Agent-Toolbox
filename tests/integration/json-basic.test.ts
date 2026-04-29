import { describe, expect, it } from "vitest";
import { ToolboxRuntime } from "@agent-toolbox/core";
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
  });

  it("searches JSON tools", () => {
    const runtime = new ToolboxRuntime();
    runtime.registerPlugin(jsonBasicPlugin);

    expect(runtime.searchTools("json").map((tool) => tool.name)).toContain("json.format");
  });
});

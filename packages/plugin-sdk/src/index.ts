export type {
  PluginManifest,
  ToolDefinition,
  ToolHandler,
  ToolboxPlugin,
  ToolResult
} from "@agent-toolbox/core";

export function definePlugin<TPlugin>(plugin: TPlugin): TPlugin {
  return plugin;
}

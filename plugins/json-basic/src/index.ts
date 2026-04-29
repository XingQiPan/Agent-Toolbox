import { definePlugin } from "@agent-toolbox/plugin-sdk";
import type { PluginManifest, ToolboxPlugin, ToolResult } from "@agent-toolbox/core";

const manifest: PluginManifest = {
  schema_version: "0.1",
  id: "json.basic",
  name: "JSON Basic Tools",
  version: "0.1.0",
  description: "Format and validate JSON text.",
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
      name: "json.format",
      title: "Format JSON",
      description: "Parse JSON text and return pretty formatted JSON.",
      category: "json",
      risk_level: "low",
      input_schema: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Raw JSON text."
          },
          indent: {
            type: "integer",
            minimum: 0,
            maximum: 8,
            description: "Number of spaces used for indentation."
          }
        },
        required: ["text"],
        additionalProperties: false
      },
      output_schema: {
        type: "object",
        properties: {
          formatted: {
            type: "string"
          }
        },
        required: ["formatted"],
        additionalProperties: false
      }
    },
    {
      name: "json.validate",
      title: "Validate JSON",
      description: "Check whether a text value is valid JSON.",
      category: "json",
      risk_level: "low",
      input_schema: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Raw JSON text."
          }
        },
        required: ["text"],
        additionalProperties: false
      },
      output_schema: {
        type: "object",
        properties: {
          valid: {
            type: "boolean"
          }
        },
        required: ["valid"],
        additionalProperties: false
      }
    }
  ]
};

function failure(code: string, message: string): ToolResult {
  return {
    ok: false,
    error: {
      code,
      message,
      retryable: false
    },
    usage: {
      duration_ms: 0,
      cost_usd: 0
    }
  };
}

export const jsonBasicPlugin = definePlugin<ToolboxPlugin>({
  manifest,
  handlers: {
    "json.format": (input) => {
      if (typeof input.text !== "string") {
        return failure("INVALID_INPUT", "Expected input.text to be a JSON string.");
      }

      const indent = typeof input.indent === "number" ? input.indent : 2;
      const parsed = JSON.parse(input.text);
      const formatted = JSON.stringify(parsed, null, indent);

      return {
        ok: true,
        result: {
          summary: "JSON formatted successfully.",
          artifacts: [],
          data: {
            formatted
          }
        },
        usage: {
          duration_ms: 0,
          cost_usd: 0
        }
      };
    },
    "json.validate": (input) => {
      if (typeof input.text !== "string") {
        return failure("INVALID_INPUT", "Expected input.text to be a JSON string.");
      }

      JSON.parse(input.text);

      return {
        ok: true,
        result: {
          summary: "JSON is valid.",
          artifacts: [],
          data: {
            valid: true
          }
        },
        usage: {
          duration_ms: 0,
          cost_usd: 0
        }
      };
    }
  }
});

export { manifest };

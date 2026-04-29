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
          },
          error: {
            type: ["object", "null"],
            properties: {
              name: {
                type: "string"
              },
              message: {
                type: "string"
              },
              position: {
                type: "integer"
              }
            },
            required: ["name", "message"],
            additionalProperties: false
          }
        },
        required: ["valid", "error"],
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

function parseJsonErrorDetails(error: unknown): Record<string, unknown> {
  const message = error instanceof Error ? error.message : String(error);
  const positionMatch = message.match(/position\s+(\d+)/i);

  return {
    name: error instanceof Error ? error.name : "SyntaxError",
    message,
    ...(positionMatch ? { position: Number(positionMatch[1]) } : {})
  };
}

export const jsonBasicPlugin = definePlugin<ToolboxPlugin>({
  manifest,
  handlers: {
    "json.format": (input) => {
      if (typeof input.text !== "string") {
        return failure("INVALID_INPUT", "Expected input.text to be a JSON string.");
      }

      const requestedIndent = input.indent;
      if (
        requestedIndent !== undefined &&
        (typeof requestedIndent !== "number" ||
          !Number.isInteger(requestedIndent) ||
          requestedIndent < 0 ||
          requestedIndent > 8)
      ) {
        return failure("INVALID_INPUT", "Expected input.indent to be an integer from 0 to 8.");
      }

      const indent = typeof requestedIndent === "number" ? requestedIndent : 2;
      let parsed: unknown;

      try {
        parsed = JSON.parse(input.text);
      } catch (error) {
        const details = parseJsonErrorDetails(error);
        return failure("INVALID_JSON", `Input text is not valid JSON: ${String(details.message)}`);
      }

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

      try {
        JSON.parse(input.text);
      } catch (error) {
        return {
          ok: true,
          result: {
            summary: "JSON is invalid.",
            artifacts: [],
            data: {
              valid: false,
              error: parseJsonErrorDetails(error)
            }
          },
          usage: {
            duration_ms: 0,
            cost_usd: 0
          }
        };
      }

      return {
        ok: true,
        result: {
          summary: "JSON is valid.",
          artifacts: [],
          data: {
            valid: true,
            error: null
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

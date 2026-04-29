import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@agent-toolbox/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      "@agent-toolbox/plugin-sdk": fileURLToPath(new URL("./packages/plugin-sdk/src/index.ts", import.meta.url)),
      "@agent-toolbox/plugin-json-basic": fileURLToPath(new URL("./plugins/json-basic/src/index.ts", import.meta.url))
    }
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node"
  }
});

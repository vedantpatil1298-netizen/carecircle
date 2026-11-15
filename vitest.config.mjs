import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)) },
  },
  test: {
    coverage: {
      include: [
        "lib/{account-security,appointments,care-access,care-intents,medications}.ts",
        "app/{access-actions,appointment-actions,medication-actions}.ts",
        "app/api/care-chat/route.ts",
      ],
      reporter: ["text", "json-summary", "html"],
      thresholds: { lines: 85, statements: 80, functions: 85, branches: 70 },
    },
  },
});

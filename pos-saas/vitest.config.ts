import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./lib/test/setup.tsx"],
    include: [
      "modules/**/*.test.ts",
      "lib/**/*.test.ts",
      "lib/**/*.test.tsx",
      "components/**/*.test.tsx",
      "hooks/**/*.test.ts",
      "hooks/**/*.test.tsx",
      "scripts/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "modules/**/domain/**/*.ts",
        "modules/**/application/**/*.ts",
        "modules/shared/domain/**/*.ts",
        "modules/shared/errors/**/*.ts",
        "modules/shared/http/**/*.ts",
        "modules/shared/serialization/**/*.ts",
      ],
      exclude: [
        "modules/**/*.test.ts",
        "modules/**/index.ts",
        "modules/**/*.d.ts",
        "modules/**/types.ts",
        "modules/**/ports.ts",
        "modules/**/test-helpers.ts",
        "modules/shared/http/api-handler.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});

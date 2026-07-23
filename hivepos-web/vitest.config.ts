import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    // Default node env for logic tests; component tests opt into jsdom via a
    // per-file `// @vitest-environment jsdom` pragma (jsdom is a devDep).
    // setupFiles registers @testing-library/jest-dom matchers + RTL cleanup so
    // those component tests (toBeInTheDocument, etc.) resolve.
    environment: "node",
    setupFiles: ["./lib/test/setup.tsx"],
    include: [
      "app/**/*.test.{ts,tsx}",
      "components/**/*.test.{ts,tsx}",
      "hooks/**/*.test.{ts,tsx}",
      "lib/**/*.test.{ts,tsx}",
      "scripts/**/*.test.ts",
    ],
    coverage: { provider: "v8", reporter: ["text", "json", "html"] },
  },
});

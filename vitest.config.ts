import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    // ponytail: node env for now (logic tests). Switch to jsdom + add jsdom dep
    // when the first component test lands.
    environment: "node",
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

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/__tests__/**/*.ts"],
    exclude: ["src/__tests__/integration/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: ["node_modules", "dist", "**/*.d.ts", "src/__tests__/integration/**"],
    },
  },
});

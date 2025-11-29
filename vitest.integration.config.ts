import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/integration/**/*.ts"],
    testTimeout: 60000, // 60s for container startup
    hookTimeout: 60000,
    pool: "forks", // Use forks for better isolation
    poolOptions: {
      forks: {
        singleFork: true, // Run in single fork to share container
      },
    },
  },
});

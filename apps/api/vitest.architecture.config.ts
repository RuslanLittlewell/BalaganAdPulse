import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    "process.env.JWT_SECRET": JSON.stringify("architecture-test-secret"),
  },
  test: {
    environment: "node",
    include: ["test/architecture/**/*.test.ts", "test/composition/**/*.test.ts", "test/shared/**/*.test.ts", "test/identity/**/*.test.ts"],
    exclude: ["test/identity/**/*.prisma-adapters.test.ts", "**/node_modules/**", "**/.git/**"],
  },
});

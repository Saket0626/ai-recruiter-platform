import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgresql://researchreach:test@127.0.0.1:5432/postgres",
      DIRECT_URL: "postgresql://researchreach:test@127.0.0.1:5432/postgres",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});

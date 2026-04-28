import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    // Use node environment — tests are server-side only at scaffold stage.
    environment: "node",

    // Test files live alongside source files (*.test.ts / *.spec.ts).
    include: ["**/*.{test,spec}.{ts,tsx}"],

    // Exclude Next.js build artifacts.
    exclude: ["node_modules", ".next", "**/*.d.ts"],

    // Global test timeout: 10s. DB tests may be slow in CI.
    testTimeout: 10_000,
  },
});

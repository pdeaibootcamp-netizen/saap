import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
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

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // `server-only` unconditionally throws under a plain Node resolver (it
      // only resolves to a no-op under Next's webpack "react-server"
      // condition — see docs/HANDOVER.md for the full story). This alias is
      // test-runner-scoped only; it does not change what ships to the
      // browser — Next's own build still enforces the real guard.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only-noop.ts"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
  },
});

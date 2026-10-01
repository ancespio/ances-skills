import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    server: { deps: { inline: ["@cloudflare/workers-oauth-provider"] } },
    environment: "node",
    coverage: { enabled: false },
  },
});

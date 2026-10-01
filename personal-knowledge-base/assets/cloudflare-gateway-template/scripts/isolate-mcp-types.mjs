import { readFileSync, writeFileSync } from "node:fs";

// Wrangler emits ambient Cloudflare/NodeJS names for each entrypoint.
// Exporting the generated binding type keeps the MCP declarations module-local.
const path = new URL("../mcp-configuration.d.ts", import.meta.url);
const generated = readFileSync(path, "utf8");
const marker = "export type { McpBindings };";
if (!generated.includes(marker)) {
  writeFileSync(path, generated.trimEnd() + "\n\n" + marker + "\n", "utf8");
}

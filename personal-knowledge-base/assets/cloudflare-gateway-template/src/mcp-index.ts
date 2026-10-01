import { OAuthProvider, insufficientScope, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { authorizeBearer } from "./auth";
import { GithubRepositoryClient } from "./github";
import { handleMcpAuth, type McpEnv, type Identity } from "./mcp-auth";
import { KnowledgeReader } from "./mcp-knowledge";
import { serveKnowledgeMcp } from "./mcp";

export function buildMcpReader(env: McpEnv) {
  // Repository scope is deployment configuration, never caller-controlled.
  return new KnowledgeReader(new GithubRepositoryClient({
    owner: env.GITHUB_OWNER, repository: env.GITHUB_REPOSITORY, token: env.GITHUB_MCP_TOKEN,
  }), env.SYNC_STATE);
}

export function mcpProvider(env: McpEnv) {
  return new OAuthProvider<McpEnv>({
    apiRoute: "/mcp", authorizeEndpoint: "/authorize", tokenEndpoint: "/oauth/token", clientRegistrationEndpoint: "/oauth/register",
    scopesSupported: ["kb:read", "offline_access"], requiredScopes: ["kb:read"],
    resourceMetadata: { resource: `${env.MCP_ORIGIN}/mcp`, authorization_servers: [env.MCP_ORIGIN] },
    accessTokenTTL: 3600, refreshTokenTTL: 2592000,
    apiHandler: { async fetch(request, bound, ctx) {
      const auth = ctx as ExecutionContext & { props: Identity; auth: Parameters<typeof insufficientScope>[0] };
      if (!auth.auth.scope.includes("kb:read")) return insufficientScope(auth.auth, ["kb:read"]);
      if (!bound.MCP_ALLOWED_LOGIN || auth.props.login !== bound.MCP_ALLOWED_LOGIN) return new Response("Forbidden", { status: 403 });
      if (new URL(request.url).pathname !== "/mcp") return new Response("Not found", { status: 404 });
      return serveKnowledgeMcp(request, buildMcpReader(bound));
    } },
    defaultHandler: { fetch(request, bound) {
      return handleMcpAuth(request, bound, (bound as McpEnv & { OAUTH_PROVIDER: OAuthHelpers }).OAUTH_PROVIDER);
    } },
  });
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/health" && request.method === "GET") return Response.json({ ok: true, mode: "keyword" });
    if (path === "/admin/mcp/warm") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      if (!await authorizeBearer(request, env.ADMIN_TOKEN)) return new Response("Unauthorized", { status: 401 });
      try { return Response.json(await buildMcpReader(env).warm()); }
      catch { return Response.json({ error: "MCP cache warming failed" }, { status: 503 }); }
    }
    if (path === "/mcp" || path.startsWith("/mcp/") || path === "/authorize" || path === "/callback" || path.startsWith("/oauth/") || path.startsWith("/.well-known/")) {
      return mcpProvider(env).fetch(request, env, ctx);
    }
    return new Response("Not found", { status: 404 });
  },
  async scheduled(_controller, env, ctx): Promise<void> {
    if (env.GITHUB_MCP_TOKEN) ctx.waitUntil(buildMcpReader(env).warm().catch(() => {
      console.error("MCP cache warming failed");
    }));
  },
} satisfies ExportedHandler<McpEnv>;

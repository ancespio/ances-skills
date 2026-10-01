import { AuthorizationError, CimdFetchError, authorizationErrorRedirect, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import type { McpBindings } from "../mcp-configuration";

export type McpEnv = McpBindings;
export type Identity = { login: string; userId: string };
const escape = (text: string) => text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
class IdentityError extends Error {}

export async function githubIdentity(env: McpEnv, code: string, verifier: string, fetcher: typeof fetch = fetch): Promise<Identity> {
  const response = await fetcher("https://github.com/login/oauth/access_token", {
    method: "POST", redirect: "manual", headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.GITHUB_OAUTH_CLIENT_ID, client_secret: env.GITHUB_OAUTH_CLIENT_SECRET, code, code_verifier: verifier, redirect_uri: `${env.MCP_ORIGIN}/callback` }),
  });
  const token: { access_token?: string; scope?: string } = await response.json();
  if (!response.ok) throw new IdentityError("token-http-failure");
  if (!token.access_token) throw new IdentityError("token-exchange-rejected");
  if (token.scope?.trim()) throw new IdentityError("unexpected-identity-scope");
  const userResponse = await fetcher("https://api.github.com/user", { redirect: "manual", headers: { authorization: `Bearer ${token.access_token}`, accept: "application/vnd.github+json", "user-agent": "KnowledgeBase-MCP" } });
  const user: { login?: string; id?: number } = await userResponse.json();
  if (!userResponse.ok) throw new IdentityError("identity-http-failure");
  if (!env.MCP_ALLOWED_LOGIN || user.login !== env.MCP_ALLOWED_LOGIN || !Number.isSafeInteger(user.id)) throw new IdentityError("identity-owner-mismatch");
  return { login: user.login, userId: String(user.id) };
}

export async function handleMcpAuth(request: Request, env: McpEnv, oauth: OAuthHelpers): Promise<Response> {
  if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET) return new Response("MCP 身份登录尚未配置", { status: 503 });
  const url = new URL(request.url);
  try {
    if (url.pathname === "/authorize" && request.method === "GET") {
      const original = await oauth.parseAuthRequest(request);
      const details = await oauth.describeConsent(original);
      const consent = await oauth.beginConsent(original);
      consent.headers.set("Content-Type", "text/html; charset=utf-8");
      return new Response(`<!doctype html><meta charset="utf-8"><title>KnowledgeBase 只读授权</title><h1>允许 ${escape(details.clientName)} 读取知识库？</h1><p>仅 ${escape(env.GITHUB_OWNER)}/${escape(env.GITHUB_REPOSITORY)}，只读。GitHub 登录仅确认身份，不申请 repo 权限。</p><p>客户端域名：${escape(details.clientDomain ?? "动态注册，名称未经验证")}；返回地址：${escape(details.redirectHost)}</p>${details.redirectIsLoopback ? "<p>访问权将交给本机应用，请确认由你发起。</p>" : ""}<p>权限：kb:read；offline_access 允许续期。</p><form method="post"><input type="hidden" name="handle" value="${escape(consent.handle)}"><button name="decision" value="approve">允许只读访问</button> <button name="decision" value="deny">拒绝</button></form>`, { headers: consent.headers });
    }
    if (url.pathname === "/authorize" && request.method === "POST") {
      const form = await request.formData();
      const handle = String(form.get("handle") ?? "");
      if (form.get("decision") !== "approve") {
        const denied = await oauth.denyConsent(request, handle);
        return new Response(null, { status: 302, headers: denied.headers });
      }
      const approved = await oauth.approveConsent(request, handle, { scope: ["kb:read", "offline_access"] });
      const verifier = crypto.randomUUID() + crypto.randomUUID();
      const { state, headers } = await oauth.beginUpstream(approved.request, { data: { verifier }, headers: approved.headers });
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
      const challenge = btoa(String.fromCharCode(...digest)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
      const upstream = new URL("https://github.com/login/oauth/authorize");
      upstream.search = new URLSearchParams({ client_id: env.GITHUB_OAUTH_CLIENT_ID, redirect_uri: `${env.MCP_ORIGIN}/callback`, scope: "", state, code_challenge: challenge, code_challenge_method: "S256" }).toString();
      headers.set("Location", upstream.href);
      return new Response(null, { status: 302, headers });
    }
    if (url.pathname === "/callback" && request.method === "GET") {
      const { request: original, data, headers } = await oauth.finishUpstream<{ verifier: string }>(request);
      let identity: Identity;
      try {
        if (url.searchParams.has("error") || !url.searchParams.get("code")) throw new Error("denied");
        identity = await githubIdentity(env, url.searchParams.get("code")!, data.verifier);
      } catch (error) {
        console.warn("MCP identity denied", error instanceof IdentityError ? error.message : "identity-response-failure");
        headers.set("Location", authorizationErrorRedirect(original, "access_denied"));
        return new Response(null, { status: 302, headers });
      }
      const { redirectTo } = await oauth.completeAuthorization({ request: original, userId: identity.userId, metadata: { login: identity.login }, scope: original.scope, props: identity });
      headers.set("Location", redirectTo);
      return new Response(null, { status: 302, headers });
    }
    return new Response("Method not allowed", { status: 405 });
  } catch (error) {
    if (error instanceof AuthorizationError && error.redirectTo) return Response.redirect(error.redirectTo, 302);
    if (error instanceof AuthorizationError || error instanceof CimdFetchError) return new Response("授权已过期或客户端验证失败，请重新发起连接", { status: 400 });
    return new Response("身份服务暂时不可用", { status: 503 });
  }
}

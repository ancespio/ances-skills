import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { KnowledgeReader } from "./mcp-knowledge";

const commit = z.string().regex(/^[a-f0-9]{40}$/i).optional();
const lines = { from_line: z.number().int().min(1).default(1), max_lines: z.number().int().min(1).max(200).default(200), commit };
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export function createKnowledgeMcp(reader: KnowledgeReader) {
  const server = new McpServer({ name: "personal-knowledge-base", version: "1.0.0" });
  const result = async (work: () => Promise<unknown>) => {
    try {
      const data = await work();
      return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
    } catch (error) {
      // 只返回已知业务错误；GitHub 响应、凭据和内部异常不得进入工具输出。
      const message = error instanceof Error && /路径|范围|快照|查询|limit|commit|来源|正文|文档/.test(error.message) ? error.message : "读取失败，请检查服务状态和只读凭据";
      return { isError: true, content: [{ type: "text" as const, text: message }] };
    }
  };
  server.registerTool("queryKnowledgeBase", {
    description: "搜索固定私有仓库中的知识页、来源题录、literature 笔记与稳定 Context；日记需 include_diary。返回同一 commit 的关键词候选，须读取全文和核验来源。",
    inputSchema: { query: z.string().min(1).max(500), scope: z.enum(["knowledge", "evidence", "literature", "context"]).optional(), include_diary: z.boolean().default(false), limit: z.number().int().min(1).max(10).default(5), commit }, annotations,
  }, input => result(() => reader.query(input)));
  server.registerTool("getKnowledgeDocument", {
    description: "分页读取检索结果中的 knowledge、literature、context 文档及可解析引用。raw、derived、source 必须走核验接口。请传 query 返回的 commit。",
    inputSchema: { path: z.string().min(1).max(1000), ...lines }, annotations,
  }, input => result(() => reader.document(input.path, input.from_line, input.max_lines, input.commit)));
  server.registerTool("getVerifiedSource", {
    description: "在同一 commit 校验 source 页与 raw 原件 SHA，返回嵌套 YAML 题录、metadata_status、可用原文/摘要/译文。哈希通过不等于题录全字段 verified。",
    inputSchema: { slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), commit }, annotations,
  }, input => result(() => reader.source(input.slug, input.commit)));
  server.registerTool("getVerifiedSourceText", {
    description: "按需分页读取已校验的 PDF 转录、中文摘要或译文。每次验证同一 commit 的 raw/source/manifest/artifact identity 和 SHA；缺失或失败拒绝读取。",
    inputSchema: { slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), variant: z.enum(["original", "zh-abstract", "zh-full"]), ...lines }, annotations,
  }, input => result(() => reader.text(input.slug, { variant: input.variant, fromLine: input.from_line, maxLines: input.max_lines }, input.commit)));
  return server;
}

export async function serveKnowledgeMcp(request: Request, reader: KnowledgeReader) {
  const server = createKnowledgeMcp(reader);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } finally { await server.close(); }
}

# Cloudflare Gateway 与私人 GPTs 配置参考

## 目标与边界

这是知识库的可选只读入口，不替代本地 qmd。知识库与 Gateway 分两个私有仓库维护：前者只保存知识库，后者保存 Worker 代码、配置与 Action schema。不得把 `raw/`、默认排除的 `wiki/derived/`、管理端点、webhook secret、Deploy Hook URL 或 token 暴露给 GPT。derived 只允许通过校验后的分页接口按需读取。

```text
KnowledgeBase main push -> GitHub Push webhook -> Worker incremental/full sync -> AI Search
                       -> scheduled continuation only while a full sync is pending

Gateway main push -> Cloudflare Workers Builds -> Worker code deployment
```

Git Builds/Deploy Hook 只部署 Gateway 代码，绝不替代知识库 webhook。

## 1. 前提

1. 知识库在 GitHub 私有仓库的 `main` 分支维护，`raw/` 不被 Git 换行转换改写。
2. 准备 GitHub fine-grained token，只读访问知识库仓库的 Contents 与 Metadata。
3. 用户自行在 Cloudflare 和 GPT Builder 输入 secret；不将其贴入对话、Markdown 或 Git。

## 2. Cloudflare 资源与 `wrangler.jsonc`

创建 KV namespace 保存同步状态，实际 ID 只写入 Gateway 私有仓库；AI Search 可用账户默认 namespace。脱敏模板：

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "private-kb-gateway",
  "main": "src/index.ts",
  "compatibility_date": "YYYY-MM-DD",
  "compatibility_flags": ["nodejs_compat"],
  "vars": { "GITHUB_OWNER": "<owner>", "GITHUB_REPOSITORY": "<knowledgebase-repository>" },
  "secrets": { "required": ["GITHUB_TOKEN", "GITHUB_WEBHOOK_SECRET", "GPT_ACTION_TOKEN", "ADMIN_TOKEN"] },
  "kv_namespaces": [{ "binding": "SYNC_STATE", "id": "<kv-namespace-id>" }],
  "ai_search_namespaces": [{ "binding": "AI_SEARCH", "namespace": "default" }],
  "triggers": { "crons": ["*/5 * * * *"] },
  "observability": { "enabled": true, "head_sampling_rate": 0.1 }
}
```

`*/5 * * * *` 每 5 分钟检查一次 KV：存在 pending full sync 时调用 `continue()`，不存在时直接结束。它不会在空闲时启动每日全量同步，避免重复扫描导致 KV PUT 和 Worker CPU 用量异常。由 Wrangler 管理时，Cron 只在配置文件中维护；下一次部署会以它替换远端 Cron。

## 3. 部署与密钥

```powershell
pnpm install
pnpm exec wrangler types
pnpm test
pnpm exec wrangler deploy

pnpm exec wrangler secret put GITHUB_TOKEN
pnpm exec wrangler secret put GITHUB_WEBHOOK_SECRET
pnpm exec wrangler secret put GPT_ACTION_TOKEN
pnpm exec wrangler secret put ADMIN_TOKEN
```

GPT 只能使用 `GPT_ACTION_TOKEN`；`ADMIN_TOKEN` 和 GitHub token 仅限管理与同步。Deploy Hook URL 本身也是凭据。

## 4. 可复用 Worker 调度骨架

```ts
const fullSync = new FullSyncCoordinator({ repository, index, state }, 5);

async scheduled(_controller, env, ctx) {
  ctx.waitUntil((async () => {
    const pending = await state.getPendingFullSync();
    if (pending) {
      await fullSync.continue();
    }
  })());
}
```

Webhook 必须验证签名，只处理 `refs/heads/main`；普通 Push 增量同步，force Push 或截断 payload 改为全量对账。`/v1/query`、`/v1/sources/{slug}` 和 `/v1/sources/{slug}/text` 用 Action token；`/admin/*` 必须使用独立 Admin token，且不得出现在公开 OpenAPI。

PDF derived 不进入默认 AI Search。`getVerifiedSource` 返回通过校验的 `availableTextVariants`；客户端再按需调用：

```http
GET /v1/sources/{slug}/text
    ?variant=original|zh-abstract|zh-full
    &from_line=1
    &max_lines=200
```

Worker 必须在同一个 synced commit 依次验证 source 页 raw SHA、manifest 的 source/raw identity 和目标 transcript/translation artifact SHA。响应返回 raw/derived 路径与哈希、`generatedAt`、`syncedCommit`、分页位置和 warnings；任何一级不一致都拒绝返回。

## 5. GitHub webhook 与首次同步

在知识库仓库设置 Push webhook：目标为 `https://<worker-host>/github/webhook`，Content type 为 JSON，secret 与 `GITHUB_WEBHOOK_SECRET` 一致。首次同步传入 `main` 的完整 commit SHA；若任务未完成，只继续同一任务，不重新 start。`/health` 的非空 `syncedCommit` 才是可检索基线。

## 6. Workers Builds 与私人 GPTs

连接 **Gateway 仓库**到 Workers Builds，生产分支的部署命令使用 `pnpm deploy` 或等价 `wrangler deploy`。需要不创建 commit 的代码重部署时，对 main 分支 Deploy Hook 发 POST；不得公开 URL。

在仅自己可见的 GPT 中导入 `https://<worker-host>/openapi.json`，认证选择 Bearer/API Key，并仅填 `GPT_ACTION_TOKEN`。Instructions 要求：事实优先用完整性验证过的 evidence；knowledge/context 仅辅助理解；调用失败明确降级。`include_context=false` 仍检索 persona、项目画像和 Context 指南；只有需要近期事件、历史过程或决策演化时才设为 `true`，追加 diary。

Context 全量进入 `kb-context`：persona、项目画像和 `DIARY_GUIDE.md` 类比 Wiki 稳定层，使用 metadata `kind` 过滤后每次检索；diary 类比 Raw 历史层，已索引但仅在 `include_context=true` 时追加检索。将脱敏的 [`diary-template.md`](diary-template.md) 复制到 KnowledgeBase 的 `context/DIARY_GUIDE.md`，保留 `type: context-guide`、`remote_access: always` 等 frontmatter。该复制动作由用户或本地 Agent 执行；Cloudflare 定时任务不会创建或修改 Context。

OpenAPI `0.2.1` 的 `include_context` 描述应明确上述语义。AI Search Workers binding 的过滤条件放在 `ai_search_options.retrieval.filters`；稳定层使用 `kind $in [context-persona, context-project, context-guide, persona]`，历史层使用 `kind $in [context-diary, diary]`。每个 `$in` 值数量保持在平台限制内。

## 7. 验收与排查

| 检查 | 通过标准 |
| --- | --- |
| 运行基线 | `/health` 返回 `ok: true` 且 `syncedCommit` 非空 |
| Action | OpenAPI 只暴露三个只读 operation，三者单独调用成功 |
| Derived | 原文与摘要译文可分页读取；缺失全文译文、篡改 raw、manifest 或 derived 文件时拒绝返回 |
| 增量 | 一次知识库 `main` Push 触发 webhook 后索引 commit 更新 |
| Context 默认层 | `include_context=false` 能返回 persona/项目画像/指南，且不返回 diary |
| Context 历史层 | `include_context=true` 能在稳定层之外返回相关 diary |
| 补偿 | Cron 只继续 pending full sync；空闲时不启动新任务 |
| 代码部署 | Gateway 推送或 Deploy Hook 后出现新的生产部署 |

Worker 已部署但无内容时先查 `/health`、首次同步与 webhook；Build 成功但索引未更新时查 webhook/定时同步，而不是 Build 配置。

## 官方参考

- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [AI Search metadata filtering](https://developers.cloudflare.com/ai-search/configuration/retrieval/filtering/)
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Deploy Hooks](https://developers.cloudflare.com/workers/ci-cd/builds/deploy-hooks/)
- [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

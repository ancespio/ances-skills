# Cloudflare Gateway 与私人 GPTs 配置参考

这是保留的 GPT Actions + AI Search 路线，不因新增 MCP 而自动停用。先读
[路线选择与共同准备](remote-access.md)；不用 AI Search 时另选
[MCP 独立配置](github-readonly-mcp.md)。两者不要共用 Worker 名称或 KV。

## 目标与边界

这是知识库的可选只读入口，不替代本地 qmd。知识库与 Gateway 分两个私有仓库维护：前者只保存知识库，后者保存 Worker 代码、配置与 Action schema。不得把 `raw/`、默认排除的 `wiki/derived/`、管理端点、webhook secret、Deploy Hook URL 或 token 暴露给 GPT。derived 只允许通过校验后的分页接口按需读取。

```text
KnowledgeBase main push -> GitHub Push webhook -> Worker incremental/full sync -> AI Search
                       -> scheduled continuation only while a full sync is pending

Gateway main push -> Cloudflare Workers Builds -> Worker code deployment
```

Git Builds/Deploy Hook 只部署 Gateway 代码，绝不替代知识库 webhook。

## 1. 前提

先现场确认用户的 ChatGPT 账户可管理私人 GPT Actions、Cloudflare 账户可使用
AI Search Workers binding，以及用户接受对应资源费用。能力不可用时报告阻塞，
再由用户选择是否改走 MCP，不能默默切换。

Agent 收集知识库 owner/repository、main 分支、Cloudflare 目标账户、独立 Gateway
目录和 Worker 名称；确认安装项目依赖、创建资源、部署的授权。
将 skill 的 `assets/cloudflare-gateway-template/` 复制到该空目录，检查已有 Git 状态，
不要覆盖现有工程。此路线使用 `wrangler.jsonc` 和 `src/index.ts`。

检查 `node --version`、`pnpm --version`；授权后执行 `pnpm install`，
保存 lockfile，之后使用 frozen lockfile。执行 `pnpm exec wrangler whoami`
确认账户，未登录时由用户完成 `pnpm exec wrangler login` 的浏览器授权。

1. 知识库在 GitHub 私有仓库的 `main` 分支维护，`raw/` 不被 Git 换行转换改写。
2. 准备 GitHub fine-grained token，只读访问知识库仓库的 Contents 与 Metadata。
3. 用户自行在 Cloudflare 和 GPT Builder 输入 secret；不将其贴入对话、Markdown 或 Git。

## 2. Cloudflare 资源与 `wrangler.jsonc`

创建 KV namespace 保存同步状态，实际 ID 只写入 Gateway 私有仓库；AI Search 可用账户默认 namespace。脱敏模板：

先执行 `pnpm exec wrangler kv namespace list`，无本服务可复用的 namespace 时，
执行 `pnpm exec wrangler kv namespace create KB_ACTIONS_SYNC`。
将返回 ID 填入下面 SYNC_STATE；确认 AI Search 可用的 namespace 与绑定名称，
模板同步代码会确保所需搜索实例存在。保留模板已验证的 compatibility_date，
不要将下列 YYYY-MM-DD 占位符直接部署。

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
pnpm cf:types:mcp
pnpm test
pnpm typecheck
pnpm deploy:dry

pnpm exec wrangler secret put GITHUB_TOKEN
pnpm exec wrangler secret put GITHUB_WEBHOOK_SECRET
pnpm exec wrangler secret put GPT_ACTION_TOKEN
pnpm exec wrangler secret put ADMIN_TOKEN
pnpm deploy
```

GPT 只能使用 `GPT_ACTION_TOKEN`；`ADMIN_TOKEN` 和 GitHub token 仅限管理与同步。Deploy Hook URL 本身也是凭据。

生成 MCP 类型只为共享工程的 TypeScript 检查，不创建或部署 MCP 资源。
前三种非 GitHub 凭据分别生成独立随机值，不互相复用；用户在安全终端交互输入，
不得把值写进命令参数、对话或 Git。secret put 如需创建初始 Worker，只用已确认名称。
部署后保存实际 origin 和版本；GET /v1/query 方法不正确不构成鉴权验收，
需对 POST /v1/query 无 token 请求确认 401。

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

在知识库目录执行 `git fetch origin main`、`git rev-parse origin/main` 获得实际
远端完整 SHA。使用安全会话提供的进程环境变量，不在命令中粘贴管理 token：

```powershell
$origin = "https://<worker-host>"
$commit = "<knowledgebase-origin-main-full-sha>"
$headers = @{ Authorization = "Bearer $env:KB_ADMIN_TOKEN" }
Invoke-RestMethod -Method Post -Uri "$origin/admin/sync" -Headers $headers -ContentType "application/json" -Body (@{commit=$commit} | ConvertTo-Json)
Invoke-RestMethod -Uri "$origin/health"
# 仅在 pending 任务存在时手动继续；也可以等 Cron。
Invoke-RestMethod -Method Post -Uri "$origin/admin/sync/continue" -Headers $headers
```

不要并行启动多份全量任务；轮询应间隔并退避，不能以密集请求消耗配额。
GitHub Settings → Webhooks 中检查一次真实 Push delivery 的响应和目标 commit。
成功入队仍需继续检查 /health 与实际查询结果。完成后清理管理会话中的 token。

全量任务 pending 期间，`syncedCommit` 会继续表示上一个完整、一致的索引基线，直到清理旧条目和全部批次完成后才原子切换到目标 commit。确认任务是否前进时查看 `pendingFullSync.commit`、`pendingFullSync.cursor`、`lastAttempt.status` 和 `lastAttempt.updatedAt`；不要仅因 `syncedCommit` 仍旧就重复启动全量同步。粗略剩余时间为 `ceil((可索引文件总数 - cursor) / batchSize) × Cron 间隔`。提高 Cron 频率或批量会缩短等待，但必须先评估 Worker CPU、KV PUT 和 AI Search 操作配额。

## 6. Workers Builds 与私人 GPTs

连接 **Gateway 仓库**到 Workers Builds，生产分支的部署命令使用 `pnpm deploy` 或等价 `wrangler deploy`。需要不创建 commit 的代码重部署时，对 main 分支 Deploy Hook 发 POST；不得公开 URL。

在仅自己可见的 GPT 中导入 `https://<worker-host>/openapi.json`，认证选择 Bearer/API Key，并仅填 `GPT_ACTION_TOKEN`。Instructions 要求：事实优先用完整性验证过的 evidence；knowledge/context 仅辅助理解；调用失败明确降级。`include_context=false` 仍检索 persona、项目画像和 Context 指南；只有需要近期事件、历史过程或决策演化时才设为 `true`，追加 diary。

用 [只读客户端 Instructions](readonly-client-instructions.md) 的通用部分与 Actions
适配部分配置 GPT。保存为仅自己可见；公开发布、组织分享或切换认证另征授权。
在 Builder 中逐一测试三个 operation，再从实际聊天读取原文与摘要的两页。
不要导入 MCP 的第四个文档工具，当前 Action schema 没有这个接口。
当前 AI Search 模板未纳入 literature，不能声称可查询整理笔记；需要它时由用户
选择 MCP 或另行授权扩展 AI Search。原有 Wiki、Context 与 verified PDF 路线不变。

Context 全量进入 `kb-context`：persona、项目画像和 `DIARY_GUIDE.md` 类比 Wiki 稳定层，使用 metadata `kind` 过滤后每次检索；diary 类比 Raw 历史层，已索引但仅在 `include_context=true` 时追加检索。将脱敏的 [`diary-template.md`](diary-template.md) 复制到 KnowledgeBase 的 `context/DIARY_GUIDE.md`，保留 `type: context-guide`、`remote_access: always` 等 frontmatter。该复制动作由用户或本地 Agent 执行；Cloudflare 定时任务不会创建或修改 Context。

OpenAPI `0.2.1` 的 `include_context` 描述应明确上述语义。AI Search Workers binding 的过滤条件放在 `ai_search_options.retrieval.filters`；稳定层使用 `kind $in [context-persona, context-project, context-guide, persona]`，历史层使用 `kind $in [context-diary, diary]`。每个 `$in` 值数量保持在平台限制内。

## 7. 验收与排查

此路线使用 skill 的 `scripts/verify-gateway.ps1 -WorkerUrl "https://<worker-host>" -ExpectedCommit "<full-sha>"`；
脚本通过进程环境 KB_GATEWAY_ACTION_TOKEN 可选检查真实稳定/历史 Context 查询。
无 token 时 authenticatedQueries=false，不能视为客户端通过；PDF 分页仍按下表及手动 Prompt 检查。
不要使用 MCP 的 verify-mcp.ps1 或向本服务提供 OAuth token。

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

将 [手动验收 Prompt](readonly-client-instructions.md) 交给用户；验收表记录真实结果，
没有授权客户端 token 时明确标记“未验证”，不能用管理员请求替代。
模板的 raw/正文读取不会自动下载 Git LFS 实体；若远端只得到 pointer 必须拒绝，
不能忽略哈希或将 pointer 当 PDF/全文。生产 raw 不用于篡改测试，使用隔离单测夹具。
回退先使用已知 Worker 版本，保留知识库原件和旧索引；清理资源、撤销旧 GPT 或删除
webhook 必须单独获准。更新依赖前重跑旧 Action、Context 和源文件完整性回归。

## 官方参考

- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [AI Search metadata filtering](https://developers.cloudflare.com/ai-search/configuration/retrieval/filtering/)
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Deploy Hooks](https://developers.cloudflare.com/workers/ci-cd/builds/deploy-hooks/)
- [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

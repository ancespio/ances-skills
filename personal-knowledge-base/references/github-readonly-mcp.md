# GitHub 单仓只读 MCP：从零配置到真实读取

按阶段执行并记录无密钥检查点。此路线使用 Cloudflare Worker + KV + GitHub，不创建 AI Search。
它是关键词检索，不取代本地 qmd；现有 GPT Actions 路线继续可选，见 [路线选择](remote-access.md)。

## 0. 确认边界和输入

先确定知识库 owner/repository（私有、main）、独立 Gateway 目录、Cloudflare 账户、
Worker 名称、允许登录的 GitHub 用户、客户端以及部署和费用授权。
列出将远程可读的目录。模板索引 wiki/concepts、entities、synthesis、sources、literature 内容和 context；
排除 raw、derived、wiki 系统页/outputs、literature 根 README 与 templates。
Context 全量进入缓存，默认仅检索 remote_access: always，diary 按需；敏感材料必须在上传前处理。
不要把已有 local-only 字段误认作服务器的访问控制。

检查至少一篇 source：raw_file/raw_sha256 有效；PDF manifest、原文与中文摘要的 QC 通过，
并已提交到知识库 main。不需要为了部署重新摄入全部文献。
raw 配置禁用 Git 换行转换。不要复制私有材料到 Gateway。
模板当前不支持自动解引用 Git LFS pointer；raw/manifest/正文若是 LFS pointer，会核验失败。
assets/intermediate 的 LFS 不等于 transcript 必须走 LFS；遇到大文件先报告限制，不绕过哈希。

## 1. 创建独立工程

将 skill 的 `assets/cloudflare-gateway-template/` 复制到用户确认的空目录。
已有工程先比对差异，不能覆盖其 secrets、配置或未提交修改。
使用项目级 Node.js、pnpm，先探测 `node --version`、`pnpm --version`、`git status`；
模板依赖最低运行要求以实际 package metadata 为准，不全局升级。
授权后在 Gateway 目录执行：

```powershell
pnpm install
pnpm exec wrangler whoami
```

未登录时由用户完成 `pnpm exec wrangler login` 的浏览器授权。
多账户时确认实际目标账户；必要时在私有配置写 account_id。
首次安装保留 lockfile，之后使用 frozen lockfile。不要复制已有服务的 node_modules 或身份文件作为交付。
在私有 Gateway 仓库维护代码、部署配置和 lockfile；.dev.vars、.env、.wrangler 不入 Git。

## 2. 创建资源并参数化

先查已有资源，复用明确属于本服务的资源，避免重跑重复创建：

```powershell
pnpm exec wrangler kv namespace list
pnpm exec wrangler kv namespace create KB_MCP_CACHE
pnpm exec wrangler kv namespace create KB_MCP_OAUTH
```

将输出的两个 ID 分别填入 `wrangler.mcp.jsonc` 的 SYNC_STATE 和 OAUTH_KV；
不要复用旧 Actions 服务的 KV。
把 name 改为唯一 Worker 名，设置 GITHUB_OWNER、GITHUB_REPOSITORY、MCP_ALLOWED_LOGIN。
MCP_ALLOWED_LOGIN 是 GitHub 实际登录名，必须精确匹配。
MCP_ORIGIN 是最终 HTTPS origin，无路径且无尾斜杠。

如果还不知道 workers.dev origin，可先确认 Cloudflare 账户的 workers.dev 子域，
或使用已确认的自定义域名；实际部署返回地址不一致时，修正 origin 和 OAuth callback 后重新部署。
不把占位符当成已配置。MCP 所有命令显式带 `-c wrangler.mcp.jsonc`，避免部署到旧入口。
保留 Cron 每五分钟预热；首次验收可用管理接口，不必等多轮 Cron。

## 3. 两套 GitHub 凭据，严格分离

**读取仓库的 fine-grained PAT**

由用户在 GitHub 创建，只选择目标私有仓库，Repository permissions 仅 Contents: Read-only
和 Metadata: Read-only。不授予 Issues、Actions、写入或组织权限。设置到期日，交付中记录轮换职责，
不记录 token 值。组织仓库若需管理员批准，等待批准后再验收。

**仅验证身份的 GitHub OAuth App**

用户在 GitHub Settings → Developer settings → OAuth Apps 注册：
- Homepage URL：MCP_ORIGIN。
- Authorization callback URL：MCP_ORIGIN + `/callback`。
- 获取 Client ID 和 Client Secret，安全输入，不粘贴对话。
- GitHub 登录请求 scope 为空；代码会拒绝返回非空 scope 的令牌。
- 仓库读取使用上面的 PAT，不借 OAuth 登录申请 repo 权限。

将各项写入 **MCP Worker** 的 secrets。可用 Cloudflare Dashboard 或交互输入；不要在命令参数携带值：

```powershell
pnpm exec wrangler secret put GITHUB_MCP_TOKEN -c wrangler.mcp.jsonc
pnpm exec wrangler secret put GITHUB_OAUTH_CLIENT_ID -c wrangler.mcp.jsonc
pnpm exec wrangler secret put GITHUB_OAUTH_CLIENT_SECRET -c wrangler.mcp.jsonc
pnpm exec wrangler secret put ADMIN_TOKEN -c wrangler.mcp.jsonc
```

ADMIN_TOKEN 是独立随机管理凭据，不能复用 PAT、OAuth secret 或旧 Action token。
若 secret put 提示创建尚不存在的 Worker，仅在已确认名称下创建；不要误覆盖现有服务。
客户端获得的是此服务签发的 OAuth token，不是 GitHub PAT 或 ADMIN_TOKEN。

## 4. 检查与部署

```powershell
pnpm cf:types
pnpm cf:types:mcp
pnpm test
pnpm typecheck
pnpm deploy:mcp:dry
pnpm deploy:mcp
```

类型由 Wrangler 生成，不能靠手写 Env 掩盖绑定错误。
cf:types:mcp 随后运行 isolate-mcp-types.mjs，将生成声明转为模块导出；
不要省略该步骤，否则两份声明文件的 Cloudflare/NodeJS 全局名称会冲突。
原路线 wrangler.jsonc 保留为模板；MCP 的生成类型、dry-run、部署只读取 mcp 配置。
测试或 dry-run 失败先修复，不把未验证工程交付给用户。
部署成功后记录实际 URL、版本、部署时间；不宣称客户端已经可读。

公开探测：
- GET /health 返回 ok=true、mode=keyword，只说明服务存活。
- GET /mcp 无凭据返回 401，不泄露文档。
- GET /.well-known/oauth-authorization-server 返回同 origin 的授权、token、注册端点。
- GET /.well-known/oauth-protected-resource/mcp（以 401 的 WWW-Authenticate 声明为准）
  中 resource 应为完整 /mcp URL。
- /v1/query 等旧 Actions 路径在这个独立 Worker 返回 404；不会因此关闭另一 Worker 的旧服务。

## 5. 建立完整快照

管理员通过安全会话将 ADMIN_TOKEN 放入当前进程环境 `KB_MCP_ADMIN_TOKEN`，
不要写入 profile、文档、命令历史或日志。用真实 origin 执行：

```powershell
$origin = "https://<worker-host>"
$headers = @{ Authorization = "Bearer $env:KB_MCP_ADMIN_TOKEN" }
$warm = Invoke-RestMethod -Method Post -Uri "$origin/admin/mcp/warm" -Headers $headers
$warm | Select-Object commit, complete, loaded, remaining
```

单次最多读取 20 个变化文件；complete=false 时续跑同一 warm，不清空状态或重新 start。
Cron 会继续；若手动续跑，串行执行并至少间隔 60 秒，让 KV 写入传播。
不要同时运行多个预热脚本。当前 KV 不是强一致事务/锁，不承诺多写入者并发安全；
出现停滞、旧值或配额错误时停止密集重试，检查部署日志和 GitHub/Cloudflare 限额。
规模较大时先评估 KV 单值大小和整快照读写开销，超限需单独设计，不盲目扩批量。

只有 complete=true 才发布该完整 commit。完成后比较实际知识库 origin/main SHA；
若 main 已前进，继续下一轮，不能把旧完整快照说成最新。
历史快照保留七天；最新快照持续可读；过期 commit 请求会报错，客户端应重新检索。
Agent 离开管理会话后清理进程中的 token 变量，不输出凭据。
不需要给 GitHub 配 webhook；此路线通过 Cron 发现 main 变化。

## 6. 连接客户端与通用 Instructions

客户端必须支持远程 Streamable HTTP MCP 和 OAuth。
在实际客户端的自定义连接/App/MCP 设置中：
1. 填 `https://<worker-host>/mcp`，认证选 OAuth。
2. 发起连接，核对同意页显示的客户端域名、回调地址和目标 owner/repository。
3. 用 MCP_ALLOWED_LOGIN 指定账户完成 GitHub 登录；其他账户应被拒绝。
4. 确认授权的是 kb:read；如允许离线续期，可含 offline_access。
5. 验证实际出现四个工具，而不是只看到连接名称。

ChatGPT 的入口名称、开发者模式和账户资格随产品变化；Agent 现场检查客户端，
参考 [官方连接指南](https://developers.openai.com/plugins/deploy/connect-chatgpt)，
不可把旧菜单名称或账户权限写成保证。
若需要再包装 Plugin，复用已验收的 MCP 连接，按客户端要求绑定实际 App ID，
加入 [只读客户端规则](readonly-client-instructions.md)。不要发布私人 App ID 或打包全量知识库。
客户端创建/发布属于独立授权范围；仅配置 MCP 不代表获准公开发布 Plugin。

## 7. 用真实授权客户端验收

使用上面已建立的 OAuth 客户端，不把管理 token 当客户端 token。
逐项记录“通过 / 失败 / 未验证”，只输出必要的脱敏结果：

1. tools/list 恰有 queryKnowledgeBase、getKnowledgeDocument、getVerifiedSource、getVerifiedSourceText，
   都标只读，没有任意仓库参数、写工具或管理工具。
2. queryKnowledgeBase 用库内主题实际返回结果，记录 mode=keyword、repository、commit；
   commit 必须是完整 40 位 SHA，后续调用显式复用。
3. 检索稳定 Context 时 include_diary=false；历史问题设 true 后能查到一条实际日记。
   无对应材料时标“无样本，未验证”，不要制造私人数据。
4. 对一份 literature 笔记调用 getKnowledgeDocument，读取两页，检查 nextLine/complete
   及 references；原始引用应引导到 source 核验，而不是直接读取 raw。
5. getVerifiedSource 读取真实 slug，确认 raw integrity 与 metadata_status 分开呈现。
6. getVerifiedSourceText 对 original、zh-abstract 各读取首 20 行和下一页，
   检查返回 syncedCommit 与查询 commit 相同、路径/哈希/页码/生成时间和 warnings。
7. zh-full 不存在时应明确拒绝；测试夹具中的 raw、manifest、derived 篡改应失败。
   不为线上验收篡改真实 raw。路径越界、201 行、无效 commit、其他身份必须拒绝。
8. 经授权正常更新一条知识库内容并推 main 后，等待 warm 完成，验证新 commit 与内容可读；
   不以 Worker 重新部署替代知识库同步。

可把 [手动验收 Prompt](readonly-client-instructions.md) 交给用户网页端执行。
本地单测成功、匿名 401、部署成功和缓存 complete 均不能替代真实 OAuth 阅读验收。

可选自动检查使用 skill 的 `scripts/verify-mcp.ps1`（不是 verify-gateway.ps1）：

```powershell
.\scripts\verify-mcp.ps1 -WorkerUrl "https://<worker-host>" -ExpectedCommit "<full-sha>"
# 仅已有安全客户端 OAuth token 位于 KB_MCP_ACCESS_TOKEN 时可执行：
.\scripts\verify-mcp.ps1 -WorkerUrl "https://<worker-host>" -Query "<真实主题>" -SourceSlug "<slug>" -DocumentPath "literature/<实际笔记>.md"
```

脚本放在知识库 scripts 时从知识库目录运行；也可使用 skill 脚本绝对路径。
无客户端 token 只检查匿名拒绝和 discovery，输出 authenticatedReading=not-verified；
有 token 时检查四工具、固定 commit、原文和摘要分页。它不会替用户完成 OAuth 登录，
也不会代替历史 Context、缺失变体和真实 Push 的手动检查。

## 8. 常见阻塞、恢复与回退

- 401：检查客户端 OAuth 是否完成/过期，不能改用管理 token；重新连接或正常刷新。
- 403/登录拒绝：检查 GitHub 实际 login、允许身份与空 scope；不扩大 PAT/OAuth 权限试错。
- 尚无快照：串行继续 warm；检查 PAT 单仓读取权限及 main 是否存在。
- 正文核验失败：检查同一 commit 的 raw、source、manifest、artifact，是否只有 LFS pointer；
  禁止忽略哈希，修复必须走本地授权流程。
- 搜索漏词：这是 keyword，不是向量；换标题、别名、作者或明确主题词，或回本地 qmd。
- 配额/规模限制：报告真实限制，降低预热频率或另行规划分片；不要默认购买升级。
- 凭据轮换：分别轮换 PAT、OAuth secret、ADMIN_TOKEN；PAT 失效不通过申请 repo OAuth scope 绕过。
- 回退：独立 Worker 可按已知版本回滚，原 GPT Actions 服务保留不动；
  删除资源、撤销旧连接或停用付费服务另征授权。

## 官方依据

- [Cloudflare OAuth Provider](https://github.com/cloudflare/workers-oauth-provider)
- [Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Wrangler types](https://developers.cloudflare.com/workers/wrangler/commands/#types)
- [GitHub PAT 最小权限](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

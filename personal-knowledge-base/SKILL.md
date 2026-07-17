---
name: personal-knowledge-base
description: 创建、使用和维护由 LLM 负责整理的个人知识库或 LLM Wiki，适用于 Markdown/Obsidian 知识库。用于用户要求了解创建前准备、搭建知识库、设计 AGENTS.md/CLAUDE.md、配置 Obsidian Web Clipper、标定和摄入来源、把论文 PDF 转录/OCR/翻译为可校验的 wiki/derived 阅读层、查询本地 wiki、更新用户画像/项目状态/偏好/日记、执行健康检查、跨笔记综合反思、记录开放问题、合并重复页面、配置 qmd/rg 搜索、Cloudflare 只读 Gateway、来源可追溯性和 confidence 时。
---
# 个人知识库

## 总览

把个人知识库当作一个持续积累的持久化产物：人负责收集原始来源和提出问题；Codex 负责维护结构化 wiki、链接、日志、综合分析和来源账本。优先使用透明的 Markdown 文件和明确的操作规则，而不是一次性、不可追踪的 RAG 回答。

## 第一步

1. 先读取本地规则：`AGENTS.md`、`CLAUDE.md`、`README.md` 或同类 schema 文件。若它们与本 skill 冲突，以项目本地规则为准。
2. 判断用户意图：创建新知识库、操作已有知识库、迁移规则、摄入来源、查询知识、健康检查、反思/综合、添加问题，或合并重复页面。
3. 非琐碎写入前说明假设：目标目录、来源归属、wiki 语言、搜索工具、持久化预期和验证命令。
4. 如果知识库位于 Git 仓库中，编辑前先检查仓库状态。
5. 将 raw 来源视为不可变。可以读取和计算哈希；未经用户明确确认并完成备份，不要编辑、覆盖、移动或删除。

## 架构

除非现有项目另有规定，默认使用简单三层模型：

- `raw/`：人类拥有的原始来源，例如剪藏、文章、PDF、截图、临时笔记和个人写作。默认只追加，不修改。
- `wiki/`：LLM 维护的 Markdown 页面，例如 `sources/`、`concepts/`、`entities/`、`synthesis/`、`outputs/`、`templates/`，以及 `index.md`、`log.md`、`overview.md`、`QUESTIONS.md`。
- `wiki/derived/`：由 raw PDF 等原始材料生成的转录、OCR、摘要译文、全文译文和解析产物。它是可校验的辅助阅读层，不是新来源，默认不进入图谱或语义检索。
- `context/`：可选的长期个人/项目上下文、偏好和日记。除非本地 schema 明确允许，否则不要把它当作外部证据计入 confidence。
- Schema 文件：`AGENTS.md` 或 `CLAUDE.md` 是操作契约，用来定义目录规则、工作流、模板、confidence 和验证方式。

## 创建前先向用户说明准备事项

用户要求从零创建知识库时，不要立即批量写文件。先用简短清单说明最低准备和推荐准备，并确认用户是否继续。

最低准备：

- 一个知识库根目录。已有目录也可以，但要先检查冲突。
- 至少 1 篇可用于测试的代表性材料。推荐准备 2-3 篇不同类型的来源用于标定。
- 用户愿意长期遵守的基本边界：`raw/` 由用户拥有且默认不可修改，`wiki/` 由 LLM 维护。

推荐准备：

- 2-3 篇代表性来源：一篇外部文章或剪藏、一篇 PDF/研究资料、一篇个人写作或项目笔记。不要要求用户先整理全部历史材料。
- 若 PDF 是主要材料：准备实际常见版式的样本，确认是否需要中文摘要/全文翻译、固定术语译法、可接受的本地存储和 Git LFS 范围。
- 期望覆盖的主题范围，以及不希望进入知识库的隐私内容。
- 可选的 Context 初始材料：个人背景、长期偏好、当前项目、既有决策、近期状态和日记。未提供时保持为空，不自行推断。
- 工具选择：Obsidian 用于浏览，qmd 用于本地语义搜索，Python 用于 lint，Git 用于版本管理。这些工具都应先检测；除非用户授权，不要安装。
- Wiki 写作语言、slug 语言、是否保存可复用查询输出、是否启用 Git/备份。

向用户说明：最小可用版本可以从“一个目录 + 一篇测试材料”开始；2-3 篇代表性材料只用于标定输出风格和规则，不是创建前必须完成的资料迁移。

## 创建新知识库

1. 先执行准备问答：确认根目录、材料类型、Context 范围、隐私边界、Wiki 语言和可选工具。用户只提供最低准备时也可以继续。
2. 检查根目录现状、Git 状态和已有 `AGENTS.md`/`CLAUDE.md`/`README.md`。已有规则只合并，不覆盖。
3. 创建最小可用结构：`raw/`、`wiki/`、`wiki/sources/`、`wiki/concepts/`、`wiki/entities/`、`wiki/synthesis/`、`wiki/derived/pdfs/`、`wiki/outputs/`、`wiki/templates/`、`context/persona/`、`context/diary/`、`wiki/index.md`、`wiki/log.md`、`wiki/overview.md`、`wiki/QUESTIONS.md`。
4. 在批量写内容前先写 schema 文件。至少包含来源不可变、Context 更新、wikilink 格式、页面模板、操作流程、confidence 规则、日志和验证方式。
5. 只添加确实会用到的模板和脚本。如果 schema 包含 frontmatter、哈希、图谱排除或 wikilink 规则，创建可运行的 lint 脚本。
6. 检测 Obsidian、qmd、Python 和 Git，不要假设它们存在。qmd 不可用时降级为 `rg` 和 `wiki/index.md`；未经授权不要安装依赖。
7. 初始化后执行系统核查：目录、系统文件、模板、schema 关键规则、lint 和搜索索引逐项报告通过或缺失。
8. 正式批量处理前，用 2-3 篇代表性来源标定。逐篇让用户审查摘要、概念提取、aliases、wikilink、个人立场分离和输出风格；把修正写回 schema。
9. 标定完成后再询问是否批量迁移剩余材料，避免大量页面风格不一致。

需要创建完整项目时，读取 `references/bootstrap-prompt.md`，把其中 prompt 改成用户的路径、工具和偏好后执行。需要写项目规则时，读取 `references/agents-template.md` 并生成 `AGENTS.md` 或改写为 `CLAUDE.md`。需要生成 wiki 页面模板时，读取 `references/page-templates.md`。

## 配置 Obsidian Chrome Web Clipper

用户选择 Obsidian 和 Chrome/Chromium 浏览器时，在初始化完成后主动提供下面的配置指导。不要未经授权替用户安装浏览器扩展或修改 Obsidian 设置。

1. 让用户先在 Obsidian 中选择 **Open folder as vault**，把知识库根目录作为 vault 打开，并保持 Obsidian 已启动。
2. 只提供 Obsidian 官方 Web Clipper 安装地址：`https://chromewebstore.google.com/detail/obsidian-web-clipper/cnjifjpddelmedmihgijeibhnjfabmlf`。
3. 安装后打开扩展，进入齿轮 **Settings**；添加或选择刚打开的知识库 vault。浏览器要求打开 Obsidian URI 时，让用户确认允许。
4. 在 Web Clipper Settings 中点击 **New template**，创建 `LLM Wiki - Article`：
   - Behavior：`Create a new note`
   - Vault：当前知识库 vault
   - Note location：`raw/clippings`
   - Note name：`{{date|date:"YYYY-MM-DD"}}-{{title|safe_name}}`
   - Properties：至少包含 `type: web-clipping`、`title: {{title}}`、`source_url: {{url}}`、`author: {{author}}`、`captured: {{date|date:"YYYY-MM-DD"}}`、`processed: false`
   - Note content：保留 `{{content}}`，并在正文前记录标题、来源 URL、作者和剪藏日期。
5. 为统一附件位置，指导用户在 Obsidian **Settings → Files & Links → Default location for new attachments** 中选择 **In the folder specified below**，填写 `raw/images`。
6. 让用户在一篇真实文章上试剪藏：确认目标 vault、文件名、`raw/clippings/` 路径、正文、来源属性和图片位置都正确，再把它作为第一篇标定来源执行 INGEST。
7. 配置失败时先检查：Obsidian 是否已打开该 vault、模板的 Vault/Note location 是否正确、浏览器是否允许 `obsidian://` 协议、`raw/clippings/` 是否存在。

说明 Web Clipper 是可选工具；用户也可以手动把 Markdown 放入 `raw/articles/` 或 `raw/clippings/`。官方说明表明普通剪藏保存在本地 vault；不要默认启用需要外部模型的 Interpreter。

## PDF Derived 摄入

处理论文、扫描件或复杂版式 PDF 时，不要直接把一次性提取文本当作 source，也不要只保存摘要。采用 `PREPARE -> DERIVE -> QC -> INGEST`：

1. `PREPARE`：确认 raw PDF 只读，复用 source slug，计算 SHA-256，检查现有 derived、项目内 Python 环境、MinerU/Docling、模型缓存、磁盘和 Git LFS。
2. `DERIVE`：MinerU 主用、Docling 回退；先写临时 work，再规范化为 `wiki/derived/pdfs/<source-slug>/`。保留 transcript、manifest、assets 和完整 intermediate。
3. `QC`：验证 raw identity、artifact SHA、连续页锚、图片链接、首/中/尾页、双栏阅读顺序、OCR、公式、表格与参考文献。未通过时保持 `needs-review` 或 `failed`，不得继续知识提升。
4. `INGEST`：更新原 source 页和已有 concept/entity。PDF 是原始证据；transcript 是主要 LLM 阅读层；译文是辅助层，三者共享一个 source identity。finalizer 完成质检后同步 `derived_manifest`、`derived_transcript`、可用摘要/全文译文路径和 `derived_status`；历史修复使用 `--sync-source-only`，先核验 raw SHA-256。

所有文章默认生成中文辅助摘要：中文原文只生成摘要，非中文 PDF 写入 `abstract.zh-CN.md`。全文译文必须先按 transcript 篇幅询问用户：不超过 80,000 字符且不超过 30 页的短篇或常规篇均询问并建议翻译；超过任一阈值的超长篇建议只保留摘要，只有用户明确坚持才全文翻译。显式指定 model：小规模更新优先使用子 agent，大规模任务才调用 Codex CLI；小模型只处理低复杂度任务，不能绕过统一 QC。译文 frontmatter 与 manifest 必须记录 model、调用方式、prompt version 和生成时间。翻译前读取 concept/entity 的 `title` 与 `aliases` 建立术语表，保留原始术语、公式、引用和页锚。每次翻译后验证 raw identity、页锚数量与顺序、Markdown/HTML 图片链接、公式、引用编号、术语 aliases、中文内容质量，并确认 `source_count` 和 confidence 未变。derived 永不增加 `source_count` 或 confidence，所有 Markdown 设置 `graph-excluded: true`。

默认 qmd collection 排除 `derived/**`；建立 `includeByDefault: false` 的独立 derived collection，并忽略 `**/intermediate/**`。只有需要逐行核对原文转录或译文时显式查询 derived。完整目录、frontmatter、manifest、工具和质量门槛见 `references/pdf-derived-ingest.md`，每次实际处理 PDF 前先读取。

## 新建完成后向用户交付使用方法

创建完成不能只报告文件列表。必须同时告诉用户：

- 文章和网页剪藏放 `raw/articles/` 或 `raw/clippings/`，PDF 放 `raw/pdfs/`，截图放 `raw/images/`，随手想法放 `raw/notes/`，个人文章与分析放 `raw/personal/`。
- 第一次先摄入 2-3 篇代表性来源并审查结果，不要立刻全量导入。
- 可直接复制的日常指令：`摄入 <路径>`、`根据我的知识库回答 <问题>`、`我想搞清楚 <问题>`、`更新日记 <内容>`、`记录偏好 <内容>`、`lint`、`reflect`。
- 用户主要浏览 `wiki/`，不要手动改写由 LLM 维护的页面；发现问题时要求 Agent 修正规则和重新处理。
- 哪些动作需要用户确认：批量摄入、high confidence、合并、删除、大范围重写和依赖安装。
- 推荐节奏：随时收集，逐篇摄入；每两周 LINT；每月或每新增约 10 篇来源 REFLECT；项目状态和日记按事件更新。

## 日常操作

执行 `INGEST` 时：

1. 除非用户要求批处理，否则一次只处理一个 raw 来源。PDF 必须先完成 `PREPARE -> DERIVE -> QC`，通过后再进入知识提取。
2. 在需要追溯时，提取标题、来源元数据、日期和 raw SHA-256。
3. 创建或更新 `wiki/sources/<slug>.md`。
4. 更新匹配的 concept/entity 页面，不要制造重复页面。先检查 slug 和 aliases。
5. 显式记录矛盾，不要静默覆盖旧说法。
6. 更新 `index.md`，并向 `log.md` 追加记录。
7. 如果 qmd 已配置，执行项目安全查询入口或 `qmd update`；hybrid 失败/超时后依次降级 BM25 和 `rg`，返回实际模式与原因。不可用时说明已降级，不要擅自安装。默认查询和 `rg` 都不得混入 derived。

处理个人写作时：

- 将用户个人立场与外部证据分开保存。
- 除非本地 schema 明确允许，否则不要用个人写作增加外部证据的 `source_count`。

执行 `CONTEXT` 时：

1. 触发词包括：`更新画像`、`更新日记`、`记录偏好`、`记录项目进展`、`同步上下文`、`context`；触发词本身不等于授权写入。
2. Context 写入只发生在实际对话过程中。不要创建每日自动化任务，也不要因为日期变化自动生成日记；仅在对话出现重大节点、状态变化或任务结束时判断是否写入。
3. 先完整读取相关 Context 文件，再按语义路由：个人背景/长期状态写入 `context/persona/`，项目决策和进展写入对应项目文件，按日期事件写入 `context/diary/`。
4. 日记只记录用户明确陈述的事实、用户明确决定和当前交互中明确表达或确认的决策倾向。不得写入 Agent 推断、观察、心理分析或猜测；没有事实或状态变化时不创建空日记。
5. Persona 和项目文件使用“当前状态 + 日期化演化记录”，只追加或谨慎修订，不静默删除旧状态。今日日记存在时追加，不存在时创建；每次写入署名 `Codex Win端`。
6. 跨日期或跨项目追踪使用项目本地允许的相对 Markdown 链接；Context 不强制使用 Wiki 层英文 slug 规则。
7. 新建或触碰的 Context Markdown 应有 `type`、`date`、`updated` 和 `remote_access` frontmatter。`DIARY_GUIDE.md` 使用 `always`；用户画像、项目画像和日记默认使用 `on-demand`；`local-only` 不进入远程 Gateway 索引。
8. `context/` 不参与外部 `source_count`、confidence、`raw_sha256` 或 source integrity；除非用户明确要求，不把 Context 转成 wiki 知识页。
9. Gateway 的定时任务只做已有文件的索引校准和续跑，不生成或修改 Context。若 qmd 已索引 `context/`，写入后执行或提醒执行 `qmd update`。
10. 涉及 Context 维护规则时读取 `references/context-maintenance.md`；需要创建或撰写日记时读取 `references/diary-template.md`；完成后报告修改了哪些文件和记录了哪些已确认内容。

执行 `QUERY` 时：

1. 根据本地配置，用 `qmd query`、`rg` 或 `index.md` 搜索 wiki。
2. 综合前完整读取相关页面，不只依赖片段。
3. 知识性结论引用 source 页面。不要只依赖 concept 页面或 context 文件作为证据。
4. 把回答视为基于既有证据的二阶产物，不是新 source。回答、output、synthesis 和回答触发的 concept/entity 更新都不得增加 `source_count` 或提高 confidence。
5. 凡需落盘的 Query，默认先写入 `wiki/outputs/YYYY-MM-DD-<topic>.md`，并设置 `graph-excluded: true`。单次问答、临时格式化内容或用户明确要求不保存时，可以只在对话中回答。
6. output 至少包含：问题、简短结论、依据及对应 source 链接、反例/矛盾与局限、Confidence Notes、建议沉淀位置。将它登记到 index 的 Outputs 或 Recent Outputs，不要直接登记为 Recent Synthesis。
7. 执行 REVIEW：检查可复用性、逐条来源追溯、反证、证据缺口，并在更新 concept/entity 前按 slug 和 aliases 检查已有页面。
8. 默认不自动 PROMOTE。只有用户明确要求提升，或当前任务已明确授权时，才按类型处理：
   - 跨来源新结论、比较、框架或连接 -> `wiki/synthesis/`。
   - 既有定义或实体信息的补充、修正 -> 更新对应 concept/entity，并追加 Evolution Log。
   - 证据不足但值得追踪 -> `wiki/QUESTIONS.md`。
   - 用户确认的偏好、项目决策或近期状态 -> `context/`。
   - 单次问答、无来源推断或临时格式化 -> 保留在 outputs 或不落盘。
9. 保留原 output 作为候选答案和审计记录，注明提升目标；所有提升写入日志。只有实际生成 synthesis 时，才更新 Recent Synthesis。

执行 `LINT` 时：

- 检查 frontmatter、缺失 source 页、断裂 wikilink、outputs 图谱排除、过期哈希、孤立页面、重复概念和搜索索引新鲜度。
- 修复大范围问题前先写报告；合并、删除或重写前先询问用户。

执行 `REFLECT` 时：

- 写综合结论前先搜索反证。
- 扫描 concepts、entities、sources 和既有 synthesis，寻找模式、空白、矛盾和可复用问题。
- 当证据稀薄或单边时，写明局限性。

执行 `ADD-QUESTION` 时：

- 规范化用户问题，并附带 opened 日期追加到 `QUESTIONS.md`。
- 记录操作日志。

执行 `MERGE` 时：

- 不要自动合并。先展示拟保留 slug、aliases、来源并集和 redirect 方案。
- 如果 schema 使用 redirect，用 redirect 保留旧链接。

## 可选：Cloudflare 只读检索与私人 GPTs

仅当用户明确需要在手机或网页版 ChatGPT 查询私人知识库时，才采用这一可选扩展。它不替代本地 qmd，也不把知识库仓库改造成网页工程。

1. 保持知识库与 Gateway 为两个仓库：知识库仓库只保存知识库；Gateway 仓库存放 Worker、部署配置和 GPT Action schema。
2. Gateway 只暴露只读检索、已验证来源页和按需 derived 文本分页读取接口。`raw/` 与 `wiki/derived/` 不进入默认搜索索引；`context/` 只在请求明确需要个人化上下文时检索；不得向 GPT 暴露管理端点、webhook 或任何 secret。
3. 将知识库仓库 `main` 的 GitHub Push webhook 指向 Gateway。普通 push 触发增量索引；同时可配置每日全量校准和定时续跑，处理漏事件或超出单次执行上限的任务。这里的定时任务只维护远程索引，不创建或修改 `context/` 日记、画像或项目状态。
4. 初次索引完成后，以 `GET /health` 返回非空 `syncedCommit` 作为可查询基线；不要把 Worker 已部署或 OpenAPI 可访问误判为知识库已同步。
5. Cloudflare Git Builds 或 Deploy Hook 只部署 Gateway 代码；知识库索引仍由 GitHub webhook 和定时校准负责。不要混淆两条链路。
6. 在私人 GPT 中导入 Gateway 的 `/openapi.json`，仅配置 Action 专用 Bearer token，并使用指令要求：事实优先引用已完整性验证的 evidence；knowledge 和 context 只能辅助理解；失败时明确降级，不假称已检索。
7. 如需让云端 GPT 参考日记规则和模板，将脱敏的 `references/diary-template.md` 复制为知识库的 `context/DIARY_GUIDE.md`，保留 `remote_access: always`；Gateway 只索引该已存在的指南，不会自动生成或修改 Context。

部署前先让用户确认 Cloudflare、GitHub 与私人 GPT 的使用范围。所有 token、webhook URL、KV 标识和私人路径只在对应平台的 secret/config 中保存，绝不写入知识库、公开 skill 或提交记录。部署后至少验证：`/health` 的 `syncedCommit`、三个 Action 的单独调用、derived 分页与篡改拒绝，以及一次知识库 `main` push 的 webhook 增量同步。

实施前完整读取 [`references/cloudflare-gateway-gpts.md`](references/cloudflare-gateway-gpts.md)；不要用其中的占位符覆盖用户已有生产配置。

需要新建 Gateway 时，从 `assets/cloudflare-gateway-template/` 复制 starter；该目录包含脱敏后的完整 Worker 源码与回归测试。部署后运行 `scripts/verify-gateway.ps1 -WorkerUrl <worker-url>` 验证健康状态和只读 Action schema。

### 完整实施 SOP

当用户明确选择 Cloudflare + 私人 GPTs 时，按以下顺序执行；每一步先验证上一层，不要把“代码已部署”当作“知识库已同步”。

#### A. 先做范围和凭据隔离

1. 确认两个私有仓库：KnowledgeBase 只放 `raw/`、`wiki/`、`context/`；Gateway 只放 Worker、测试、配置和 OpenAPI。
2. 确认 KnowledgeBase 只维护 `main`，Gateway 的生产分支也明确为 `main`。
3. 生成并分别保存 `GITHUB_WEBHOOK_SECRET`、`GPT_ACTION_TOKEN`、`ADMIN_TOKEN`；`GITHUB_TOKEN` 使用 GitHub fine-grained token，仅授予 KnowledgeBase 的 Contents/Metadata 只读权限。
4. 禁止把 secret、Deploy Hook URL、KV ID、真实仓库路径写入 GPT Instructions、公开 skill 或 KnowledgeBase。

#### B. 先准备 KnowledgeBase

1. 建立 `raw/articles/`、`raw/pdfs/`、`raw/notes/`、`wiki/sources/`、`wiki/concepts/`、`wiki/entities/`、`wiki/synthesis/`、`context/`。
2. 来源页必须保存 `raw_file`、`raw_sha256`；用同一 Git commit 读取 source 与 raw，哈希一致才进入 evidence index。
3. 提交首批内容并记录完整 `main` commit SHA。Gateway 只读取 GitHub，不修改 KnowledgeBase。

#### C. 准备 Gateway

1. 从 `assets/cloudflare-gateway-template/` 复制 starter；不要复制 `node_modules/`、`.wrangler/` 或真实配置。
2. 运行 `pnpm install`、`pnpm exec wrangler types`、`pnpm test`、`pnpm exec wrangler deploy --dry-run`。
3. 公开 OpenAPI 只允许 `POST /v1/query`、`GET /v1/sources/{slug}` 与 `GET /v1/sources/{slug}/text`；`/github/webhook`、`/admin/sync`、`/admin/sync/continue` 不得进入 GPT schema。
4. Worker 的读写边界必须固定：`raw/` 不索引；`wiki/sources/` 是 evidence；`wiki/concepts/`、`entities/`、`synthesis/` 是 knowledge；`context/` 只有请求明确启用时检索。

#### D. 配置 Cloudflare

1. `wrangler.jsonc` 使用 `vars` 保存 owner/repository 等非敏感值，`secrets.required` 只列 secret 名称。
2. 创建 `SYNC_STATE` KV，填入现有 namespace ID；不要在生产配置中省略 ID，也不要因部署提示自动创建第二个状态库。
3. 绑定 `AI_SEARCH` 默认 namespace，并让 Worker 确保 `kb-evidence`、`kb-knowledge`、`kb-context` 实例存在。
4. 配置 `triggers.crons`：`30 2 * * *` 每日 UTC 启动全量校准，`0 * * * *` 每小时继续未完成批次。Cron 使用 UTC，并由配置文件作为唯一来源。
5. 连接 Gateway 仓库到 Workers Builds。生产 Deploy command 使用 `pnpm deploy` 或 `wrangler deploy`；`wrangler versions upload` 只作为非生产 preview 命令。

#### E. 部署和 secrets（或引导用户手动在网页填写secrets）

```powershell
pnpm exec wrangler login
pnpm exec wrangler deploy
pnpm exec wrangler secret put GITHUB_TOKEN
pnpm exec wrangler secret put GITHUB_WEBHOOK_SECRET
pnpm exec wrangler secret put GPT_ACTION_TOKEN
pnpm exec wrangler secret put ADMIN_TOKEN
```

部署后先访问 `/health` 和 `/openapi.json`。`syncedCommit: null` 是正常的“尚未首次同步”，不是 Worker 部署失败。

#### F. 接入 KnowledgeBase webhook

在 KnowledgeBase 仓库添加 Push webhook：目标 `<WORKER_URL>/github/webhook`、JSON 内容、同一 `GITHUB_WEBHOOK_SECRET`、仅 Push event。Worker 必须验证 HMAC，只处理 `refs/heads/main`；普通 Push 做增量，force push 或 GitHub 截断 payload 做全量对账。

#### G. 首次全量同步

1. 取得 `main` 完整 SHA，不接受短 SHA。
2. 使用 `ADMIN_TOKEN` 调用 `POST /admin/sync` 启动一次。
3. 若 `complete: false`，只调用 `POST /admin/sync/continue`，直到 `complete: true`；不要重复 start，也不要在尚未完成时并发启动第二个任务。
4. 每批处理数量以 Gateway 代码为准；当前 starter 默认每批 5 个可索引 Markdown 文件。
5. 最终检查 `/health` 的 `syncedCommit` 等于目标 commit，且 `issues` 已审查。

#### H. 配置私人 GPT

1. 创建 Only me 的私人 GPT；初始阶段不要上传与 Gateway 重复的 Knowledge 文件。
2. Actions 导入 `<WORKER_URL>/openapi.json`，配置 Bearer/API Key，仅填 `GPT_ACTION_TOKEN`。
3. Instructions 要求区分 evidence、knowledge、context 与综合推断；默认 `include_context=false`，涉及项目状态/偏好/历史决策或日记撰写规则时才为 true，并明确说明 Context 写入只发生在实际对话节点。
4. 对只读查询 POST 明确设置 `x-openai-isConsequential: false`，并为每个响应定义具体 schema，不使用空 object schema。
5. 在 Preview 同时测试单独 Action 和自然语言提问；单独成功不代表自然语言路由已成功。

#### I. 验收矩阵

```text
[ ] /health = 200，首次同步后 syncedCommit 非空
[ ] /openapi.json 只含三个只读 operation
[ ] 无 token 查询返回 401，正确 Action token 返回 200
[ ] Admin token 不能用于 GPT Action
[ ] main Push 返回 webhook accepted，并推进 syncedCommit
[ ] 非 main Push 被忽略，错误签名返回 401
[ ] raw 不进入 evidence/knowledge index
[ ] source 只有 raw_sha256 验证通过才返回 verified
[ ] 每日 full sync 与每小时 continue 均能工作
[ ] Gateway main Push 触发新的生产 Worker 部署
[ ] GPT Preview 能自动调用 Action，失败时明确降级
```

#### J. 故障定位顺序

- `/health` 正常但内容为空：查首次全量同步、KV 游标和 AI Search 实例，不先重导 GPT schema。
- Build 成功但索引不变：查 KnowledgeBase webhook 和定时同步，不查 Git Builds。
- Action 单测成功但自然语言失败：查 OpenAPI 具体响应 schema、`x-openai-isConsequential`、Instructions 是否保存。
- `/health` 的 commit 不推进：查 webhook branch、签名、增量 payload 是否被截断，以及 full sync 是否卡在 cursor。
- AI Search `items.list` 出现 metadata filter 超长：不得将完整知识库路径传给 `search`；使用每页最多 10 项的无 search 分页扫描，并按 `item.key === path` 精确匹配。

详细配置字段、脱敏源代码和验证脚本直接读取 `references/cloudflare-gateway-gpts.md`、`assets/cloudflare-gateway-template/` 与 `scripts/verify-gateway.ps1`。

## 推荐使用节奏

- 每天或随时：把材料放入对应 `raw/` 子目录，记录日记、偏好和项目进展。
- 每获得一篇重要材料：执行一次 INGEST；前 5 篇尽量逐篇确认质量。
- 提问时：直接说“根据我的知识库”；需要个人化答案时允许 QUERY 同时读取 Context。回答默认先进入 outputs 候选区，确认值得复用后再提升。
- 每两周：执行 LINT，先看报告再决定是否修复。
- 每月或每新增约 10 篇来源：执行 REFLECT，检查反证、矛盾和知识空白。
- 发现概念重复时：执行 MERGE，但必须先确认方案。

## 来源完整性与 Confidence

- 当知识库追踪 provenance 时，在 source 页保存 `raw_file`、`raw_sha256` 和 `last_verified`。
- 超过项目新鲜度阈值的来源应标记为可能过时。
- 保守使用 confidence：一个外部来源通常是 low；多个独立来源可到 medium；如果 schema 要求，high confidence 必须等待用户明确确认。
- Query 回答及其二阶产物不算独立来源；回答次数、总结次数和页面提升都不得改变 `source_count` 或 confidence。
- 当矛盾影响结论时，应同时在 source 页和 concept/entity 页保持可见。

## 验证

编辑后验证被触及的具体范围：

- 如果项目有 lint 脚本，运行它。
- 只有在 qmd 已配置且 schema 要求时，才运行 `qmd status`/`qmd update`。
- 用 `rg` 抽查新增 slug、wikilink、aliases 和日志记录。
- 报告已运行命令、失败原因和跳过的验证。不要编造测试结果。

## 参考模板

- `references/bootstrap-prompt.md`：创建个人知识库时可直接给 Codex/Claude Code 的完整 prompt。
- `references/agents-template.md`：可复制到项目根目录的 `AGENTS.md` 行为契约模板，包含 Context 更新规则。
- `references/page-templates.md`：source、concept、entity、synthesis、output 等 wiki 页面模板。
- `references/pdf-derived-ingest.md`：PDF 转录/OCR/翻译、manifest、质检、qmd 隔离和 Gateway 原文读取规范。
- `references/diary-template.md`：脱敏日记模板；需要写入或部署 `context/DIARY_GUIDE.md` 时读取。

---
name: personal-knowledge-base
description: 创建、使用和维护 Markdown/Obsidian 个人知识库。用于来源与 PDF 摄入、文献整理、可追溯查询、用户与项目时间线、知识库检查，以及配置本地 qmd 或可选的 GitHub 只读 MCP、Cloudflare AI Search 远程入口。
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

按内容归属分层，保持原件、派生产物和用户整理内容之间的链接：

- `raw/`：人类拥有的原始来源，例如剪藏、文章、PDF、截图、临时笔记和个人写作。默认只追加，不修改。
- `wiki/`：LLM 维护的 Markdown 页面，例如 `sources/`、`concepts/`、`entities/`、`synthesis/`、`outputs/`、`templates/`，以及 `index.md`、`log.md`、`overview.md`、`QUESTIONS.md`。
- `wiki/derived/`：由 raw PDF 等原始材料生成的转录、OCR、摘要译文、全文译文和解析产物。它是可校验的辅助阅读层，不是新来源，默认不进入图谱或语义检索。
- `context/`：可选的长期上下文层。`diary/` 是个人跨项目的全局时间线，persona 中的项目文件是指向日记的精简项目时间线；用户画像保存跨项目长期状态和偏好。它不是外部证据，不计入 confidence。
- `literature/`：用户主导的自由 Markdown 文献整理层，按领域、项目或问题组织。默认可读可检索，Agent 编辑须获得该层或文件的明确授权；不作为新的独立来源。
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
3. 创建最小可用结构：`raw/`、`wiki/`、`wiki/sources/`、`wiki/concepts/`、`wiki/entities/`、`wiki/synthesis/`、`wiki/derived/pdfs/`、`wiki/outputs/`、`wiki/templates/`、`context/persona/`、`context/diary/`、`literature/`、`literature/templates/`、`wiki/index.md`、`wiki/log.md`、`wiki/overview.md`、`wiki/QUESTIONS.md`。
4. 在批量写内容前先写 schema 文件。至少包含来源不可变、Context 更新、wikilink 格式、页面模板、操作流程、confidence 规则、日志和验证方式。
5. 只添加确实会用到的模板和脚本。如果 schema 包含 frontmatter、哈希、图谱排除或 wikilink 规则，创建可运行的 lint 脚本。
6. 将 `assets/literature/` 复制为知识库的 `literature/` 使用说明与四份可选模板；已有内容只做最小合并。检测 Obsidian、qmd、Python 和 Git，不要假设它们存在。qmd 不可用时降级为 `rg` 和 `wiki/index.md`；未经授权不要安装依赖。
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
- 用户在 `literature/` 自由整理、在 `wiki/` 阅读结构化知识；原文与译文通过相对链接打开。解释授权整理页编辑与授权 Wiki 摄入的区别。
- 哪些动作需要用户确认：批量摄入、high confidence、合并、删除、大范围重写和依赖安装。
- 推荐节奏：随时收集，逐篇摄入；实际完成的工作在任务结束时写入当日日记；项目阶段变化再更新项目画像；每两周 LINT；每月或每新增约 10 篇来源 REFLECT。

## 日常操作

执行文献整理任务前读取 [文献整理规范](references/literature-management.md)。默认本地检索范围为 wiki、context、literature；只查整理层使用 `scripts/qmd-query.ps1 -Collection literature`。配置或排查搜索时先读 [qmd 运行规范](references/qmd-runtime.md)：附带脚本实际依次尝试 hybrid、hybrid-no-rerank、BM25、rg，90 秒为单次 hybrid 上限，不是总时限。查询、保存整理页和更新索引不自动触发 Wiki 摄入。

`literature/` 无 frontmatter 也合法；用户明确要求把指定内容摄入 Wiki 时，只读整理页，追溯已有 source 或原件并执行原有确认/QC，更新适用的 synthesis/concept/entity。编辑整理页须有独立授权。原件、转录、译文与整理次数均不得制造新 source identity。

执行 `INGEST` 时先按路径分流：literature 使用上面的显式整理层流程；context 不作为外部来源摄入。以下步骤仅适用于外部 raw 来源，个人写作使用其专门规则：

1. 除非用户要求批处理，否则一次只处理一个 raw 来源。PDF 必须先完成 `PREPARE -> DERIVE -> QC`，通过后再进入知识提取。
2. 读取 [来源 metadata 规范](references/source-metadata.md)，在本次授权摄入范围内根据原件及权威网络资料获取题录、标识符、版本、摘要和资源，记录字段依据与冲突。缺失不猜测；不顺带批量更新旧来源。raw SHA-256、metadata_status 与 confidence 分开维护。
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
2. Context 写入只发生在实际对话过程中。不要创建每日自动化任务，也不要因为日期变化自动生成空日记。
3. `context/diary/` 是用户个人跨项目的全局时间线。只要当天通过实际对话完成了可确认的工作，任务结束时就应追加做了什么、结果、验证、失败/阻塞和下一步；同一任务的例行步骤可合并简记。
4. 普通闲聊、纯讨论、未执行设想、无结果的重复操作和逐句对话不写入日记。日记不得包含 Agent 推断、观察、心理分析或猜测，也不得把计划写成已完成。
5. persona 中的项目文件维护各项目的精简时间线。只有项目阶段、里程碑、关键决策、阻塞或下一步变化时，才追加简短的日期化摘要，并用相对 Markdown 链接指向对应日记；不要复制日记全文。
6. 写入顺序为“完整事件写当日日记 -> 项目级阶段变化精炼到项目画像 -> 跨项目长期偏好或身份变化更新用户画像”。普通完成事项只写日记。
7. Persona 和项目文件采用“当前状态 + 日期化演化记录”，只追加或谨慎修订，不静默删除旧状态。今日日记存在时追加，不存在时创建；日记与项目画像应双向链接，每次写入署名 `Codex Win端`。
8. 新建或触碰的 Context Markdown 应有 `type`、`date`、`updated` 和 `remote_access` frontmatter。Context 全量进入网页端只读索引：`DIARY_GUIDE.md`、用户画像和项目画像使用 `always`，作为类似 Wiki 的稳定层每次检索；日记使用 `on-demand`，作为类似 Raw 的历史层，仅在需要追溯时追加检索。`on-demand` 表示“已索引但不默认查询”，不得再用 `local-only` 排除 Context。
9. `context/` 不参与外部 `source_count`、confidence、`raw_sha256` 或 source integrity；除非用户明确要求，不把 Context 转成 wiki 知识页。
10. 涉及 Context 维护规则时读取 `references/context-maintenance.md`；需要创建或撰写日记时读取 `references/diary-template.md`；完成后报告修改了哪些文件和记录了哪些已确认内容。

执行 `QUERY` 时：

1. 根据本地配置，用安全 qmd 入口或 `rg` 检索 wiki、context 和 literature。derived 仍只在显式指定时读取；整理层模板与根 README 不参与检索。
2. 综合前完整读取相关页面，不只依赖片段。
3. 知识性结论引用 source 页面。不要只依赖 concept、整理页或 context 文件作为证据。整理页中的个人判断、Agent 分析和待核验线索要与已核验外部证据区分。
4. 把回答视为基于既有证据的二阶产物，不是新 source。回答、output、synthesis 和回答触发的 concept/entity 更新都不得增加 `source_count` 或提高 confidence。
5. 完成回答后判断是否值得复用。只有多个来源形成了可复用的综合结论、比较、框架或稳定决策，且核心结论能逐条追溯到 source 页、未来可能再次用于查询或项目决策时，才提示用户：「这个回答适合沉淀，是否写入 output 并执行 Review？」单一事实、临时状态、格式转换、无来源推断和普通闲聊不提示保存。
6. 用户确认前不要创建 output、修改 index 或追加 `query` 日志；用户拒绝或未确认时不落盘。用户也可以在原始请求中明确要求保存，以直接完成确认。
7. 用户确认后写入 `wiki/outputs/YYYY-MM-DD-<topic>.md`，并设置 `graph-excluded: true`。output 至少包含：问题、简短结论、依据及对应 source 链接、反例/矛盾与局限、Confidence Notes、建议沉淀位置。将它登记到 index 的 Outputs 或 Recent Outputs，追加 `query` 日志，不要直接登记为 Recent Synthesis。随后自动执行 REVIEW：检查可复用性、逐条来源追溯、反证和证据缺口，在 output 中标注建议去向，并在建议更新 concept/entity 前按 slug 和 aliases 检查已有页面。
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

## 可选远程入口：由用户选择路线

先读取 [远程路线选择与共同准备](references/remote-access.md)，说明成本、召回、权限和客户端要求，由用户选择；纯本地也是完整可用方案。已有路线不得自动迁移、停用或删除。

- GitHub 只读 MCP：读取 [完整配置流程](references/github-readonly-mcp.md)。Worker 提供 OAuth、关键词检索和按 commit 缓存，无需 AI Search；四个只读工具按统一版本分页和校验。适合希望控制语义索引成本、接受关键词召回的用户。
- GPT Actions + Cloudflare AI Search：读取 [完整配置流程](references/cloudflare-gateway-gpts.md)。保留语义检索、签名 webhook、分批同步、三种只读 Action；使用前核验用户账户是否提供 Actions 和 AI Search。不能因另一路线存在而替用户放弃此路线。
- 两条路线共用 `assets/cloudflare-gateway-template/` 的来源校验模块，但使用不同入口、配置和独立 Worker 名称。可并行评估；不可把 MCP 的 `include_diary/commit` 与 Actions 的 `include_context/syncedCommit` 混用。
- 新用户 Agent 按所选指南完成资源探测、配置、凭据接线、测试、部署、客户端连接和真实读取验收。必要的登录、凭据生成或同意页面交由用户在平台完成，不要求用户把秘密贴到聊天。
- 云端插件只读；Context 双时间线的实际写入由获授权的本地 Agent 执行。可复用的客户端指令见 [只读客户端指令模板](references/readonly-client-instructions.md)。
- 配置完成不等于读取验收，缓存完成不等于最新 main；必须报告真实工具返回的版本、检索模式、缺失内容和未验证项。公开包不包含账号、服务地址、App ID、凭据或私人笔记。

## 推荐使用节奏

- 每天或随时：把材料放入对应 `raw/` 子目录；实际完成工作后更新全局日记，项目阶段变化时再更新项目画像。
- 每获得一篇重要材料：执行一次 INGEST；前 5 篇尽量逐篇确认质量。
- 提问时：直接说“根据我的知识库”；需要个人化答案时允许 QUERY 同时读取 Context。值得复用的回答先询问是否写入 outputs，确认保存后 Review，另获提升授权后才 Promote。
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

- `references/remote-access.md`：远程路线选择及共同准备，选择远程入口时读取。
- `references/literature-management.md`：整理层读写与显式摄入边界。
- `references/source-metadata.md`：授权摄入时的详细题录核验。
- `references/bootstrap-prompt.md`：创建个人知识库时可直接给 Codex/Claude Code 的完整 prompt。
- `references/agents-template.md`：可复制到项目根目录的 `AGENTS.md` 行为契约模板，包含 Context 更新规则。
- `references/page-templates.md`：source、concept、entity、synthesis、output 等 wiki 页面模板。
- `references/pdf-derived-ingest.md`：PDF 转录/OCR/翻译、manifest、质检、qmd 隔离和 Gateway 原文读取规范。
- `references/diary-template.md`：脱敏日记模板；需要写入或部署 `context/DIARY_GUIDE.md` 时读取。

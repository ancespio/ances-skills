---
name: personal-knowledge-base
description: 创建、使用和维护由 LLM 负责整理的个人知识库或 LLM Wiki，适用于 Markdown/Obsidian 知识库。用于用户要求了解创建前需要准备什么、搭建个人知识库、设计 AGENTS.md/CLAUDE.md 规则、建立 raw/wiki/context 目录、配置 Obsidian Web Clipper、标定首批来源、摄入来源、查询本地 wiki、更新用户画像/项目状态/偏好/日记、执行健康检查、跨笔记综合反思、记录开放问题、合并重复页面、配置 qmd/rg 搜索、维护来源可追溯性和 confidence 时。
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
- 期望覆盖的主题范围，以及不希望进入知识库的隐私内容。
- 可选的 Context 初始材料：个人背景、长期偏好、当前项目、既有决策、近期状态和日记。未提供时保持为空，不自行推断。
- 工具选择：Obsidian 用于浏览，qmd 用于本地语义搜索，Python 用于 lint，Git 用于版本管理。这些工具都应先检测；除非用户授权，不要安装。
- Wiki 写作语言、slug 语言、是否保存可复用查询输出、是否启用 Git/备份。

向用户说明：最小可用版本可以从“一个目录 + 一篇测试材料”开始；2-3 篇代表性材料只用于标定输出风格和规则，不是创建前必须完成的资料迁移。

## 创建新知识库

1. 先执行准备问答：确认根目录、材料类型、Context 范围、隐私边界、Wiki 语言和可选工具。用户只提供最低准备时也可以继续。
2. 检查根目录现状、Git 状态和已有 `AGENTS.md`/`CLAUDE.md`/`README.md`。已有规则只合并，不覆盖。
3. 创建最小可用结构：`raw/`、`wiki/`、`wiki/sources/`、`wiki/concepts/`、`wiki/entities/`、`wiki/synthesis/`、`wiki/outputs/`、`wiki/templates/`、`context/persona/`、`context/diary/`、`wiki/index.md`、`wiki/log.md`、`wiki/overview.md`、`wiki/QUESTIONS.md`。
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

1. 除非用户要求批处理，否则一次只处理一个 raw 来源。
2. 在需要追溯时，提取标题、来源元数据、日期和 raw SHA-256。
3. 创建或更新 `wiki/sources/<slug>.md`。
4. 更新匹配的 concept/entity 页面，不要制造重复页面。先检查 slug 和 aliases。
5. 显式记录矛盾，不要静默覆盖旧说法。
6. 更新 `index.md`，并向 `log.md` 追加记录。
7. 如果 qmd 已配置，执行 `qmd update`；不可用时说明已降级，不要擅自安装。

处理个人写作时：

- 将用户个人立场与外部证据分开保存。
- 除非本地 schema 明确允许，否则不要用个人写作增加外部证据的 `source_count`。

执行 `CONTEXT` 时：

1. 触发词包括：`更新画像`、`更新日记`、`记录偏好`、`记录项目进展`、`同步上下文`、`context`。
2. 先读取相关现有文件，再判断目标位置：个人背景/长期状态写入 `context/persona/`，项目决策和进展写入对应项目文件，偏好写入偏好文件，按日期事件写入 `context/diary/`。
3. 只记录用户明确表达、可长期复用的信息。不要从一次性措辞推断敏感身份、稳定偏好或长期目标。
4. Persona 和项目文件只追加或谨慎修订；保留历史变化和日期。今日日记存在时追加，不存在时创建。
5. 需要跨日期或跨项目追踪时，用本地 schema 允许的链接指向相关日记或项目文件。
6. `context/` 不参与外部 `source_count`、confidence 或 source integrity；除非用户明确要求，不把 Context 自动转成 wiki 知识页。
7. 如果 qmd 已索引 `context/`，写入后执行或提醒执行 `qmd update`；最后报告修改了哪些文件以及记录了什么。

执行 `QUERY` 时：

1. 根据本地配置，用 `qmd query`、`rg` 或 `index.md` 搜索 wiki。
2. 综合前完整读取相关页面，不只依赖片段。
3. 知识性结论引用 source 页面。不要只依赖 concept 页面或 context 文件作为证据。
4. 当本地 schema 要求时，将可复用答案沉淀到 `wiki/outputs/` 或 `wiki/synthesis/`。

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

## 推荐使用节奏

- 每天或随时：把材料放入对应 `raw/` 子目录，记录日记、偏好和项目进展。
- 每获得一篇重要材料：执行一次 INGEST；前 5 篇尽量逐篇确认质量。
- 提问时：直接说“根据我的知识库”，需要个人化答案时允许 QUERY 同时读取 Context。
- 每两周：执行 LINT，先看报告再决定是否修复。
- 每月或每新增约 10 篇来源：执行 REFLECT，检查反证、矛盾和知识空白。
- 发现概念重复时：执行 MERGE，但必须先确认方案。

## 来源完整性与 Confidence

- 当知识库追踪 provenance 时，在 source 页保存 `raw_file`、`raw_sha256` 和 `last_verified`。
- 超过项目新鲜度阈值的来源应标记为可能过时。
- 保守使用 confidence：一个外部来源通常是 low；多个独立来源可到 medium；如果 schema 要求，high confidence 必须等待用户明确确认。
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

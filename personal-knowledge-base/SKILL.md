---
name: personal-knowledge-base
description: 创建、使用和维护由 LLM 负责整理的个人知识库或 LLM Wiki，适用于 Markdown/Obsidian 知识库。用于用户要求搭建个人知识库、设计 AGENTS.md/CLAUDE.md 规则、建立 raw/wiki/context 目录、摄入来源、查询本地 wiki、执行健康检查、跨笔记综合反思、记录开放问题、合并重复页面、配置 qmd/rg 搜索、维护来源可追溯性和 confidence 时。
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

## 创建新知识库

1. 明确根目录，以及是否使用 Obsidian、Git、qmd 或普通 Markdown 搜索。
2. 创建最小可用结构：`raw/`、`wiki/`、`wiki/sources/`、`wiki/concepts/`、`wiki/entities/`、`wiki/synthesis/`、`wiki/outputs/`、`wiki/templates/`、`wiki/index.md`、`wiki/log.md`、`wiki/overview.md`、`wiki/QUESTIONS.md`。
3. 在批量写内容前先写 schema 文件。至少包含来源不可变、wikilink 格式、页面模板、操作流程、confidence 规则、日志和验证方式。
4. 只添加确实会用到的模板和脚本。如果 schema 包含 frontmatter、哈希、图谱排除或 wikilink 规则，lint 脚本通常有价值。
5. 不要假设搜索工具存在，先验证。可用时优先用 `qmd`；小规模库或 Windows 受限环境可降级为 `rg` 或手动读取 `index.md`。
6. 批量摄入前，先用 2-3 篇代表性来源标定流程，并根据结果收紧 schema。

需要创建完整项目时，读取 `references/bootstrap-prompt.md`，把其中 prompt 改成用户的路径、工具和偏好后执行。需要写项目规则时，读取 `references/agents-template.md` 并生成 `AGENTS.md` 或改写为 `CLAUDE.md`。需要生成 wiki 页面模板时，读取 `references/page-templates.md`。

## 日常操作

执行 `INGEST` 时：

1. 除非用户要求批处理，否则一次只处理一个 raw 来源。
2. 在需要追溯时，提取标题、来源元数据、日期和 raw SHA-256。
3. 创建或更新 `wiki/sources/<slug>.md`。
4. 更新匹配的 concept/entity 页面，不要制造重复页面。先检查 slug 和 aliases。
5. 显式记录矛盾，不要静默覆盖旧说法。
6. 更新 `index.md`，并向 `log.md` 追加记录。

处理个人写作时：

- 将用户个人立场与外部证据分开保存。
- 除非本地 schema 明确允许，否则不要用个人写作增加外部证据的 `source_count`。

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
- `references/agents-template.md`：可复制到项目根目录的 `AGENTS.md` 行为契约模板。
- `references/page-templates.md`：source、concept、entity、synthesis、output 等 wiki 页面模板。

# 创建个人知识库完整 Prompt

在用户要从零创建个人知识库时，先按实际环境替换占位符，再把下面 prompt 作为任务说明交给 Codex/Claude Code 执行。这个 prompt 要求 Agent 先解释准备事项并等待确认，再开始写文件。若用户已有目录或规则，不要覆盖，先读取并合并。

````markdown
我要创建一个由 LLM 维护的个人知识库，根目录是：

`<KB_ROOT>`

请你在这个目录中搭建一个 Markdown/Obsidian 友好的 LLM Wiki。核心思想是：我负责人类侧的来源剪藏、材料筛选和问题提出；你负责把原始来源逐步整理成可追溯、可链接、可维护的 wiki，而不是每次查询时重新做一次临时 RAG。

## 开始前先做准备确认

先不要写文件。先向我展示下面这份准备清单，并区分“最低需要”和“推荐准备”：

最低需要：

- 确认知识库根目录 `<KB_ROOT>`。
- 至少准备 1 篇代表性测试材料；如果暂时没有，允许先创建空骨架。
- 确认 `raw/` 由我拥有且默认不可修改，`wiki/` 由你维护。

推荐准备：

- 2-3 篇用于标定的不同材料：外部文章/网页剪藏、PDF/研究资料、个人文章/项目笔记各选一类。
- 若 PDF 是主要材料：准备实际常见的单栏、双栏、扫描件或复杂表格样本；确认中文摘要/全文翻译偏好、固定术语译法、存储空间与 Git LFS 范围。全文翻译必须单独确认。
- 希望知识库重点覆盖的主题，以及明确不应进入知识库的隐私内容。
- 可选的 Context 初始材料：个人背景、长期偏好、当前项目、已有决策、近期状态和日记。
- 工具偏好：是否使用 Obsidian、qmd、Python lint 和 Git。先检测，不要擅自安装。
- Wiki 正文语言、slug 语言、是否持久化高价值查询结果。

告诉我：不需要先整理全部历史材料，可以从“一个目录 + 一篇测试材料”开始。展示你的默认方案和需要我回答的问题，等待我明确确认后再执行下面的创建步骤。

请严格遵守以下边界：

- `raw/` 是我拥有的原始来源层，只读、只追加，未经我明确确认不得修改、移动、覆盖或删除。
- `wiki/` 是你维护的知识层，可以创建和更新，但所有重要结论必须能追溯到 source 页。
- `context/` 是长期上下文层，用于用户画像、项目画像、偏好和日记；它不是外部证据，不参与 `source_count` 和 confidence 计数。Context 只在实际对话出现重大节点、状态变化或任务结束时写入，不创建每日自动化任务。
- 所有文件写入使用 UTF-8 无 BOM。
- 如果目录是 Git 仓库，写入前先执行 `git status --short`，不得覆盖我的已有改动。
- 删除任何文件前，先备份到就近 `TMP/` 目录，并等待我确认。

请完成以下工作：

1. 检查 `<KB_ROOT>` 现状，报告是否已有文件、是否是 Git 仓库、是否已有 `AGENTS.md`/`CLAUDE.md`/`README.md`。
2. 若没有冲突，创建目录结构：

```text
raw/
  articles/
  clippings/
  images/
  pdfs/
  notes/
  personal/
wiki/
  sources/
  concepts/
  entities/
  synthesis/
  derived/
    pdfs/
  outputs/
  templates/
context/
  persona/
  diary/
scripts/
outputs/
```

3. 创建系统文件：

```text
AGENTS.md
README.md
wiki/index.md
wiki/log.md
wiki/overview.md
wiki/QUESTIONS.md
wiki/templates/source-template.md
wiki/templates/concept-template.md
wiki/templates/entity-template.md
wiki/templates/synthesis-template.md
wiki/templates/output-template.md
```

4. 在 `AGENTS.md` 中写入完整操作契约，至少包含：

- Raw/Wiki/Context 三层职责。
- INGEST、QUERY -> REVIEW -> PROMOTE、CONTEXT、LINT、REFLECT、ADD-QUESTION、MERGE 工作流。
- PDF `PREPARE -> DERIVE -> QC -> INGEST`：raw PDF 是证据，`transcript.md` 是主要 LLM 阅读层，译文是辅助层，三者共享 source identity；derived 不增加 `source_count` 或 confidence。
- PDF 默认 MinerU 主用、Docling 回退；非中文默认生成中文摘要，全文译文必须再次询问；翻译前读取 concept/entity aliases 建立术语表。
- derived 目录为 `wiki/derived/pdfs/<source-slug>/`，包含 transcript、manifest、适用译文、assets 和完整 intermediate；所有 derived Markdown 都 `graph-excluded: true`。
- 外部来源与个人写作的不同处理方式。
- Context 更新规则：个人画像、项目状态、偏好、日记分别存放；只追加或谨慎修订；日记只记录确认事实、用户决策和明确确认的决策倾向，不写 Agent 推断；不作为外部证据；只有我明确要求时才沉淀为知识页；无状态变化时不创建空日记。
- 可复制的脱敏日记模板见 `references/diary-template.md`；若网页端 GPT 需要读取规则和模板，可将其复制为知识库的 `context/DIARY_GUIDE.md` 并设置 `remote_access: always`。
- source integrity：`raw_file`、`raw_sha256`、`last_verified`、`possibly_outdated`。
- concept/entity 去重：先检查英文 slug，再检查 aliases。
- wikilink 规则：目标统一用英文小写连字符。
- confidence 规则：1 个来源 low，3+ medium，5+ 且无重大矛盾为 high 候选，high 需我确认。
- Query 落盘默认先进入 `wiki/outputs/` 候选区；只有可复用且可追溯的回答才能提升到 synthesis、concept/entity、QUESTIONS 或 context。
- 回答、output、synthesis 和回答触发的 concept/entity 更新都是二阶产物，不得创建为 source，也不得增加 `source_count` 或提高 confidence。
- PROMOTE 前必须按 slug 和 aliases 检查已有 concept/entity；所有提升写入 `wiki/log.md`，只有实际 synthesis 才进入 Recent Synthesis。
- `wiki/outputs/`、`wiki/index.md`、`wiki/log.md`、`wiki/overview.md`、`wiki/QUESTIONS.md` 必须 `graph-excluded: true`。
- 任何大范围修复、合并、删除、重写前必须先报告方案并等待确认。

5. 在 `wiki/templates/` 中创建页面模板：

- source summary 模板：含 `raw_file`、`raw_sha256`、`last_verified`、来源摘要、关键观点、相关概念、相关实体、矛盾与局限。
- concept 模板：含 Definition、Aliases、Key Points、Sources、Contradictions、My Position、Evolution Log。
- entity 模板：含简介、相关来源、相关概念、演化记录。
- synthesis/output 模板：含问题、结论、证据、反例或矛盾、confidence notes、limitations；output 还要包含建议沉淀位置。

6. 创建 `scripts/lint.py` 的最小版本，先检查这些项目：

- `wiki/outputs/` 下 Markdown 是否有 `graph-excluded: true`。
- `wiki/log.md`、`wiki/index.md`、`wiki/overview.md`、`wiki/QUESTIONS.md` 是否有 `graph-excluded: true`。
- `wiki/concepts/` 和 `wiki/entities/` 文件名是否为英文小写连字符。
- source 页是否包含 `raw_file`、`raw_sha256`、`last_verified`。
- wikilink 目标是否疑似中文、包含空格或下划线。
- source 页记录的 raw 文件是否存在。
- PDF derived 的 raw/manifest/artifact SHA、连续页锚、图片链接、source 状态和 `graph-excluded`；至少包含正常与篡改回归测试。

7. 搜索工具处理：

- 先检测 `qmd` 是否可用；Windows 下若 PATH 找不到，使用 `Get-Command qmd` 和 `npm prefix -g` 定位全局 npm shim，仍找不到时让我提供路径。
- 如果 qmd 不可用，不要安装依赖，先降级使用 `rg` 和 `wiki/index.md`。
- 如果 qmd 可用，初始化命令优先使用：

```powershell
qmd init
qmd collection add wiki/
qmd collection add context/
qmd update
qmd status
```

- 如果存在 `wiki/derived/`：普通 wiki collection 忽略 `derived/**`；独立 `derived` collection 设置 `includeByDefault: false` 并忽略 `**/intermediate/**`。
- 创建安全查询入口：hybrid 最多等待 90 秒，失败或超时后依次降级 BM25 和 `rg`，输出实际模式和原因；默认 `rg` 也必须排除 derived。

8. 初始化完成后，执行一次全系统 Audit：

- 检查所有目录、系统文件和模板是否存在。
- 逐项检查 `AGENTS.md` 是否覆盖 Raw 不可变、Context 更新、INGEST 类型判断、PDF PREPARE/DERIVE/QC、SHA-256、aliases 去重、QUESTIONS 匹配、QUERY 溯源、REVIEW 分类、PROMOTE 路由、二阶产物不计来源、high confidence 人工确认、LINT、REFLECT 反向检验、MERGE redirect 和系统文件隔离。
- 运行 `python scripts/lint.py`。
- 如果 qmd 可用，运行 `qmd status` 和一次测试查询。
- 把结果写入 `wiki/outputs/system-audit-YYYY-MM-DD.md`，逐项标注通过、未通过和修复优先级。

9. 首次使用标定：

- 不要直接批量摄入所有材料。
- 让我依次选择 2-3 篇代表性来源，逐篇执行 INGEST。
- 每篇完成后让我审查：摘要是否准确、概念/实体是否过多或遗漏、aliases 是否合理、wikilink 是否规范、个人立场是否与外部证据分开。
- 根据反馈更新 `AGENTS.md`，再处理下一篇。
- 标定完成后，询问是否批量处理剩余来源。

10. 创建或完善面向使用者的 `README.md`，必须说明：

- 创建前要准备什么，以及最低可从一篇材料开始。
- 每种材料放到哪个 `raw/` 子目录。
- 如何执行摄入、查询、记录问题、更新 Context、LINT、REFLECT 和 MERGE。
- Context 与 Wiki 的区别，以及如何更新画像、偏好、项目进展和日记。
- 哪些操作需要我确认。
- 推荐使用节奏和第一次标定方法。

11. 初始化完成后，运行可用验证：

- `python scripts/lint.py`
- 如果 qmd 可用，运行 `qmd status`
- 用 `rg` 抽查 `graph-excluded`、`raw_sha256`、`QUESTIONS.md`、`Evolution Log`

12. 最后给我一个简短报告和可直接复制的使用指令：

- 创建了哪些文件。
- 哪些验证通过。
- 哪些验证跳过及原因。
- 第一次摄入 2-3 篇代表性来源时建议我怎么做、审查什么。
- 分别给出：摄入、查询、记录开放问题、更新画像、记录偏好、更新项目进展、更新日记、健康检查、综合反思的示例指令。
````

## 使用注意

- 如果用户只想“先生成模板让我审查”，不要创建真实知识库；只输出或写入模板文件。
- 如果用户已有 `AGENTS.md`，不要覆盖；先读取并提出合并方案。
- 如果用户要求适配 Claude Code，把文件名和措辞从 `AGENTS.md` 改成 `CLAUDE.md`，但保留同一套操作契约。

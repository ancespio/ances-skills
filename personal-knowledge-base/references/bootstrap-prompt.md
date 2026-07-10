# 创建个人知识库完整 Prompt

在用户要从零创建个人知识库时，先按实际环境替换占位符，再把下面 prompt 作为任务说明交给 Codex/Claude Code 执行。若用户已有目录或规则，不要覆盖，先读取并合并。

````markdown
我要创建一个由 LLM 维护的个人知识库，根目录是：

`<KB_ROOT>`

请你在这个目录中搭建一个 Markdown/Obsidian 友好的 LLM Wiki。核心思想是：我负责人类侧的来源剪藏、材料筛选和问题提出；你负责把原始来源逐步整理成可追溯、可链接、可维护的 wiki，而不是每次查询时重新做一次临时 RAG。

请严格遵守以下边界：

- `raw/` 是我拥有的原始来源层，只读、只追加，未经我明确确认不得修改、移动、覆盖或删除。
- `wiki/` 是你维护的知识层，可以创建和更新，但所有重要结论必须能追溯到 source 页。
- `context/` 是长期上下文层，用于用户画像、项目画像、偏好和日记；它不是外部证据，不参与 `source_count` 和 confidence 计数。
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
- INGEST、QUERY、LINT、REFLECT、ADD-QUESTION、MERGE 工作流。
- 外部来源与个人写作的不同处理方式。
- source integrity：`raw_file`、`raw_sha256`、`last_verified`、`possibly_outdated`。
- concept/entity 去重：先检查英文 slug，再检查 aliases。
- wikilink 规则：目标统一用英文小写连字符。
- confidence 规则：1 个来源 low，3+ medium，5+ 且无重大矛盾为 high 候选，high 需我确认。
- `wiki/outputs/`、`wiki/index.md`、`wiki/log.md`、`wiki/overview.md`、`wiki/QUESTIONS.md` 必须 `graph-excluded: true`。
- 任何大范围修复、合并、删除、重写前必须先报告方案并等待确认。

5. 在 `wiki/templates/` 中创建页面模板：

- source summary 模板：含 `raw_file`、`raw_sha256`、`last_verified`、来源摘要、关键观点、相关概念、相关实体、矛盾与局限。
- concept 模板：含 Definition、Aliases、Key Points、Sources、Contradictions、My Position、Evolution Log。
- entity 模板：含简介、相关来源、相关概念、演化记录。
- synthesis/output 模板：含问题、结论、证据、confidence notes、limitations。

6. 创建 `scripts/lint.py` 的最小版本，先检查这些项目：

- `wiki/outputs/` 下 Markdown 是否有 `graph-excluded: true`。
- `wiki/log.md`、`wiki/index.md`、`wiki/overview.md`、`wiki/QUESTIONS.md` 是否有 `graph-excluded: true`。
- `wiki/concepts/` 和 `wiki/entities/` 文件名是否为英文小写连字符。
- source 页是否包含 `raw_file`、`raw_sha256`、`last_verified`。
- wikilink 目标是否疑似中文、包含空格或下划线。
- source 页记录的 raw 文件是否存在。

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

8. 初始化完成后，运行可用验证：

- `python scripts/lint.py`
- 如果 qmd 可用，运行 `qmd status`
- 用 `rg` 抽查 `graph-excluded`、`raw_sha256`、`QUESTIONS.md`、`Evolution Log`

9. 最后给我一个简短报告：

- 创建了哪些文件。
- 哪些验证通过。
- 哪些验证跳过及原因。
- 第一次摄入 2-3 篇代表性来源时建议我怎么做。
````

## 使用注意

- 如果用户只想“先生成模板让我审查”，不要创建真实知识库；只输出或写入模板文件。
- 如果用户已有 `AGENTS.md`，不要覆盖；先读取并提出合并方案。
- 如果用户要求适配 Claude Code，把文件名和措辞从 `AGENTS.md` 改成 `CLAUDE.md`，但保留同一套操作契约。

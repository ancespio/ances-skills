# AGENTS.md 模板

将本模板复制到知识库根目录的 `AGENTS.md`。按项目实际情况替换 `<KB_ROOT>`、搜索工具路径和偏好。若用于 Claude Code，可改名为 `CLAUDE.md`。

````markdown
# AGENTS.md

## 角色

你是本知识库的 LLM 维护者。人类负责收集 raw 来源、提出问题和确认高风险操作；你负责把来源逐步整理为可追溯、可链接、可验证的 Markdown Wiki。

始终先读本文件，再执行摄入、查询、反思、合并、修复或上下文维护任务。

## 核心原则

- 不要把知识库当作一次性 RAG。目标是让知识在 `wiki/` 中持续积累。
- `raw/` 是来源真相层，只读、只追加。未经用户明确确认，不修改、移动、覆盖或删除。
- `wiki/` 是 LLM 维护层。可以创建和更新，但每个知识性结论都必须可追溯到 source 页。
- `context/` 是长期上下文层，不是外部来源，不参与 `source_count`、confidence 或 source hash 计数。
- 矛盾必须显式记录，不得静默覆盖。
- 输出有复用价值时应沉淀回 `wiki/outputs/` 或 `wiki/synthesis/`。
- 删除任何文件前，先备份到就近 `TMP/` 目录并等待确认。
- 写入文本文件使用 UTF-8 无 BOM。

## 目录结构

```text
<KB_ROOT>/
  raw/
    articles/
    clippings/
    images/
    pdfs/
    notes/
    personal/
  wiki/
    index.md
    log.md
    overview.md
    QUESTIONS.md
    sources/
    concepts/
    entities/
    synthesis/
    outputs/
    templates/
  context/
    persona/
    diary/
  outputs/
  scripts/
    lint.py
```

## 工具

优先使用本地搜索，不依赖外部服务。

推荐 qmd：

```powershell
qmd init
qmd collection add wiki/
qmd collection add context/
qmd update
qmd status
```

Windows 下 PATH 找不到 qmd 时，先尝试：

```powershell
Get-Command qmd -ErrorAction SilentlyContinue
npm prefix -g
```

根据 npm 全局 prefix 定位 qmd shim；如果仍不可用，不要擅自安装依赖，降级使用 `rg`、`wiki/index.md` 和完整读文件。

## 系统文件

这些文件必须含 `graph-excluded: true`：

- `wiki/index.md`
- `wiki/log.md`
- `wiki/overview.md`
- `wiki/QUESTIONS.md`
- `wiki/outputs/` 下所有 Markdown

`wiki/log.md` 是追加式日志，记录格式：

```text
YYYY-MM-DD HH:MM | <operation> | <target or title>
```

## Frontmatter

所有 wiki 页面至少包含：

```yaml
---
type: <page-type>
title: "页面标题"
date: YYYY-MM-DD
tags: [wiki, wiki/<type>]
---
```

外部 source 页额外包含：

```yaml
---
type: source-summary
title: "{{title}}"
date: YYYY-MM-DD
source_url: "{{url}}"
domain: "{{domain}}"
author: "{{author}}"
tags: [wiki, wiki/source]
processed: true
raw_file: "raw/articles/filename.md"
raw_sha256: "<64-char-hex>"
last_verified: YYYY-MM-DD
possibly_outdated: false
---
```

个人写作 source 页额外包含：

```yaml
---
type: personal-writing
title: "{{title}}"
date: YYYY-MM-DD
tags: [wiki, wiki/source, personal-writing]
processed: true
raw_file: "raw/personal/filename.md"
raw_sha256: "<64-char-hex>"
last_verified: YYYY-MM-DD
counts_as_external_source: false
---
```

## Wikilink 规则

- 所有 wikilink 目标使用英文小写连字符 slug。
- 正确：`[[value-investing]]`、`[[attention-mechanism]]`
- 错误：`[[价值投资]]`、`[[ValueInvesting]]`、`[[value_investing]]`
- 中文名写入 frontmatter `aliases`。
- `log.md` 不使用 wikilink，写纯文本路径。
- 不要 wikilink 到系统文件：`log`、`index`、`overview`、`QUESTIONS`。

## Confidence

| 来源数量 | Confidence | 规则 |
|---|---|---|
| 1 个外部来源 | low | 自动设置 |
| 3+ 个外部来源 | medium | 自动设置 |
| 5+ 个外部来源且无重大矛盾 | high candidate | 先向用户展示 Definition 和 Sources |
| 用户明确确认 | high | 才能设置 |

个人写作不参与外部来源 `source_count`。

## INGEST

触发词：`ingest`、`摄入`、`处理这个`

1. 读取目标 raw 来源，只读。
2. 计算 raw 文件 SHA-256。
3. 判断来源类型：
   - `context/`：默认不摄入，除非用户要求沉淀为知识页。
   - frontmatter `type: personal-writing` 或路径 `raw/personal/`：走个人写作流程。
   - 其他：走外部来源流程。
4. 若缺少 frontmatter，从第一个 `#` 标题或文件名推断 title；在 `log.md` 记录警告。
5. 生成英文小写连字符 slug。
6. 创建或更新 `wiki/sources/<slug>.md`。
7. 提取概念和实体前，先检查已有 slug 和 aliases，避免重复页。
8. 更新相关 concept/entity 页：追加来源、更新 `source_count`、`confidence`、`last_reviewed` 和 `Evolution Log`。
9. 矛盾写入 `Contradictions`。
10. 更新 `wiki/index.md`。
11. 检查 `wiki/QUESTIONS.md` 是否有可回答问题；如有，询问是否执行 QUERY。
12. 追加 `wiki/log.md`。

个人写作流程：

- 不写客观 Summary。
- 立场写入相关 concept 页 `## My Position`，标注「个人认知」。
- 不增加外部 `source_count`。
- 引用外部来源时，尝试链接已有 source 页。

## QUERY

触发词：直接提问，或「根据我的知识库」

1. 若问题涉及用户偏好、项目状态或近期上下文，先读 `context/`。
2. 优先执行 `qmd query "<问题>" --json` 获取 top 5；失败则读 `wiki/index.md` 并用 `rg` 搜索。
3. 完整读取相关页面。
4. 合成答案；每个知识性核心结论必须溯源到具体 `wiki/sources/<slug>.md`。
5. 标注 confidence 和分歧。
6. 若答案可复用，写入 `wiki/outputs/YYYY-MM-DD-<topic>.md`，frontmatter 含 `graph-excluded: true`，并更新 `wiki/index.md` 与 `wiki/log.md`。

输出格式：

- 普通问题：Markdown 正文
- 比较类：Markdown 表格
- 演示类：Marp 幻灯片
- 趋势类：Python matplotlib 代码块
- 清单类：结构化列表

## LINT

触发词：`lint`、`检查`、`健康检查`

1. 运行 `scripts/lint.py`。
2. 把报告写入 `wiki/outputs/lint-YYYY-MM-DD.md`，frontmatter 含 `graph-excluded: true`。
3. 若 qmd 可用，执行 `qmd status`；索引落后时执行 `qmd update` 并记录。
4. 展示摘要，询问是否修复。

## REFLECT

触发词：`reflect`、`综合分析`、`发现规律`

1. 先找反证。找不到反证时，在 Limitations 写明「回音室风险」。
2. 扫描 concepts、entities、sources、synthesis，识别模式、空白、矛盾和新问题。
3. 对有证据支撑的候选项，完整读取相关页面并写入 `wiki/synthesis/<topic>-synthesis.md`。
4. 输出 gap report 到 `wiki/outputs/gap-report-YYYY-MM-DD.md`。
5. 更新 `wiki/overview.md`、`wiki/index.md` 和 `wiki/log.md`。

## ADD-QUESTION

触发词：`我想搞清楚`、`add question`、`记录一个问题`

1. 规范化问题。
2. 追加到 `wiki/QUESTIONS.md`：

```markdown
- [ ] 问题内容（opened YYYY-MM-DD）
```

3. 追加 `wiki/log.md`。

## MERGE

触发词：`merge`、`去重`

1. 先提出合并方案，等待用户确认。
2. 主 slug 保留英文。
3. aliases、Key Points、Sources、Evolution Log 做并集去重。
4. 如果 My Position 两页都有，先展示差异再合并。
5. 被合并页面替换为 redirect：

```markdown
redirect: [[main-slug]]
```

6. 更新 wikilinks。
7. 记录 `wiki/log.md`。

## Source Integrity

- re-ingest：若 lint 报告 `SOURCE MODIFIED`，重新摄入来源并更新所有受影响页面。
- 来源超过 2 年时标注 `possibly_outdated: true`。
- 矛盾来源必须在 source 页和 concept 页显式记录。
````

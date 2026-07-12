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

## CONTEXT

触发词：`更新画像`、`更新日记`、`记录偏好`、`记录项目进展`、`同步上下文`、`context`

Context 用于理解用户、项目状态、偏好和近期事实，但不为知识性结论提供外部证据。Context 写入只发生在实际对话中：不创建每日自动化任务，不因日期变化自动生成日记，仅在出现重大节点、状态变化或任务结束时判断是否记录。

建议文件划分：

```text
context/
  DIARY_GUIDE.md
  persona/
    user-profile.md
    preferences.md
    project-<slug>.md
  diary/
    YYYY-MM-DD-diary.md
```

执行步骤：

1. 先完整读取相关 Context 文件；不存在时再创建。
2. 只记录用户明确陈述的事实、用户明确决定或当前交互中明确表达/确认的决策倾向。
3. 日记不得包含 Agent 推断、观察、心理分析或猜测；没有事实或状态变化时不创建空日记。
4. Persona、preferences 和 project 文件采用“当前状态 + 日期化演化记录”，只追加或谨慎修订，不静默删除历史。
5. 今日日记存在时追加，不存在时创建；每次写入署名 `Codex Win端`。
6. 跨日期事件链使用相对 Markdown 链接指向相关日记或项目文件，不强制使用 Wiki 层英文 slug 规则。
7. 新建或触碰的 Context Markdown 应包含 `type`、`date`、`updated`、`remote_access` frontmatter；指南为 `always`，画像/项目/日记默认为 `on-demand`，`local-only` 不进入远程 Gateway 索引。
8. 不在 Context 中记录护照号、注册号、密钥、token、联系方式等真实敏感值，也不写部分掩码或占位符。
9. `context/` 不参与 `source_count`、confidence、`raw_sha256` 或 source integrity；只有用户明确要求时，才转入 `wiki/concepts/` 或 `wiki/synthesis/`。
10. Gateway 定时任务只索引和校准已有文件，不生成或修改 Context。若 qmd 已索引 `context/`，写入后执行 `qmd update`。
11. 具体规则见 `references/context-maintenance.md`；可复制的脱敏日记模板见 [`references/diary-template.md`](diary-template.md)。项目需要让网页端 GPT 参考规则和模板时，将该模板复制为 `context/DIARY_GUIDE.md` 并保留 `remote_access: always`。

示例：

```text
更新画像：我接下来半年主要关注本地 AI 工具和人机协作研究。
记录偏好：以后给我命令时优先提供 PowerShell 版本。
记录项目进展：personal-knowledge-base 已完成公开仓库首版发布。
更新日记：今天完成了首批来源标定，并调整了概念命名规则。
同步上下文：把本次任务中对未来有用的项目状态和偏好写入 context。
```

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
13. 如果 qmd 已配置，执行 `qmd update`；不可用时说明已降级。

个人写作流程：

- 不写客观 Summary。
- 立场写入相关 concept 页 `## My Position`，标注「个人认知」。
- 不增加外部 `source_count`。
- 引用外部来源时，尝试链接已有 source 页。

## QUERY -> REVIEW -> PROMOTE

触发词：直接提问、「根据我的知识库」、`review output`、`promote`、`提升回答`、`沉淀回答`

核心边界：回答、output、synthesis 和回答触发的 concept/entity 更新都是二阶产物，不是独立来源。不得把它们创建为 source 页，也不得因此增加 `source_count` 或提高 confidence。

1. 若问题涉及用户偏好、项目状态或近期上下文，先读 `context/`。
2. 优先执行 `qmd query "<问题>" --json` 获取 top 5；失败则读 `wiki/index.md` 并用 `rg` 搜索。
3. 完整读取相关页面，不只依赖搜索片段。
4. 合成答案；每个知识性核心结论必须溯源到具体 `wiki/sources/<slug>.md`，并标注 confidence、分歧和局限。
5. 凡需落盘的 Query，默认只写入 `wiki/outputs/YYYY-MM-DD-<topic>.md`，frontmatter 含 `graph-excluded: true`。单次问答、临时格式化内容或用户明确要求不保存时，可以不落盘。
6. output 至少包含：问题、简短结论、依据及 source 链接、反例/矛盾与局限、Confidence Notes、建议沉淀位置。更新 index 的 Outputs 或 Recent Outputs，并追加 `query` 日志；不要直接更新 Recent Synthesis。
7. 提升前执行 REVIEW：检查可复用性、来源追溯、反证和证据缺口；拟更新 concept/entity 时，先按英文 slug 和 aliases 查重。
8. 默认不自动 PROMOTE。只有用户明确要求提升，或当前任务已明确授权时，才按以下规则处理：

| 回答类型 | 处理位置 |
|---|---|
| 多个独立来源支持的新结论、比较、框架或跨来源连接 | `wiki/synthesis/` |
| 对既有定义或实体信息的补充、修正 | 对应 concept/entity，并追加 Evolution Log |
| 证据不足但值得追踪的问题 | `wiki/QUESTIONS.md` |
| 用户确认的偏好、项目决策、近期状态 | `context/` |
| 单次问答、无来源推断、临时格式化内容 | 保留在 outputs 或不落盘 |

9. 保留原 output 作为候选答案和审计记录，并注明提升目标。每次提升追加日志：`YYYY-MM-DD HH:MM | promote | wiki/outputs/<file>.md -> <target>`。只有实际生成 synthesis 时，才更新 Recent Synthesis。

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

## 文档维护

- 当知识库操作规则变化时，同步更新项目的用户指南或 `README.md`。
- 当 Context 目录、分类或更新规则变化时，同步更新本节和用户指南中的 Context 说明。
````

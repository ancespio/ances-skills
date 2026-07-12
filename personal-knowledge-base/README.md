# Personal Knowledge Base

一个用于创建、使用和维护个人知识库或 LLM Wiki 的 Codex skill。思路来自于https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

它不把知识库做成一次性的问答缓存，而是维护一套透明的 Markdown 文件：原始材料保留不动，知识页面持续演化，每个重要结论都能追溯到具体来源。

你不需要先学会知识图谱、RAG 或复杂的 Obsidian 配置。安装 skill 后，准备一个文件夹和少量测试材料，用自然语言让 Codex 创建、摄入、查询和维护即可。

## 核心模型

```text
raw/       人类拥有的原始材料，只读、只追加
wiki/      Agent 维护的来源页、概念页、实体页和综合分析
context/   用户画像、项目状态、偏好和日记，不作为外部证据
```

你负责收集材料、提出问题和确认高风险操作；Codex 负责维护 Wiki。项目根目录的 `AGENTS.md` 或 `CLAUDE.md` 会保存这套分工和规则，让不同会话保持一致。

## 适合谁

适合：

- 希望把文章、论文、剪藏、笔记和个人写作长期积累成可查询知识库的人。
- 希望答案能追溯到原始来源，而不是只相信一次对话总结的人。
- 希望 AI 记住长期偏好、项目状态和日记，但又不把这些内容冒充外部证据的人。
- 愿意在前 2-3 篇材料上花一点时间标定规则，以换取后续稳定输出的人。

不适合：

- 只想临时上传几份文件问一次问题，不需要长期维护。
- 希望把全部资料一次性丢进去、完全不审查结果。
- 希望 AI 自动修改原始材料或自动确认高置信度结论。

## 能做什么

- 创建完整的 Markdown/Obsidian 知识库结构。
- 生成可直接使用的 `AGENTS.md` 行为契约。
- 摄入外部来源和个人写作，并保留 `raw_file`、`raw_sha256`、`last_verified`。
- 通过 slug 和 aliases 对齐概念，避免重复页面。
- 使用 qmd、`rg` 或 `wiki/index.md` 查询本地知识，并通过 REVIEW 决定是否把高价值回答提升回 Wiki。
- 对 frontmatter、wikilink、来源哈希、孤立页面和搜索索引执行健康检查。
- 在综合结论前主动搜索反证，显式记录矛盾和局限。
- 维护开放问题，并在新来源可能回答问题时提示继续查询。
- 更新个人画像、偏好、项目进展和日记，并在个人化查询时读取这些 Context。
- 在第一次创建时解释需要准备的材料，带你完成 2-3 篇来源标定和系统核查。
- 可选地将知识库接入 Cloudflare 的只读 Gateway 和私人 GPTs，让网页版与手机端检索同一份受版本约束的知识库。

## 创建前要准备什么

### 最低需要

- 一个用于存放知识库的文件夹。
- 至少 1 篇代表性材料。没有材料时也可以先创建空骨架。
- 接受这条基本分工：`raw/` 由你拥有且默认不修改，`wiki/` 由 Codex 维护。

### 推荐准备

- 2-3 篇不同类型的测试材料，例如：一篇网页文章、一份 PDF/研究资料、一篇你自己的文章或项目笔记。
- 你最关心的主题范围，以及明确不希望进入知识库的隐私内容。
- 可选的 Context 初始信息：个人背景、长期偏好、当前项目、已有决策、近期状态和日记。
- 可选工具：Obsidian 用于浏览，qmd 用于本地搜索，Python 用于健康检查，Git 用于版本管理。

不需要先清洗、改名或搬完全部历史资料。最稳妥的方式是先用 2-3 篇材料把规则调顺，再逐步增加。

## 安装

在 Codex 中说：

```text
帮我安装这个 skill：https://github.com/ancespio/ances-skills/tree/main/personal-knowledge-base
```

安装后可以显式调用：

```text
使用 $personal-knowledge-base 创建一个可追溯的个人知识库。
```

当请求明显涉及个人知识库的创建、摄入、查询、检查、反思、问题管理或去重时，也允许语义触发。

## 从零创建

### 1. 准备目标目录

例如：

```text
C:\KnowledgeBase
```

目录可以是空的，也可以已有材料。已有文件时，Codex 会先检查，不应直接覆盖。

### 2. 发出创建指令

```text
使用 $personal-knowledge-base 在 C:\KnowledgeBase 创建个人知识库。
先告诉我需要准备什么、你的默认方案和需要我确认的问题，得到确认后再写文件。
```

Codex 会询问材料类型、Context 范围、隐私边界、语言和工具。没有特殊要求时，可以直接接受默认方案。

### 3. 完成基础搭建

确认后，Codex 会创建 `raw/`、`wiki/`、`context/`、模板、系统文件、操作契约和健康检查脚本，并检测本地搜索工具。

完整创建任务也可以直接使用 [bootstrap-prompt.md](./references/bootstrap-prompt.md)。它已经包含准备问答、目录结构、Audit、首次标定和最终使用说明。

### 4. 放入 2-3 篇测试材料

优先选择真实、常见、差异明显的材料：

```text
raw/clippings/example-article.md
raw/pdfs/example-paper.pdf
raw/personal/my-note.md
```

### 5. 逐篇标定

```text
摄入 raw/clippings/example-article.md
```

每篇完成后重点检查：

- 摘要有没有歪曲原文。
- 概念和实体是否太多、太少或命名不自然。
- 中文名称、英文 aliases 和英文 slug 是否对应。
- 个人观点是否与外部证据分开。
- 来源、哈希、矛盾和 confidence 是否记录清楚。

不满意时直接说：

```text
请修正这次结果，并更新 AGENTS.md：以后处理同类材料时，概念只保留能够跨来源复用的内容。
```

### 6. 执行系统核查

```text
对知识库执行完整系统 Audit，检查目录、模板、AGENTS.md、lint 和搜索索引，只报告问题，不自动做高风险修复。
```

### 7. 再开始批量积累

2-3 篇标定结果稳定后，再让 Codex 批量处理剩余材料。这样可以避免一次生成大量风格不一致的页面。

需要定制项目规则时，使用 [agents-template.md](./references/agents-template.md)。实际机器路径、工具位置和项目边界应写在知识库自己的 `AGENTS.md` 中，不要写死在可公开复用的 skill 里。

页面结构参考 [page-templates.md](./references/page-templates.md)。

## 材料放到哪里

| 你的材料           | 放置目录           | 示例                     |
| ------------------ | ------------------ | ------------------------ |
| 手动保存的长文章   | `raw/articles/`  | Markdown 文章            |
| 浏览器网页剪藏     | `raw/clippings/` | Web Clipper 输出         |
| PDF 和研究资料     | `raw/pdfs/`      | 论文、报告、书籍章节     |
| 截图和图表         | `raw/images/`    | PNG、JPG                 |
| 随手想法           | `raw/notes/`     | 临时观察、问题、灵感     |
| 自己写的文章和分析 | `raw/personal/`  | 项目复盘、投资笔记、长文 |

`raw/` 是原始材料区。不要为了让 Wiki 看起来整齐而重写原文；如果原文确实发生变化，重新摄入即可。

## 配置 Obsidian Chrome Web Clipper

Obsidian Web Clipper 是可选的网页收集入口。它可以把网页正文和元数据保存成知识库里的 Markdown；不用它时，也可以手动把文章放进 `raw/articles/` 或 `raw/clippings/`。

### 1. 把知识库作为 Obsidian Vault 打开

1. 安装并打开 Obsidian。
2. 选择 **Open folder as vault**。
3. 选择你的知识库根目录，例如 `C:\KnowledgeBase`。
4. 确认左侧文件列表中能看到 `raw/`、`wiki/` 和 `context/`。

第一次配置 Web Clipper 时保持 Obsidian 处于打开状态，以便浏览器扩展识别并调用这个 vault。

### 2. 安装官方 Chrome 扩展

打开 [Obsidian Web Clipper - Chrome Web Store](https://chromewebstore.google.com/detail/obsidian-web-clipper/cnjifjpddelmedmihgijeibhnjfabmlf)，点击 **Add to Chrome**。这个版本也适用于大多数 Chromium 浏览器，例如 Brave、Arc 和 Vivaldi。

安装后建议把 Web Clipper 固定到 Chrome 工具栏。官方使用说明见 [Obsidian Web Clipper Help](https://help.obsidian.md/web-clipper)。

### 3. 连接知识库 Vault

1. 点击 Chrome 工具栏中的 Web Clipper 图标。
2. 点击齿轮进入 **Settings**。
3. 在 Vault 设置中添加或选择刚才打开的知识库 vault。
4. 如果 Chrome 询问是否允许打开 Obsidian，选择允许。

如果列表里没有目标 vault，先回到 Obsidian 打开该知识库，再重新打开扩展；仍然找不到时，重启 Obsidian 和 Chrome 后重试。

### 4. 创建 LLM Wiki 剪藏模板

在 Web Clipper Settings 中点击 **New template**，填写：

| 设置项        | 推荐值                                             |
| ------------- | -------------------------------------------------- |
| Template name | `LLM Wiki - Article`                             |
| Behavior      | `Create a new note`                              |
| Vault         | 当前知识库 vault                                   |
| Note location | `raw/clippings`                                  |
| Note name     | `{{date\|date:"YYYY-MM-DD"}}-{{title\|safe_name}}` |

在 **Properties** 中至少添加：

| Property       | Value                          |
| -------------- | ------------------------------ |
| `type`       | `web-clipping`               |
| `title`      | `{{title}}`                  |
| `source_url` | `{{url}}`                    |
| `author`     | `{{author}}`                 |
| `captured`   | `{{date\|date:"YYYY-MM-DD"}}` |
| `processed`  | `false`                      |

Note content 可以使用：

```markdown
# {{title}}

- Source: {{url}}
- Author: {{author}}
- Captured: {{date|date:"YYYY-MM-DD"}}

{{content}}
```

`{{content}}` 是网页正文；日期格式和文件名过滤器来自 Web Clipper 的官方变量与过滤器语法。模板修改会自动保存。

### 5. 设置图片附件目录

在 Obsidian 中打开：

**Settings → Files & Links → Default location for new attachments**

选择 **In the folder specified below**，填写：

```text
raw/images
```

这样 Obsidian 保存到本地的图片和其他附件会集中进入 `raw/images/`。

### 6. 做一次真实测试

1. 打开一篇普通网页文章。
2. 点击 Web Clipper，选择 `LLM Wiki - Article`。
3. 在保存前确认 Vault、Note name 和 Note location。
4. 点击 **Add to Obsidian**。
5. 回到 Obsidian，确认 `raw/clippings/` 出现新的 Markdown 文件，正文和来源属性完整；若保存了本地图片，检查它们是否进入 `raw/images/`。
6. 测试通过后，在 Codex 中说：

```text
摄入 raw/clippings/<刚剪藏的文件名>.md
```

这篇文章可以直接作为第一次标定来源。批量剪藏前先测试一篇，避免路径或模板错误产生大量待整理文件。

## 日常工作流

### 1. 收集材料

把文章、剪藏、PDF、图片和个人写作放入 `raw/`。原始文件默认不修改。

### 2. 摄入外部来源

```text
摄入 raw/clippings/example.md
```

Codex 会读取原文、计算哈希、创建 source 页、更新相关 concept/entity 页面、检查开放问题，并记录索引和日志。

### 3. 摄入自己的文章

```text
摄入 raw/personal/my-analysis.md
```

自己的文章用于记录你的立场，不会被当成多个外部来源给自己增加 confidence。

### 4. 查询知识

```text
根据我的知识库，回答：<问题>
```

Codex 会搜索相关页面、完整读取来源并合成答案。知识性结论会追溯到 source 页；凡需落盘的回答默认先保存到 `wiki/outputs/` 候选区，不会直接写进知识图谱。

每份候选回答会列出问题、简短结论、来源依据、反例/矛盾与局限、Confidence Notes，以及建议沉淀位置。随后可以发出：

```text
审查刚才的 output，把值得长期复用且来源可追溯的内容提升到合适位置。
```

Codex 会按内容类型处理：跨来源洞见进入 `wiki/synthesis/`，既有定义的补充进入 concept/entity 并记录 Evolution Log，证据空白进入 `wiki/QUESTIONS.md`，你确认的偏好或项目状态进入 `context/`。单次问答、无来源推断和临时格式化内容继续留在 outputs 或不落盘。

回答、output 和 synthesis 都是基于已有来源的二阶产物，不是新证据。无论回答或提升多少次，都不能借此增加 `source_count` 或提高 confidence；所有提升都会写入 `wiki/log.md`。

### 5. 记录尚未解决的问题

```text
我想搞清楚：<开放问题>
```

问题会进入 `wiki/QUESTIONS.md`，供后续来源和综合分析使用。

### 6. 更新 Context

Context 记录的是“关于你和当前工作的长期上下文”，不是外部知识来源。

```text
更新画像：我接下来半年主要关注本地 AI 工具和人机协作研究。
```

```text
记录偏好：以后给我命令时优先提供 PowerShell 版本。
```

```text
记录项目进展：个人知识库 skill 已完成首次公开发布，下一步是补充使用文档。
```

```text
更新日记：今天完成了 3 篇测试来源标定，调整了概念命名规则。
```

```text
同步上下文：把本次任务中对未来有用的项目状态和偏好写入 context。
```

对应关系：

- 个人背景和长期状态：`context/persona/user-profile.md`
- 工作与输出偏好：`context/persona/preferences.md`
- 项目目标、决策和进展：`context/persona/project-<slug>.md`
- 当天事件和阶段记录：`context/diary/YYYY-MM-DD-diary.md`

Codex 会先读取现有 Context，只追加或谨慎修订。Context 不参与外部来源计数；只有你明确要求“把这段上下文沉淀为知识页”时，才会转入 Wiki。

### 7. 健康检查

```text
检查知识库，只生成报告，先不要修复
```

报告会检查断链、空壳页面、来源哈希变化、过期页面、重复概念和搜索索引。

### 8. 综合反思

```text
综合分析已有知识，主动寻找反证、矛盾和空白
```

Codex 会先寻找反证，再生成跨来源 synthesis 和 gap report。

### 9. 合并重复页面

```text
检查是否有重复概念，并给出合并方案，先不要执行。
```

Codex 必须先展示主 slug、aliases、来源并集和 redirect 方案，得到确认后才能合并。

## 可选：在手机或网页版 ChatGPT 查询知识库

如果你明确希望在手机或网页版 ChatGPT 中查询知识库，可在本地知识库之外部署一个独立的 Cloudflare Gateway，并接入仅自己可见的私人 GPTs。它是可选只读入口，不会随着知识库更新，不替代本地 qmd，也不会把知识库仓库改造成网页工程。

1. 知识库与 Gateway 分别维护：前者只保存知识库，后者保存 Worker、部署配置和 Action schema。
2. 由知识库 `main` 的 GitHub Push webhook 触发增量索引；每日全量校准和定时续跑用于补偿漏事件或长任务。
3. Cloudflare Git Builds 或 Deploy Hook 只部署 Gateway 代码，不负责索引知识库。
4. Gateway 只读；不索引 `raw/`，只在明确需要时检索 `context/`，并且不把管理端点或密钥暴露给 GPT。
5. 在 `/health` 返回非空 `syncedCommit` 后，再把 `/openapi.json` 导入私人 GPT 的 Actions，并只配置 Action 专用 Bearer token。

部署时不要把 token、webhook URL、KV 标识、私人路径或知识库内容写入公开 skill、Git 提交或 GPT Instructions。验收时至少检查：健康接口、两个 Action 的独立调用，以及一次知识库 `main` push 是否触发增量同步。

## 推荐节奏

| 频率                     | 建议动作                                      |
| ------------------------ | --------------------------------------------- |
| 随时                     | 把材料放入 `raw/`；记录项目进展、偏好和日记 |
| 每篇重要材料             | 执行一次摄入；前 5 篇尽量逐篇审查             |
| 有问题时                 | 直接说“根据我的知识库”或记录开放问题        |
| 每两周                   | 执行一次 LINT，先看报告再修复                 |
| 每月或每新增约 10 篇来源 | 执行一次 REFLECT                              |
| 发现重复时               | 请求 MERGE 方案并人工确认                     |

## 哪些事情需要你确认

- 第一次创建前的目录、边界和工具方案。
- 批量摄入或批量迁移历史材料。
- 概念晋升为 `confidence: high`。
- 合并重复页面、删除文件和大范围重写。
- 安装依赖或修改 Git 历史。

## 搜索工具

Agents会优先检测 qmd 是否存在；Windows 下 PATH 找不到时，可使用以下命令定位全局 npm 安装：

```powershell
Get-Command qmd -ErrorAction SilentlyContinue
npm prefix -g
```

如果 qmd 不可用，不会擅自安装依赖，降级使用 `rg` 和 `wiki/index.md`。

## 隐私与安全

- 不要把真实 `raw/`、`context/`、日记或用户画像放进公开 skill 仓库。
- 不要在模板中写入用户名、主目录、访问令牌或本机绝对路径。
- 发布前搜索常见凭据模式和本机路径。
- 删除、合并或大范围重写前先展示方案并等待确认。
- confidence 表示证据覆盖程度，不代表事实绝对正确。

## 文件结构

```text
personal-knowledge-base/
├── SKILL.md
├── README.md
├── agents/
│   └── openai.yaml
└── references/
    ├── agents-template.md
    ├── bootstrap-prompt.md
    └── page-templates.md
```

## License

本项目使用 [MIT License](https://github.com/ancespio/ances-skills/blob/main/LICENSE)。

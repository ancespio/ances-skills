# Personal Knowledge Base

一个用于创建、使用和维护个人知识库或 LLM Wiki 的 Codex skill。

它不把知识库做成一次性的问答缓存，而是维护一套透明的 Markdown 文件：原始材料保留不动，知识页面持续演化，每个重要结论都能追溯到具体来源。

## 核心模型

```text
raw/       人类拥有的原始材料，只读、只追加
wiki/      Agent 维护的来源页、概念页、实体页和综合分析
context/   用户画像、项目状态、偏好和日记，不作为外部证据
```

项目根目录的 `AGENTS.md` 或 `CLAUDE.md` 是实际操作契约。它负责规定目录权限、页面模板、工作流、confidence、日志和验证方式；本 skill 提供可复用的方法与模板。

## 能做什么

- 创建完整的 Markdown/Obsidian 知识库结构。
- 生成可直接使用的 `AGENTS.md` 行为契约。
- 摄入外部来源和个人写作，并保留 `raw_file`、`raw_sha256`、`last_verified`。
- 通过 slug 和 aliases 对齐概念，避免重复页面。
- 使用 qmd、`rg` 或 `wiki/index.md` 查询本地知识。
- 对 frontmatter、wikilink、来源哈希、孤立页面和搜索索引执行健康检查。
- 在综合结论前主动搜索反证，显式记录矛盾和局限。
- 维护开放问题，并在新来源可能回答问题时提示继续查询。

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

需要建立完整项目时，使用 [bootstrap-prompt.md](./references/bootstrap-prompt.md)。先替换知识库根路径和工具偏好，再交给 Codex 执行。

需要定制项目规则时，使用 [agents-template.md](./references/agents-template.md)。实际机器路径、工具位置和项目边界应写在知识库自己的 `AGENTS.md` 中，不要写死在可公开复用的 skill 里。

页面结构参考 [page-templates.md](./references/page-templates.md)。

## 日常工作流

### 1. 收集

把文章、剪藏、PDF、图片和个人写作放入 `raw/`。原始文件默认不修改。

### 2. 摄入

```text
摄入 raw/clippings/example.md
```

Agent 读取原文、计算哈希、创建 source 页、更新相关 concept/entity 页面，并记录索引和日志。

### 3. 查询

```text
根据我的知识库，回答：<问题>
```

Agent 搜索相关页面，完整读取来源并合成答案。知识性结论应追溯到 source 页，而不是只引用概念页。

### 4. 记录问题

```text
我想搞清楚：<开放问题>
```

问题会进入 `wiki/QUESTIONS.md`，供后续来源和综合分析使用。

### 5. 定期维护

```text
检查知识库，只生成报告，先不要修复
```

```text
综合分析已有知识，主动寻找反证、矛盾和空白
```

建议按需摄入和查询，每周执行一次健康检查，在材料积累明显增加时执行 REFLECT。

## 搜索工具

优先检测 qmd 是否存在；Windows 下 PATH 找不到时，可使用以下命令定位全局 npm 安装：

```powershell
Get-Command qmd -ErrorAction SilentlyContinue
npm prefix -g
```

如果 qmd 不可用，不要擅自安装依赖，降级使用 `rg` 和 `wiki/index.md`。

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

本项目使用仓库根目录的 [MIT License](../LICENSE)。

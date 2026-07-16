# Ances Skills

我在真实工作流中持续使用和迭代的一组 AI Skills。每个 skill 都是可独立安装的结构化指令集，尽量把复杂任务变成可重复、可审查、可验证的工作流。

[![License](https://img.shields.io/badge/License-MIT-3B82F6?style=for-the-badge)](./LICENSE)
[![Skills](https://img.shields.io/badge/Skills-2-10B981?style=for-the-badge)](#skills)
[![Codex](https://img.shields.io/badge/Codex-Skills-111827?style=flat-square&logo=openai&logoColor=white)](https://developers.openai.com/codex/)

这些 skill 主要面向 Codex；核心规则和参考资料采用 Markdown，也便于迁移到其他支持 `SKILL.md` 的 Agent 环境。

## 目录

| Skill                                              | 一句话说明                                               | 文档                                         |
| -------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------- |
| [personal-knowledge-base](./personal-knowledge-base/) | 创建、摄入、检索、检查和维护可追溯的 Markdown 个人知识库 | [使用说明](./personal-knowledge-base/README.md) |
| [multimodal-evidence](./multimodal-evidence/) | 统一多模态证据提取与独立外部核验协议 | [SKILL.md](./multimodal-evidence/SKILL.md) |

## 安装方式

在 Codex 中直接说：

```text
帮我安装这个 skill：https://github.com/ancespio/ances-skills/tree/main/personal-knowledge-base
```

也可以显式指定：

```text
使用 $skill-installer 安装：https://github.com/ancespio/ances-skills/tree/main/personal-knowledge-base
```

安装多模态证据 skill：

```text
帮我安装这个 skill：https://github.com/ancespio/ances-skills/tree/main/multimodal-evidence
```

也可以显式指定：

```text
使用 $skill-installer 安装：https://github.com/ancespio/ances-skills/tree/main/multimodal-evidence
```

## Skills

### multimodal-evidence（多模态证据）

定义“客观证据提取”和“独立外部核验”的统一能力协议，并通过 runtime router 选择宿主原生视觉能力、Gemini CLI、Antigravity CLI 或其他兼容后端。

它支持：

- 从图片、截图、PDF 指定页面、图表、流程图和设计稿中提取原文、布局、表格和不确定项。
- 使用统一 `EvidencePackage` 结构，让主 Agent 不依赖具体后端的输出格式。
- 将文件提取（`extraction`）与联网核验（`verification`）分开，普通 OCR 默认不联网。
- 在主 Agent 已具备可靠原生多模态能力时避免重复调用。
- 对 Gemini CLI、agy 的认证、权限、空输出、超时和降级路径进行明确约束。
- 对网络核验设置公共 HTTPS、来源优先级、查询脱敏和搜索/抓取预算。

当前账号路由注意：个人 Google AI Pro/Ultra 和 Gemini Code Assist Individuals 的 Gemini CLI OAuth 已迁移到 Antigravity；这类账号应先在交互式终端运行 `agy` 完成登录，再使用 agy 的无头适配器。Gemini CLI 仍可通过 Gemini API Key、Vertex AI 或受支持的企业账号使用。

常见触发方式：

```text
使用 $multimodal-evidence 提取这张图片中的客观证据
再用另一个视觉后端独立复核这页 PDF
核对截图中的公开版本号和官方出处
```

→ [SKILL.md](./multimodal-evidence/SKILL.md)

### personal-knowledge-base（个人知识库）

> 依照Karpathy的[LLM wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)思想，把散落的原始材料变成可追溯、可链接、可持续维护的个人 Wiki。

这个 skill 把个人知识库视为长期积累的持久化产物：人负责收集来源和提出问题，Agent 负责维护结构化 Wiki、来源账本、概念链接、综合分析和健康检查。

希望将LLM作为编译器而非仅仅作为查询器来构建知识库，而不是直接切分向量化（甚至不需要向量化），模型越智能，Prompt越合理，编译出来的wiki就越有用。

它支持：

- 从零建立 `raw/`、`wiki/`、`context/` 三层知识库。
- 设计项目级 `AGENTS.md` 或 `CLAUDE.md` 操作契约。
- 摄入文章、剪藏、PDF 摘要和个人写作，同时保留来源哈希。
- 将单栏、双栏、扫描版和复杂版式 PDF 转录为可校验的 `wiki/derived/` Markdown，MinerU 主用、Docling 回退。
- 为非中文 PDF 生成中文摘要，并在用户确认后生成复用既有术语的全文译文；转录和译文不增加来源计数。
- 根据本地 Wiki 查询并输出可追溯答案。
- 执行 LINT、REFLECT、ADD-QUESTION 和 MERGE 工作流。
- 使用 qmd 搜索，并在不可用时降级到 `rg` 和索引文件。
- 隔离普通知识检索与 derived 全文读取，支持 hybrid -> BM25 -> `rg` 的安全降级。
- 管理 source integrity、矛盾记录和 confidence。
- （可选）指导用户将知识库挂载到Cloudflare，并创建专属GPTs实现在线访问
- （可选）通过只读 Gateway 按需分页读取经过 raw、manifest 和 artifact 哈希校验的 PDF 转录与译文。

常见触发方式：

```text
帮我创建一个个人知识库
摄入 raw/clippings/example.md
摄入 raw/pdfs/example-paper.pdf，先转录并质检，只生成中文摘要
根据我的知识库回答这个问题
检查一下知识库健康状况
综合分析已有笔记，寻找矛盾和知识空白
Ask to GPTs：我最近关注的内容有什么新的进展吗？跟知识库已有内容有冲突吗？
```

→ [项目说明](./personal-knowledge-base/README.md) · [SKILL.md](./personal-knowledge-base/SKILL.md)

## 设计原则

- 原始来源默认只读，知识层由 Agent 维护。
- 重要结论必须能够追溯到来源。
- 个人观点与外部证据分开记录。
- 先报告再执行大范围修复、合并、删除或重写。
- 使用渐进式披露：核心流程放在 `SKILL.md`，详细模板放在 `references/等附属文件夹`。

## 许可证

[MIT License](./LICENSE)。可以使用、修改和再分发，但请自行审查工作流对本地文件和隐私数据的影响。

Made by [@ancespio](https://github.com/ancespio)

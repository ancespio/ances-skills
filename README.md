# Ances Skills

我在真实工作流中持续使用和迭代的一组 AI Skills。每个 skill 都是可独立安装的结构化指令集，尽量把复杂任务变成可重复、可审查、可验证的工作流。

[![License](https://img.shields.io/badge/License-MIT-3B82F6?style=for-the-badge)](./LICENSE)
[![Skills](https://img.shields.io/badge/Skills-1-10B981?style=for-the-badge)](#skills)
[![Codex](https://img.shields.io/badge/Codex-Skills-111827?style=flat-square&logo=openai&logoColor=white)](https://developers.openai.com/codex/)

这些 skill 主要面向 Codex；核心规则和参考资料采用 Markdown，也便于迁移到其他支持 `SKILL.md` 的 Agent 环境。

## 目录

| Skill                                              | 一句话说明                                               | 文档                                         |
| -------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------- |
| [personal-knowledge-base](./personal-knowledge-base/) | 创建、摄入、检索、检查和维护可追溯的 Markdown 个人知识库 | [使用说明](./personal-knowledge-base/README.md) |

## 安装方式

在 Codex 中直接说：

```text
帮我安装这个 skill：https://github.com/ancespio/ances-skills/tree/main/personal-knowledge-base
```

也可以显式指定：

```text
使用 $skill-installer 安装：https://github.com/ancespio/ances-skills/tree/main/personal-knowledge-base
```

## Skills

### personal-knowledge-base（个人知识库）

> 把散落的原始材料变成可追溯、可链接、可持续维护的个人 Wiki。

这个 skill 把个人知识库视为长期积累的持久化产物：人负责收集来源和提出问题，Agent 负责维护结构化 Wiki、来源账本、概念链接、综合分析和健康检查。

它支持：

- 从零建立 `raw/`、`wiki/`、`context/` 三层知识库。
- 设计项目级 `AGENTS.md` 或 `CLAUDE.md` 操作契约。
- 摄入文章、剪藏、PDF 摘要和个人写作，同时保留来源哈希。
- 根据本地 Wiki 查询并输出可追溯答案。
- 执行 LINT、REFLECT、ADD-QUESTION 和 MERGE 工作流。
- 使用 qmd 搜索，并在不可用时降级到 `rg` 和索引文件。
- 管理 source integrity、矛盾记录和 confidence。
- （可选）指导用户将知识库挂载到Cloudflare，并创建专属GPTs实现在线访问

常见触发方式：

```text
帮我创建一个个人知识库
摄入 raw/clippings/example.md
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

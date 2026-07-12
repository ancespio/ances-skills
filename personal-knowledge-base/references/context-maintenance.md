# Context 维护规则

本参考文件定义长期上下文层的写入边界。项目本地 `AGENTS.md` 优先级高于本文件。

## 触发与判断

Context 写入只发生在实际对话过程中。不得创建每日自动化任务，也不得因为日期变化自动生成日记。Codex 在对话中自行判断是否出现重大节点或任务结束；普通检查、重复执行、无状态变化的对话不写入 Context。

触发词包括 `更新画像`、`更新日记`、`记录偏好`、`记录项目进展`、`同步上下文`、`context`，但触发词本身不等于授权写入，仍须遵守事实边界。

## 可写内容

只记录以下内容：

- 用户明确陈述的事实。
- 用户明确作出的决定、约束或偏好。
- 用户在当前交互中明确表达或确认的决策倾向。

不得把 Agent 的推断、观察、心理分析、猜测或未确认的长期偏好写成日记内容。日记不包含 `Agent Observations` 一类章节。

## 路由与历史

1. 重大节点首先写入当日日记；如果不存在当日日记才新建。
2. 对未来仍有复用价值的事实或用户决策，再同步到对应的用户画像、项目画像或偏好文件。
3. Persona 与项目文件采用“当前状态 + 日期化演化记录”，只追加或谨慎修订，不静默删除旧状态。
4. 日记跨日期事件使用相对 Markdown 链接连接日记或项目画像；Context 不强制使用 Wiki 的英文 slug wikilink 规则。
5. 每次由 Codex 写入的 Context 内容署名 `Codex Win端`。
6. 没有事实、决策或状态变化时，不创建空日记。

## 隐私

Context 中不记录护照号、注册号、密钥、token、联系方式等真实敏感值；不使用部分掩码或占位符替代。只保留必要的事件事实和用户决策。

## Frontmatter 与远程访问

新建或实际触碰的 Context Markdown 使用 UTF-8 无 BOM，并包含：

```yaml
---
type: context-diary | context-persona | context-project | context-guide
date: YYYY-MM-DD
updated: YYYY-MM-DD
remote_access: always | on-demand | local-only
---
```

`context/DIARY_GUIDE.md` 使用 `remote_access: always`，用于网页端读取规则和模板；用户画像、项目画像和日记默认使用 `on-demand`；明确不应远程返回的内容使用 `local-only`。`local-only` 文件不得进入远程 Gateway 索引。

## 网页端检索

Gateway 的定时任务只负责已有文件的索引校准和续跑，不生成或修改 Context。涉及日记撰写规则、Context 维护方式时，应读取 `DIARY_GUIDE.md` 并启用 Context 检索；普通知识问题默认不读取 Context，涉及用户偏好、项目状态、历史决策或近期上下文时才启用。

日记模板见项目中的 `context/DIARY_GUIDE.md`。

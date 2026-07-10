# Wiki 页面模板

将这些模板放入 `wiki/templates/`，或由 agent 按需生成对应文件。字段可按本地 schema 微调，但不要删除 provenance、confidence 和 contradiction 相关字段。

## `source-template.md`

```markdown
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

# {{title}}

## Source

- Raw file: `{{raw_file}}`
- Original URL:
- Author:
- Published:
- Captured:

## Summary

用中文写 3-6 句话，概括来源主旨。个人写作不要写客观 Summary，改写为 `## My Position Extracted`。

## Key Claims

- 观点 1
- 观点 2
- 观点 3

## Related Concepts

- [[concept-slug]]

## Related Entities

- [[entity-slug]]

## Contradictions / Tensions

- 暂无，或列出与已有来源冲突的说法。

## Limitations

- 来源局限、时间局限、样本局限或视角局限。

## Notes for Future Query

- 这个来源可能回答的问题。
```

## `concept-template.md`

```markdown
---
type: concept
title: "中文概念名"
date: YYYY-MM-DD
last_reviewed: YYYY-MM-DD
tags: [wiki, wiki/concept]
aliases:
  - 中文概念名
  - English Concept Name
source_count: 1
confidence: low
---

# 中文概念名（English Concept Name）

## Definition

用中文给出当前定义。定义必须由 Sources 支撑；如果证据不足，明确写出不确定性。

## Key Points

- 要点 1
- 要点 2
- 要点 3

## Sources

- [[source-slug]]：一句话说明该来源如何支持或修正本概念。

## Related Concepts

- [[related-concept]]

## Related Entities

- [[related-entity]]

## Contradictions

- 暂无，或列出分歧来源和分歧点。

## My Position

> 仅用于个人写作或用户明确立场。不要把这里计入外部 confidence。

## Open Questions

- 仍需澄清的问题。

## Evolution Log

- YYYY-MM-DD（1 sources）：初始创建，来自 [[source-slug]]。
```

## `entity-template.md`

```markdown
---
type: entity
title: "实体中文名"
date: YYYY-MM-DD
last_reviewed: YYYY-MM-DD
tags: [wiki, wiki/entity]
aliases:
  - 实体中文名
  - Entity English Name
source_count: 1
confidence: low
---

# 实体中文名（Entity English Name）

## Overview

实体是谁/是什么，以及它为什么出现在知识库中。

## Key Facts

- 事实 1
- 事实 2

## Sources

- [[source-slug]]：相关事实。

## Related Concepts

- [[concept-slug]]

## Related Entities

- [[entity-slug]]

## Contradictions

- 暂无。

## Evolution Log

- YYYY-MM-DD（1 sources）：初始创建，来自 [[source-slug]]。
```

## `synthesis-template.md`

```markdown
---
type: synthesis
title: "综合分析标题"
date: YYYY-MM-DD
tags: [wiki, wiki/synthesis]
---

# 综合分析标题

## Question

这次综合要回答的问题。

## Short Answer

先给结论，避免只堆材料。

## Evidence

- [[source-a]]：支持点。
- [[source-b]]：支持点或反对点。

## Analysis

分段综合，显式区分事实、推断和个人判断。

## Contradictions / Alternative Views

- 分歧 1。

## Confidence Notes

- confidence: low/medium/high candidate/high
- 原因：

## Limitations

- 证据缺口、时间风险、样本偏差。

## Follow-up Questions

- [ ] 后续问题。
```

## `output-template.md`

```markdown
---
type: output
title: "输出标题"
date: YYYY-MM-DD
tags: [wiki, wiki/output]
graph-excluded: true
---

# 输出标题

## Answer

回答正文。

## Sources

- [[source-slug]]

## Confidence Notes

- confidence:
- 依据：
- 分歧：

## Reuse

- 是否应转入 `wiki/synthesis/`：
- 是否回答了 `QUESTIONS.md` 中的问题：
```

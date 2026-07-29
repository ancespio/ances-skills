# 场景 2：按原生 PPTX 模板填充

## 分析与计划

先读取 Theme、Master、Layout、页面、对象、字体、字号、颜色、段落/run、表格和图表，写入：

```text
template_analysis.json → adaptation_report.json → fill_plan.json
```

`adaptation_report.json` 必须说明模板是 placeholder-based 还是 framework-only、可用页面家族、内容区域、容量风险、缺失字体、歧义样例文字和无法安全编辑的对象。

用户分别确认三份文件后才允许 apply；确认记录必须绑定各自文件哈希。普通样例文字如果无法确定是否可替换，默认锁定并集中询问用户。

## 保留合同

- 保留 Theme、Master、Layout、字体、字号、颜色和固定框架。
- 模板只有视觉框架、没有 placeholder 时，可在既有内容区创建新的原生文本、表格、图表和形状；继承模板风格，不另建无关设计系统。
- 允许选择、克隆、重排和复用已有页面/版式，但必须在 fill plan 中明确。
- 不自动缩字、改色、换元素、改写内容或替换字体。

## 容量冲突

先尝试已有合适版式、克隆同类页或拆页。仍无法容纳时停止并报告 `template_capacity_conflict`；列出冲突页、对象、所需容量和可选处理，由用户决定。

## 代表页门

至少制作一页普通页和一页内容最密集页；若存在表格、图表或其他复杂原生对象，再加入对应代表页。代表页必须直接复用，真实渲染并确认后才批量填充。

最终同时做 OOXML/对象回读与视觉 QA；语义 readback 不能替代视觉检查。

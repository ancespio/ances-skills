# 场景 1：根据资料从 0 制作

场景 1 的父流程只增加一次版式确认，图片成稿本身完全交给随 Skill 原样复制的 `GordenImagePPTGen`。

## 父流程：只确认版式

运行记录可以包含 `brief.json`、`evidence_plan.json`、`outline.json` 和 `slide_plan.json`。它们用于把已确认的内容整理成一份覆盖全部页面的 `layout-preview.pptx`，不在父流程重复实现 Gorden 的内容策划、风格确认或图片生成。

`layout-preview.pptx` 只表达：

- 每个可见文字块的完整文字；
- 每个文字块的大致 `[x,y,w,h]` 位置、大小、层级、对齐方式和阅读顺序；
- 图片、图表、表格、SVG 等资产预留区；
- 内容区、装饰安全区和禁止侵入区。

预览使用中性线框、灰阶区块和原生文本框，不加入候选风格、装饰语言或动效。真实渲染并写 `visual_qa.json` 后，向用户展示整套预览，只取得一次 `layout-preview` 确认。未确认前不得调用 Gorden。

## Gorden 原版：A1–A5 原样执行

确认版式后，读取 [gorden-integration.md](gorden-integration.md) 和 [GordenImagePPTGen/SKILL.md](../GordenImagePPTGen/SKILL.md)，按上游原版执行：

```text
A1 确认风格 / 受众 / 页数 / 语言
→ A2 outline.json
→ A3 每页 prompts/NN-*.md
→ A4 调用 imagegen，复制逐页 PNG，写 imagegen-manifest.json
→ A5 用 compose_pptx.py 合成图片型 PPTX
```

父流程不增加 `style_reference_plan.json`、style-reference-choice、A/B/C 代表稿、固定调用次数或自定义 prompt 合同。Gorden 原版自己的风格询问和默认规则继续生效；父流程不会静默改写它们。

当前完整素材库仍保留在 `assets/style-library/`，但不会自动套用。只有用户在 Gorden A1 中明确提供或选择参考时，才把对应素材作为本次输入并登记来源。

## 交付与转场

场景 1 交付逐页 PNG 和每页一张全幅 PNG 的图片型 PPTX。必须真实渲染、逐页视觉检查、回读对象，并取得 `image-deck-final` 确认；图片内部文字和图形不可按普通 PPT 对象编辑。

如果用户还需要可编辑版本，先完成图片型 PPTX 验收，再新建独立场景 3 运行；不得在本次运行内自动串联 `GordenImage2PPTX`。

## 禁止

- 未确认版式就调用 Gorden；
- 把版式预览中的占位文字留到正式图片；
- 在父流程偷偷改写 Gorden A1–A5、跳过 `imagegen-manifest.json` 或伪造 imagegen 结果；
- 把图片型 PPTX 宣称为可编辑 PPTX；
- 增加动画、转场、旁白、音频或视频。

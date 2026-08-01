# 场景 3：图片或 PDF 重建

场景 3 的父流程只增加一次版式确认，图片到 PPTX 的重建完全交给随 Skill 原样复制的 `GordenImage2PPTX`。

## 父流程：只确认版式

输入可以是用户提供的图片、逐页 PDF 渲染，或已经通过 `image-deck-final` 确认的场景 1 逐页 PNG。父流程只锁定页数、顺序、画布和大致布局，并生成一份覆盖全部源页的 `layout-preview.pptx`。它不要求父流程逐区域选择重建方法，也不把源页裁切、去字或 imagegen 次数重新定义一遍。

预览只表达源页中要保留的文字块、大致位置、阅读顺序、图片/框架预留区和安全区；使用中性线框，不加入新风格。真实渲染并写 `visual_qa.json` 后，向用户展示整套预览，只取得一次 `layout-preview` 确认。未确认前不得调用 Gorden。

## Gorden 原版：B0–B9 原样执行

确认版式后，读取 [gorden-integration.md](gorden-integration.md) 和 [GordenImage2PPTX/SKILL.md](../GordenImage2PPTX/SKILL.md)，按上游原版执行：

```text
B0 唯一 RUN_ROOT / 源图隔离
→ B1 探色
→ B2 背景
→ B3 整体框架
→ B4 图标 / 装饰
→ B5–B7 文字提取、坐标和排版
→ B8 合成可编辑 PPTX
→ B9 imagegen manifest、逐页 QA 和视觉对照
```

父流程不增加 `source_region`、`source-preserved-png`、`imagegen-detexted-png`、固定三次调用、两页原型或父级区域审批。Gorden 原版的四层规则、edit target 要求、抠图脚本、`imagegen-assets-manifest.json`、`layout_guard.py`、`placement_qa.py` 和 `visual_compare_qa.py` 原样生效。

## 可编辑边界

- 普通标题、正文、数字和标签由 Gorden 写成 PowerPoint 原生文本框；
- 背景、框架、图标、装饰、复杂图表和艺术字按 Gorden 原版作为图片层，可移动、替换、缩放，但不承诺对象级编辑；
- 允许 Gorden 原版生成的 PNG 图片层，必须保留 manifest 并在 `editability_report.json` 中披露；
- 不使用未登记 JPG/WebP、把整页截图伪装成原生对象，或在 SVG 中内嵌 raster。

当前完整素材库仍保留在 `assets/style-library/`，但场景 3 不会自动使用它。源页、Gorden 运行目录、生成 manifest 和父运行的最终资产登记必须保持可追溯。

## 交付

每个生成的 PPTX 都必须真实渲染、逐页视觉检查、回读对象并写 `visual_qa.json` 和 `editability_report.json`。普通文字可编辑性与图片层边界必须如实说明；任一 Gorden QA 或父级 PPTX QA 失败都不得交付。

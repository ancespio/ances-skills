# 质量门禁

## 所有 PPTX

每次生成 PPTX 后立即：

1. 用 PowerPoint、LibreOffice 或宿主认可的真实渲染器渲染全部页面；
2. 逐页以足够分辨率查看，不只看缩略图；
3. 检查溢出、越界、意外换行、遮挡、字体、颜色、层级、缺失/多余元素和错误图表数据；
4. 写 `visual_qa.json`，绑定 PPTX SHA-256、render 目录、渲染页和实际检查页；
5. QA 非 PASS 时返回拥有问题的上游文件修复并重新生成。

`pptx_artifacts.json` 必须登记运行目录内每一个 PPTX。漏登记或缺 QA 即失败。

## 场景 1 图片成稿

同时逐页核对 `slide_plan.json` 的每个文字块、bbox、阅读顺序、数据、图表含义和元素位置。最终可见文字必须准确、完整、无乱码和占位符；错字、漏字、事实错误、跨区摆放或阅读顺序变化必须回到图片生成阶段重做，不能以“之后可以转可编辑版”为由放行。

生成 manifest 必须证明：每次场景 1 调用都携带与 `style_reference_plan.json` 完全一致的 `style_reference_ids`，并发生在 `style-reference-choice` 与 `gorden-generation-scope` 确认之后；A/B/C 的成功调用均为 `style-selection` 且只覆盖同一组代表页；正式页面调用均为 `formal-generation`，发生在 `style-choice` 后，只覆盖剩余页面；选中代表页的最终 PNG 与风格候选原图哈希一致，没有被正式生成阶段重做。

最终 PPTX 每页只能有一个覆盖全画布的 raster 图片对象。回读报告必须明确每页原生文字、原生对象和 SVG 均为 0，raster 为 1，且图片内部内容不可编辑。全量图片成稿及其 PPTX 通过视觉 QA 后，还必须取得绑定最终 PPTX 哈希的 `image-deck-final` 用户确认；该确认只允许后续新建场景 3，不会把当前运行改成可编辑重建。

## 模板任务

同时检查 Theme/Master/Layout、源格式、字体、字号、颜色、对象尺寸位置、表格/图表和未授权对象未变化。

## 重建任务

同时输出并实际查看 source、preview、side-by-side、blend 和 diff heatmap。主要元素中心偏差不超过页面尺寸 1%，尺寸偏差不超过 2%；像素差仅作诊断。

对场景 3 的每个 PNG 额外核对：真实 PNG 签名/结构、实际像素尺寸与计划一致、按放置区域计算的长边 1920 px 基准分辨率、无普通文字、计划/构建/回读的 asset ID 一致和不可编辑影响披露。全页背景/框架 PNG 必须先证明普通文字已清除；不得用双层重复文字掩盖未清理底图。场景 1 的整页 PNG 本来就包含最终文字，按上一节检查，不套用“无普通文字”规则。

使用 Gorden 时还要核对真实 imagegen manifest。场景 3 运行并检查 `layout_guard.py --strict`、`placement_qa.py` 和 `visual_compare_qa.py` 的产物；场景 1 按上一节检查生成阶段、页合同、逐字文字、位置和代表页复用。组件 QA 不能替代真实 PPTX 渲染；两套门禁任一失败都不得交付。

## 回读与可编辑性

重新打开或解析最终 PPTX，核对页数、顺序、关键文字、数值和对象类型。`editability_report.json` 逐页披露原生文本、原生对象、SVG、经允许 raster、无法恢复项和警告。

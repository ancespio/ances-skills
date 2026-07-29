# 质量门禁

## 所有 PPTX

每次生成 PPTX 后立即：

1. 用 PowerPoint、LibreOffice 或宿主认可的真实渲染器渲染全部页面；
2. 逐页以足够分辨率查看，不只看缩略图；
3. 检查溢出、越界、意外换行、遮挡、字体、颜色、层级、缺失/多余元素和错误图表数据；
4. 写 `visual_qa.json`，绑定 PPTX SHA-256、render 目录、渲染页和实际检查页；
5. QA 非 PASS 时返回拥有问题的上游文件修复并重新生成。

`pptx_artifacts.json` 必须登记运行目录内每一个 PPTX。漏登记或缺 QA 即失败。

## 模板任务

同时检查 Theme/Master/Layout、源格式、字体、字号、颜色、对象尺寸位置、表格/图表和未授权对象未变化。

## 重建任务

同时输出并实际查看 source、preview、side-by-side、blend 和 diff heatmap。主要元素中心偏差不超过页面尺寸 1%，尺寸偏差不超过 2%；像素差仅作诊断。

## 回读与可编辑性

重新打开或解析最终 PPTX，核对页数、顺序、关键文字、数值和对象类型。`editability_report.json` 逐页披露原生文本、原生对象、SVG、经允许 raster、无法恢复项和警告。

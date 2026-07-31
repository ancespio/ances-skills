# 场景 3：图片或 PDF 重建

## 锁定事实

输入可以是用户提供的图片、逐页 PDF 渲染，或已经通过 `image-deck-final` 确认的场景 1 逐页 PNG。以源页面为唯一版式事实，锁定页数、顺序、画布、可读文字、主要元素和相对布局。不得新建故事大纲或擅自改写内容。

写入 `reconstruction_plan.json`：每页源尺寸、文字块、非文字视觉、源像素 bbox、目标 fraction bbox、层级、置信度和目标实现方式。

读取 [gorden-integration.md](gorden-integration.md)。场景 3 只执行 `GordenImage2PPTX`，它是默认且必需的逐页重建执行器；先写入 `gorden_component.json`，保存能力探针并向用户说明无重试最低 `3N` 次 imagegen 的生成范围，对应每页 B2、B3、B4。Gorden 只接管 B1–B9 执行，不接管源内容锁定、用户确认和最终门禁。

若输入来自场景 1，必须在场景 1 完成图片型 PPTX 与逐页 PNG 的 `image-deck-final` 验收后，另建独立运行目录再开始。新运行写 `scene1_handoff.json`，逐项绑定上游 run ID、最终图片型 PPTX、`image-deck-final` 审批文件及每页 PNG 的路径与 SHA-256；用户确认该交接文件并形成 `start-reconstruction` 后才能进入原型。场景 3 必须拥有独立的计划、审批、原型、产物登记与 QA；禁止在场景 1 内自动串联，也不得复制场景 1 的审批文件冒充场景 3 已获确认。

## 文字优先

所有普通可读文字必须生成 PowerPoint 原生文本框。提取不确定、遮挡或无法辨认的文字必须进入 `uncertain_text[]`，向用户展示并确认；不得猜测，也不得把它藏入 SVG。

标题艺术字、Logo 字样或装饰性字形可作为一个 SVG 或 PNG 资产，但要在计划中说明其不可按普通文字编辑，提供可读文字替代说明，并通过 `artistic-text-assets` 确认门。

## 保真优先的视觉资产

不以格式统一代替视觉判断：

1. 普通文字始终使用原生文本框。
2. Gorden B2/B3/B4 生成的无文字背景、整体框架、图标、装饰和艺术字使用受控 PNG；默认保留整体 frame，不为局部可编辑机械切碎。
3. 照片、纹理、复杂插画、3D/透视画面、密集屏幕、阴影/渐变/光效和复杂图表以视觉相似性优先，不改画成通用图标或低质量原生形状。
4. 若用户明确要求某个简单视觉改为 SVG，可在 Gorden 原型之后单独提出替换计划并重新确认；这不是默认批量路径。

每个 PNG 必须在 `asset_plan.json` 记录页面、fraction bbox、视觉角色、来源类型、选择原因、可编辑性影响、实际像素尺寸和文字清理状态。进入原型前必须通过 `asset-plan` 与 `reconstruction-png-assets` 两道用户确认。

页级背景或整体框架 PNG 可以全页放置，但必须已验证清除普通文字，再叠加原生文本层。不得将包含原普通文字的整页截图垫底后重复叠字。

仍然禁止：

- JPG、WebP、GIF、BMP 或任何未登记 raster；
- SVG `<image>`、data URI raster 或外部 raster 链接；
- 把整页截图包进 SVG；
- noisy raster tracing；
- PNG 中固化普通文字，或将不确定文字藏进图像。

对例外 SVG 构建前运行 `scripts/validate_svg_assets.py <asset-or-dir>`；PNG 的文件类型、像素尺寸、计划登记、文字政策和构建/回读一致性由 `validate_contracts.py` 校验。Gorden 的 manifest 与三项 QA 脚本结果必须同时保留。

## 两页原型门

先制作一页文字密集页和一页视觉复杂页。两页都必须是可直接复用的正式 PPTX 页面，并满足：

- 普通文字原生可编辑；
- 视觉资产按计划使用 SVG/PNG，PNG 区域已单独确认；
- 无缺失/多余元素和错误换行；
- 主要元素中心偏差不超过页面尺寸的 1%；
- 主要元素尺寸偏差不超过 2%；
- 已实际查看 side-by-side、blend 和 diff heatmap。

像素差只用于定位，不自动判断语义正确。用户确认两页后才批量重建。

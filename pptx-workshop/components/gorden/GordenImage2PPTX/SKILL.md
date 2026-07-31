---
name: GordenImage2PPTX
description: >-
  执行 PPTX Workshop 场景 3：把图片、逐页 PDF 渲染或已确认的场景 1 PNG
  重建为普通文字原生可编辑、复杂视觉以保真 PNG 分区承载的 PPTX。
  只执行父流程已批准的逐区域资产方法、文字回填、合成和逐页 QA；不重新策划或改变风格。
---

# GordenImage2PPTX

本组件以视觉相似性优先，普通文字可编辑优先。它不追求把复杂图案机械拆成大量 PowerPoint 形状，也不默认让 imagegen 重画整页背景、框架和图标。

## PPTX Workshop 组件合同

1. 只由独立的场景 3 调用；场景 1 不得在同一 run 内串联本组件。
2. 开始前必须确认宿主确实提供可调用的 raster imagegen 能力。父探针中的 `imagegen_required: true` 只是需求声明，不是能力证明；无能力时在规划与用户确认前阻断。
3. 必须已经确认 `reconstruction_plan.json`、`asset_plan.json`、`gorden_component.json`、不确定文字、PNG 资产范围和两页原型范围。来自场景 1 时还需确认 `scene1_handoff.json` 与 `start-reconstruction`。
4. 本组件不得新增、删除或改写页面内容，不得重新决定区域、资产方法、版式或风格。
5. `RUN_ROOT` 固定等于父合同指定的 `<run>/work/gorden/image2pptx/`。全部源页映射、中间资产、prompt、layout、preview、QA 和输出都留在父 run 内；不得创建 `$PWD/image2pptx_runs/` 或读取其他任务目录。
6. generation manifest 写入父 run 的 `manifests/gorden-generation.json`。组件 QA 不能替代父流程对每个 PPTX 的真实渲染、`visual_qa.json` 和对象回读。

## 可编辑性边界

- 普通标题、正文、数字、日期、标签、表格文字：PowerPoint 原生文本框。
- 无普通文字的复杂视觉：受控 PNG，可整体移动、替换和缩放，不宣称对象级可编辑。
- 必须去字的复杂视觉：经批准后用 imagegen 生成局部无文字 PNG。
- 简单视觉或艺术字 SVG：只有用户明确要求并重新确认时使用；艺术字必须转曲，任何 `<text>` 都失败。
- 不使用大量小 shape 机械重画复杂插画、图表、纹理、阴影、渐变或透视画面。

## 三种区域方法

每个非文字资产必须在 `asset_plan.json` 选择且只能选择一种方法。

### `source-preserved-png`

用于锁定源页中已经确认不含普通文字的复杂区域。

- `source_kind` 必须为 `extracted`。
- 用 `source_region.page_id` 和整数 `bbox_px:[x,y,w,h]` 绑定源页。
- 只做无损像素裁取，不重画、不重采样、不调色、不补内容。
- 输出必须与该源区逐像素一致；使用 `scripts/extract_source_region.py` 创建并校验。
- 禁止把含普通文字的整页截图或区域用此方法垫底后再叠字。

### `imagegen-detexted-png`

只用于普通文字与复杂视觉交织、必须先去字且原生方法无法保真的区域。

- `source_kind` 必须为 `generated`。
- 每个资产对应至少一次 `purpose: visual-region` 的真实 imagegen 调用。
- 调用必须记录 `asset_id`、`page_id`、锁定源页 SHA-256、完整 prompt、provider/model、时间、输出路径与 SHA-256。
- 调用前先显示当前锁定源页，使其成为唯一 edit target；prompt 明确区域 bbox、需保留的视觉和需移除的普通文字。
- 不得把源图仅当风格参考，也不得用路径字符串冒充传图。
- 不得一次重画整页 background/frame/icons 来代替逐区域决策。

### `approved-svg`

只用于用户明确要求改为 SVG 的简单视觉或艺术字资产。运行父流程 `validate_svg_assets.py`；艺术字先转曲，不得含 `<text>`、raster、脚本或动画。

## 每页执行流程

1. 打开 `reconstruction_plan.json` 中本页 `source_image`，核对路径、SHA-256、真实像素尺寸和页序。
2. 按 `asset_plan.json` 列出全部视觉区域、目标 bbox、方法、文字政策和 asset ID；计划外区域停止并回父流程重新确认。
3. 对 `source-preserved-png` 运行无损裁取并校验逐像素一致。
4. 对 `imagegen-detexted-png` 逐资产执行 imagegen；只处理批准区域，保留真实生成证据。
5. 用 GPT 视觉读取普通文字，逐字写入原生文本框；不确定字符回到父流程，不猜测，不藏入 PNG/SVG。
6. 以源图实际像素 bbox 换算 `x/y/w/h`；确定字体、字号、粗细、行距后再回校位置。
7. 运行 `layout_guard.py --strict`，再运行 `placement_qa.py` 并实际查看源图框和预览框。
8. 合成 PPTX 与预览，运行 `visual_compare_qa.py`，实际查看 source、preview、side-by-side、blend 和 diff heatmap。
9. 修复本页问题后重跑三项 QA；通过后再处理下一页。

完整字段与命令见 [image-to-pptx.md](references/image-to-pptx.md)，运行时要求见 [runtime-notes.md](references/runtime-notes.md)。

## 逐页 QA 硬门禁

`manifests/gorden-generation.json.qa_results[]` 的唯一键是 `(tool,page_id)`。preview 阶段至少覆盖两页原型（不足两页则覆盖全部）；final 阶段覆盖全部计划页。每页都必须恰好包含：

- `layout_guard`
- `placement_qa`
- `visual_compare_qa`

`visual_compare_qa` 的 `checks` 必须逐页实际判定，以下四项全部为 `false` 才能写 `status: pass`：

- `text_overlap`
- `critical_structure_drift`
- `major_alignment_drift`
- `major_color_drift`

任何文字重叠、关键结构变形、主要元素明显错位或颜色显著漂移都必须返工。不得使用 `pass_with_declared_fidelity_gap`、备注或平均像素指标放行。像素差只用于定位，不自动决定语义正确。

## 最低 imagegen 调用量

最低调用量等于批准的 `imagegen-detexted-png` 资产数；全部区域可安全原样保留时可以为 0。重试另计。即使最低次数为 0，开始场景 3 前仍须确认宿主具备真实 imagegen 能力，以便计划中的去字区域或返工需要使用。

## 依赖与脚本

| 脚本 | 用途 |
|---|---|
| `scripts/extract_source_region.py` | 无损裁取并校验 source-preserved PNG |
| `scripts/layout_guard.py` | 校验源尺寸、bbox、坐标和文字样式 |
| `scripts/placement_qa.py` | 把文本/视觉 bbox 画回源图与预览 |
| `scripts/visual_compare_qa.py` | 生成并排、叠图、差异热图和诊断指标 |
| `scripts/compose_pptx.py` | 合成原生文字与批准视觉资产 |
| `scripts/chroma_key.py`、`slice_grid.py` | 仅在批准的 imagegen 资产确需去底/切分时使用 |

依赖为 Python、`python-pptx`、Pillow 和 NumPy。缺失时停止并报告，不自动安装。

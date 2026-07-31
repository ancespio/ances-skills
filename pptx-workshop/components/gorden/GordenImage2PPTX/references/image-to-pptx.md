# 场景 3：逐区域保真重建

本流程把锁定源页重建为“普通文字原生可编辑 + 复杂视觉区域可替换”的 PPTX。视觉相似性优先；不默认重画整页，也不把复杂图案机械拆成通用图标或大量 shape。

## 1. 父流程输入

开始执行前必须存在并已确认：

- `plans/reconstruction_plan.json`
- `plans/asset_plan.json`
- `plans/gorden_component.json`
- `approvals/asset-plan.json`
- `approvals/reconstruction-png-assets.json`（存在 PNG 时）
- `approvals/gorden-generation-scope.json`
- 不确定文字与艺术字对应审批（适用时）

来自场景 1 时，`scene1_handoff.pages[].path` 必须继续指向上游原始 PNG，不能复制到新 run 后替换路径。

## 2. 运行目录

父 `gorden_component.json` 的 stage 必须声明：

```json
{
  "component": "GordenImage2PPTX",
  "output_root": "work/gorden/image2pptx",
  "manifest_path": "manifests/gorden-generation.json"
}
```

因此：

```text
RUN_ROOT=<run>/work/gorden/image2pptx/
```

建议结构：

```text
work/gorden/image2pptx/
├── pages/P01/
│   ├── layout.json
│   ├── assets/
│   ├── prompts/
│   └── qa/
├── out/
└── preview/
```

不得使用 `$PWD/image2pptx_runs/`，不得从历史 `editable/01`、`out/` 或 `qa/` 读取同名文件。

## 3. 锁定源页

每页在 `reconstruction_plan.slides[]` 记录：

```json
{
  "id": "P01",
  "source_page": 1,
  "source_image": {
    "path": "sources/page-01.png",
    "sha256": "<64-hex>"
  },
  "ref_width": 1920,
  "ref_height": 1080,
  "objects": []
}
```

`source_image` 是当前页唯一版式事实。每次 imagegen 前重新打开当前页；多页任务不得共享模糊的“上一张图”引用。

## 4. 资产决策

### 4.1 原样保留源区

适用于已确认不含普通文字、但用原生/SVG 重画会降低保真的复杂区域：

```json
{
  "id": "visual-P01-01",
  "pages": ["P01"],
  "asset_type": "png",
  "source": "work/gorden/image2pptx/pages/P01/assets/visual-01.png",
  "visual_role": "other-complex-visual",
  "source_kind": "extracted",
  "reconstruction_method": "source-preserved-png",
  "source_region": {
    "page_id": "P01",
    "bbox_px": [120, 180, 640, 420]
  },
  "bbox": [0.0625, 0.166667, 0.333333, 0.388889],
  "contains_semantic_text": false,
  "ordinary_text_in_asset": false,
  "semantic_text_policy": "none",
  "text_removal_status": "verified-clean",
  "pixel_width": 640,
  "pixel_height": 420,
  "selection_reason": "原样保留复杂视觉比重画更接近源页",
  "editability_impact": "区域可整体替换，内部对象不可单独编辑"
}
```

执行：

```text
python scripts/extract_source_region.py <source.png> <output.png> --bbox 120 180 640 420
```

脚本输出必须与源区逐像素一致。不能对其调色、降噪、重采样或补画。
所有 PNG 的归一化目标 `bbox` 必须与 `source_region.bbox_px` 指向同一位置和尺寸；只允许坐标换算产生的最多 1 个源像素误差，不能把裁对的区域移到别处。

### 4.2 imagegen 去字区域

适用于文字与复杂视觉交织且无法直接保留的区域。asset plan 使用：

```json
{
  "source_kind": "generated",
  "reconstruction_method": "imagegen-detexted-png",
  "source_region": {"page_id": "P01", "bbox_px": [760, 180, 980, 620]}
}
```

每次调用必须：

1. 打开 `P01.source_image`，确认它是唯一 edit target；
2. prompt 写明 asset ID、源 bbox、保留内容、移除哪些普通文字、禁止改变结构/比例/颜色；
3. 只生成该区域，不重画整页；
4. 输出路径与 asset plan 的 `source` 完全一致；
5. manifest 记录 `purpose: visual-region`、`asset_id`、`page_id`、`source_page_sha256`、prompt、provider/model、时间、输出哈希。

示例调用记录：

```json
{
  "id": "call-P01-visual-02-01",
  "purpose": "visual-region",
  "workflow_phase": "reconstruction",
  "page_id": "P01",
  "asset_id": "visual-P01-02",
  "source_page_sha256": "<64-hex>",
  "provider": "<provider>",
  "model": "<model>",
  "prompt": "<完整 prompt>",
  "generated_at": "<ISO-8601>",
  "status": "succeeded",
  "output_path": "work/gorden/image2pptx/pages/P01/assets/visual-02.png",
  "output_sha256": "<64-hex>"
}
```

## 5. 普通文字

直接使用视觉能力逐字读取当前锁定源页，记录内容、源像素 bbox、字号、颜色、粗细、对齐和阅读顺序。普通文字必须进入 `texts[]`；不使用外部 OCR 输出作为最终文字，不猜测不确定字符。

坐标换算：

```text
x = x_px / ref_width
y = y_px / ref_height
w = w_px / ref_width
h = h_px / ref_height
size_ratio = text_height_px / ref_height
```

缩略图坐标必须先按宽高比例分别换回源图像素。先锁定字体、字号、粗细和行距，再回校 bbox，避免样式变化造成再次换行。

艺术字不进入普通 `texts[]`。PNG 艺术字走相应资产方法并确认；SVG 艺术字必须转曲且不含 `<text>`。

## 6. 合成前检查

每页执行：

```text
python scripts/layout_guard.py <source.png> <layout.json> --strict
python scripts/placement_qa.py <source.png> <layout.json> --slide-index 1 --out-dir <qa-source-boxes>
```

打开源图标框图，确认每个 bbox 圈住正确文本或视觉对象。guard 通过只表示数学一致，不表示量对了对象。

## 7. 合成与逐页视觉检查

```text
python scripts/compose_pptx.py <layout-or-deck.json> <out.pptx> --preview-dir <preview>
python scripts/placement_qa.py <source.png> <layout.json> --slide-index 1 --preview <preview.png> --out-dir <qa-placement>
python scripts/visual_compare_qa.py <source.png> <preview.png> --out-dir <qa-visual>
```

实际打开 source、preview、side-by-side、blend、diff heatmap；逐项检查：

- 普通文字内容、换行、字号、基线和边界；
- 文字与图标/装饰是否重叠；
- 关键框架、图表、卡片和连接关系是否变形；
- 主要元素中心、尺寸和相对间距；
- 颜色、渐变、阴影和层级；
- 缺失、多余或重复元素。

像素指标用于定位，不能自动替代语义判断。任何关键缺陷都返工，不得以“中等保真”或 `pass_with_declared_fidelity_gap` 放行。

## 8. QA manifest

每页登记三项，唯一键为 `(tool,page_id)`：

```json
{
  "page_id": "P01",
  "tool": "visual_compare_qa",
  "status": "pass",
  "report_path": "work/gorden/image2pptx/pages/P01/qa/visual/report.json",
  "report_sha256": "<64-hex>",
  "checks": {
    "text_overlap": false,
    "critical_structure_drift": false,
    "major_alignment_drift": false,
    "major_color_drift": false
  }
}
```

`layout_guard` 与 `placement_qa` 同样记录 `page_id`、report 路径和 SHA-256。preview 至少覆盖两页原型；final 覆盖全部页面。

## 9. 最终交付

- 每个生成的 PPTX 都登记到 `pptx_artifacts.json`，立即真实渲染并写 `visual_qa.json`。
- 回读普通文字、raster/SVG 数量、asset ID 与页序，写 `editability_report.json`。
- 明确披露 PNG 内部对象不可单独编辑。
- 任一逐页 QA、父级视觉 QA 或对象回读失败，都不得交付。

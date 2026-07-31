# Image2PPTX 运行时说明

本说明只服务 PPTX Workshop 场景 3。父流程决定内容、区域方法和用户门禁；本组件只执行已批准任务。

## 1. imagegen 能力前置

进入规划前先确认宿主确实存在可调用的 raster imagegen 工具。`backend_probe.py` 只能检查本地依赖和组件文件，不能证明宿主有 imagegen。无能力时立即阻断，不自动安装、不以 PIL/SVG/HTML/Canvas 冒充。

场景 3 的最低 imagegen 次数按 `imagegen-detexted-png` 区域数计算，可能为 0；但宿主能力仍须在开始前确认。

## 2. 运行根

`RUN_ROOT` 必须直接使用父合同的：

```text
<run>/work/gorden/image2pptx/
```

不得使用 `$PWD/image2pptx_runs/`，不得把输出写到父 run 外。manifest 固定写入 `<run>/manifests/gorden-generation.json`。

## 3. 源图与 edit target

- 每页使用 `reconstruction_plan.slides[].source_image` 的路径、哈希和尺寸。
- 多页逐页处理；调用前重新打开当前页。
- imagegen prompt 必须把当前源页指定为唯一 edit target，并明确 asset ID 与源 bbox。
- 只写本地路径不等于传图；仅作风格参考也不合格。

## 4. 源区保留

`source-preserved-png` 只允许对无普通文字区域做无损像素裁取。使用 `extract_source_region.py`；输出不调色、不缩放、不补画。validator 会逐像素比较锁定源区与输出。

## 5. imagegen 去字

`imagegen-detexted-png` 每个资产至少有一次真实调用证据，输出路径必须等于 asset plan 的 `source`。失败重试保留记录；只有成功输出可进入构建。

去底和切片只适用于该已批准生成资产确有需要的情况：

- `chroma_key.py --preset frame-safe`：细线/框架类；
- `chroma_key.py --preset icon-safe`：图标/艺术字；
- `slice_grid.py`：只切已批准生成的图标表，不切源页来规避 asset plan。

## 6. 文字与坐标

- 普通文字由视觉能力逐字读取，写成原生文本框。
- bbox 使用源图真实像素坐标；缩略图测量先换回源图。
- 合成前运行 `layout_guard.py --strict`，并实际查看 `placement_qa.py` 的源图标框。

## 7. QA

每页分别运行 layout、placement、visual compare 三项 QA，并在 manifest 写 `page_id`。`visual_compare_qa.py` 的数值只作诊断；执行者实际查看图像后，四类关键缺陷全部为 false 才能 pass。

组件 QA 通过后仍须按父流程真实渲染每个 PPTX、写 `visual_qa.json` 并回读对象。

## 8. 依赖

需要 Python、`python-pptx`、Pillow 和 NumPy。缺失时停止并报告，不自动安装。只有用户明确要求 CLI/API 后端时才说明凭据和成本；不得自行读取、迁移或回显凭据。

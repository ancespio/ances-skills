# Image2PPTX 运行时说明

本页只服务 PPTX Workshop 场景 3：把用户图片、逐页 PDF 渲染或已确认的场景 1 PNG 重建为普通文字原生可编辑、视觉资产分层的 PPTX。它不执行场景 1，不读取风格图库，也不生成新的设计风格。

## 1. 前置门禁

调用 imagegen 前必须完成：

- 锁定源页数、顺序、画布、可读文字和相对布局；
- 确认 `reconstruction_plan.json`；
- 确认不确定文字；
- 预登记并确认 `asset_plan.json`；
- 确认 `gorden-generation-scope`；
- 选定一页文字密集页和一页视觉复杂页作为原型。

用户说“直接生成”或“不用确认”也不能跳过这些步骤。输入来自场景 1 时，还必须验证 `scene1_handoff.json` 和 `start-reconstruction`。

## 2. 后端解析

1. 用户明确指定可用图片后端时使用该后端。
2. Codex 运行时使用本地 `imagegen` skill 及其图片编辑/生成能力。
3. 其他运行时使用其原生 raster 图片生成工具。
4. 没有可用后端时停止并报告，不自动安装依赖，也不用代码绘图降级。

B2/B3/B4 必须使用真实 imagegen。禁止用 SVG、HTML、Canvas、PIL、PowerPoint shapes、填充色块或源图局部裁切冒充生成层。

## 3. 每页 edit target

每页、每个 B2/B3/B4 调用前：

1. 用 `view_image` 打开当前页源图；
2. 明确这张图是唯一 edit target，而不是风格参考；
3. prompt 指定当前目标层：background、frame 或 icons；
4. 一页完成后再切换到下一页，禁止跨页复用错误源图。

只在 prompt 中写本地路径不等于传图。产物无法证明基于当前源页提取时，该层失败。

## 4. Codex 图片落盘与证据

- 一次调用生成一张图；background、frame、icons 分别调用。
- 将选定结果复制到本次唯一 `RUN_ROOT/editable/NN/`，并保留生成源图。
- 每页可保留组件级 `imagegen-assets-manifest.json`。
- 同时汇总到父流程 `manifests/gorden-generation.json`，purpose 使用 `background`、`frame`、`icons`，`workflow_phase` 固定为 `reconstruction`，并记录页面、provider、model、完整 prompt、时间、状态、输出路径和 SHA-256。
- 不得读取固定 `editable/01`、`out/`、`qa/` 或其他任务目录中的同名资产。

## 5. 文字、坐标与 QA

- 普通文字由 GPT 视觉读取并写入原生文本框，不使用外部 OCR 结果作为最终文字。
- bbox 必须来自源图实际像素坐标；在缩略图上量测时，按宽高比例分别换回源图坐标。
- 推荐用 `size_ratio = 文字实际像素高度 / ref_height`，或直接使用确认的 PowerPoint pt 字号。
- 合成前运行 `layout_guard.py --strict`。
- 合成后运行 `placement_qa.py` 与 `visual_compare_qa.py`，并打开其标注图、并排图、叠图和差异图。
- 三项 QA 的 pass 报告路径与 SHA-256 写入统一 generation manifest；它们不能替代父流程的全量 PPTX 渲染与 `visual_qa.json`。

## 6. 抠图与比例

- 框架使用 `chroma_key.py --preset frame-safe --scale 2`。
- 图标和艺术字使用 `chroma_key.py --preset icon-safe --scale 2`。
- 原图含绿色时改用原图不存在的纯色抠图底，并在生成与去底步骤保持一致。
- 画布比例由源图决定，background、frame、icons、layout 和 PPTX 必须一致。
- 只允许裁切或缩放整张 imagegen 生成图以统一比例；不得裁源图局部冒充资产。

## 7. CLI 例外

只有用户明确要求使用 CLI/API 时才切换到相应图片生成脚本，并在调用前说明需要的凭据和成本。不得自行读取、迁移或回显凭据。

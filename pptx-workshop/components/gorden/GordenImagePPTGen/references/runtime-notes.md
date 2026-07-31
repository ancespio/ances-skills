# ImagePPTGen 运行时说明

本页只说明 PPTX Workshop 场景 1 的图片生成运行时。它不包含图片重建、抠图、OCR 或可编辑 PPTX 流程。

## 1. 后端解析

1. 用户明确指定可用图片后端时使用该后端。
2. Codex 运行时使用本地 `imagegen` skill 及其图片生成工具。
3. 其他运行时使用其原生 raster 图片生成工具。
4. 没有可用后端时停止并报告，不自动安装依赖，也不用代码绘图降级。

禁止用 SVG、HTML、Canvas、PIL、PowerPoint shapes 或截图渲染冒充图片生成；禁止在已生成位图上用代码补字。

## 2. 阶段感知调用

### 风格选择阶段

- 只有完整文字、文字 bbox 和全量无风格版式已经确认后才能开始。
- 先检查内置风格目录，并取得绑定 `style_reference_plan.json` 的 `style-reference-choice`；没有确认时不得调用 imagegen。
- 对同一组代表页分别生成 A/B/C 三套图片。
- 调用 purpose 分别为 `style-option-a`、`style-option-b`、`style-option-c`，`workflow_phase` 统一为 `style-selection`。
- 三套方案共享完全相同的文字、位置、阅读顺序和内容区，只改变风格变量。
- 每次调用携带完全相同的已确认 `style_reference_ids`，不得引入未确认风格。
- 在用户确认 `style-choice` 前，不得生成其余正式页面。

### 正式生成阶段

- 只处理未被选中代表页覆盖的剩余页面。
- 调用 purpose 为 `final-page`，`workflow_phase` 为 `formal-generation`。
- prompt 继承已选风格，并继续绑定该页的全部文字和 bbox。
- 不得重新选择风格、重新策划或重生成已选代表页。

## 3. Codex 图片落盘

- 一次调用生成一张图片；不同页面和不同风格方向分别调用。
- 内置工具的原始结果通常位于 `$CODEX_HOME/generated_images/`。
- 将选定结果复制到本次唯一 `RUN_ROOT`：
  - 风格候选：`work/gorden/image-deck/style-options/<a|b|c>/`；
  - 正式剩余页：`work/gorden/image-deck/final-pages/`。
- 保留生成源图，不把唯一副本留在工具默认目录。
- 在 `manifests/gorden-generation.json` 登记 `workflow_phase`、当前 slide contract 的 SHA-256、`style_reference_ids`、完整 provenance、输出路径和 SHA-256。

## 4. Prompt 与文字

- 每个可见文字块都逐字写入 prompt，不能只写摘要。
- 同时写入该文字块的 `[x,y,w,h]` fraction bbox、阅读顺序和层级。
- 生僻字可逐字拆分强调，但不得改变文字内容。
- 任何错字、漏字、乱码或占位文字都判失败，修改 prompt 后重生成对应图片。
- 位置允许在已确认 bbox 内做视觉微调，但不得交换模块、改变阅读顺序或侵入装饰安全区。

## 5. 比例与尺寸

比例由用户或父合同决定，默认仅在用户没有指定时使用 16:9。整次运行的版式预览、风格候选、正式页面和 PPTX 画布必须一致。

| 画布 | 建议尺寸 |
|---|---|
| 16:9 | 2048×1152 |
| 3:2 | 1536×1024 |
| 4:3 | 1600×1200 或等比例高分辨率 |

后端不能直接生成目标比例时，先在 prompt 中保留安全边，再只对整张生成图做等比例裁切；不得借裁切重排内容。

## 6. CLI 例外

只有用户明确要求使用 CLI/API 时才切换到相应图片生成脚本，并在调用前说明需要的凭据和成本。不得自行读取、迁移或回显凭据。

---
name: GordenImagePPTGen
description: >-
  执行 PPTX Workshop 场景 1 的图片型 PPT 生产。在逐页完整文字、文字大致位置、无风格版式预览和生成范围均已确认后，
  先为同一组代表页生成 A/B/C 三套风格图片供用户选择，再复用选中代表页并只生成其余页面，最终合成为每页一张全幅 PNG 的图片型 PPTX。
  不负责重新策划、扩写内容、决定版式或替用户选择风格。
---

# GordenImagePPTGen

本组件只执行 `pptx-workshop` 场景 1 已确认的图片生产合同，不是独立策划入口。可使用内置风格参考库，但必须先由父流程展示并取得用户确认，不能把图库变成默认输入。

## PPTX Workshop 组件合同

- 只接受父运行已确认的 `slide_plan.json`、`style_reference_plan.json`、`asset_plan.json`、`gorden_component.json` 与审批文件；不得在组件内重做内容、版式或风格决策。
- 所有输出写入父 `gorden_component.json` 指定的 `<run>/work/gorden/image-deck/`，统一 generation manifest 写入父 run；不得创建组件外独立任务根。
- 任何 imagegen 调用只能发生在 `gorden-generation-scope` 之后；组件 QA 不能替代父流程每个 PPTX 的真实渲染、视觉检查与对象回读。

## 必需输入

开始任何 imagegen 调用前，确认：

1. `brief.json → evidence_plan.json → outline.json → slide_plan.json` 已确认。
2. `slide_plan.json` 已逐页锁定：
   - 每个可见文字块的完整最终文字；
   - 每个文字块的大致位置与范围，使用同一画布上的 `[x, y, w, h]` fraction bbox；
   - 阅读顺序、层级、内容区、资产预留区和装饰安全区。
3. 覆盖全部页面的无风格 `layout-preview.pptx` 已渲染、检查并由用户确认。
4. 内置/用户参考已展示，`style_reference_plan.json` 与 `style-reference-choice` 已确认。
5. `asset_plan.json`、`gorden_component.json` 和 `gorden-generation-scope` 已确认。

缺少任一输入时停止；不得自行补写文字、改版式或先生成图片试探。

## 阶段 1：风格选择

风格代表页的 imagegen 调用全部属于风格选择阶段，不属于正式批量生成。

1. 设最终页数为 `N`，代表页数为 `R=min(N,3)`。
2. 从实际页面中映射封面、常规页、复杂页等最多三个不同角色。
3. 读取 `style_reference_plan.json` 的 `selected_ids` 与 `usage_mode`，据此提出 A/B/C 三个落地方向。单一参考时比较同一视觉语言的不同落地；融合参考时比较不同权重。三者只改变配色、字体气质、图形语言、材质、留白和装饰，不引入未确认风格。
4. 对同一组 `R` 页分别生成 A/B/C 图片：
   - 使用完全相同的最终文字；
   - 遵守相同的大致 bbox、阅读顺序和内容区；
   - 不增删模块，不改变信息密度，不重新设计版式。
5. 在 `manifests/gorden-generation.json` 中分别记录 `style-option-a`、`style-option-b`、`style-option-c`，把 `workflow_phase` 固定为 `style-selection`，并逐次记录同一组 `style_reference_ids`。
6. 将三套代表页分别合成为可复用图片型 PPTX，真实渲染并逐页检查，再等待用户 `style-choice`。

选中的 `R` 张代表页就是最终页资产，后续不得重新生成。

## 阶段 2：正式生成

只有 `style-choice` 确认后才能进入正式生成。

1. 从最终页清单中排除已选中的 `R` 张代表页。
2. 只为剩余 `N-R` 页编译 prompt 并调用 imagegen，purpose 记为 `final-page`，`workflow_phase` 固定为 `formal-generation`。
3. 每页 prompt 必须继承选定风格，同时逐字使用该页已锁定文字和大致 bbox。
4. 不得重新提供未确认风格选项，不得扩写内容、调整信息密度或改变版式。
5. 错字、漏字、乱码、占位文字、事实偏差或明显越出已确认位置时，只重生成对应页面。

最低调用量为 `3R+(N-R)=N+2R`；正常 `N>=3` 时为 `N+6`。重试另计。

## 阶段 3：合成与终验

1. 按 `slide_plan.json` 的页序组合：
   - 选中风格代表页的原始 PNG；
   - 正式生成阶段产生的剩余页面 PNG。
2. 用 `scripts/compose_pptx.py` 合成为每页一张全幅 PNG 的图片型 PPTX。
3. 真实渲染全部页面，逐页检查文字、位置、风格一致性、裁切和清晰度。
4. 回读 PPTX，确认每页只有一张覆盖全画布的 PNG。
5. 明确披露图片内部文字和图形不可编辑，并取得 `image-deck-final` 确认。

场景 1 到此结束。需要可编辑版本时，另开场景 3；不得在本组件中调用 `GordenImage2PPTX` 或 `GordenSuperPPTSkill`。

## Prompt 合同

读取 [image-prompt-guide.md](references/image-prompt-guide.md)。每个 prompt 必须包含：

- 页面 ID 与阶段：`style-option-a|b|c` 或 `final-page`；
- 已确认的全部可见文字，逐字给出；
- 每个文字块的 bbox JSON 字面量、阅读顺序和层级；`text` 与 bbox 必须从同一 `content_blocks[]` 项逐字编译，compact 或默认带空格 JSON 均可，例如 `block={"text":"年度收入 12.6 亿元","bbox":[0.08,0.22,0.36,0.12]}`；
- 已确认的资产区域与装饰安全区；
- 当前候选风格或已选风格的明确视觉属性；
- 已确认参考 ID、使用方式及只读预览/样例路径；
- 禁止新增文字、占位符、模块和版式变化的约束。

不得只给主题、摘要或 `visual_generation_prompt` 就出图。

## imagegen 与证据

- 必须使用真实 raster 图像生成后端；禁止用 SVG、HTML、Canvas、PIL、PowerPoint shapes 或截图渲染冒充 imagegen。
- 禁止在生成图片上用代码补字、盖字或局部重画；修正只能重生成该页。
- 将选定生成结果复制到唯一 `RUN_ROOT`，同时保留生成源图。
- 每次调用写入 `manifests/gorden-generation.json`：`purpose`、`workflow_phase`、`page_id`、当前 slide contract 的 SHA-256、已确认 `style_reference_ids`、provider、model、完整 prompt、时间、状态、输出路径和 SHA-256。
- 正式阶段不得为代表页写成功的 `final-page` 调用。

运行时差异见 [runtime-notes.md](references/runtime-notes.md)。

## 脚本与依赖

| 脚本 | 用途 |
|---|---|
| `scripts/compose_pptx.py` | 将逐页 PNG 按页序合成为全幅图片型 PPTX，并可输出预览 |

依赖为 `python3`、`python-pptx` 和 `Pillow`。缺失时停止并报告，不自动安装。

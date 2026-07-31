---
name: pptx-workshop
description: 策划并生成图片型演示文稿，以及模板填充、图片或 PDF 可编辑重建、参考稿创作和已有 PPTX 续写修改。用于用户要求从资料制作图片版 PPT、按原生模板填内容、把图片/PDF 还原成可编辑 PPTX、参考已有演示稿制作新稿、或在已有 PPT 上新增和修改页面时。强制先策划和确认，每个生成的 PPTX 都必须渲染并视觉检验。
---

# PPTX Workshop

把用户请求路由到五个场景之一。用户只需说明想得到什么；不要要求用户理解 route、JSON、SVG、OOXML 或 PowerPoint 对象模型。

## 先选择场景

读取 [scenarios.md](references/scenarios.md) 与 [routing.md](references/routing.md)，只选择一个主场景：

1. 根据资料从 0 制作。
2. 按原生 PPTX 模板填充。
3. 把图片或 PDF 重建成真实 PPTX。
4. 参考 PPTX 或图片制作新稿。
5. 在已有 PPTX 上续写或修改。

只有高风险歧义才询问。缺少的信息若只影响局部审美，说明假设后继续；若会改变事实、页数/顺序、模板保留、对象修改范围或资产类型，先询问。

## 执行共同工作流

读取 [global-workflow.md](references/global-workflow.md) 与 [planning-contracts.md](references/planning-contracts.md)，并遵守：

1. 创建唯一运行目录；源文件保持只读。
2. 写入 `project.json` 与场景要求的策划合同。
3. 完成当前场景规定的用户确认门；不得用代理委托、默认同意或命令行 `--force` 代替用户确认。
4. 先生成规定的版式预览或代表页 PPTX。
5. 每生成一个 PPTX，立即真实渲染、逐页检查并写 `visual_qa.json`。
6. 代表页和视觉检查通过后才批量构建。
7. 回读最终 PPTX，写 `editability_report.json`，再运行 final validator。

运行：

```text
python scripts/validate_contracts.py <run-dir> --phase plan|preview|final
```

策划与交付合同的机器字段定义统一收录在 [Schema 索引](references/schemas/README.md)；不得在 `references/` 根目录散放新的 `*.schema.json`。

## 硬门禁

读取 [approval-gates.md](references/approval-gates.md)、[assets-fonts.md](references/assets-fonts.md)、[style-library.md](references/style-library.md) 与 [quality-gates.md](references/quality-gates.md)。以下规则不可绕过：

- 场景 1/4 必须先完成 `brief.json → evidence_plan.json → outline.json → slide_plan.json`；`slide_plan.json` 必须逐页锁定每个可见文字块的完整文字、`[x,y,w,h]` 大致位置、阅读顺序和装饰安全区。
- 场景 1/4 和场景 5 的任何新增页面，必须先交付覆盖全部新增页面的无风格版式布局 PPTX，并由用户确认。
- 场景 1 在全量版式确认后必须检查内置风格库，主动展示 3–6 个最相关的可视化候选，并允许用户改用自带参考或自定义方向。用户通过 `style_reference_plan.json` 与 `style-reference-choice` 确认参考后，才为同一组 `R=min(N,3)` 个代表页生成 A/B/C 三套可直接复用的图片生产稿；不得静默套用任何样例。用户再选中实际代表稿后，代表页原图直接进入最终成稿，正式生成阶段只补齐其余 `N-R` 页。
- 场景 1 的最终产物是逐页 PNG 与每页一张全幅图片的 PPTX；图片内部文字和图形不声明可编辑。
- 场景 2 先确认模板分析、适配报告和 fill plan，再生成代表页。
- 场景 3 锁定源页数、顺序、文字与布局；先确认不确定文字，再生成一页文字密集和一页视觉复杂原型。
- 场景 4 由参考稿锁定风格；多个冲突参考必须由用户指定主参考，不重新进行风格三选一。
- 场景 5 先确认对象级 change plan；局部修改只改目标页副本，默认在原页后保留修改副本。
- 默认可以搜索外部信息，但候选证据只有经用户确认后才能进入正式稿。
- 任何进入最终稿的图片、SVG 或艺术字资产都必须先列入资产计划并确认；风格选择阶段未入选的 A/B/C 候选图记录在生成 manifest 中，不作为最终资产。计划外最终资产必须重新确认。
- 场景 1/3 使用内置 Gorden 组件前，必须向用户说明页数、至少 imagegen 调用次数、时间/额度影响并确认 `gorden-generation-scope`。
- 用户需要把场景 1 成品转为可编辑版本时，先完成并确认图片版，再以逐页 PNG 为只读源新建独立场景 3；新运行必须用 `scene1_handoff.json` 与 `start-reconstruction` 绑定上游终验和逐页哈希，不得在场景 1 内自动串联 Image2PPTX。
- 场景 1 图片里的全部可见文字必须与已确认策划一致；错字、漏字、乱码或占位文字必须重生成图片，不得留给未来的场景 3 修正。最终图片型 PPTX 还必须通过 `image-deck-final` 用户确认。
- 缺失字体不得自动替换；先报告，再由用户确认候选字体或资产替代方案。
- 不增加动画、转场、旁白、音频或视频。

## 对象与资产边界

除场景 1 明确交付图片型 PPTX 外，普通标题、正文、数字、日期、标签和表格文字优先使用 PowerPoint 原生文本对象。不要为了“原生”而用大量小形状机械重画复杂插画。

- 场景 1：最终每页为一个全幅 PNG 图片对象；源资产与生成过程仍须按 `asset_plan.json` 确认。
- 场景 4：允许使用经审批的 SVG 或栅格图片资产。
- 场景 2/5：优先保留原对象和格式；替换资产必须单独确认。
- 场景 3：普通文字必须为原生文本框。默认由 Gorden 生成无文字背景、整体框架、图标/装饰/艺术字 PNG，以视觉保真优先；不强制做低质量原生/SVG 重画。PNG 必须计划内、无普通文字、分辨率合格、经用户专门确认并披露不可编辑影响；只有用户明确要求时才把某个简单视觉改为 SVG。禁止 JPG/WebP、SVG 内嵌 raster、未登记 raster 和噪声位图描摹。
- 艺术字可作为 SVG 或 PNG 资产；必须向用户说明它不是普通可编辑文字，并取得单独确认。

## 后端选择

读取 [backend-integration.md](references/backend-integration.md)。场景 1/3 同时读取 [gorden-integration.md](references/gorden-integration.md) 和对应的内置组件入口：场景 1 只运行 `components/gorden/GordenImagePPTGen`；场景 3 运行 `components/gorden/GordenImage2PPTX`。先运行能力探针，不自行安装依赖，不跨场景静默串联。

```text
python scripts/backend_probe.py [--ppt-master-root <path>]
python scripts/manage_style_library.py --check
```

## 场景引用

- 场景 1：[scenario-1-new-deck.md](references/scenario-1-new-deck.md)
- 场景 2：[scenario-2-template-fill.md](references/scenario-2-template-fill.md)
- 场景 3：[scenario-3-reconstruction.md](references/scenario-3-reconstruction.md)
- 场景 4：[scenario-4-reference-deck.md](references/scenario-4-reference-deck.md)
- 场景 5：[scenario-5-existing-deck.md](references/scenario-5-existing-deck.md)

## 交付

场景 1 先给逐页 PNG 和图片型 PPTX，明确图片内部内容不可编辑，并报告全量渲染与逐页检查结果。其他场景先给最终 PPTX，再简要说明确认门、原生可编辑对象、图片/SVG 边界、字体或重建限制和 QA 结果。不得以“文件已写出”代替完成状态。

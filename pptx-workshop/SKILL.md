---
name: pptx-workshop
description: 策划并生成图片型演示文稿，以及模板填充、图片或 PDF 可编辑重建、参考稿创作和已有 PPTX 续写修改。用于用户要求从资料制作图片版 PPT、按原生模板填内容、把图片/PDF 还原成可编辑 PPTX、参考已有演示稿制作新稿、或在已有 PPT 上新增和修改页面时。强制先策划和确认，每个生成的 PPTX 都必须渲染并视觉检验。
---

# PPTX Workshop

本目录唯一的用户入口是本文件。`GordenImagePPTGen/WORKFLOW.md` 与 `GordenImage2PPTX/WORKFLOW.md` 是内部执行说明，不是独立 Skill 入口；必须先由本 Skill 选择场景、完成该场景的策划与用户确认，再读取对应 Gorden 流程。

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
- 场景 1 在一次版式确认后直接进入随 Skill 原样复制的 `GordenImagePPTGen`；不再增加父流程自己的风格库选择、A/B/C 代表稿或二次策划门。Gorden 原版 A1–A5 继续生效。
- 场景 1 的最终产物是逐页 PNG 与每页一张全幅图片的 PPTX；图片内部文字和图形不声明可编辑。
- 场景 2 先确认模板分析、适配报告和 fill plan，再生成代表页。
- 场景 3 在一次版式确认后直接进入随 Skill 原样复制的 `GordenImage2PPTX`；不再增加父流程自己的逐区域方法选择、源像素裁切门或两页原型门。Gorden 原版 B0–B9 的四层重建和 QA 继续生效。
- 场景 4 由参考稿锁定风格；多个冲突参考必须由用户指定主参考，不重新进行风格三选一。
- 场景 5 先确认对象级 change plan；局部修改只改目标页副本，默认在原页后保留修改副本。
- 默认可以搜索外部信息，但候选证据只有经用户确认后才能进入正式稿。
- 进入最终稿的资产仍须登记并披露来源；内置风格库继续完整保留，但不作为场景 1/3 的默认输入。Gorden 原版 manifest 是生成证据的唯一来源，父流程不再推算或硬编码 imagegen 调用次数。
- 用户需要把场景 1 成品转为可编辑版本时，先完成并确认图片版，再以逐页 PNG 为只读源新建独立场景 3；新运行必须用 `scene1_handoff.json` 与 `start-reconstruction` 绑定上游终验和逐页哈希，不得在场景 1 内自动串联 Image2PPTX。
- 场景 1 图片里的全部可见文字必须与已确认策划一致；错字、漏字、乱码或占位文字必须重生成图片，不得留给未来的场景 3 修正。最终图片型 PPTX 还必须通过 `image-deck-final` 用户确认。
- 缺失字体不得自动替换；先报告，再由用户确认候选字体或资产替代方案。
- 不增加动画、转场、旁白、音频或视频。

## 对象与资产边界

除场景 1 明确交付图片型 PPTX 外，普通标题、正文、数字、日期、标签和表格文字优先使用 PowerPoint 原生文本对象。不要为了“原生”而用大量小形状机械重画复杂插画。

- 场景 1：最终每页为一个全幅 PNG 图片对象；源资产与生成过程以 Gorden 原版 `imagegen-manifest.json` 为准，父运行只保留必要的资产登记。
- 场景 4：允许使用经审批的 SVG 或栅格图片资产。
- 场景 2/5：优先保留原对象和格式；替换资产必须单独确认。
- 场景 3：普通文字按 Gorden 原版写入原生文本框；背景、框架、图标、装饰和复杂图表按 Gorden 原版作为图片层处理，并在 manifest 与回读报告中披露不可对象级编辑。允许 PNG；仍禁止 JPG/WebP、SVG 内嵌 raster、未登记 raster 和噪声位图描摹。
- 艺术字可作为 SVG 或 PNG 资产；必须向用户说明它不是普通可编辑文字，并取得单独确认。

## 后端选择

场景 1/3 在执行 Gorden 原版前，必须先确认当前宿主确实提供可调用的 raster imagegen 能力。`backend_probe.py` 中的 `imagegen_required: true` 只是需求声明，不是能力探测结果；若宿主没有真实 imagegen，立即说明该场景被阻断。

读取 [backend-integration.md](references/backend-integration.md)。场景 1/3 同时读取 [gorden-integration.md](references/gorden-integration.md) 和对应的内嵌 Gorden 流程入口：场景 1 只运行 `GordenImagePPTGen`；场景 3 运行 `GordenImage2PPTX`。先运行能力探针，不自行安装依赖，不跨场景静默串联。

```text
python scripts/backend_probe.py [--ppt-master-root <path>]
# 仅当用户要求使用内置参考时检查完整素材库
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

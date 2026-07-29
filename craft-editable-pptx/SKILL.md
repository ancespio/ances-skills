---
name: craft-editable-pptx
description: 策划、创建、模板填充、图片或 PDF 重建、参考稿创作以及续写或修改真实可编辑 PowerPoint。用于用户要求制作 PPT/PPTX、按原生模板填内容、把图片/PDF 还原成 PPT、参考已有演示稿制作新稿、或在已有 PPT 上新增和修改页面时。强制先策划和确认，普通文字保持原生可编辑，每个生成的 PPTX 都必须渲染并视觉检验。
---

# Craft Editable PPTX

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

读取 [global-workflow.md](references/global-workflow.md)，并遵守：

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

## 硬门禁

读取 [approval-gates.md](references/approval-gates.md)、[assets-fonts.md](references/assets-fonts.md) 与 [quality-gates.md](references/quality-gates.md)。以下规则不可绕过：

- 场景 1/4 必须先完成 `brief.json → outline.json → slide_plan.json`。
- 场景 1/4 和场景 5 的任何新增页面，必须先交付覆盖全部新增页面的无风格版式布局 PPTX，并由用户确认。
- 场景 1 提供三套风格方向；每套必须是可直接复用的 3 页生产稿：封面、常规页、复杂页。
- 场景 2 先确认模板分析、适配报告和 fill plan，再生成代表页。
- 场景 3 锁定源页数、顺序、文字与布局；先确认不确定文字，再生成一页文字密集和一页视觉复杂原型。
- 场景 4 由参考稿锁定风格；多个冲突参考必须由用户指定主参考，不重新进行风格三选一。
- 场景 5 先确认对象级 change plan；局部修改只改目标页副本，默认在原页后保留修改副本。
- 默认可以搜索外部信息，但候选证据只有经用户确认后才能进入正式稿。
- 任何图片、SVG 或艺术字资产都必须先列入资产计划并确认；计划外资产重新确认。
- 缺失字体不得自动替换；先报告，再由用户确认候选字体或资产替代方案。
- 不增加动画、转场、旁白、音频或视频。

## 对象与资产边界

普通标题、正文、数字、日期、标签和表格文字优先使用 PowerPoint 原生文本对象。不要为了“原生”而用大量小形状机械重画复杂插画。

- 场景 1/4：允许使用经审批的 SVG 或栅格图片资产。
- 场景 2/5：优先保留原对象和格式；替换资产必须单独确认。
- 场景 3：普通文字必须为原生文本框；非文字视觉只允许纯 SVG。禁止 PNG/JPG、SVG 内嵌 raster、整页位图和噪声位图描摹。复杂图案可作为一个整体 SVG。
- 艺术字可作为 SVG 或经允许的图片资产；必须向用户说明它不是普通可编辑文字。场景 3 只允许 SVG。

## 后端选择

读取 [backend-integration.md](references/backend-integration.md)。优先使用能满足当前场景合同的宿主演示工具或已安装 PPT Master 后端。先运行能力探针，不自行安装依赖，不把缺失能力静默降级成整页图片。

```text
python scripts/backend_probe.py [--ppt-master-root <path>]
```

## 场景引用

- 场景 1：[scenario-1-new-deck.md](references/scenario-1-new-deck.md)
- 场景 2：[scenario-2-template-fill.md](references/scenario-2-template-fill.md)
- 场景 3：[scenario-3-reconstruction.md](references/scenario-3-reconstruction.md)
- 场景 4：[scenario-4-reference-deck.md](references/scenario-4-reference-deck.md)
- 场景 5：[scenario-5-existing-deck.md](references/scenario-5-existing-deck.md)

## 交付

先给最终 PPTX，再简要说明：用户确认过哪些门、哪些对象原生可编辑、哪些复杂视觉是 SVG/图片资产、是否存在字体或重建限制，以及全量渲染与回读是否通过。不得以“文件已写出”代替完成状态。

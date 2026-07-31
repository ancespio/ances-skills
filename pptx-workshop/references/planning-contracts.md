# 策划合同

本文件说明合同之间的关系和门禁；机器可读字段定义见 [Schema 索引](schemas/README.md)。Schema 文件迁入子目录后仍保留原 `$id`，避免目录整理破坏既有合同标识。

## 公共合同

- `project.json`：运行 ID、场景、阶段、源文件路径/哈希和输出位置。
- `brief.json`：受众、目标、成功标准、事实边界和交付约束。
- `pptx_artifacts.json`：本次运行产生的全部 PPTX 与各自 QA 文件。
- `editability_report.json`：最终真实对象和不可编辑资产披露；场景 1 必须如实记录每页仅有一张全幅 raster，不能用空报告暗示可编辑。

凡使用 `slide_plan.json`，每页必须明确 `text_locked: true` 与 `layout_locked: true`。每个可见文字块逐字记录最终 `text`、稳定 `id`、`[x,y,w,h]` fraction bbox、对齐方式和阅读顺序；`layout` 同时记录版式模式、按 block ID 排列的阅读顺序与装饰安全区。缺任一项时不得生成版式预览或图片。

## 场景合同

| 场景 | 必需策划文件 |
|---|---|
| 1 | plan 阶段：`brief.json`、`evidence_plan.json`、`outline.json`、`slide_plan.json`、`asset_plan.json`、`gorden_component.json`；版式确认后的 preview/final 阶段追加 `style_reference_plan.json` |
| 2 | `brief.json`、`template_analysis.json`、`adaptation_report.json`、`fill_plan.json` |
| 3 | `brief.json`、`reconstruction_plan.json`、`asset_plan.json`、`gorden_component.json`；输入来自场景 1 时追加 `scene1_handoff.json` |
| 4 | `brief.json`、`reference_profile.json`、`evidence_plan.json`、`outline.json`、`slide_plan.json`、`asset_plan.json` |
| 5 | `brief.json`、`change_plan.json`；存在新增页时追加 `outline.json`、`slide_plan.json` |

`style_reference_plan.json` 绑定当前内置目录 SHA-256，记录实际展示给用户的 3–6 个候选和用户选中的 1–3 个参考。它只能在全量无风格版式确认后生效，并由 `style-reference-choice` 明确确认；A/B/C 代表稿均以它和版式预览为直接父合同。

场景 1 的 `manifests/gorden-generation.json` 还必须逐次绑定对应 slide contract 的 SHA-256、已确认的 `style_reference_ids`，并区分 `style-selection` 与 `formal-generation`。A/B/C 代表图只能属于前者；选定代表页不得出现成功的 `final-page` 重生成记录。

## 父哈希

所有 approval 使用 `subject_path` 与 `subject_sha256` 绑定被确认文件。构建计划与每个 PPTX 产物使用 `parents[]` 记录直接上游文件及哈希。上游变化后，不修改旧哈希以伪造延续；重新生成下游和确认。

状态仅使用 `draft`、`awaiting_user`、`confirmed`、`generated`、`qa_passed`、`blocked`。不存在 `confirmed_by_delegation`。

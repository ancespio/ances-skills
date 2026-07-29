# 策划合同

## 公共合同

- `project.json`：运行 ID、场景、阶段、源文件路径/哈希和输出位置。
- `brief.json`：受众、目标、成功标准、事实边界和交付约束。
- `pptx_artifacts.json`：本次运行产生的全部 PPTX 与各自 QA 文件。
- `editability_report.json`：最终真实对象和不可编辑资产披露。

## 场景合同

| 场景 | 必需策划文件 |
|---|---|
| 1 | `brief.json`、`evidence_plan.json`、`outline.json`、`slide_plan.json`、`asset_plan.json` |
| 2 | `brief.json`、`template_analysis.json`、`adaptation_report.json`、`fill_plan.json` |
| 3 | `brief.json`、`reconstruction_plan.json`、`asset_plan.json` |
| 4 | `brief.json`、`reference_profile.json`、`evidence_plan.json`、`outline.json`、`slide_plan.json`、`asset_plan.json` |
| 5 | `brief.json`、`change_plan.json`；存在新增页时追加 `outline.json`、`slide_plan.json` |

## 父哈希

所有 approval 使用 `subject_path` 与 `subject_sha256` 绑定被确认文件。构建计划与每个 PPTX 产物使用 `parents[]` 记录直接上游文件及哈希。上游变化后，不修改旧哈希以伪造延续；重新生成下游和确认。

状态仅使用 `draft`、`awaiting_user`、`confirmed`、`generated`、`qa_passed`、`blocked`。不存在 `confirmed_by_delegation`。

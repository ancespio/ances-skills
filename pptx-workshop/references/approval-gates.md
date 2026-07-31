# 用户确认门禁

确认文件写入 `approvals/<gate>.json`，必须包含：

- `gate`；
- `status: confirmed`；
- `confirmed_by: user`；
- `subject_path` 和当前 `subject_sha256`；
- 用户选择或允许的精确范围；
- 时间戳。

不得把“不回复”“你来决定”“直接做”或代理内部评审转换成以下用户确认：

- `evidence-inclusion`；
- `asset-plan`；
- `gorden-generation-scope`；
- `layout-preview`；
- `style-reference-choice`；
- `style-choice`；
- `image-deck-final`；
- `start-reconstruction`（仅场景 1 图片成稿转入新的场景 3 时）；
- `template-analysis`；
- `template-adaptation`；
- `template-fill-plan`；
- `template-ambiguities`；
- `template-capacity-conflict`；
- `missing-fonts`；
- `uncertain-text`；
- `reconstruction-prototypes`；
- `reconstruction-png-assets`；
- `artistic-text-assets`；
- `template-representatives`；
- `reference-representatives`；
- `change-scope`；
- `delete-original-slides`。

使用 `scripts/record_approval.py` 只能在用户已经在对话中明确确认后落盘；脚本不能替用户做决定。

场景 1 的顺序固定为：确认策划合同 → 确认含逐页完整文字与大致位置的 `layout-preview` → 展示内置/用户风格候选并确认 `style-reference-choice` → 确认 `asset-plan` 与 `gorden-generation-scope` → 按已选参考在风格选择阶段生成 A/B/C 代表图 → 用户确认 `style-choice` → 正式生成阶段复用代表页并只生成剩余页面 → 全量 QA 后确认 `image-deck-final`。后一门禁不得反向替代前一门禁。

`style-reference-choice` 的 subject 必须是当前 `style_reference_plan.json`，decision 中的 `selected_ids` 与 `usage_mode` 必须逐项一致。它只批准参考方向，不等于批准 A/B/C 中任一实际代表稿；`style-choice` 也不能反向批准未展示过的参考来源。

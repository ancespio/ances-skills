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
- `primary-reference`（场景 4 多份参考冲突时，subject 为 `reference_profile.json`，decision 的 `primary_reference` 记录用户指定的主参考 ID）；
- `change-scope`；
- `delete-original-slides`。

使用 `scripts/record_approval.py` 只能在用户已经在对话中明确确认后落盘；脚本不能替用户做决定。

列表中的 `gorden-generation-scope`、`style-reference-choice`、`style-choice`、`reconstruction-png-assets`、`artistic-text-assets` 仅在历史兼容运行或其他场景明确启用时使用；当前场景 1/3 的父流程不要求这些门，唯一新增用户确认是 `layout-preview`。

场景 1 的父流程顺序固定为：记录策划合同 → 生成覆盖全部页面的 `layout-preview` → 用户确认 `layout-preview` → 原样执行 GordenImagePPTGen A1–A5 → 全量 QA 后确认 `image-deck-final`。Gorden 自己的 A1 风格/受众/页数询问不另转成父流程的 style-reference 或 A/B/C 门。

场景 3 的父流程顺序固定为：锁定源页和大致布局 → 生成覆盖全部源页的 `layout-preview` → 用户确认 `layout-preview` → 原样执行 GordenImage2PPTX B0–B9 → 全量 QA 和对象回读。父流程不另加逐区域资产、固定调用次数或两页原型门。

`style-reference-choice` 的 subject 必须是当前 `style_reference_plan.json`，decision 中的 `selected_ids` 与 `usage_mode` 必须逐项一致。它只批准参考方向，不等于批准 A/B/C 中任一实际代表稿；`style-choice` 也不能反向批准未展示过的参考来源。

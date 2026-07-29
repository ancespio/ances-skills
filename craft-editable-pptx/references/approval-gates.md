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
- `layout-preview`；
- `style-choice`；
- `template-analysis`；
- `template-adaptation`；
- `template-fill-plan`；
- `template-ambiguities`；
- `template-capacity-conflict`；
- `missing-fonts`；
- `uncertain-text`；
- `reconstruction-prototypes`；
- `template-representatives`；
- `reference-representatives`；
- `change-scope`；
- `delete-original-slides`。

使用 `scripts/record_approval.py` 只能在用户已经在对话中明确确认后落盘；脚本不能替用户做决定。

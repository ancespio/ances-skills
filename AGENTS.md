# AGENTS.md

## 仓库边界

- 根目录 `README.md` 只登记可发布 Skill；每个 Skill 的 `SKILL.md` 是用户入口。
- `pptx-workshop/` 是当前 PPT 工作流的唯一权威实现。`craft-editable-pptx` 仅是历史名称，不得重新创建同名重复 Skill。
- PPT 相关的现役 Skill 只保留 `pptx-workshop/`；历史实验库、外部 Skill 快照与运行产物只允许放在仓库外的可恢复备份中，不作为 Skill 入口或交付来源。
- `TMP/` 只放可恢复的临时备份与测试缓存，不作为交付来源。

## PPTX Workshop 不变量

- 场景 1 先完成 `brief.json → evidence_plan.json → outline.json → slide_plan.json → 全量无风格版式预览`，用户确认一次后直接执行 Skill 根目录内嵌的 GordenImagePPTGen A1–A5；最终交付逐页 PNG 和图片型 PPTX。需要可编辑稿时，必须在场景 1 终验后新建场景 3。
- 场景 2 锁定模板的 Theme、Master、Layout、字体、字号和颜色；模板可以只规定视觉框架，不强制依赖占位符。
- 场景 3 视觉相似性优先，但普通文字必须是原生文本框；复杂视觉可使用经计划、说明并确认的 PNG，简单视觉仅在用户要求时改用 SVG。
- 场景 4 继承主参考风格，仍须先策划和确认全量版式。
- 场景 5 局部修改必须复制目标页并保留格式；新增页仍走版式预览。是否删除原页由用户决定，源 PPTX 保持只读。
- 每生成一个 PPTX，都必须立即真实渲染、逐页视觉检查、对象回读并绑定父计划与 SHA-256；没有 `visual_qa.json` 的 PPTX 不得交付。
- 内嵌 Gorden 原版流程只执行父流程已经批准的生成或重建任务，不得跳过一次版式确认。保留 `pptx-workshop/GordenImagePPTGen/`、`pptx-workshop/GordenImage2PPTX/`、`pptx-workshop/GORDEN_NOTICE.md` 和固定上游提交信息；原版 A1–A5/B0–B9 不由父流程重写。
- 所有机器可读合同统一放在 `pptx-workshop/references/schemas/`；不得在 `references/` 根目录散放 `*.schema.json`。Schema 的 `$id` 是稳定合同标识，不随目录整理改写。
- `pptx-workshop/assets/style-library/catalog.json` 与 Gorden 上游示例图库是可发布内置风格参考；完整素材库必须保留，但场景 1/3 不得静默套用。只有用户主动选择或场景 4 合同明确引用时，才写入 `style_reference_plan.json` 并登记来源。

## 修改与发布

- 文本文件使用 UTF-8 无 BOM；不提交虚拟环境、缓存、真实密钥、原始用户资料或实验运行产物。
- 不自动安装依赖。先运行能力探针；缺失依赖时报告影响并等待用户授权。
- 修改只触及当前任务需要的文件。未经明确授权，不执行 commit、push、merge、rebase、reset、分支切换或清理未跟踪文件。

## 验证

修改 `pptx-workshop/` 后至少运行：

```powershell
$env:PYTHONUTF8 = '1'
python C:\Users\Ances\.codex\skills\.system\skill-creator\scripts\quick_validate.py .\pptx-workshop
python .\pptx-workshop\scripts\validate_contracts.py --self-test
python .\pptx-workshop\scripts\validate_svg_assets.py --self-test
python .\pptx-workshop\scripts\manage_style_library.py --check
Get-ChildItem .\pptx-workshop\scripts\*.py | ForEach-Object { python -m py_compile $_.FullName }
git diff --check
```

同时解析所有 JSON Schema、检查 Markdown 本地链接和 UTF-8 BOM。若验证环境缺少可选包，明确报告未执行项，不为通过测试临时全局安装依赖。

# Schema 索引

本目录统一保存 PPTX Workshop 的 JSON Schema，均采用 JSON Schema Draft 2020-12。运行产物仍写入各次运行目录的 `plans/`、`approvals/` 与 `manifests/`；这里仅定义机器可读合同。

目录整理不会改写现有 `$id`。校验器中的版本常量与本目录 Schema 必须同步更新，不能通过复制旧 Schema 或放宽字段要求绕过确认门。

## 运行与公共合同

- [project.schema.json](project.schema.json)：运行身份、场景、阶段与路径。
- [brief.schema.json](brief.schema.json)：目标、受众、事实边界与交付约束。
- [approval.schema.json](approval.schema.json)：用户确认及其父对象哈希。
- [asset-plan.schema.json](asset-plan.schema.json)：最终资产、来源和编辑性披露；场景 3 的具体分层由 Gorden 原版负责。
- [pptx-artifacts.schema.json](pptx-artifacts.schema.json)：PPTX、父计划与 QA 绑定。
- [visual-qa.schema.json](visual-qa.schema.json)：逐页视觉检查。
- [editability-report.schema.json](editability-report.schema.json)：对象回读与可编辑性披露。

## 内容与版式策划

- [evidence-plan.schema.json](evidence-plan.schema.json)：候选证据与纳入状态。
- [outline.schema.json](outline.schema.json)：页序与叙事结构。
- [slide-plan.schema.json](slide-plan.schema.json)：逐页完整文字、bbox、阅读顺序和装饰安全区。
- [style-reference-plan.schema.json](style-reference-plan.schema.json)：用户主动选择内置参考时的可选记录，不是场景 1/3 的必需文件。
- [build-plan.schema.json](build-plan.schema.json)：正式构建及父合同绑定。

## 场景专用合同

- [template-analysis.schema.json](template-analysis.schema.json)：场景 2 模板分析。
- [adaptation-report.schema.json](adaptation-report.schema.json)：场景 2 内容适配结果。
- [fill-plan.schema.json](fill-plan.schema.json)：场景 2 模板填充计划。
- [reconstruction-plan.schema.json](reconstruction-plan.schema.json)：场景 3 锁定源页和版式确认记录。
- [scene1-handoff.schema.json](scene1-handoff.schema.json)：场景 1 图片成稿转场景 3 的独立交接。
- [reference-profile.schema.json](reference-profile.schema.json)：场景 4 主参考与继承规则。
- [change-plan.schema.json](change-plan.schema.json)：场景 5 对象级修改范围。

## Gorden 执行合同

- [gorden-component.schema.json](gorden-component.schema.json)：直接嵌入的 Gorden 能力、生成范围和用户确认记录；文件名保留兼容性。
- [gorden-generation-manifest.schema.json](gorden-generation-manifest.schema.json)：父流程兼容的 Gorden 生成证据；原版 `imagegen-manifest.json` 与 `imagegen-assets-manifest.json` 仍是 Gorden 原版主证据。

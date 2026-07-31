# 内置风格样例库来源说明

本目录为 PPTX Workshop 的只读视觉参考库。样例可用于场景 1 的风格参考选择，以及场景 4 的参考稿分析；它们不是已经通过场景 2 模板解析、字体审计和容量验证的原生模板，不得静默填充或直接复制到最终稿。

## PPT Master

- 来源：https://github.com/hugohe3/ppt-master
- 固定资产快照：`2296b80c5f2c3df6eac4461dd788b9f526b72e14`
- 授权：MIT，完整文本见 `ppt-master/LICENSE.txt`。
- 内置范围：21 个完整 reference deck、21 个自包含 SVG 封面、21 个由 LibreOffice 转换的 PNG 预览和上游 `examples.json` 元数据。
- 没有重复复制 280 页逐页 SVG 和原始配图；完整页面已经包含在 reference deck 中。

这些 reference deck 可能包含品牌名称、事实内容、照片、旁白或动画。只能提取配色、字体气质、图形语言、材质、留白、网格和装饰规律；不得未经核验复制原有事实、商标、照片、动画、旁白或页面文字。

## ppt-agent-workflow-san

- 来源：https://github.com/mucsbr/ppt-agent-workflow-san
- 固定提交：`801cd2bd46c3cc4ca2c846ff28da2d9284816cd9`
- 上游 README 声明：Apache License 2.0；快照未附根 LICENSE 文件，因此本目录另从 Apache 官方固定地址保存完整 `san-dark-product-analysis/LICENSE.txt`。
- 内置范围：`ppt-workflow/` 的 8 页深色产品分析样例，以及根目录 2 张工作流截图。工作流截图只作来源说明，不进入风格候选。

## GordenSuperPPTSkills

- 来源：https://github.com/GordenSun/GordenSuperPPTSkills
- 固定提交：`8c05583dab8334182b71738e8dfbbec5c56a1951`
- 上游 README 声明：可以商用，但必须标明 GitHub 出处或作者 `@Gorden Sun`；上游未附标准 LICENSE。
- 38 张风格参考图保留在 `components/gorden/GordenImagePPTGen/参考图/`，5 张流程/产物示例保存在 `gorden-workflow-examples/`。
- 完整授权边界见 `components/gorden/NOTICE.md`；父仓库 MIT 不覆盖这些文件。

## 已核验但未复制二进制资产的仓库

- `CxyZyr/PPTX-Template-Skills`：MIT；仓库提供模板解析/填充方法，但没有 PPTX、图片或风格样例可导入。
- `ilioner/ppt-craft-editable`：快照中的 PPTX/PNG 位于验证临时目录，且未发现仓库级 LICENSE；只在目录来源审计中登记，不作为可发布资产复制。

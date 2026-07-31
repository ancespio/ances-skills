# 内置 Gorden 组件

## 组件位置

两个组件已经随 `pptx-workshop` 一起提供，不需要另外克隆仓库或配置外部路径：

```text
components/gorden/
├── NOTICE.md
├── UPSTREAM_COMMIT
├── GordenImagePPTGen/
└── GordenImage2PPTX/
```

来源为 `GordenSun/GordenSuperPPTSkills`，作者 Gorden Sun，固定提交 `8c05583dab8334182b71738e8dfbbec5c56a1951`。使用与交付时保留 [NOTICE.md](../components/gorden/NOTICE.md) 中的出处和作者说明。

先运行只读探针并把输出保存为 `manifests/backend_probe.json`：

```text
python scripts/backend_probe.py > manifests/backend_probe.json
```

探针检查内置提交标记、两个组件入口、源区无损裁取脚本、合成脚本、三项重建 QA 脚本，以及 `python-pptx`、Pillow、NumPy。缺依赖时停止并告知用户，不自动安装。

执行当前场景前，完整读取对应内置组件的 `SKILL.md`：

- 场景 1：只读 [GordenImagePPTGen/SKILL.md](../components/gorden/GordenImagePPTGen/SKILL.md)；
- 场景 3：读 [GordenImage2PPTX/SKILL.md](../components/gorden/GordenImage2PPTX/SKILL.md)。

组件中的图像生成、manifest、逐页 edit target、抠图和 QA 细则继续生效；其中独立策划、风格询问、依赖安装等内容若与本 Skill 冲突，以两个组件入口的 `## PPTX Workshop 组件合同` 和父 Skill 合同为准。不得读取或引用仓库外的同名 Skill 文件。

## 场景 1：策划后生成图片型成稿

固定顺序：

```text
brief.json
→ evidence_plan.json
→ outline.json
→ slide_plan.json
→ 覆盖全部页面的无风格版式预览 PPTX
→ 展示内置/用户风格参考并确认 style_reference_plan.json
→ asset_plan.json
→ gorden_component.json 与生成范围确认
→ 风格选择阶段：同一组 R=min(N,3) 个代表页的 A/B/C 可复用生产级图片方案
→ 用户选定风格
→ 选中方案的 R 页原图直接进入正式稿
→ 正式生成阶段：GordenImagePPTGen 只生成其余 N-R 页
→ 最终逐页 PNG + 每页整图的图片型 PPTX
→ 最终全量渲染、逐页对照与 image-deck-final 确认
```

`slide_plan.json` 必须先逐页锁定每个可见文字块的完整文字、`[x,y,w,h]` 大致位置、阅读顺序、内容区、装饰安全区和资产预留。随后按 [内置风格参考库](style-library.md) 展示候选，用户通过 `style-reference-choice` 决定参考方向。ImagePPTGen 不得重新执行主题澄清或大纲策划：风格选择阶段只把同一版式和已确认参考编译成 A/B/C 代表图，正式生成阶段只把选定风格编译到剩余页面。任何阶段都不得绕过确认静默采用内置风格。

每页 PNG 必须包含最终真实文字，并作为场景 1 的正式页面交付。标题、正文、数字、标点、大小写和换行均需与已确认页面文案一致；任何错字、漏字、乱码或事实偏差都必须重生成该页，不能以“之后还能编辑”为理由放行。最终 PPTX 每页只铺放一张对应的全页 PNG，不宣称文字或页面元素可编辑。

设页数为 `N`、代表页数为 `R=min(N,3)`，一次无重试的最低 imagegen 调用量是 `N+2R` 次：

1. 风格选择阶段为同一组 `R` 个代表页生成 A/B/C，共 `3R` 次；
2. 用户选中方案后，其 `R` 页直接复用，不重新生成；
3. 正式生成阶段只生成剩余 `N-R` 页，因此合计 `3R+(N-R)=N+2R` 次；`N>=3` 时即 `N+6` 次。

这只是无重试的最低预算；任何文字修正、视觉返工或生成失败都会增加调用量。生成任何风格代表页前，必须把页数、最低调用量、代表页复用规则和预计影响写入 `gorden_component.json`，向用户说明并确认 `gorden-generation-scope`。

场景 1 到图片型 PPTX 验收即结束，不得在同一次运行中调用 Image2PPTX。若用户需要可编辑版本，必须先完成 `image-deck-final` 确认，再以已确认的逐页 PNG 为输入，新建独立运行目录并重新进入场景 3；新的 `reconstruction_plan.json`、审批、原型和 QA 均不得沿用场景 1 结果冒充通过。

## 场景 3：逐区域保真重建

固定顺序：

```text
用户图片、逐页 PDF 渲染或已确认的场景 1 PNG
→ 锁定页数、顺序、文字和布局
→ reconstruction_plan.json
→ 不确定文字确认
→ asset_plan.json
→ gorden_component.json 与生成范围确认
→ 一页文字密集页 + 一页视觉复杂页原型
→ 用户确认原型
→ 按批准资产区域批量重建
→ 最终全量渲染、逐页对照和对象回读
```

Image2PPTX 负责逐页执行已批准的资产方法：无普通文字的复杂区域按源像素 bbox 原样保留为 `source-preserved-png`；只有必须去字的复杂区域才以当前源页为 edit target 生成 `imagegen-detexted-png`；普通文字回填为原生文本框；经用户明确要求的简单视觉才使用 `approved-svg`。组件不得重新决定区域方法，也不得默认重画整页背景、框架与图标。

一次无重试的最低 imagegen 调用量等于 `asset_plan.json` 中 `reconstruction_method: imagegen-detexted-png` 的资产数；全部复杂区域都能安全原样保留时可以为 0。普通文字识别、源区裁取和 PPTX 合成本身不计为 imagegen 调用。批量前必须向用户说明区域数、最低调用量、重试会增加的成本并确认。

父 `gorden_component.json` 固定把 Image2PPTX 的运行根映射为 `<run>/work/gorden/image2pptx/`。组件内的 `RUN_ROOT` 就是这个目录；所有 source mapping、prompts、assets、layout、preview 和 QA 必须留在父 run 内，不得使用 `$PWD/image2pptx_runs/` 或另建独立任务根。

这里“取代场景 3”只表示内置 Image2PPTX 取代原来的重建执行方法。父 Skill 的源事实锁定、不确定文字、资产计划、艺术字确认、两页原型、用户确认、最终真实渲染、对象回读和可编辑性披露全部保留。

场景 3 只执行 Image2PPTX，不执行 ImagePPTGen。若输入来自场景 1，只有通过 `image-deck-final` 确认的逐页 PNG 才能作为新运行的源事实；新运行必须写入绑定上游产物、审批和逐页 PNG 哈希的 `scene1_handoff.json`，取得 `start-reconstruction` 确认，并重新建立计划、审批、原型和 QA，禁止在场景 1 内自动串联。

## 资产映射

调用 imagegen 前，根据逐页识别结果预登记稳定路径、bbox、目标像素尺寸和视觉角色：

- `source-preserved-pNN-*`：锁定源页中已确认无普通文字的原样像素区域；
- `detexted-pNN-*`：确需去字、且已批准调用 imagegen 的局部复杂视觉；
- `approved-svg-pNN-*`：用户明确要求转为 SVG 的简单视觉或已转曲艺术字；
- 普通文字不登记为图片资产，进入原生文本对象计划。

每个实际 PNG/SVG 必须映射到 `asset_plan.json` 的 asset ID。PNG 还必须绑定 `source_region.page_id` 和源像素 bbox；source-preserved 资产须逐像素等于该源区，imagegen-detexted 资产须有同 asset ID 的真实生成调用。数量、方法、路径、bbox 或像素尺寸变化会使原确认失效，必须更新计划并重新确认。任何包含普通文字的视觉 PNG 都失败。

## 双重质量门

组件质量门与父 Skill 质量门同时成立：

1. 统一保留 `manifests/gorden-generation.json`，记录阶段、真实生成源、完整 prompt、父页/源页哈希、asset ID、已确认 `style_reference_ids` 和输出路径；
2. 场景 1 核对风格选择/正式生成阶段、完整文字与 bbox 绑定、代表页复用；场景 3 对每一页分别运行并登记 `layout_guard.py --strict`、`placement_qa.py`、`visual_compare_qa.py`，唯一键为 `(tool,page_id)`；
3. 每个 PPTX 登记进 `pptx_artifacts.json`，用真实渲染器渲染全部页面并写 `visual_qa.json`；
4. 场景 1 最终回读必须确认每页只有一张全页 PNG，并明确披露不可编辑；场景 3 最终回读中普通文字必须是原生文本框，PNG 视觉层按非对象级可编辑披露；
5. 场景 3 的逐页视觉判定只在 `text_overlap`、`critical_structure_drift`、`major_alignment_drift`、`major_color_drift` 全部为 `false` 时才可 pass；不得使用“已声明保真差距”放行；
6. 任一层 QA 失败都不得交付。

## 阻断条件

内置提交标记或当前场景所需组件文件缺失、风格目录校验失败、依赖缺失、需要 imagegen 的计划却无真实后端、生成范围未确认、manifest 缺失、PPTX 真实渲染失败或回读失败时立即停止。场景 1 还需阻断未完成的 `style-reference-choice`、生成调用与已选目录 ID 不一致、任何可见文字错误以及未完成的 `image-deck-final` 确认；场景 3 还需阻断源区未绑定、source-preserved 像素不一致、imagegen 区域缺真实调用、视觉 PNG 含普通文字、逐页三项 QA 不齐、关键视觉缺陷、两页原型未确认或试图沿用场景 1 审批的情况。不得改用旧任务资产或未登记整页截图兜底。

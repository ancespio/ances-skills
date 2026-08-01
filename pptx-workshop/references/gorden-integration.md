# 内置 Gorden 流程

## 直接嵌入位置与来源

两个 Gorden 原版入口已经直接嵌入 `pptx-workshop`，不需要另外克隆仓库或配置外部路径：

```text
pptx-workshop/
├── GORDEN_NOTICE.md
├── GORDEN_UPSTREAM_COMMIT
├── GordenImagePPTGen/
└── GordenImage2PPTX/
```

来源为 `GordenSun/GordenSuperPPTSkills`，固定提交 `8c05583dab8334182b71738e8dfbbec5c56a1951`。使用与再发布时保留 [GORDEN_NOTICE.md](../GORDEN_NOTICE.md) 的出处、作者和授权说明。

先运行只读探针并把输出保存为 `manifests/backend_probe.json`：

```text
python scripts/backend_probe.py > manifests/backend_probe.json
```

探针检查固定提交、两个原版入口、合成脚本、原版重建 QA 脚本以及 `python-pptx`、Pillow、NumPy。缺依赖时停止并报告，不自动安装。

## 父流程只增加一次版式确认

PPTX Workshop 在两个 Gorden 原版入口之前只插入一次无风格 `layout-preview.pptx` 确认：

```text
版式预览 → 用户确认 layout-preview → 进入对应 Gorden 原版
```

版式预览用于锁定页数、顺序、可见文字和大致位置；它不替换 Gorden 自己的风格/受众询问、outline、逐页 prompt、imagegen、manifest 或 QA。父流程不再增加 style-reference-plan、A/B/C 代表稿、逐区域重建方法、固定 imagegen 次数或两页原型门。

## 场景 1：GordenImagePPTGen 原版

确认版式后，完整读取 [GordenImagePPTGen/SKILL.md](../GordenImagePPTGen/SKILL.md)，原样执行 A1–A5：

```text
A1 确认风格 / 受众 / 页数 / 语言
→ A2 outline.json
→ A3 prompts/NN-*.md
→ A4 imagegen + imagegen-manifest.json
→ A5 compose_pptx.py → 图片型 PPTX
```

生成 manifest、提示词、实际 imagegen 结果和 `slides/*.png` 都按上游目录规则保存。父运行只把最终 PPTX、逐页 PNG 和来源记录登记到自己的产物清单，不改变 Gorden 的字段或调用预算。
`gorden_component.json.stages[0].manifest_path` 应指向该原版 manifest；场景 3 若每页各有一份 `imagegen-assets-manifest.json`，父校验器会在本次运行目录内汇总这些文件。

## 场景 3：GordenImage2PPTX 原版

确认版式后，完整读取 [GordenImage2PPTX/SKILL.md](../GordenImage2PPTX/SKILL.md)，原样执行 B0–B9：

```text
B0 唯一 RUN_ROOT
→ B1 探色
→ B2 背景
→ B3 整体框架
→ B4 图标 / 装饰
→ B5–B7 文字与布局
→ B8 合成 PPTX
→ B9 imagegen-assets-manifest.json + 视觉 QA
```

普通文字按上游写成原生文本框；背景、框架、图标、装饰和复杂图表按上游作为图片层。父流程不重写其四层规则、edit target、透明抠图、坐标、prompt 或 QA 要求。

## 素材库

`pptx-workshop/assets/style-library/` 及其 `catalog.json` 是完整的内置参考资产，随 Skill 保留，不删除、不缩减。它们不是场景 1/3 的隐式输入；只有用户在 Gorden 原版 A1 中主动指定，或在其他场景合同中明确选择时，才进入运行并登记来源。

## 通用交付门

每个 PPTX 仍必须登记到 `pptx_artifacts.json`，用真实渲染器渲染全部页面，写 `visual_qa.json`，并回读 `editability_report.json`。Gorden 原版 manifest 和 QA 不能缺失；父级 PPTX QA 不能被 Gorden 内置脚本替代。场景 1 明确交付图片型 PPTX，场景 3 明确普通文字可编辑、图片层不可对象级编辑。

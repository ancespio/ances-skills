# 内置风格参考库

内置库用于在场景 1 的无风格版式确认后，给用户直接展示可选视觉方向；它不是静默默认值，也不是内容来源。目录入口为 `assets/style-library/catalog.json`。

## 使用顺序

1. 先完成并确认全量无风格 `layout-preview.pptx`。
2. 运行：

   ```text
   python scripts/manage_style_library.py --check
   ```

3. 根据主题、受众、正式程度、信息密度和品牌限制，从目录筛选 3–6 个最相关条目。每个候选必须向用户展示 PNG 预览、名称、来源、适用理由、授权说明和限制；reference deck 还可提供只读 PPTX 供深入查看。
4. 用户可以选择一个条目、最多三个条目融合、改用自己提供的参考，或要求自定义方向。把所有已展示候选和用户选择写入 `plans/style_reference_plan.json`，绑定当前 `catalog.json` 的 SHA-256。
5. 用户确认 `style-reference-choice` 后，才能为同一组代表页生成 A/B/C 三套生产稿。A/B/C 必须共同继承 `selected_ids`；单一参考时比较同一语言的不同落地方式，融合参考时比较不同权重，不能引入未确认的第四种风格。
6. 用户再通过 `style-choice` 选择实际代表稿；选中代表页原图进入最终 PPTX。

目录不可在版式预览前决定页面结构，也不能替用户完成选择。若目录校验失败、预览缺失、授权说明缺失或用户尚未确认，停止图片生成。

## 已内置范围

| 来源 | 内置内容 | 目录用途 |
|---|---|---|
| `hugohe3/ppt-master` | 21 套完整 PPTX、21 个原始 SVG 封面及 21 个 PNG 预览 | 21 个 `reference-deck` 条目 |
| `GordenSun/GordenSuperPPTSkills` | 38 张参考图，分为 5 个风格族；另保留 5 张流程示例 | 5 个 `style-family` 条目与辅助说明图 |
| `mucsbr/ppt-agent-workflow-san` | 8 页深蓝产品分析样例及 2 张流程截图 | 1 个 `style-family` 条目与辅助说明图 |
| `CxyZyr/PPTX-Template-Skills` | 仓库无可并入的 PPTX 或视觉样例 | 仅保留来源审计记录 |
| `ilioner/ppt-craft-editable` | 发现的二进制文件属于验证临时产物，且仓库级再分发授权不清 | 仅保留来源审计记录，不打包二进制 |

详细提交、许可证、哈希、像素尺寸、页数和未并入原因均记录在 `catalog.json` 与 [资产来源说明](../assets/style-library/NOTICE.md)。

## 引用边界

- `reference-deck` 只作为视觉参考，不自动成为场景 2 模板。若用户要求直接填充其中某套 PPTX，必须另走模板分析，验证 Theme、Master、Layout、字体和对象结构。
- 可以借鉴配色、版式语法、字体气质、图形语言、材质与装饰节奏；不得未经审查复制参考稿中的事实、品牌、照片、图表数据、正文、旁白或动画。
- Gorden 条目使用时保留作者与 GitHub 署名；其 README 授权声明不是标准开源许可证，不得改写成父仓库 MIT 授权。
- 用户自带参考必须复制到本次运行目录或使用本次运行目录内的受控副本，并在计划中记录 SHA-256；不能只写网页链接或模糊描述。
- 目录预览是选风格证据，不自动进入 `asset_plan.json`。只有正式稿实际使用的图片、SVG 或艺术字才进入资产计划。

## 维护

修改内置资产、来源说明或 Gorden 参考图库后运行：

```text
python scripts/manage_style_library.py --write
python scripts/manage_style_library.py --check
```

`--check` 会核对完整文件清单、SHA-256、PNG 尺寸、PPTX 页数、目录条目数量和模板安全标记。禁止手工改 `catalog.json` 来绕过素材变化。

`catalog_revision` 是人工递增的固定目录修订号，不是脚本运行日期；只有发布一版新的可复现目录快照时才修改。目录构建直接读取 `components/gorden/GordenImagePPTGen/参考图/`：其中任一文件增删、改名或内容变化都会改变目录和 `catalog.json` 哈希，必须运行 `--write` 与 `--check`，重新向用户展示候选；所有绑定旧 catalog SHA-256 的 `style_reference_plan.json` 与 `style-reference-choice` 自动失效。

# 公共工作流

## 运行目录

每次任务创建唯一目录：

```text
<run>/
├── project.json
├── plans/
├── approvals/
├── previews/
├── assets/
├── work/
├── exports/
├── qa/
└── manifests/
```

所有中间产物和相对引用必须留在本次运行目录内。场景 5 不复制或备份整本源 PPTX；只在 `project.json` 中记录源路径和 SHA-256，源文件保持只读。

场景 1/3 使用 Skill 内置的 `components/gorden/`，运行目录只保存探针报告、合同、prompt、manifest、生成资产和输出。每个 Gorden 阶段使用本次运行目录下唯一的 output root，不读取其他任务的历史产物，也不修改内置组件文件。

场景 1 运行只调用 `GordenImagePPTGen`，并在逐页 PNG 与图片型 PPTX 通过 QA、取得 `image-deck-final` 确认后结束。需要可编辑版时，新建场景 3 运行目录，用 `scene1_handoff.json` 和 `start-reconstruction` 绑定上游终验及逐页 PNG 哈希，再将这些 PNG 作为只读源重新走识别、计划、审批、原型和最终 QA；禁止在场景 1 目录内追加 `GordenImage2PPTX` 阶段。

## 阶段

1. `intake`：读取源材料，记录事实边界、字体、画布和能力缺口。
2. `plan`：生成当前场景要求的策划合同。
3. `awaiting_user`：输出需要确认的 PPTX/清单；停止批量构建。
4. `preview`：先确认含完整文字和大致位置的全量无风格版式；场景 1 随后展示内置/用户风格参考，确认 `style_reference_plan.json`，再只为代表页生成 A/B/C 风格图片并完成视觉 QA，风格图属于本阶段。
5. `build`：只按已确认合同批量构建；场景 1 复用选中代表页并只生成剩余页面，不再选择或探索风格。
6. `final`：渲染全量 PPTX、逐页检查、回读对象和文字，生成最终报告。

## 失效传播

任何确认都绑定被确认文件的 SHA-256。上游文件变化后，相应 approval 自动失效；所有依赖该 approval 的预览、代表页和正式稿也必须重新生成或复核。场景 1 的风格参考计划还绑定内置 `catalog.json` 的 SHA-256；目录资产或来源说明变化后必须重新展示并确认参考选择。

每个生成的 `.pptx` 都必须登记在 `pptx_artifacts.json`，并记录直接父文件的路径与 SHA-256。Validator 会递归扫描运行目录；发现未登记的 PPTX、父哈希失效、缺少 `visual_qa.json`、产物哈希不匹配或 QA 非 PASS 时立即失败。

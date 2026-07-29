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

## 阶段

1. `intake`：读取源材料，记录事实边界、字体、画布和能力缺口。
2. `plan`：生成当前场景要求的策划合同。
3. `awaiting_user`：输出需要确认的 PPTX/清单；停止批量构建。
4. `preview`：生成版式预览、风格选项或代表页，并逐个完成视觉 QA。
5. `build`：只按已确认合同批量构建，不重新决定故事、模板或资产。
6. `final`：渲染全量 PPTX、逐页检查、回读对象和文字，生成最终报告。

## 失效传播

任何确认都绑定被确认文件的 SHA-256。上游文件变化后，相应 approval 自动失效；所有依赖该 approval 的预览、代表页和正式稿也必须重新生成或复核。

每个生成的 `.pptx` 都必须登记在 `pptx_artifacts.json`，并记录直接父文件的路径与 SHA-256。Validator 会递归扫描运行目录；发现未登记的 PPTX、父哈希失效、缺少 `visual_qa.json`、产物哈希不匹配或 QA 非 PASS 时立即失败。

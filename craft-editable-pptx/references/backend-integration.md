# PPTX 解析与原生对象生成层

这是一组本地能力，不是在线服务。它负责读取/修改 `.pptx`，生成原生文本、形状、连接线、表格、图表、SVG 图片，并保留或检查 Theme/Master/Layout。

## 能力优先级

1. 用户提供 PPTX/模板时，优先使用能保留 Master/Layout 和对象格式的宿主工具。
2. 已安装 PPT Master 时，可使用其 `pptx_intake.py`、`template_fill_pptx` 和 SVG→DrawingML 管线。
3. 从零或版式预览可使用宿主演示文稿工具生成真实 PPTX。
4. 任何候选后端缺少当前场景硬能力时，停止并报告；不得静默改成整页图片。

## PPT Master 接口

可选环境变量或参数指向 `skills/ppt-master` 根目录。能力探针只检查文件和依赖，不安装：

- `scripts/pptx_intake.py`：PPTX 画布、主题、页面、表格、图表和结构分析；
- `scripts/template_fill_pptx.py` 或包 CLI：analyze/scaffold/check/apply/validate；
- `scripts/svg_to_pptx.py`：把合同内 SVG 转为原生 DrawingML PPTX；
- 渲染与回读工具：用于真实 QA。

不调用动画、转场增强、旁白、音频、视频或自动图片生成接口。模板填充不暴露 `--force`。

## 首版发布边界

本 skill 不复制 PPT Master 的大体积耦合源码；通过能力合同接入宿主或独立安装的固定版本后端。Validator、SVG 安全检查和确认门禁是本 skill 自包含能力。

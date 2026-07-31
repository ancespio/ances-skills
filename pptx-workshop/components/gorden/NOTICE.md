# Gorden 组件来源与署名

- 原项目：GordenSun/GordenSuperPPTSkills
- 原作者：Gorden Sun
- 来源：https://github.com/GordenSun/GordenSuperPPTSkills
- 固定提交：`8c05583dab8334182b71738e8dfbbec5c56a1951`
- 上游 README 声明：可以商用，使用时必须标明 GitHub 出处或作者 `@Gorden Sun`。
- 在固定提交的仓库根目录未发现标准 `LICENSE` 文件；README 中的商用与署名声明不等同于标准开源许可证。公开再分发本目录前必须重新核对授权，不能把本目录纳入父仓库 MIT 再授权。

本目录复制了上游 `GordenImagePPTGen` 与 `GordenImage2PPTX` 两个子组件的执行脚本，并保留 `GordenImagePPTGen/参考图/` 下 38 张示例作为五个可选风格族。图库通过 `assets/style-library/catalog.json` 建立来源、哈希和署名索引；全量无风格版式确认后，PPTX Workshop 必须向用户展示相关候选，只有写入 `style_reference_plan.json` 并取得 `style-reference-choice` 后才可使用。示例图不得成为默认风格或隐式输入。

两个 `SKILL.md` 及相关运行说明已按 PPTX Workshop 合同改写：先锁定逐页完整文字、bbox 与阅读顺序，再确认风格参考；场景 1 的 A/B/C 代表图调用明确登记为 `style-selection` 并绑定已选目录 ID，选定后复用代表页并以 `formal-generation` 只生成剩余页面；场景 3 按已批准的源区保留、局部 imagegen 去字、原生文字和逐页 QA 执行并登记为 `reconstruction`。已移除组件自行策划、固定整页三层重画、跨场景串联和自动安装依赖等上游行为。没有复制上游 `GordenSuperPPTSkill` 编排层。

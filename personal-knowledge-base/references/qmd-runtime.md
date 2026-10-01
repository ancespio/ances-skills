# 项目内 qmd 与检索范围

本地 qmd 与远程 MCP/AI Search 是独立检索入口；配置云端不安装或重建本地模型。
附带 PowerShell 脚本面向 Windows，固定从项目 `.local/qmd/` 运行，不自动寻找全局索引。

## 初次配置

1. 检查 `.local/qmd/package.json`、node_modules、已有索引和自定义 collection；已有可用安装不重复安装。
2. 未安装时先确认依赖/模型下载授权。脚本接口基于 @tobilu/qmd 2.5.3；
   在项目内声明并固定该版本后安装（例如 `npm install --prefix .local/qmd --save-exact @tobilu/qmd@2.5.3`），不做全局安装。
   使用其他版本先检查 help/参数兼容，不盲目升级。
3. 把 qmd.ps1、qmd-config.ps1、qmd-query.ps1、test_qmd_query.ps1 复制到项目 scripts。
4. qmd-config.ps1 会重写本项目的 index.yml；已有自定义配置须先备份和合并，不直接覆盖。
5. 在项目根目录执行：

```powershell
.\scripts\qmd-config.ps1 -Update
.\scripts\qmd.ps1 embed
.\scripts\qmd.ps1 status
.\scripts\qmd-query.ps1 -Query "<真实主题>" -Limit 5
.\scripts\qmd-query.ps1 -Query "<笔记主题>" -Collection literature
.\scripts\test_qmd_query.ps1 -LiteratureFallbackChecks
```

完整 hybrid 依赖本地 embedding/reranker 模型，首次下载、全量 embedding 可能耗时。
缺少依赖时如实使用 rg，不把降级结果称为 hybrid。这里只提供流程，不自动下载安装。

## 范围与实际降级顺序

- 默认 wiki、context、literature；wiki 排除 derived 和 lint 输出。
- literature 排除根 README、templates，子目录中的阅读 README 仍是内容。
- derived 独立 collection，includeByDefault=false，排除 intermediate；逐行核对时才显式选择。
- 实际顺序：hybrid → hybrid-no-rerank → BM25 → rg；所有分支遵守 Collection 范围。
- TimeoutSeconds 默认 90，分别约束两次 hybrid 尝试，不是整个请求的总 90 秒；
  BM25 另有 30 秒超时。返回 mode、query_strategy、fallback_reason。
- rg 范围测试通过不等于模型可用；要证明 hybrid，需在真实项目补运行
  test_qmd_query.ps1 -IncludeHybrid，并指定实际查询词和预期命中文件。

模型、索引、缓存不进入公开 skill 或知识库 Git。不要把配置更改、索引刷新当作摄入或修改 literature 的授权。

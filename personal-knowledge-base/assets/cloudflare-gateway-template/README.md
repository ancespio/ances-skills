# 只读知识库 Gateway 模板

从模板复制到独立私有工程后，先选择路线，不要直接部署占位符。

| 路线 | 入口与配置 | 部署命令 | 外部资源 |
| --- | --- | --- | --- |
| GPT Actions | src/index.ts / wrangler.jsonc | pnpm deploy | AI Search + SYNC_STATE KV |
| GitHub MCP | src/mcp-index.ts / wrangler.mcp.jsonc | pnpm deploy:mcp | SYNC_STATE KV + OAUTH_KV |

两条路线的 Worker 名、域名、KV 和客户端凭据必须独立；仅共享只读来源校验代码。
MCP 不导入 AI Search 运行入口；Actions 不暴露 MCP/OAuth 路由。
pnpm check 会生成两套绑定类型并运行全部测试；生成类型不创建云资源。
cf:types:mcp 会把 Wrangler 生成的 MCP 声明转成模块导出，避免全局类型重名；
不要只运行其中的 wrangler types 命令而跳过后处理。
首次授权安装依赖后提交生成的 lockfile，之后使用 frozen lockfile。

完整指南位于安装 skill 的 references/remote-access.md、
references/github-readonly-mcp.md 与 references/cloudflare-gateway-gpts.md。
配置必须由部署者填写；不要提交 secret、.dev.vars、.env、.wrangler 或私人材料。
此模板不支持自动解析远端 Git LFS pointer；完整性不符时拒绝读取，不绕过校验。

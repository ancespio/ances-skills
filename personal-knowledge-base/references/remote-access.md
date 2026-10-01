# 远程只读接入：先选择路线

远程接入可选；本地 Markdown、Obsidian 与 qmd 不依赖云端。不要因模板提供某条路线就替用户决定迁移、停服或购买资源。

| 选择 | GitHub 单仓只读 MCP | GPT Actions + Cloudflare AI Search |
| --- | --- | --- |
| 适合 | 需要 MCP 客户端、Plugin/App；希望直接检索指定仓库 | 已使用私人 GPT Actions；需要 AI Search 检索 |
| 检索 | 完整 commit 的 KV 快照，关键词排序，非向量 | Cloudflare AI Search 索引 |
| Literature | 支持，排除说明和模板 | 当前模板未接入 |
| Context | 稳定层默认检索，日记按需 | 稳定层默认检索，日记按需 |
| PDF 全文 | 哈希验证后分页读取 | 哈希验证后分页读取 |
| 客户端认证 | OAuth；GitHub 仅验证允许的用户身份 | Action 专用 Bearer token |
| 同步 | Cron 分批建立完整快照 | GitHub webhook 增量，Cron 续跑全量 |
| 配置入口 | wrangler.mcp.jsonc / src/mcp-index.ts | wrangler.jsonc / src/index.ts |
| 教程 | [完整 MCP 流程](github-readonly-mcp.md) | [完整 Actions 流程](cloudflare-gateway-gpts.md) |

两条路线使用不同 Worker 名称、域名、KV 和客户端凭据。选择其一即可；并存时分别验收，不能复用 OAuth KV 或以新部署覆盖旧 Worker。账户是否支持所选客户端和 AI Search，应现场验证；不可承诺所有套餐均可用。

## Agent 开始前收集

只向用户询问无法从本地或已授权平台确认的信息：

- 知识库本地路径、私有 GitHub owner/repository、主分支（当前模板按 main）。
- 选择哪条路线、Cloudflare 账户和独立 Gateway 工作目录，是否允许创建付费资源/安装项目依赖/部署。
- 远程可读范围：Wiki、Literature、Context 中哪些内容可上传；模板会读取仓库内全部 context，不能把 local-only 当成远程保护。
- 客户端类型和可用权限；MCP 允许登录的 GitHub 用户名，Actions 的私人 GPT 管理权。
- 一个已摄入 source slug、相关查询词、已通过 QC 的 original 与 zh-abstract，用于最终真实读取验收。

知识库与 Gateway 分仓。公开 skill 只包含代码和占位符，不含真实材料、账号配置、token、App ID 或服务器地址。GitHub PAT 与客户端认证凭据分离。用户在平台/安全终端输入 secret，Agent 不要求贴进对话，不写入命令参数、日志、文档或 Git。

## 可直接交给 Agent 的配置 Prompt

```text
使用 personal-knowledge-base 为我的现有知识库配置可选远程只读访问。
先读 references/remote-access.md，检查实际环境并向我解释 MCP 与 GPT Actions
两条路线的差异，保留我的选择权；不要关闭或覆盖已有服务。
确定路线后按相应完整指南执行，在独立 Gateway 目录安装项目级依赖和部署。
先确认私有仓库、远程可读范围、资源费用及部署权限。
你可完成资源配置、模板参数化、测试、同步和客户端指导；
必须由我完成的网页登录、授权、付款或密钥输入才暂停给出精确步骤。
不要让我粘贴密钥。部署后用实际客户端完成检索、全文分页和身份校验，
报告版本 commit、检索模式、同步进度及仍未验证项。不要把部署成功当成阅读成功。
```

“自主完成”不代表绕过用户的登录、授权或付费决策。每阶段记录无密钥检查点，失败在原步骤恢复，不重复创建资源。

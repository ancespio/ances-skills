# PDF Derived 摄入规范

## 目录

1. [目标与证据边界](#目标与证据边界)
2. [摄入前向用户确认](#摄入前向用户确认)
3. [目录与文件契约](#目录与文件契约)
4. [工具选择](#工具选择)
5. [PREPARE -> DERIVE -> QC -> INGEST](#prepare---derive---qc---ingest)
6. [转录与翻译规则](#转录与翻译规则)
7. [质量门槛](#质量门槛)
8. [检索与 Gateway](#检索与-gateway)
9. [失败与回退](#失败与回退)

## 目标与证据边界

PDF 仍是唯一原始证据。`transcript.md` 是方便 LLM 阅读、引用和定位的主要全文层；中文摘要和全文译文只是辅助阅读层。PDF、转录和译文共享同一个 source identity：

- 不为转录或译文新建 source 页。
- 不因转录、OCR、翻译或回答次数增加 `source_count` 或 confidence。
- source 页继续指向 raw PDF，同时登记 derived 路径和状态。
- 所有 derived Markdown 必须 `graph-excluded: true`。
- 只有 raw 哈希、manifest identity 和目标 artifact 哈希全部一致，才可把 derived 视为可用阅读层。

## 摄入前向用户确认

用户给出 PDF 或要求批量摄入 PDF 时，先说明并确认：

1. **文件与权限**：PDF 已放入 `raw/pdfs/`，raw 保持只读；若文件受密码保护，要求用户先提供可读取副本，不尝试绕过保护。
2. **代表性与版式**：首次配置准备 2-3 份代表性 PDF，至少覆盖常见单栏、双栏、扫描/OCR 或复杂表格中的实际类型。
3. **语言策略**：所有文章默认生成中文辅助摘要；中文原文只生成摘要，非中文 PDF 写入 `abstract.zh-CN.md`。全文译文会显著增加成本和审校量；不超过 80,000 字符且不超过 30 页的短篇或常规篇均询问并建议翻译，超长篇（超过任一阈值）建议只保留摘要，只有用户明确坚持才全文翻译。
4. **术语偏好**：询问是否有固定译法；若无，先读取现有 concept/entity 的 `title` 与 `aliases` 生成术语表。
5. **存储成本**：完整解析产物、页面图片和中间文件可能明显大于原 PDF。若启用 Git，同用户确认 Git LFS 和仓库容量。
6. **运行环境**：优先使用项目内 Python 3.10-3.12 环境；先检测 MinerU、Docling、OCR 与模型缓存，不全局安装，不重复安装已有依赖。

低风险默认值：MinerU 主用、Docling 回退、自动判断 OCR、只生成摘要译文、保留完整解析产物。

## 目录与文件契约

```text
wiki/derived/pdfs/<source-slug>/
├── transcript.md
├── abstract.zh-CN.md
├── translation.zh-CN.md
├── manifest.json
├── assets/
└── intermediate/<engine>/
```

- `transcript.md`：规范化全文，保留标题层级、公式、表格、引用、图片链接和 `<!-- page: N -->` 页锚。
- `abstract.zh-CN.md`：非中文来源的摘要译文；中文来源不创建。
- `translation.zh-CN.md`：只有用户明确授权后才创建的全文译文。
- `manifest.json`：记录 raw identity、解析器、页数、语言、质量状态、翻译状态、warnings 和所有 artifact 的 SHA-256。
- `assets/`：转录实际引用的图片和图表。
- `intermediate/<engine>/`：解析器的可审计输出，不作为主要阅读入口。

推荐把运行环境和缓存放在 `.local/pdf-ingest/`，并忽略 `.venv/`、`cache/`、`work/`。若项目使用 Git，`assets/` 与 `intermediate/` 使用 Git LFS；模型、缓存、日志和临时 work 不进 Git。

### `transcript.md` 最小 frontmatter

```yaml
---
type: derived-transcript
date: YYYY-MM-DD
source_slug: "source-slug"
raw_file: "raw/pdfs/source.pdf"
raw_sha256: "<64-char-hex>"
language: "en"
generator: "mineru"
generator_version: "<version>"
generated_at: "<ISO-8601>"
ocr_used: true | false | unknown
quality_status: needs-review | pass | failed
graph-excluded: true
---
```

### 译文最小 frontmatter

```yaml
---
type: derived-translation
date: YYYY-MM-DD
source_slug: "source-slug"
derived_from: "transcript.md"
raw_file: "raw/pdfs/source.pdf"
raw_sha256: "<64-char-hex>"
source_language: "en"
target_language: "zh-CN"
translation_scope: "abstract" # 或 full
translator: "llm-agent"
generated_at: "<ISO-8601>"
glossary_sources:
  - "wiki/concepts/example.md"
quality_status: needs-review | pass | failed
graph-excluded: true
---
```

## 工具选择

| 顺序 | 工具 | 适用场景 | 处理方式 |
|---|---|---|---|
| 1 | MinerU | 论文、单栏/双栏、公式、表格、混合文本与图片 | 默认主流程，优先使用本地 pipeline 与自动 OCR |
| 2 | Docling | MinerU 失败、结构严重错乱、特定表格或版式表现更好 | 使用 Markdown/JSON 输出作为回退 |
| 3 | 人工/视觉复核 | 两个解析器都无法可靠恢复文字，或关键公式/表格不可判定 | 标记 failed/needs-review，停止知识提升并向用户报告 |

先检查已有项目依赖。不要因为 CLI 不在 PATH 就重复安装：先检查项目 venv、局部 npm/Python 目录和 wrapper。新建环境时固定依赖版本并保存 lock/requirements 记录。

## PREPARE -> DERIVE -> QC -> INGEST

### 1. PREPARE

1. 确认 PDF 位于 `raw/pdfs/` 且只读。
2. 读取或创建对应 source slug；重摄入时复用已有 slug。
3. 计算 raw SHA-256，并与已有 source 页核对。
4. 检查目标 `wiki/derived/pdfs/<slug>/` 是否已存在。不得静默覆盖；先比较 raw hash、manifest 和生成版本，再提出重建方案。
5. 检测 Python、MinerU、Docling、模型缓存、磁盘空间和 Git LFS。

### 2. DERIVE

1. 在临时 work 目录运行 MinerU，不直接写最终目录。
2. 失败或关键结构不可用时改用 Docling；保留实际使用引擎和版本。
3. 规范化输出：清理非法控制字符，重写图片相对链接，注入连续页锚，复制完整 engine 产物。
4. 检测语言。所有文章默认生成中文辅助摘要；非中文 PDF 写入 `abstract.zh-CN.md`，中文原文生成同语言摘要。生成全文译文前，按短篇、常规篇、超长篇规则给出对应建议并询问用户。
5. 生成 manifest，逐个记录除 manifest 自身外的 artifact path、bytes 和 SHA-256。

### 3. QC

1. raw SHA 必须与 PREPARE 记录一致。
2. PDF 页数必须与 manifest `page_count` 一致，页锚必须从 1 连续到末页。
3. 检查所有本地图片链接存在，公式与表格不是空占位。
4. 每份文档至少抽查首、中、尾页面；双栏论文检查阅读顺序，扫描件检查 OCR 错字和乱码。
5. 比较标题、作者、摘要、章节、参考文献和关键数字；译文抽查术语一致性与否定关系。
6. 只有通过门槛才设置 `quality_status: pass`；否则保持 `needs-review` 或 `failed`。MinerU 与 Docling 均失败时停止 INGEST 的知识提升部分。

### 4. INGEST

1. 创建或更新原 source 页，不新建 derived source。
2. 追加 `derived_manifest`、`derived_transcript`、适用的译文路径、`derived_status` 和 `derived_last_verified`。若由维护脚本处理，finalizer 在核验 raw SHA-256 后同步这些可验证路径和状态；仅修复历史元数据时使用 `--sync-source-only`。
3. 以 raw PDF 为证据提取或更新 concept/entity；derived 仅作为读取层。
4. 不因 derived 改变任何 `source_count` 或 confidence。
5. 更新索引、日志和 qmd；默认 collection 排除 derived，独立 collection 仅供显式全文读取。

## 转录与翻译规则

- 优先忠实保留原文，不在 transcript 中“润色”作者表达。
- 保留公式、脚注、引用编号、表格标题、图注、原始术语和页锚。
- 翻译前扫描 `wiki/concepts/*.md` 与 `wiki/entities/*.md` 的 `title`/`aliases`，生成术语表并在译文 frontmatter 记录来源。
- 首次出现的关键术语采用“中文译名（Original Term）”；技术名、量表名、模型名可保留英文。
- 译文不得消除原文的不确定性、否定、条件或分歧。
- 回答引用仍指向 source 页和 raw identity；可附 derived 路径帮助定位，但不能把译文当作新证据。

## 质量门槛

通过状态至少满足：

- raw、source、manifest 的 SHA identity 一致。
- manifest 记录的所有 artifact 均存在，bytes 与 SHA-256 一致，且没有未登记产物。
- derived Markdown 均 `graph-excluded: true`。
- 页锚数量和顺序与 PDF 页数一致。
- 图片链接无断裂；关键表格、公式、章节和参考文献可读。
- source 页 derived 状态与 manifest 一致。
- lint 包含正常和篡改回归测试。

## 检索与 Gateway

本地 qmd 推荐配置：

- 普通 `wiki` collection 忽略 `derived/**`。
- 建立 `derived` collection，设置 `includeByDefault: false`，并忽略 `**/intermediate/**`。
- 默认 Query 只检索 source/concept/entity/synthesis/context；需要逐行核对 PDF 时显式选择 `derived`。
- 安全查询入口在 hybrid 超时或失败后降级到 BM25，再降级到 `rg`；每次返回实际模式和原因。默认 `rg` 同样排除 derived。

远程 Gateway 不把 derived 放进默认语义索引。先调用 `getVerifiedSource` 查看 `availableTextVariants`，再调用只读接口：

```http
GET /v1/sources/{slug}/text
    ?variant=original|zh-abstract|zh-full
    &from_line=1
    &max_lines=200
```

Worker 必须在同一个 synced commit 校验 source raw SHA、manifest raw identity 和目标 artifact SHA，分页响应返回 raw/derived 路径与哈希、生成时间、commit、warnings 和下一行位置。

## 失败与回退

- **模型或依赖缺失**：报告缺失项和预计影响，获得授权后只安装到项目内环境。
- **MinerU 失败**：保留诊断信息，使用 Docling 重试。
- **两者均失败**：manifest 标记 failed，source 页记录状态，不创建/更新知识结论。
- **页锚、表格或图片不完整**：保持 needs-review，不以“有大部分文字”为由通过。
- **译文不确定**：保留原始术语并标记待审，不自造确定译名。
- **已有 derived 与 raw hash 不同**：视为需要重建，不覆盖旧产物，先按项目备份和确认规则执行。

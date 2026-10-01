# 来源 Metadata 核验

## 何时做

在用户授权摄入、重新摄入或更新来源信息时主动补充题录。普通查询、保存整理页和刷新索引不触发全库改写。不建立额外后台抓取服务。

## 获取顺序

1. 读取实际原件首页、版权页与相关正文，识别题名、作者顺序、年份、标识符和版本。
2. 按 DOI、arXiv ID、PMID 或题名加作者匹配出版商、arXiv、Crossref、PubMed 等对应条目。网络查找只采信实际读取的资料，不用模型记忆填空。
3. 区分预印本、正式版和具体 PDF；正式版题录不能冒充预印本自身的出版信息。版本关系写 related_versions。
4. 只填有依据且有用途的字段；只有年份就填 publication_year，不制造月日。未知为空或省略；冲突同时保留值与依据，标 needs-review。

## 字段与证据示例

下面是虚构的结构示例，不可原样写入真实 source：

```yaml
author: "示例作者甲, 示例作者乙"
authors:
  - name: "示例作者甲"
    orcid: ""
    affiliations: ["示例机构"]
  - name: "示例作者乙"
publication_type: conference-paper
publication_year: 2025
venue: "示例会议"
version: preprint
abstract: |
  从实际原件逐字核对的原始摘要。
metadata_checked_at: "2026-10-01"
metadata_status: partial
metadata_evidence:
  - fields: [title, authors, abstract, version]
    kind: pdf
    raw_file: raw/pdfs/example-paper.pdf
    locator: "第 1 页标题、作者栏及摘要"
    checked_at: "2026-10-01"
metadata_conflicts: []
```

可选字段包括出版商、卷期页码/文章号、DOI/arXiv/PMID/PMCID/ISBN/ISSN、作者 ORCID/机构、关键词、资助、许可、代码/数据/补充材料、更正和撤稿信息。网页依据记录 kind、url、locator、checked_at。引用次数仅在实际获取时记录提供方、获取时间及计数，不用它推导知识库 confidence。

## 不混淆四种状态

- `metadata_status: verified`：已填入字段经过核对，不表示所有字段齐全。
- `last_verified` 与 raw SHA：原件身份核验，不等于题录核验。
- `derived_status`：辅助阅读层 QC，不等于论文结论正确。
- `source_count/confidence`：独立外部证据覆盖，不受题录补齐次数影响。

author 保留显示兼容用途，并与有序 authors 一致。原始摘要写 abstract；中文 Summary 是知识库分析，不冒充原摘要。metadata 更新不改 raw、不重建 derived identity，不自行提高 confidence。页面模板见 [page-templates.md](page-templates.md)。

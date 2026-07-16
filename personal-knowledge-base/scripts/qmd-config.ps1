param(
    [switch]$Update
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$qmdRoot = Join-Path $repoRoot '.local\qmd'
$configDir = Join-Path $qmdRoot '.qmd'
$configPath = Join-Path $configDir 'index.yml'
$qmdScript = Join-Path $PSScriptRoot 'qmd.ps1'

if (-not (Test-Path -LiteralPath $configDir)) {
    & $qmdScript init
    if ($LASTEXITCODE -ne 0) {
        throw 'qmd init failed.'
    }
}

$wikiPath = Join-Path $repoRoot 'wiki'
$contextPath = Join-Path $repoRoot 'context'
$derivedPath = Join-Path $wikiPath 'derived'

$config = @"
collections:
  wiki:
    path: $wikiPath
    pattern: "**/*.md"
    ignore:
      - "derived/**"
      - "outputs/lint-*.md"
  context:
    path: $contextPath
    pattern: "**/*.md"
  derived:
    path: $derivedPath
    pattern: "**/*.md"
    ignore:
      - "**/intermediate/**"
    includeByDefault: false
models:
  embed: hf:Qwen/Qwen3-Embedding-0.6B-GGUF/Qwen3-Embedding-0.6B-Q8_0.gguf
  generate: hf:tobil/qmd-query-expansion-1.7B-gguf/qmd-query-expansion-1.7B-q4_k_m.gguf
  rerank: hf:ggml-org/Qwen3-Reranker-0.6B-Q8_0-GGUF/qwen3-reranker-0.6b-q8_0.gguf
"@

[System.IO.File]::WriteAllText(
    $configPath,
    ($config.Trim() + [Environment]::NewLine),
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "qmd configuration written to $configPath"

if ($Update) {
    & $qmdScript update
    exit $LASTEXITCODE
}

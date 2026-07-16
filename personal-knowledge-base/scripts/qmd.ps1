param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$QmdArgs
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$qmdRoot = Join-Path $repoRoot '.local\qmd'
$qmdEntry = Join-Path $qmdRoot 'node_modules\@tobilu\qmd\bin\qmd'

if (-not $env:QMD_EMBED_MODEL) {
    $env:QMD_EMBED_MODEL = 'hf:Qwen/Qwen3-Embedding-0.6B-GGUF/Qwen3-Embedding-0.6B-Q8_0.gguf'
}

if (-not $env:QMD_RERANK_CONTEXT_SIZE) {
    $env:QMD_RERANK_CONTEXT_SIZE = '1024'
}

if (-not $env:QMD_EMBED_PARALLELISM) {
    $env:QMD_EMBED_PARALLELISM = '1'
}

if (-not (Test-Path -LiteralPath $qmdEntry)) {
    throw "Local qmd is not installed. Run: npm install --prefix .local/qmd"
}

$node = Get-Command node -ErrorAction Stop | Select-Object -First 1

Push-Location $qmdRoot
try {
    & $node.Source $qmdEntry @QmdArgs
    $exitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

exit $exitCode

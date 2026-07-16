param(
    [Parameter(Mandatory = $true)]
    [string]$DerivedQuery,

    [switch]$IncludeHybrid,

    [string]$HybridQuery,

    [string]$ExpectedHybridPath
)

$ErrorActionPreference = 'Stop'

$queryScript = Join-Path $PSScriptRoot 'qmd-query.ps1'
$default = & $queryScript -Query $DerivedQuery -TimeoutSeconds 1 -Limit 5 | ConvertFrom-Json
if (@($default.results).Count -ne 0) {
    throw 'Default fallback query leaked derived content.'
}

$derived = & $queryScript -Query $DerivedQuery -TimeoutSeconds 1 -Limit 5 -Collection derived | ConvertFrom-Json
$files = @($derived.results | ForEach-Object {
    if ($_ -is [string]) { $_ } else { $_.file }
})
if (-not ($files -match 'transcript\.md')) {
    throw 'Explicit derived query did not return transcript.md.'
}
if ($files -match 'intermediate') {
    throw 'Explicit derived fallback leaked intermediate content.'
}

if ($IncludeHybrid) {
    if (-not $HybridQuery -or -not $ExpectedHybridPath) {
        throw 'IncludeHybrid requires HybridQuery and ExpectedHybridPath.'
    }
    $hybrid = & $queryScript -Query $HybridQuery -TimeoutSeconds 90 -Limit 5 | ConvertFrom-Json
    if ($hybrid.mode -ne 'hybrid') {
        throw "Expected stable reranked hybrid mode, got $($hybrid.mode): $($hybrid.fallback_reason)"
    }
    if ($hybrid.query_strategy -ne 'structured') {
        throw "Expected structured hybrid strategy, got $($hybrid.query_strategy)."
    }
    if (-not (@($hybrid.results.file) -match $ExpectedHybridPath)) {
        throw 'Hybrid query did not return the expected concept page.'
    }
}

Write-Host 'qmd query isolation checks passed.'

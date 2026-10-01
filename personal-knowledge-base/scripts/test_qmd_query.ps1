param(
    [string]$DerivedQuery,

    [switch]$LiteratureFallbackChecks,

    [switch]$IncludeHybrid,

    [string]$HybridQuery,

    [string]$ExpectedHybridPath
)

$ErrorActionPreference = 'Stop'

$queryScript = Join-Path $PSScriptRoot 'qmd-query.ps1'

if ($LiteratureFallbackChecks) {
    # Load only the production fallback function, avoiding model or network dependencies.
    $tokens = $null
    $parseErrors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile($queryScript, [ref]$tokens, [ref]$parseErrors)
    if ($parseErrors.Count -gt 0) { throw 'Query script failed to parse.' }
    $fallback = $ast.Find({
        param($node)
        $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-RgFallback'
    }, $true)
    if (-not $fallback) { throw 'Production fallback function is missing.' }
    . ([scriptblock]::Create($fallback.Extent.Text))

    $workspaceRoot = Split-Path -Parent $PSScriptRoot
    $fixtureBase = [System.IO.Path]::GetFullPath((Join-Path $workspaceRoot '.local\qmd\.qmd'))
    $testId = [guid]::NewGuid().ToString('N')
    $repoRoot = Join-Path $fixtureBase "query-check-$testId"
    $fixtures = @{
        'wiki/knowledge.md' = 'qa-shared-scope'
        'wiki/outputs/lint-probe.md' = 'qa-excluded-guide'
        'context/profile.md' = 'qa-shared-scope'
        'literature/调研.md' = 'qa-shared-scope'
        'literature/README.md' = 'qa-excluded-guide'
        'literature/templates/probe.md' = 'qa-excluded-guide'
        'literature/subtopic/README.md' = 'qa-nested-reading'
        'wiki/derived/pdfs/demo/transcript.md' = 'qa-derived-scope'
        'wiki/derived/pdfs/demo/intermediate/raw.md' = 'qa-derived-scope'
    }
    try {
        foreach ($relative in $fixtures.Keys) {
            $path = Join-Path $repoRoot $relative
            [void][System.IO.Directory]::CreateDirectory((Split-Path -Parent $path))
            [System.IO.File]::WriteAllText($path, $fixtures[$relative], [System.Text.UTF8Encoding]::new($false))
        }
        $results = @(Invoke-RgFallback -Query 'qa-shared-scope' -Limit 20)
        if ($results.Count -ne 3 -or -not ($results -match 'literature') -or -not ($results -match 'context') -or -not ($results -match 'knowledge.md')) {
            throw 'Default fallback must include wiki, context and literature.'
        }
        foreach ($scope in @('wiki', 'context', 'literature')) {
            $results = @(Invoke-RgFallback -Query 'qa-shared-scope' -Limit 20 -Collection $scope)
            if ($results.Count -ne 1 -or -not ($results -match "[\\/]$scope[\\/]")) {
                throw "Explicit $scope fallback escaped its collection."
            }
        }
        foreach ($scope in @('', 'literature')) {
            if (@(Invoke-RgFallback -Query 'qa-excluded-guide' -Limit 20 -Collection $scope).Count -ne 0) {
                throw 'Fallback leaked literature guides, templates or wiki lint reports.'
            }
            if (@(Invoke-RgFallback -Query 'qa-nested-reading' -Limit 20 -Collection $scope).Count -ne 1) {
                throw 'Only the root literature README should be excluded.'
            }
        }
        if (@(Invoke-RgFallback -Query 'qa-derived-scope' -Limit 20).Count -ne 0) {
            throw 'Default fallback leaked derived content.'
        }
        $results = @(Invoke-RgFallback -Query 'qa-derived-scope' -Limit 20 -Collection derived)
        if ($results.Count -ne 1 -or -not ($results -match 'transcript.md')) {
            throw 'Explicit derived fallback must include transcript and exclude intermediate.'
        }
        if (@(Invoke-RgFallback -Query 'qa-shared-scope' -Limit 1).Count -ne 1) {
            throw 'Fallback exceeded its global result limit.'
        }
        if (@(Invoke-RgFallback -Query 'qa-shared-scope' -Limit 20 -Collection unknown).Count -ne 0) {
            throw 'Unknown collection must not broaden fallback scope.'
        }
        Write-Host 'Literature/default/explicit collection fallback checks passed (12 assertions).'
    }
    finally {
        # Back up every owned fixture to the workspace TMP before removing the test directory.
        $resolvedFixture = [System.IO.Path]::GetFullPath($repoRoot)
        if (-not $resolvedFixture.StartsWith($fixtureBase + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw 'Test cleanup target escaped the fixture base.'
        }
        if (Test-Path -LiteralPath $resolvedFixture) {
            $backupRoot = Join-Path $workspaceRoot 'TMP'
            [void][System.IO.Directory]::CreateDirectory($backupRoot)
            $audit = @()
            foreach ($file in Get-ChildItem -LiteralPath $resolvedFixture -Recurse -File) {
                $relative = $file.FullName.Substring($resolvedFixture.Length + 1)
                $backup = Join-Path $backupRoot ("qmd-check-$testId-" + ($relative -replace '[\\/]', '-'))
                Copy-Item -LiteralPath $file.FullName -Destination $backup
                if ((Get-FileHash -LiteralPath $file.FullName).Hash -ne (Get-FileHash -LiteralPath $backup).Hash) {
                    throw 'Fixture backup verification failed; cleanup stopped.'
                }
                $audit += "$relative -> $backup"
            }
            [System.IO.File]::WriteAllText((Join-Path $backupRoot "qmd-check-$testId-audit.txt"), ($audit -join [Environment]::NewLine), [System.Text.UTF8Encoding]::new($false))
            Remove-Item -LiteralPath $resolvedFixture -Recurse
        }
    }
}

if (-not $DerivedQuery) {
    if ($LiteratureFallbackChecks -and -not $IncludeHybrid) { exit 0 }
    throw 'DerivedQuery is required for live index checks.'
}

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

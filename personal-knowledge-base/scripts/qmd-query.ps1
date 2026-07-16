param(
    [Parameter(Mandatory = $true)]
    [string]$Query,

    [ValidateRange(1, 20)]
    [int]$Limit = 5,

    [ValidateRange(1, 600)]
    [int]$TimeoutSeconds = 90,

    [ValidateRange(1, 40)]
    [int]$CandidateLimit = 5,

    [string]$Collection,

    [switch]$Expand
)

$qmdScript = Join-Path $PSScriptRoot 'qmd.ps1'
$repoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-QmdProcess {
    param(
        [string[]]$Arguments,
        [int]$Timeout
    )

    $hostPath = (Get-Command powershell.exe -ErrorAction Stop).Source
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $hostPath
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.CreateNoWindow = $true
    $commandArguments = @('-NoProfile', '-File', $qmdScript) + $Arguments
    $startInfo.Arguments = ($commandArguments | ForEach-Object {
        '"' + ([string]$_ -replace '"', '\"') + '"'
    }) -join ' '

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    [void]$process.Start()

    if (-not $process.WaitForExit($Timeout * 1000)) {
        $process.Kill()
        $process.WaitForExit()
        return [pscustomobject]@{
            ExitCode = $null
            TimedOut = $true
            StdOut = $process.StandardOutput.ReadToEnd()
            StdErr = $process.StandardError.ReadToEnd()
        }
    }

    return [pscustomobject]@{
        ExitCode = $process.ExitCode
        TimedOut = $false
        StdOut = $process.StandardOutput.ReadToEnd()
        StdErr = $process.StandardError.ReadToEnd()
    }
}

function Convert-QmdJson {
    param([string]$Text)

    if (-not $Text.Trim()) {
        return @()
    }
    return @($Text | ConvertFrom-Json)
}

$collectionArgs = @()
if ($Collection) {
    $collectionArgs = @('-c', $Collection)
}

$queryLine = ($Query -replace '\s+', ' ').Trim()
$hybridQuery = if ($Expand) {
    $queryLine
}
else {
    "lex: $queryLine`nvec: $queryLine"
}
$queryStrategy = if ($Expand) { 'expanded' } else { 'structured' }

$hybridArgs = @(
    'query',
    $hybridQuery,
    '-n',
    $Limit.ToString(),
    '-C',
    $CandidateLimit.ToString(),
    '--format',
    'json'
) + $collectionArgs
$hybrid = Invoke-QmdProcess -Arguments $hybridArgs -Timeout $TimeoutSeconds
$fallbackReason = $null

if (-not $hybrid.TimedOut -and $hybrid.ExitCode -eq 0) {
    try {
        $results = Convert-QmdJson $hybrid.StdOut
        [pscustomobject]@{
            mode = 'hybrid'
            query_strategy = $queryStrategy
            fallback_reason = $null
            results = @($results)
        } | ConvertTo-Json -Depth 12
        exit 0
    }
    catch {
        $fallbackReason = "hybrid returned invalid JSON: $($_.Exception.Message)"
    }
}
elseif ($hybrid.TimedOut) {
    $fallbackReason = "hybrid timed out after $TimeoutSeconds seconds"
}
else {
    $fallbackReason = "hybrid failed with exit code $($hybrid.ExitCode): $($hybrid.StdErr.Trim())"
}

$noRerankArgs = @(
    'query',
    $hybridQuery,
    '-n',
    $Limit.ToString(),
    '-C',
    $CandidateLimit.ToString(),
    '--no-rerank',
    '--format',
    'json'
) + $collectionArgs
$noRerank = Invoke-QmdProcess -Arguments $noRerankArgs -Timeout $TimeoutSeconds
if (-not $noRerank.TimedOut -and $noRerank.ExitCode -eq 0) {
    try {
        $results = Convert-QmdJson $noRerank.StdOut
        if (@($results).Count -gt 0) {
            [pscustomobject]@{
                mode = 'hybrid-no-rerank'
                query_strategy = $queryStrategy
                fallback_reason = $fallbackReason
                results = @($results)
            } | ConvertTo-Json -Depth 12
            exit 0
        }
        $fallbackReason = "$fallbackReason; hybrid without rerank returned no results"
    }
    catch {
        $fallbackReason = "$fallbackReason; hybrid without rerank returned invalid JSON: $($_.Exception.Message)"
    }
}
elseif ($noRerank.TimedOut) {
    $fallbackReason = "$fallbackReason; hybrid without rerank timed out after $TimeoutSeconds seconds"
}
else {
    $fallbackReason = "$fallbackReason; hybrid without rerank failed with exit code $($noRerank.ExitCode): $($noRerank.StdErr.Trim())"
}

$searchArgs = @('search', $Query, '-n', $Limit.ToString(), '--format', 'json') + $collectionArgs
$search = Invoke-QmdProcess -Arguments $searchArgs -Timeout 30
if (-not $search.TimedOut -and $search.ExitCode -eq 0) {
    try {
        $results = Convert-QmdJson $search.StdOut
        if (@($results).Count -gt 0) {
            [pscustomobject]@{
                mode = 'bm25'
                query_strategy = $queryStrategy
                fallback_reason = $fallbackReason
                results = @($results)
            } | ConvertTo-Json -Depth 12
            exit 0
        }
        $fallbackReason = "$fallbackReason; BM25 returned no results"
    }
    catch {
        $fallbackReason = "$fallbackReason; BM25 returned invalid JSON: $($_.Exception.Message)"
    }
}
else {
    $fallbackReason = "$fallbackReason; BM25 failed or timed out"
}

$rgResults = @(if ($Collection -eq 'derived') {
    & rg -n -i -F --glob '*.md' --glob '!**/intermediate/**' -- $Query `
        (Join-Path $repoRoot 'wiki\derived') 2>$null |
        Select-Object -First $Limit
}
else {
    & rg -n -i -F --glob '*.md' --glob '!**/derived/**' -- $Query `
        (Join-Path $repoRoot 'wiki') (Join-Path $repoRoot 'context') 2>$null |
        Select-Object -First $Limit
})
[pscustomobject]@{
    mode = 'rg'
    query_strategy = $queryStrategy
    fallback_reason = $fallbackReason
    results = $rgResults
} | ConvertTo-Json -Depth 12

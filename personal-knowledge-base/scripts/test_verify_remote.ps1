param()
$ErrorActionPreference = 'Stop'
$previousToken = [Environment]::GetEnvironmentVariable('KB_MCP_ACCESS_TOKEN')
$previousActionToken = [Environment]::GetEnvironmentVariable('KB_GATEWAY_ACTION_TOKEN')
$fixture = @{ requests = [System.Collections.Generic.List[object]]::new(); mode = 'normal' }
$commit = 'a' * 40
$origin = 'https://example.com'
function Invoke-RestMethod {
    param($Uri, $Method, $Headers, $ContentType, $Body)
    if ($Uri -eq "$origin/health") {
        if ($fixture.mode -eq 'actions') { return @{ ok = $true; syncedCommit = $commit; pendingFullSync = $null } }
        return @{ ok = $true; mode = 'keyword' }
    }
    if ($Uri -eq "$origin/openapi.json") {
        return @{
            info = @{ version = 'fixture' }
            paths = @{
                '/v1/query' = @{ post = @{ operationId = 'queryKnowledgeBase'; requestBody = @{ content = @{ 'application/json' = @{ schema = @{ properties = @{ include_context = @{ description = 'Persona, project context, and the Context guide are always searched. Set true to additionally trace diary history.' } } } } } } } }
                '/v1/sources/{slug}' = @{ get = @{ operationId = 'getVerifiedSource' } }
                '/v1/sources/{slug}/text' = @{ get = @{ operationId = 'getVerifiedSourceText' } }
            }
        }
    }
    if ($Uri -like '*/.well-known/*') {
        return @{
            authorization_endpoint = "$origin/authorize"
            token_endpoint = "$origin/oauth/token"
            registration_endpoint = "$origin/oauth/register"
        }
    }
    if ($Method -ne 'Post' -or -not $Headers) {
        $error = [System.Exception]::new('unauthorized fixture')
        $error | Add-Member -NotePropertyName Response -NotePropertyValue @{ StatusCode = 401 }
        throw $error
    }
    $request = $Body | ConvertFrom-Json
    if ($Uri -eq "$origin/v1/query") {
        $kind = if ($request.include_context) { 'context-diary' } else { 'context-persona' }
        return @{ syncedCommit = $commit; context = @(@{ kind = $kind; path = "context/$kind.md" }) }
    }
    $fixture.requests.Add($request)
    if ($request.method -eq 'initialize') { return @{ result = @{ protocolVersion = '2025-03-26' } } }
    if ($request.method -eq 'tools/list') {
        return @{ result = @{ tools = @('queryKnowledgeBase', 'getKnowledgeDocument', 'getVerifiedSource', 'getVerifiedSourceText') | ForEach-Object { @{ name = $_; annotations = @{ readOnlyHint = $true } } } } }
    }
    $args = $request.params.arguments
    if ($request.params.name -eq 'queryKnowledgeBase') {
        $value = @{ mode = 'keyword'; commit = $commit }
    } elseif ($request.params.name -eq 'getKnowledgeDocument') {
        $value = @{ commit = $commit; content = 'note'; complete = $true }
    } elseif ($request.params.name -eq 'getVerifiedSource') {
        $value = @{ commit = $commit; integrityStatus = 'verified'; availableTextVariants = @('original', 'zh-abstract') }
    } else {
        $value = @{
            syncedCommit = $commit; fromLine = $args.from_line; content = 'fixture text'
            complete = ($args.from_line -eq 21); nextLine = 21
            rawSha256 = ('b' * 64); derivedSha256 = ('c' * 64)
        }
        if ($fixture.mode -eq 'wrong-commit') { $value.syncedCommit = 'd' * 40 }
    }
    return @{ result = @{ content = @(@{ type = 'text'; text = ($value | ConvertTo-Json -Depth 10) }) } }
}
function Assert-Fails([scriptblock]$Action, [string]$Message) {
    $failed = $false
    try { & $Action | Out-Null } catch { $failed = $true }
    if (-not $failed) { throw $Message }
}
try {
    [Environment]::SetEnvironmentVariable('KB_MCP_ACCESS_TOKEN', '')
    $result = & "$PSScriptRoot/verify-mcp.ps1" -WorkerUrl $origin
    if ($result.authenticatedReading -notlike 'not-verified*') { throw 'Anonymous check falsely claimed authenticated success.' }
    [Environment]::SetEnvironmentVariable('KB_MCP_ACCESS_TOKEN', 'fixture-not-a-real-token')
    $arguments = @{ WorkerUrl = $origin; Query = 'fixture'; SourceSlug = 'paper'; DocumentPath = 'literature/note.md'; ExpectedCommit = $commit }
    $result = & "$PSScriptRoot/verify-mcp.ps1" @arguments
    if ($result.authenticatedReading -ne 'pass') { throw 'Authenticated fixture failed.' }
    $reads = @($fixture.requests | Where-Object { $_.params.name -eq 'getVerifiedSourceText' })
    if ($reads.Count -ne 4) { throw 'Both variants must read two pages.' }
    foreach ($read in $reads) {
        if ($read.params.arguments.commit -ne $commit) { throw 'A read was not commit-pinned.' }
    }
    $fixture.mode = 'wrong-commit'
    Assert-Fails { & "$PSScriptRoot/verify-mcp.ps1" @arguments } 'Changed text commit was accepted.'
    Assert-Fails { & "$PSScriptRoot/verify-mcp.ps1" -WorkerUrl 'http://example.com' } 'Insecure origin was accepted.'
    Assert-Fails { & "$PSScriptRoot/verify-gateway.ps1" -WorkerUrl $origin } 'Actions verifier accepted the MCP route.'
    $fixture.mode = 'actions'
    [Environment]::SetEnvironmentVariable('KB_GATEWAY_ACTION_TOKEN', 'fixture-not-a-real-action-token')
    & "$PSScriptRoot/verify-gateway.ps1" -WorkerUrl $origin -ExpectedCommit $commit | Out-Null
    Assert-Fails { & "$PSScriptRoot/verify-mcp.ps1" -WorkerUrl $origin } 'MCP verifier accepted the Actions route.'
    Write-Output 'Remote verifier fixtures passed: both routes, anonymous/authenticated, paging, commit pinning, mismatch, HTTPS, route isolation.'
} finally {
    [Environment]::SetEnvironmentVariable('KB_MCP_ACCESS_TOKEN', $previousToken)
    [Environment]::SetEnvironmentVariable('KB_GATEWAY_ACTION_TOKEN', $previousActionToken)
}

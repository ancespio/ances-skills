param(
    [Parameter(Mandatory = $true)][uri]$WorkerUrl,
    [string]$ExpectedCommit,
    [string]$Query,
    [string]$SourceSlug,
    [string]$DocumentPath
)
$ErrorActionPreference = 'Stop'
if ($WorkerUrl.Scheme -ne 'https' -or $WorkerUrl.AbsolutePath -ne '/' -or $WorkerUrl.Query -or $WorkerUrl.UserInfo) {
    throw 'WorkerUrl must be an HTTPS origin without credentials, path or query.'
}
$base = $WorkerUrl.AbsoluteUri.TrimEnd('/')
$health = Invoke-RestMethod -Uri "$base/health"
if (-not $health.ok -or $health.mode -ne 'keyword') { throw 'Not a keyword MCP deployment. Use verify-gateway.ps1 for Actions.' }
$discovery = Invoke-RestMethod -Uri "$base/.well-known/oauth-authorization-server"
foreach ($field in @('authorization_endpoint', 'token_endpoint', 'registration_endpoint')) {
    $endpoint = [uri]$discovery.$field
    if (-not $endpoint.IsAbsoluteUri -or $endpoint.GetLeftPart([System.UriPartial]::Authority) -ne $base) {
        throw "OAuth discovery has an unexpected $field origin."
    }
}
try {
    Invoke-RestMethod -Uri "$base/mcp" | Out-Null
    throw 'Anonymous MCP unexpectedly succeeded.'
} catch {
    if (-not $_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 401) { throw }
}
$token = [Environment]::GetEnvironmentVariable('KB_MCP_ACCESS_TOKEN')
if (-not $token) {
    [pscustomobject]@{ route = 'mcp'; discovery = 'pass'; anonymousStatus = 401; authenticatedReading = 'not-verified: no client OAuth token' }
    return
}
if (-not $Query -or -not $SourceSlug -or -not $DocumentPath) {
    throw 'Authenticated checks require Query, SourceSlug and an allowed knowledge/literature/context DocumentPath.'
}
$headers = @{ Authorization = "Bearer $token"; Accept = 'application/json, text/event-stream' }
function Invoke-Mcp([string]$Method, [hashtable]$Parameters) {
    $body = @{ jsonrpc = '2.0'; id = 1; method = $Method; params = $Parameters } | ConvertTo-Json -Depth 15 -Compress
    $response = Invoke-RestMethod -Uri "$base/mcp" -Method Post -Headers $headers -ContentType 'application/json' -Body $body
    if ($response.error -or $response.result.isError) { throw "MCP $Method failed; inspect the client without logging credentials." }
    return $response.result
}
function Invoke-Tool([string]$Name, [hashtable]$Arguments) {
    $result = Invoke-Mcp 'tools/call' @{ name = $Name; arguments = $Arguments }
    $content = @($result.content | Where-Object { $_.type -eq 'text' })
    if ($content.Count -ne 1) { throw 'Unexpected MCP tool result.' }
    return $content[0].text | ConvertFrom-Json
}
$init = Invoke-Mcp 'initialize' @{ protocolVersion = '2025-03-26'; capabilities = @{}; clientInfo = @{ name = 'kb-readonly-check'; version = '1.0.0' } }
$headers['MCP-Protocol-Version'] = $init.protocolVersion
$listed = Invoke-Mcp 'tools/list' @{}
$expected = @('queryKnowledgeBase', 'getKnowledgeDocument', 'getVerifiedSource', 'getVerifiedSourceText')
if (Compare-Object ($listed.tools.name | Sort-Object) ($expected | Sort-Object)) { throw 'Unexpected MCP tool set.' }
if (@($listed.tools | Where-Object { -not $_.annotations.readOnlyHint }).Count) { throw 'A tool is not marked read-only.' }
$search = Invoke-Tool 'queryKnowledgeBase' @{ query = $Query; include_diary = $false }
if ($search.mode -ne 'keyword' -or $search.commit -notmatch '^[a-f0-9]{40}$') { throw 'Invalid search baseline.' }
if ($ExpectedCommit -and $search.commit -ne $ExpectedCommit) { throw 'Snapshot differs from expected commit.' }
$commit = $search.commit
$document = Invoke-Tool 'getKnowledgeDocument' @{ path = $DocumentPath; commit = $commit; from_line = 1; max_lines = 20 }
if ($document.commit -ne $commit) { throw 'Document commit differs.' }
$source = Invoke-Tool 'getVerifiedSource' @{ slug = $SourceSlug; commit = $commit }
if ($source.commit -ne $commit -or $source.integrityStatus -ne 'verified') { throw 'Source verification failed.' }
foreach ($variant in @('original', 'zh-abstract')) {
    if ($variant -notin $source.availableTextVariants) { throw "$variant is not available in this source." }
    $page = Invoke-Tool 'getVerifiedSourceText' @{ slug = $SourceSlug; variant = $variant; commit = $commit; from_line = 1; max_lines = 20 }
    if ($page.syncedCommit -ne $commit -or $page.fromLine -ne 1 -or -not $page.content) { throw "$variant first page failed." }
    if ($page.rawSha256 -notmatch '^[a-f0-9]{64}$' -or $page.derivedSha256 -notmatch '^[a-f0-9]{64}$') { throw "$variant has invalid identity hashes." }
    if (-not $page.complete) {
        $next = $page.nextLine
        if ($next -le $page.fromLine) { throw "$variant pagination did not advance." }
        $page = Invoke-Tool 'getVerifiedSourceText' @{ slug = $SourceSlug; variant = $variant; commit = $commit; from_line = $next; max_lines = 20 }
        if ($page.syncedCommit -ne $commit -or $page.fromLine -ne $next) { throw "$variant second page failed." }
    }
}
[pscustomobject]@{ route = 'mcp'; commit = $commit; mode = $search.mode; tools = $expected; authenticatedReading = 'pass'; contextHistory = 'manual-check-required' }

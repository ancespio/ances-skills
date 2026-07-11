param(
  [Parameter(Mandatory = $true)]
  [string]$WorkerUrl
)

$base = $WorkerUrl.TrimEnd('/')
$health = Invoke-RestMethod -Uri "$base/health" -Method Get
$schema = Invoke-RestMethod -Uri "$base/openapi.json" -Method Get
$operations = @($schema.paths.PSObject.Properties.Value | ForEach-Object { $_.post.operationId; $_.get.operationId } | Where-Object { $_ })

if (-not $health.ok) { throw 'Gateway health check failed.' }
if (-not $health.syncedCommit) { throw 'Gateway has no syncedCommit; finish initial sync first.' }
if (@('queryKnowledgeBase', 'getVerifiedSource') | Where-Object { $_ -notin $operations }) {
  throw 'OpenAPI is missing one or more required read-only Actions.'
}

[pscustomobject]@{
  syncedCommit = $health.syncedCommit
  openApiVersion = $schema.info.version
  operations = $operations
} | Format-List

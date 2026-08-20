param(
  [Parameter(Mandatory = $true)]
  [string]$WorkerUrl,

  [string]$ExpectedCommit,

  [string]$PersonaQuery = '用户画像 项目状态 长期偏好',

  [string]$DiaryQuery = '最近完成了什么工作 日记'
)

$base = $WorkerUrl.TrimEnd('/')
$health = Invoke-RestMethod -Uri "$base/health" -Method Get
$schema = Invoke-RestMethod -Uri "$base/openapi.json" -Method Get
$operations = @($schema.paths.PSObject.Properties.Value | ForEach-Object { $_.post.operationId; $_.get.operationId } | Where-Object { $_ })
$requiredOperations = @('queryKnowledgeBase', 'getVerifiedSource', 'getVerifiedSourceText')
$contextDescription = $schema.paths.'/v1/query'.post.requestBody.content.'application/json'.schema.properties.include_context.description

if (-not $health.ok) { throw 'Gateway health check failed.' }
if (-not $health.syncedCommit) { throw 'Gateway has no syncedCommit; finish initial sync first.' }
if ($health.pendingFullSync) { throw 'Gateway still has a pending full sync; wait for scheduled continuation.' }
if (Compare-Object ($operations | Sort-Object) ($requiredOperations | Sort-Object)) {
  throw 'OpenAPI must expose exactly the three required read-only Actions.'
}
if ($contextDescription -ne 'Persona, project context, and the Context guide are always searched. Set true to additionally trace diary history.') {
  throw 'OpenAPI include_context semantics do not match the Context retrieval policy.'
}
if ($ExpectedCommit -and $health.syncedCommit -ne $ExpectedCommit) {
  throw 'Gateway syncedCommit does not match the expected KnowledgeBase commit.'
}

try {
  Invoke-RestMethod -Uri "$base/v1/query" -Method Post -ContentType 'application/json' -Body '{"query":"unauthorized probe"}' | Out-Null
  throw 'Unauthenticated query unexpectedly succeeded.'
} catch {
  if ([int]$_.Exception.Response.StatusCode -ne 401) { throw }
}

$authenticated = $false
$stableContextCount = $null
$diaryContextCount = $null
$actionToken = [Environment]::GetEnvironmentVariable('KB_GATEWAY_ACTION_TOKEN')
if ($actionToken) {
  $headers = @{ Authorization = "Bearer $actionToken" }
  $stableBody = @{ query = $PersonaQuery; include_context = $false } | ConvertTo-Json -Compress
  $diaryBody = @{ query = $DiaryQuery; include_context = $true } | ConvertTo-Json -Compress
  $stable = Invoke-RestMethod -Uri "$base/v1/query" -Method Post -Headers $headers -ContentType 'application/json' -Body $stableBody
  $history = Invoke-RestMethod -Uri "$base/v1/query" -Method Post -Headers $headers -ContentType 'application/json' -Body $diaryBody

  $stableDiary = @($stable.context | Where-Object { $_.kind -in @('context-diary', 'diary') -or $_.path -like 'context/diary/*' })
  $historyDiary = @($history.context | Where-Object { $_.kind -in @('context-diary', 'diary') -or $_.path -like 'context/diary/*' })
  if (@($stable.context).Count -eq 0) { throw 'Default query returned no persona/project/guide Context.' }
  if ($stableDiary.Count -ne 0) { throw 'Default query leaked diary Context.' }
  if ($historyDiary.Count -eq 0) { throw 'include_context=true returned no diary Context for the diary probe.' }
  if ($stable.syncedCommit -ne $health.syncedCommit -or $history.syncedCommit -ne $health.syncedCommit) {
    throw 'Query responses do not match the health syncedCommit.'
  }

  $authenticated = $true
  $stableContextCount = @($stable.context).Count
  $diaryContextCount = $historyDiary.Count
}

[pscustomobject]@{
  syncedCommitPrefix = $health.syncedCommit.Substring(0, [Math]::Min(12, $health.syncedCommit.Length))
  pendingFullSync = $false
  openApiVersion = $schema.info.version
  operations = $operations
  unauthenticatedQueryStatus = 401
  authenticatedQueries = $authenticated
  stableContextCount = $stableContextCount
  diaryContextCount = $diaryContextCount
} | Format-List

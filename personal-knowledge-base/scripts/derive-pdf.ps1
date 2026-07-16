param(
    [Parameter(Mandatory = $true)]
    [string]$RawFile,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9]+(?:-[a-z0-9]+)*$')]
    [string]$Slug,

    [ValidateSet('Auto', 'MinerU', 'Docling')]
    [string]$Engine = 'Auto',

    [ValidateSet('pipeline', 'hybrid-engine')]
    [string]$MinerUBackend = 'pipeline'
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$rawRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot 'raw'))
$rawPath = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $RawFile))
$runtimeRoot = Join-Path $repoRoot '.local\pdf-ingest'
$venvRoot = Join-Path $runtimeRoot '.venv'
$venvPython = Join-Path $venvRoot 'Scripts\python.exe'
$mineru = Join-Path $venvRoot 'Scripts\mineru.exe'
$docling = Join-Path $venvRoot 'Scripts\docling.exe'
$normalizer = Join-Path $PSScriptRoot 'normalize_pdf_derivative.py'
$targetParent = Join-Path $repoRoot 'wiki\derived\pdfs'
$target = Join-Path $targetParent $Slug
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$workRoot = Join-Path $runtimeRoot "work\$Slug-$timestamp"

if (-not $rawPath.StartsWith($rawRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "RawFile must stay under $rawRoot"
}
if (-not (Test-Path -LiteralPath $rawPath -PathType Leaf)) {
    throw "Raw file not found: $rawPath"
}
if ([System.IO.Path]::GetExtension($rawPath) -ne '.pdf') {
    throw 'RawFile must be a PDF.'
}
if (Test-Path -LiteralPath $target) {
    throw "Derived target already exists: $target"
}
if (-not (Test-Path -LiteralPath $venvPython)) {
    throw 'PDF ingest runtime is missing. Run scripts/setup-pdf-ingest.ps1 first.'
}

$env:PIP_CACHE_DIR = Join-Path $runtimeRoot 'cache\pip'
$env:HF_HOME = Join-Path $runtimeRoot 'cache\huggingface'
$env:MODELSCOPE_CACHE = Join-Path $runtimeRoot 'cache\modelscope'
$env:TORCH_HOME = Join-Path $runtimeRoot 'cache\torch'
$env:MINERU_TOOLS_CONFIG_JSON = Join-Path $runtimeRoot 'cache\mineru.json'

[void](New-Item -ItemType Directory -Path $workRoot -Force)

function Normalize-Output {
    param(
        [string]$EngineName,
        [string]$EngineVersion,
        [string]$EngineOutput
    )

    $normalized = Join-Path $workRoot "normalized-$EngineName"
    $normalizerOutput = & $venvPython $normalizer `
        --raw $rawPath `
        --raw-relative ($RawFile.Replace('\', '/')) `
        --slug $Slug `
        --engine $EngineName `
        --engine-version $EngineVersion `
        --engine-output $EngineOutput `
        --target $normalized
    if ($LASTEXITCODE -ne 0) {
        return $null
    }
    Write-Verbose ($normalizerOutput -join [Environment]::NewLine)
    return $normalized
}

function Publish-Normalized {
    param([string]$NormalizedPath)

    $resolvedWork = [System.IO.Path]::GetFullPath($workRoot)
    $resolvedNormalized = [System.IO.Path]::GetFullPath($NormalizedPath)
    $resolvedTargetParent = [System.IO.Path]::GetFullPath($targetParent)
    if (-not $resolvedNormalized.StartsWith($resolvedWork, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Normalized output escaped the work directory.'
    }
    if (-not $resolvedTargetParent.StartsWith([System.IO.Path]::GetFullPath((Join-Path $repoRoot 'wiki\derived')), [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Derived target escaped wiki/derived.'
    }
    [void](New-Item -ItemType Directory -Path $targetParent -Force)
    Move-Item -LiteralPath $resolvedNormalized -Destination $target
    Write-Host "Derived PDF published: $target"
}

$errors = [System.Collections.Generic.List[string]]::new()

if ($Engine -in @('Auto', 'MinerU')) {
    $mineruOutput = Join-Path $workRoot 'mineru-output'
    $mineruVersion = (& $mineru --version 2>$null | Select-Object -First 1).Trim()
    & $mineru -p $rawPath -o $mineruOutput -b $MinerUBackend -m auto
    if ($LASTEXITCODE -eq 0) {
        try {
            $normalized = Normalize-Output -EngineName 'mineru' -EngineVersion $mineruVersion -EngineOutput $mineruOutput
            if ($normalized) {
                Publish-Normalized $normalized
                exit 0
            }
            $errors.Add('MinerU normalization failed.')
        }
        catch {
            $errors.Add("MinerU normalization failed: $($_.Exception.Message)")
        }
    }
    else {
        $errors.Add("MinerU exited with code $LASTEXITCODE.")
    }
    if ($Engine -eq 'MinerU') {
        throw ($errors -join ' ')
    }
}

if ($Engine -in @('Auto', 'Docling')) {
    $doclingOutput = Join-Path $workRoot 'docling-output'
    $doclingVersion = (& $docling --version 2>$null | Select-Object -First 1).Trim()
    & $docling convert $rawPath `
        --to md `
        --to json `
        --image-export-mode referenced `
        --ocr `
        --pipeline standard `
        --device auto `
        --document-timeout 1800 `
        --output $doclingOutput
    if ($LASTEXITCODE -eq 0) {
        try {
            $normalized = Normalize-Output -EngineName 'docling' -EngineVersion $doclingVersion -EngineOutput $doclingOutput
            if ($normalized) {
                Publish-Normalized $normalized
                exit 0
            }
            $errors.Add('Docling normalization failed.')
        }
        catch {
            $errors.Add("Docling normalization failed: $($_.Exception.Message)")
        }
    }
    else {
        $errors.Add("Docling exited with code $LASTEXITCODE.")
    }
}

throw ($errors -join ' ')

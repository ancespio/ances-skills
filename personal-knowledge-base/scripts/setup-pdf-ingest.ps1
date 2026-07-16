param(
    [string]$PythonPath
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $repoRoot '.local\pdf-ingest'
$venvRoot = Join-Path $runtimeRoot '.venv'
$requirements = Join-Path $runtimeRoot 'requirements.txt'
$env:PIP_CACHE_DIR = Join-Path $runtimeRoot 'cache\pip'
$env:HF_HOME = Join-Path $runtimeRoot 'cache\huggingface'

if (-not $PythonPath) {
    $python = Get-Command python -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $python) {
        throw 'Python 3.10-3.12 was not found. Pass -PythonPath explicitly.'
    }
    $PythonPath = $python.Source
}

$version = & $PythonPath -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'
if ($LASTEXITCODE -ne 0 -or $version -notin @('3.10', '3.11', '3.12')) {
    throw "MinerU on Windows requires Python 3.10-3.12; found $version."
}

if (-not (Test-Path -LiteralPath $venvRoot)) {
    & $PythonPath -m venv $venvRoot
    if ($LASTEXITCODE -ne 0) {
        throw 'Failed to create the PDF ingest virtual environment.'
    }
}

$venvPython = Join-Path $venvRoot 'Scripts\python.exe'
& $venvPython -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to upgrade pip.'
}

& $venvPython -m pip install --requirement $requirements
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to install PDF ingest dependencies.'
}

& $venvPython -m pip freeze | Out-File (
    Join-Path $runtimeRoot 'requirements.lock.txt'
) -Encoding utf8NoBOM

Write-Host "PDF ingest runtime ready: $venvRoot"

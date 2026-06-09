# Instala tableconvert.py como comando global no Windows.
# Uso: .\scripts\install-tableconvert-global.ps1

$ErrorActionPreference = "Stop"

$repoScript = Join-Path $PSScriptRoot "tableconvert.py"
$binDir = Join-Path $env:USERPROFILE "bin"
$targetPy = Join-Path $binDir "tableconvert.py"
$targetCmd = Join-Path $binDir "tableconvert.cmd"

if (-not (Test-Path $repoScript)) {
    throw "Script não encontrado: $repoScript"
}

New-Item -ItemType Directory -Force -Path $binDir | Out-Null
Copy-Item -Path $repoScript -Destination $targetPy -Force

@(
    '@echo off',
    'python "%USERPROFILE%\bin\tableconvert.py" %*'
) | Set-Content -Path $targetCmd -Encoding ASCII

pip install -r (Join-Path $PSScriptRoot "requirements-tableconvert.txt")

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$binDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$binDir", "User")
    $env:Path = "$env:Path;$binDir"
    Write-Host "Adicionado ao PATH do usuário: $binDir"
}

Write-Host ""
Write-Host "Instalado. Reinicie o terminal e teste:"
Write-Host "  tableconvert config set-key SUA_API_KEY"
Write-Host "  tableconvert convert csv-to-markdown -d `"name,age`nJohn,30`""

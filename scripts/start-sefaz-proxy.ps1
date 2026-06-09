# Inicia o proxy SEFAZ local (certificado A1 no Windows)
param(
  [int]$Port = 3333,
  [string]$Secret = $env:SEFAZ_PROXY_SECRET,
  [switch]$Restart
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$proj = Join-Path $root "tools\sefaz-proxy"

if (-not $Secret) {
  Write-Host "Defina SEFAZ_PROXY_SECRET antes de iniciar." -ForegroundColor Yellow
  Write-Host '  $env:SEFAZ_PROXY_SECRET = [guid]::NewGuid().ToString("N")'
  exit 1
}

function Test-ProxyHealth([int]$p) {
  try {
    $r = Invoke-RestMethod -Uri "http://127.0.0.1:$p/health" -TimeoutSec 2
    return $r.ok -eq $true
  } catch {
    return $false
  }
}

function Stop-SefazProxyProcesses() {
  Get-Process -Name "sefaz-proxy" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Encerrando sefaz-proxy PID $($_.Id) ..." -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force
  }
  Start-Sleep -Seconds 1
}

$env:SEFAZ_PROXY_PORT = "$Port"
$env:SEFAZ_PROXY_SECRET = $Secret
$env:VECTRA_CNPJ = if ($env:VECTRA_CNPJ) { $env:VECTRA_CNPJ } else { "59650913000104" }
$env:SEFAZ_TP_AMB = if ($env:SEFAZ_TP_AMB) { $env:SEFAZ_TP_AMB } else { "1" }

if ($Restart) {
  Stop-SefazProxyProcesses
} elseif (Test-ProxyHealth $Port) {
  Write-Host "Proxy já responde em http://127.0.0.1:$Port/health" -ForegroundColor Yellow
  Write-Host "Para trocar o SEFAZ_PROXY_SECRET, pare o processo ou rode com -Restart:" -ForegroundColor Yellow
  Write-Host "  .\scripts\start-sefaz-proxy.ps1 -Restart"
  exit 0
}

Write-Host "SEFAZ Proxy em http://127.0.0.1:$Port (CNPJ $($env:VECTRA_CNPJ))" -ForegroundColor Green
Set-Location $proj

dotnet build -v q 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  $exe = Join-Path $proj "bin\Debug\net10.0\sefaz-proxy.exe"
  if (Test-Path $exe) {
    Write-Host "Build bloqueado (proxy em execução?). Usando binário existente..." -ForegroundColor Yellow
    & $exe
    exit $LASTEXITCODE
  }
  Write-Host "Falha no build. Se o proxy antigo estiver rodando: .\scripts\start-sefaz-proxy.ps1 -Restart" -ForegroundColor Red
  exit 1
}

dotnet run --no-build

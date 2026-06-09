# Sobe proxy SEFAZ (.NET) + Cloudflare Tunnel no Windows
param(
  [Parameter(Mandatory = $true)]
  [string]$TunnelToken,

  [string]$Secret = $env:SEFAZ_PROXY_SECRET,

  [int]$Port = 3333,

  [switch]$InstallService
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$proj = Join-Path $root "tools\sefaz-proxy"

if (-not $Secret) {
  Write-Host "Defina SEFAZ_PROXY_SECRET (mesmo valor que irá no Supabase)." -ForegroundColor Yellow
  Write-Host '  $env:SEFAZ_PROXY_SECRET = [guid]::NewGuid().ToString("N")'
  exit 1
}

$env:SEFAZ_PROXY_PORT = "$Port"
$env:SEFAZ_PROXY_SECRET = $Secret
$env:VECTRA_CNPJ = if ($env:VECTRA_CNPJ) { $env:VECTRA_CNPJ } else { "59650913000104" }
$env:SEFAZ_TP_AMB = if ($env:SEFAZ_TP_AMB) { $env:SEFAZ_TP_AMB } else { "1" }

function Test-ProxyHealth {
  try {
    $r = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 3
    return $r.ok -eq $true
  } catch {
    return $false
  }
}

Push-Location $proj
Write-Host "Compilando sefaz-proxy ..." -ForegroundColor DarkGray
dotnet build -v q | Out-Null
Pop-Location

Write-Host "Iniciando SEFAZ Proxy em http://127.0.0.1:$Port ..." -ForegroundColor Cyan
$proxyJob = Start-Job -ScriptBlock {
  param($ProjectDir, $Port, $Secret, $Cnpj, $TpAmb)
  $env:SEFAZ_PROXY_PORT = "$Port"
  $env:SEFAZ_PROXY_SECRET = $Secret
  $env:VECTRA_CNPJ = $Cnpj
  $env:SEFAZ_TP_AMB = $TpAmb
  Set-Location $ProjectDir
  dotnet run --no-build 2>&1
} -ArgumentList $proj, $Port, $Secret, $env:VECTRA_CNPJ, $env:SEFAZ_TP_AMB

$deadline = (Get-Date).AddSeconds(45)
while (-not (Test-ProxyHealth) -and (Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 1
}

if (-not (Test-ProxyHealth)) {
  Receive-Job $proxyJob -ErrorAction SilentlyContinue | Write-Host
  Stop-Job $proxyJob -ErrorAction SilentlyContinue
  Remove-Job $proxyJob -ErrorAction SilentlyContinue
  Write-Host "Proxy não respondeu em /health. Verifique certificado A1 e .NET 8." -ForegroundColor Red
  exit 1
}

Write-Host "Proxy OK. Subindo Cloudflare Tunnel..." -ForegroundColor Green

if ($InstallService) {
  $existing = Get-Service -Name Cloudflared -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "Serviço 'Cloudflared' já existe (Status: $($existing.Status))." -ForegroundColor Yellow
    Write-Host "Não instale outro serviço. Opções:" -ForegroundColor Yellow
    Write-Host "  A) Dashboard: adicione sefaz-proxy.vectracargo.com.br → localhost:3333 no túnel que o serviço já usa"
    Write-Host "  B) Rode só o túnel SEFAZ em foreground: .\scripts\start-sefaz-tunnel-foreground.ps1 -TunnelToken <TOKEN>"
    Write-Host "  C) Se tiver certeza: cloudflared service uninstall  (quebra o túnel atual!) e depois -InstallService"
    exit 1
  }
  & cloudflared service install $TunnelToken
  Write-Host "Serviço cloudflared instalado. Inicie em services.msc ou: net start cloudflared" -ForegroundColor Green
  Write-Host "Mantenha o proxy rodando (agende start-sefaz-proxy.ps1 no logon ou Task Scheduler)." -ForegroundColor Yellow
  exit 0
}

Write-Host "URL pública esperada: https://sefaz-proxy.vectracargo.com.br" -ForegroundColor Green
Write-Host "Secrets Supabase:" -ForegroundColor Yellow
Write-Host "  SEFAZ_PROXY_URL=https://sefaz-proxy.vectracargo.com.br"
Write-Host "  SEFAZ_PROXY_SECRET=$Secret"
Write-Host ""
Write-Host "Ctrl+C encerra tunnel e proxy." -ForegroundColor DarkGray

try {
  & cloudflared tunnel --no-autoupdate run --token $TunnelToken
} finally {
  Stop-Job $proxyJob -ErrorAction SilentlyContinue
  Remove-Job $proxyJob -ErrorAction SilentlyContinue
}

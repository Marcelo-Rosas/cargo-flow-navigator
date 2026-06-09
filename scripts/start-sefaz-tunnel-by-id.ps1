# Conecta o túnel sefaz-proxy-vectra usando token gerado pelo cloudflared CLI (evita copiar/colar errado).
param(
  [string]$TunnelId = "2877141d-4c5d-4d85-8dd2-86057d11b88f"
)

$ErrorActionPreference = "Stop"

$connectors = (& cloudflared tunnel info $TunnelId 2>&1 | Out-String)
if (($connectors -split "`n").Count -gt 8) {
  Write-Host "Muitos conectores ativos. Rode primeiro: .\scripts\reset-sefaz-tunnel.ps1" -ForegroundColor Yellow
}

Write-Host "Gerando token para túnel $TunnelId ..." -ForegroundColor Cyan
$token = (& cloudflared tunnel token $TunnelId 2>&1 | Out-String).Trim()
if (-not $token -or $token.Length -lt 50 -or $token -match 'error|failed') {
  Write-Host "Falha ao obter token. Rode: cloudflared tunnel login" -ForegroundColor Red
  Write-Host $token
  exit 1
}

$config = Join-Path (Split-Path -Parent $PSScriptRoot) "tools\sefaz-proxy\cloudflared.run.yml"

Write-Host "Token OK ($($token.Substring(0, 12))...). Conectando (HTTP/2)..." -ForegroundColor Green
Write-Host "Mantenha este terminal aberto. Ctrl+C encerra o túnel." -ForegroundColor DarkGray

& cloudflared tunnel --config $config run --token $token

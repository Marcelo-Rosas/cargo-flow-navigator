# Roda o túnel sefaz-proxy-vectra em primeiro plano (NÃO instala serviço Windows).
# Use quando o serviço Cloudflared já existir para outro túnel (ex.: ollama-tunnel).
param(
  [Parameter(Mandatory = $true)]
  [string]$TunnelToken
)

$ErrorActionPreference = "Stop"
$TunnelToken = $TunnelToken.Trim().Trim('"').Trim("'")

if ($TunnelToken -match '^<.*>$' -or $TunnelToken.Length -lt 50) {
  Write-Host "Token inválido. Cole o token REAL do dashboard (não use <TOKEN> nem o Tunnel UUID)." -ForegroundColor Red
  Write-Host "Caminho: Zero Trust → Networks → Tunnels → sefaz-proxy-vectra → Configure / Install connector" -ForegroundColor Yellow
  Write-Host "Comando de referência: cloudflared tunnel --no-autoupdate run --token eyJhIjoi..." -ForegroundColor DarkGray
  exit 1
}

$svc = Get-Service -Name Cloudflared -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq 'Running') {
  Write-Host "Serviço Windows 'Cloudflared' já ativo ($($svc.DisplayName))." -ForegroundColor DarkGray
  Write-Host "Este script abre um SEGUNDO conector só para sefaz-proxy-vectra (OK em foreground)." -ForegroundColor DarkGray
  Write-Host "Não use 'cloudflared service install' de novo." -ForegroundColor Yellow
}

Write-Host "Conectando túnel sefaz-proxy-vectra (2877141d-...) ..." -ForegroundColor Cyan
Write-Host "Hostname esperado: https://sefaz-proxy.vectracargo.com.br" -ForegroundColor Green
Write-Host "Ctrl+C para encerrar." -ForegroundColor DarkGray

$config = Join-Path (Split-Path -Parent $PSScriptRoot) "tools\sefaz-proxy\cloudflared.run.yml"
& cloudflared tunnel --config $config run --token $TunnelToken

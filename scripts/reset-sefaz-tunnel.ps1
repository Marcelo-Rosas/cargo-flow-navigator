# Remove conectores fantasmas e processos cloudflared extras do túnel SEFAZ.
param(
  [string]$TunnelId = "2877141d-4c5d-4d85-8dd2-86057d11b88f"
)

$ErrorActionPreference = "Stop"

Write-Host "Limpando conectores stale do túnel $TunnelId ..." -ForegroundColor Cyan
& cloudflared tunnel cleanup $TunnelId 2>&1

$service = Get-CimInstance Win32_Service -Filter "Name='Cloudflared'" -ErrorAction SilentlyContinue
$servicePid = $service.ProcessId

$extra = Get-Process -Name cloudflared -ErrorAction SilentlyContinue |
  Where-Object { $servicePid -eq 0 -or $_.Id -ne $servicePid }

if ($extra) {
  Write-Host "Encerrando $($extra.Count) processo(s) cloudflared extra (serviço ollama PID $servicePid preservado)..." -ForegroundColor Yellow
  $extra | Stop-Process -Force
} else {
  Write-Host "Nenhum cloudflared extra além do serviço Windows." -ForegroundColor DarkGray
}

Start-Sleep -Seconds 2
Write-Host ""
Write-Host "Suba de novo (1 terminal):" -ForegroundColor Green
Write-Host "  .\scripts\start-sefaz-tunnel-by-id.ps1"

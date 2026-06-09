# Define secrets da consulta SEFAZ no Supabase (project epgedaiukjippepujuzc)
param(
  [Parameter(Mandatory = $true)]
  [string]$ProxyUrl,

  [string]$ProxySecret = $env:SEFAZ_PROXY_SECRET,

  [switch]$GenerateSecret,

  [string]$VectraCnpj = "59650913000104",

  [string]$ProjectRef = "epgedaiukjippepujuzc"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProxySecret)) {
  if ($GenerateSecret) {
    $ProxySecret = [guid]::NewGuid().ToString("N")
    Write-Host "Secret gerado: $ProxySecret" -ForegroundColor Green
    Write-Host "Inicie o proxy com o MESMO valor:" -ForegroundColor Yellow
    Write-Host "  `$env:SEFAZ_PROXY_SECRET = `"$ProxySecret`""
    Write-Host "  .\scripts\start-sefaz-proxy.ps1 -Restart"
  } else {
    Write-Host "ProxySecret vazio neste terminal." -ForegroundColor Red
    Write-Host ""
    Write-Host "Opção A — gerar automaticamente:" -ForegroundColor Yellow
    Write-Host '  .\scripts\set-sefaz-supabase-secrets.ps1 -ProxyUrl "https://sefaz-proxy.vectracargo.com.br" -GenerateSecret'
    Write-Host ""
    Write-Host "Opção B — definir manualmente no mesmo terminal:" -ForegroundColor Yellow
    Write-Host '  $env:SEFAZ_PROXY_SECRET = [guid]::NewGuid().ToString("N")'
    Write-Host '  .\scripts\set-sefaz-supabase-secrets.ps1 -ProxyUrl "https://sefaz-proxy.vectracargo.com.br"'
    exit 1
  }
}

if ($ProxyUrl -match '/$') {
  $ProxyUrl = $ProxyUrl.TrimEnd('/')
}

Write-Host "Configurando secrets no projeto $ProjectRef ..." -ForegroundColor Cyan
supabase secrets set "SEFAZ_PROXY_URL=$ProxyUrl" --project-ref $ProjectRef
supabase secrets set "SEFAZ_PROXY_SECRET=$ProxySecret" --project-ref $ProjectRef
supabase secrets set "VECTRA_CNPJ=$VectraCnpj" --project-ref $ProjectRef

Write-Host "Secrets aplicados. Redeploy opcional:" -ForegroundColor Green
Write-Host "  supabase functions deploy validate-document --project-ref $ProjectRef"

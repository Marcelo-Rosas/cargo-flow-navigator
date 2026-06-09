# Sincroniza GEMINI_API_KEY → Supabase (produção)
# Por padrão: GOOGLE_API_KEY de supabase/.env.local
# Com -UseShellEnv: usa $env:GEMINI_API_KEY (quando o ping “funciona” mas .env.local está bloqueado)
#
# Uso:
#   .\scripts\sync-gemini-secret.ps1
#   .\scripts\sync-gemini-secret.ps1 -UseShellEnv

param([switch]$UseShellEnv)

$ErrorActionPreference = 'Stop'
$projectRef = 'epgedaiukjippepujuzc'
$supabaseLocal = Join-Path $PSScriptRoot '..\supabase\.env.local'
$functionsEnv = Join-Path $PSScriptRoot '..\supabase\functions\.env.local.functions.txt'
$pingScript = Join-Path $PSScriptRoot 'ping-gemini.mjs'

function Get-KeySuffix([string]$k) {
  if (-not $k -or $k.Length -lt 4) { return '????' }
  return $k.Substring($k.Length - 4)
}

$key = $null
$source = ''

if ($UseShellEnv -and $env:GEMINI_API_KEY) {
  $key = $env:GEMINI_API_KEY.Trim().Trim('"').Trim("'")
  $source = 'shell GEMINI_API_KEY'
}
elseif (Test-Path $supabaseLocal) {
  Get-Content $supabaseLocal | ForEach-Object {
    if ($_ -match '^GOOGLE_API_KEY=(.+)$') {
      $key = $matches[1].Trim().Trim('"').Trim("'")
      $source = 'supabase/.env.local GOOGLE_API_KEY'
    }
  }
}

if (-not $key -and (Test-Path $functionsEnv)) {
  Get-Content $functionsEnv | ForEach-Object {
    if ($_ -match '^GEMINI_API_KEY=(.+)$') {
      $key = $matches[1].Trim().Trim('"').Trim("'")
      $source = 'functions/.env.local.functions.txt'
    }
  }
}

if (-not $key) {
  Write-Error 'Nenhuma chave encontrada. Use GOOGLE_API_KEY em supabase/.env.local ou -UseShellEnv.'
}

Write-Host "Fonte: $source"
Write-Host "Sufixo da chave a enviar: ***$(Get-KeySuffix $key) (len=$($key.Length))"

if ($env:GEMINI_API_KEY -and (Get-KeySuffix $env:GEMINI_API_KEY) -ne (Get-KeySuffix $key)) {
  Write-Host ''
  Write-Host 'AVISO: $env:GEMINI_API_KEY termina em' (Get-KeySuffix $env:GEMINI_API_KEY) 'mas voce vai enviar' (Get-KeySuffix $key)
  Write-Host '       Se o ping normal passa e o app falha, rode: .\scripts\sync-gemini-secret.ps1 -UseShellEnv'
  Write-Host ''
}

Write-Host 'Validando esta chave (nao usa shell)...'
node $pingScript --key=$key
if ($LASTEXITCODE -ne 0) {
  Write-Error "Chave de $source falha no ping. Corrija GOOGLE_API_KEY em supabase/.env.local ou use -UseShellEnv."
}

Write-Host "Atualizando secret GEMINI_API_KEY no Supabase ($projectRef)..."
supabase secrets set "GEMINI_API_KEY=$key" --project-ref $projectRef
Write-Host 'OK. Aguarde ~1 min e teste o modal de aprovacao.'

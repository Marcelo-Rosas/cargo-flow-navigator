param([int]$MaxAttempts = 200)

Set-Location (Join-Path $PSScriptRoot '..')
$benignPatterns = @(
  'already exists',
  'already member',
  'duplicate key',
  'duplicate_object',
  'does not exist, skipping'
)

for ($i = 1; $i -le $MaxAttempts; $i++) {
  Write-Host ""
  Write-Host "=== Push attempt $i ==="
  $log = Join-Path $env:TEMP "supabase-db-push-$i.log"
  supabase db push --linked --yes 2>&1 | Tee-Object -FilePath $log
  if ($LASTEXITCODE -eq 0) {
    Write-Host "db push completed successfully."
    exit 0
  }

  $text = Get-Content $log -Raw -ErrorAction SilentlyContinue
  if ($text -notmatch 'Applying migration (\d{14})') {
    Write-Host "Could not parse failing migration. Log: $log"
    exit $LASTEXITCODE
  }
  $version = $Matches[1]

  $isBenign = $false
  foreach ($pat in $benignPatterns) {
    if ($text -like "*$pat*") { $isBenign = $true; break }
  }

  if (-not $isBenign) {
    Write-Host "Non-idempotent error on $version - stopping."
    exit $LASTEXITCODE
  }

  Write-Host "Marking $version as applied..."
  supabase migration repair --status applied --linked $version 2>&1 | Out-Host
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Max attempts reached."
exit 1

# Chama a Edge Function ensure-financial-document
# Uso: .\call-ensure-financial-document.ps1
# IMPORTANTE: Substitua $accessToken pelo token do usuário autenticado (não use anon key)

$accessToken = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjliMzVmMTk4LWY4NTMtNGEwMC05NzM0LTZjMjc0NGI0ZTczYyIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2VwZ2VkYWl1a2ppcHBlcHVqdXpjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJhYTU4NzE4NS1mYjQwLTQyNzYtODQzOS0zZWUxNTNhYTVhMWMiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzcxNTYzNjA1LCJpYXQiOjE3NzE1NjAwMDUsImVtYWlsIjoibWFyY2Vsby5yb3Nhc0B2ZWN0cmFjYXJnby5jb20uYnIiLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsX3ZlcmlmaWVkIjp0cnVlfSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc3MTUyODczOH1dLCJzZXNzaW9uX2lkIjoiNzM4YjViOWMtMDE5Mi00MjY3LWE1NDYtOWExZGE0MDE4MjdiIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.Tz02WvmUK5UvcHcVFygLVjP2MFtoB8x0ipWlVi4FbU5ujuFPI8oirsj5aTxfCHuhqWGOjJX-zBICJWc2y8vQ1Q"

$sourceId = "aa87c27c-12d4-4397-8393-cc712a26a38d"
$body = '{"docType":"FAT","773648e6-42e6-4343-a218-a97dabcce80a":"' + $sourceId + '"}'

$headers = @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type"  = "application/json"
}

$url = "https://epgedaiukjippepujuzc.supabase.co/functions/v1/ensure-financial-document"

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body
    $response | ConvertTo-Json
} catch {
    Write-Host "Erro:" $_.Exception.Message
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
}

$b = "C:\Users\marce\cargo-flow-navigator\src\components\forms"

function Patch($file, $old, $new) {
  $c = Get-Content $file -Raw -Encoding UTF8
  if ($c.Contains($old)) {
    Set-Content $file $c.Replace($old, $new) -NoNewline -Encoding UTF8
    return $true
  }
  return $false
}

$f = "$b\ClientForm.tsx"
Patch $f "  const handleCnpjLookup = async () => {`n    const raw = form.getValues('cnpj') || '';" "  const handleCnpjLookup = async (rawValue?: string) => {`n    const raw = rawValue ?? form.getValues('cnpj') ?? '';"
$c = Get-Content $f -Raw -Encoding UTF8
$c = $c.Replace("cnpj: data.cnpj || null,", "cnpj: data.cnpj ? data.cnpj.replace(/\D/g, '') : null,")
Set-Content $f $c -NoNewline -Encoding UTF8
Write-Host "OK ClientForm"

$f = "$b\OwnerForm.tsx"
Patch $f "  const handleCnpjLookup = async () => {`n    const raw = form.getValues('cpf_cnpj') || '';" "  const handleCnpjLookup = async (rawValue?: string) => {`n    const raw = rawValue ?? form.getValues('cpf_cnpj') ?? '';"
$c = Get-Content $f -Raw -Encoding UTF8
$c = $c.Replace("cpf_cnpj: data.cpf_cnpj || null,", "cpf_cnpj: data.cpf_cnpj ? data.cpf_cnpj.replace(/\D/g, '') : null,")
Set-Content $f $c -NoNewline -Encoding UTF8
Write-Host "OK OwnerForm"

$f = "$b\ShipperForm.tsx"
Patch $f "  const handleCnpjLookup = async () => {`n    const raw = form.getValues('cnpj') || '';" "  const handleCnpjLookup = async (rawValue?: string) => {`n    const raw = rawValue ?? form.getValues('cnpj') ?? '';"
$c = Get-Content $f -Raw -Encoding UTF8
$c = $c.Replace("cnpj: data.cnpj || null,", "cnpj: data.cnpj ? data.cnpj.replace(/\D/g, '') : null,")
$c = $c.Replace("cpf: data.cpf || null,", "cpf: data.cpf ? data.cpf.replace(/\D/g, '') : null,")
Set-Content $f $c -NoNewline -Encoding UTF8
Write-Host "OK ShipperForm"

Write-Host "PRONTO - Reinicie: npm run dev"

# install-cfn-references.ps1
# Rodar de qualquer pasta no PowerShell:
#   C:\Users\marce\cargo-flow-navigator> .\install-cfn-references.ps1

$base = "C:\Users\marce\cargo-flow-navigator\.claude\skills\user\cargo-flow-navigator\references"
New-Item -ItemType Directory -Force -Path $base | Out-Null
Write-Host "Instalando referencias em $base..." -ForegroundColor Cyan

Set-Content "$base\orders.md" -Encoding UTF8 -Value @'
# Orders — Ordens de Servico / Kanban Operacional

## Tabela principal
`service_orders` — gerada a partir de cotacao aprovada (`quotes.status = 'converted'`)

Campos-chave:
```typescript
status: 'scheduled' | 'in_transit' | 'delivered' | 'completed' | 'cancelled'
quote_id: string
driver_id: string
vehicle_id: string
origin, destination: string
pickup_date, delivery_date: string  // ISO date
total_value: number                 // centavos
modality: 'ltl' | 'ftl' | 'dedicated'
```

## Arquivos relevantes
- `src/pages/Operational.tsx`
- `src/components/boards/OrderCard.tsx`
- `src/components/modals/OrderDetailModal.tsx`
- `src/components/forms/OrderForm.tsx`
- `src/hooks/useServiceOrders.ts`

## Fluxo de criacao
```
Quote aprovada -> botao "Converter em OS"
  -> service_orders (status: 'scheduled')
  -> workflow-orchestrator dispara 'order_created'
  -> notification-hub notifica motorista (WhatsApp)
```

## Transicoes de status (Kanban drag)
```
scheduled  -> in_transit  (motorista saiu para coleta)
in_transit -> delivered   (entrega realizada, aguarda POD)
delivered  -> completed   (POD confirmado / CT-e emitido)
qualquer   -> cancelled   (cancelamento manual, role: admin)
```

## React Query pattern
```typescript
import { useServiceOrders } from '@/hooks/useServiceOrders'
queryClient.invalidateQueries({ queryKey: ['quotes'] })
queryClient.invalidateQueries({ queryKey: ['service_orders'] })
```

## Eventos de workflow
- `order_created`    -> notifica motorista
- `order_in_transit` -> notifica cliente/embarcador
- `order_delivered`  -> solicita POD, dispara ciclo financeiro
- `order_completed`  -> fecha ciclo, gera fatura
'@

Set-Content "$base\fleet.md" -Encoding UTF8 -Value @'
# Fleet — Motoristas / Veiculos / Proprietarios

## Tabelas principais
`drivers`, `vehicles`, `vehicle_owners`

### drivers
```typescript
id, name, cpf, cnh_number, cnh_category: string
cnh_expiry: string   // ISO date — alertar se < 30 dias
phone: string        // DDI+DDD+numero ex: 5547999999999
status: 'active' | 'inactive' | 'suspended'
rntrc: string
```

### vehicles
```typescript
id, plate, renavam: string
type: 'toco' | 'truck' | 'carreta' | 'bitrem' | 'vanderleia'
axes: number
max_weight_kg: number
owner_id: string     // FK -> vehicle_owners
antt_rntrc: string
tracker_id?: string  // integracao Buonny
```

### vehicle_owners
```typescript
id, name, cpf_cnpj, rntrc: string
type: 'pf' | 'pj'
```

## Mapeamento peso -> veiculo (ANTT / Vectra)
```typescript
peso <= 6000   // toco    2 eixos
peso <= 12500  // truck   4 eixos
peso <= 25000  // carreta 5 eixos
peso <= 33000  // bitrem  7 eixos
```

## Arquivos relevantes
- `src/pages/Fleet.tsx`
- `src/components/fleet/DriverCard.tsx`
- `src/components/fleet/VehicleCard.tsx`
- `src/components/forms/DriverForm.tsx`
- `src/components/forms/VehicleForm.tsx`
- `src/hooks/useDrivers.ts`
- `src/hooks/useVehicles.ts`

## Qualificacao ANTT
- RNTRC ativo obrigatorio para viagens interestaduais
- CNH vencida -> bloquear atribuicao a OS
- Worker `driverQualificationWorker` monitora vencimentos

## Buonny (rastreamento)
```typescript
// Sempre via Edge Function — nunca direto no frontend
await supabaseInvoke('calculate-freight', {
  action: 'track_vehicle',
  tracker_id: vehicle.tracker_id
})
```
'@

Set-Content "$base\entities.md" -Encoding UTF8 -Value @'
# Entities — Clientes / Embarcadores

## Tabelas principais
`clients`, `shippers`

> shipper = quem contrata/paga o frete
> client  = destinatario final da carga (podem ser diferentes)

### clients
```typescript
id, name, cpf_cnpj, ie: string
email, phone: string
address: { street, number, complement, city, state, zip_code: string }
type: 'pf' | 'pj'
status: 'active' | 'inactive'
```

### shippers
```typescript
id, name, cpf_cnpj: string
email, phone: string
contact_name: string
address: { city, state, zip_code }
default_modality?: 'ltl' | 'ftl'
status: 'active' | 'inactive'
```

## Arquivos relevantes
- `src/pages/Clients.tsx`
- `src/pages/Shippers.tsx`
- `src/components/forms/ClientForm.tsx`
- `src/components/forms/ShipperForm.tsx`
- `src/hooks/useClients.ts`
- `src/hooks/useShippers.ts`

## Uso em cotacoes
```typescript
// QuoteForm passo 1 — autocomplete
quote.shipper_id -> shippers.id
quote.client_id  -> clients.id
```

## Validacoes
- CNPJ/CPF: lib `cpf-cnpj-validator` (ja e dependencia)
- Consulta Receita Federal: pendente

## ICMS
- Aliquota depende do par (origin_state, destination_state)
- Tabela: `icms_rates` — ver pricing.md
'@

Set-Content "$base\auth.md" -Encoding UTF8 -Value @'
# Auth — Autenticacao / Roles / ProtectedRoute

## Hook principal — NUNCA reimplementar
```typescript
import { useAuth } from '@/hooks/useAuth'
const { user, profile, role, signOut, loading } = useAuth()
```

## Roles
```typescript
type Role = 'admin' | 'financeiro' | 'operacional'
```

| Role          | Acesso                                         |
|---------------|------------------------------------------------|
| admin         | Tudo                                           |
| operacional   | OS, frota, documentos — sem financeiro         |
| financeiro    | Kanban financeiro, faturas — sem config        |

## Tabela profiles (1:1 com auth.users)
```typescript
id: string   // = auth.users.id
full_name: string
role: Role
email: string
avatar_url?: string
```

## ProtectedRoute
```typescript
// src/components/auth/ProtectedRoute.tsx — ja implementado
<ProtectedRoute requiredRole="admin"><ConfiguracoesPage /></ProtectedRoute>
<ProtectedRoute><DashboardPage /></ProtectedRoute>
```

## Supabase Auth
```typescript
await supabase.auth.signInWithPassword({ email, password })
await supabase.auth.signOut()
const { data: { session } } = await supabase.auth.getSession()
```

## Arquivos relevantes
- `src/hooks/useAuth.tsx`
- `src/components/auth/ProtectedRoute.tsx`
- `src/pages/Login.tsx`

## Anti-pattern
```typescript
// NAO fazer
const { data } = await supabase.auth.getUser()
// Correto
const { user } = useAuth()
```
'@

Set-Content "$base\financial.md" -Encoding UTF8 -Value @'
# Financial — Kanban Financeiro / FAT / PAG / Parcelas

## Tabelas principais
`financial_transactions`, `installments`, `invoices`

### financial_transactions
```typescript
id, service_order_id: string
type: 'receivable' | 'payable'    // FAT ou PAG
status: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled'
total_value: number               // centavos
due_date: string
paid_at?: string
payment_method?: 'pix' | 'boleto' | 'ted' | 'cheque'
counterpart_id: string
counterpart_type: 'shipper' | 'driver' | 'vehicle_owner'
```

### installments
```typescript
transaction_id: string
installment_number, total_installments: number
value: number   // centavos
due_date: string
status: 'pending' | 'paid' | 'overdue'
paid_at?: string
```

## Arquivos relevantes
- `src/pages/Financial.tsx`
- `src/components/boards/TransactionCard.tsx`
- `src/components/modals/TransactionDetailModal.tsx`
- `src/components/forms/PaymentForm.tsx`
- `src/hooks/useFinancialTransactions.ts`
- `src/hooks/useInstallments.ts`

## Kanban — colunas
```
A Receber (FAT) | A Pagar (PAG) | Concluidos
pending/partial | pending/partial| paid/cancelled
```

## Fluxo
```
OS completed -> workflow-orchestrator
  -> cria receivable (shipper) + payable (driver)
  -> status: 'pending'
  -> due_date = delivery_date + 30 dias
```

## Parcelamento
```typescript
import { createInstallments } from '@/lib/financialHelpers'
createInstallments({ transaction_id, total_value, count: 3, first_due: '2025-02-01' })
```

## Regras
- Overdue: due_date < hoje && status !== 'paid'
- Cancelar OS -> cancela transactions (trigger DB)
- Role `financeiro` acesso restrito a esta pagina
'@

Set-Content "$base\approvals.md" -Encoding UTF8 -Value @'
# Approvals — Workflow de Aprovacoes

## Tabelas principais
`approval_requests`, `approval_rules`, `approval_events`

### approval_requests
```typescript
id, entity_type: string   // 'quote' | 'service_order' | 'transaction'
entity_id: string
requested_by: string      // FK -> profiles
assigned_to?: string      // FK -> profiles
status: 'pending' | 'approved' | 'rejected' | 'cancelled'
reason?: string
created_at, resolved_at?: string
```

### approval_rules
```typescript
entity_type: string
condition: string         // ex: 'total_value > 500000' (centavos)
required_role: Role
auto_approve_below?: number
```

## Arquivos relevantes
- `src/pages/Approvals.tsx`
- `src/components/approvals/ApprovalQueue.tsx`
- `src/components/modals/ApprovalModal.tsx`
- `src/hooks/useApprovals.ts`

## Fluxo cotacao
```
QuoteForm submetido
  -> verifica approval_rules
  -> total_value > threshold -> cria approval_request
  -> notifica aprovador (notification-hub)
  -> quote.status = 'pending'

Aprovador decide em /aprovacoes
  -> workflow-orchestrator atualiza quote.status
  -> notifica solicitante
```

## React Query pattern
```typescript
const { data } = useApprovals({ status: 'pending', assigned_to: user.id })

await supabaseInvoke('workflow-orchestrator', {
  action: 'resolve_approval',
  request_id,
  decision: 'approved', // ou 'rejected'
  comment: 'ok'
})
queryClient.invalidateQueries({ queryKey: ['approvals'] })
queryClient.invalidateQueries({ queryKey: ['quotes'] })
```
'@

Set-Content "$base\documents.md" -Encoding UTF8 -Value @'
# Documents — CT-e / MDF-e / POD / Upload

## Tabelas principais
`documents`, `cte_records`, `pod_records`

### documents
```typescript
id, service_order_id: string
type: 'cte' | 'mdfe' | 'nfe' | 'pod' | 'other'
file_url: string   // URL publica Supabase Storage
file_name, mime_type: string
status: 'pending' | 'uploaded' | 'validated' | 'rejected'
uploaded_by: string
```

### cte_records
```typescript
id, service_order_id: string
cte_number, cte_key: string   // chave 44 digitos
issuer_cnpj: '59650913000104' // Vectra Cargo (fixo)
rntrc: '057854966'            // RNTRC Vectra (fixo)
xml_url?: string
pdf_url?: string              // DACTE
status: 'draft' | 'authorized' | 'cancelled'
sefaz_protocol?: string
issued_at?: string
```

### pod_records
```typescript
id, service_order_id: string
photo_urls: string[]
signature_url?: string
received_by: string
received_at: string
```

## Arquivos relevantes
- `src/pages/Documents.tsx`
- `src/components/documents/DocumentList.tsx`
- `src/components/documents/CTeDetail.tsx`
- `src/components/documents/PodCapture.tsx`
- `src/hooks/useDocuments.ts`
- `src/lib/supabaseStorage.ts`

## Upload
```typescript
import { uploadDocument } from '@/lib/supabaseStorage'
const { url } = await uploadDocument({
  file,
  bucket: 'documents',
  path: `orders/${order_id}/${type}/${file.name}`
})
```

## CT-e — dados fixos Vectra
```
CNPJ : 59.650.913/0001-04
RNTRC: 057854966
Cert A1 serial: 009FE30D067CEEDD022FE7
```
CT-e emitido via PHP (sped-cte) externo.
CFN registra resultado via workflow-orchestrator action: 'cte_issued'.

## Storage buckets
```
documents/ -> CT-e XML, DACTE PDF, NF-e
pods/      -> fotos POD, assinaturas
```
'@

# ── Patch pricing.md ─────────────────────────────────────────────────────────
$pricingPath = "$base\pricing.md"
if (Test-Path $pricingPath) {
    Add-Content -Path $pricingPath -Encoding UTF8 -Value @'

## Reajuste NTC Fev/2026
- +5,06% sobre tabela anterior
- Salario motorista: +7,00% | Pneu: +8,10%
- Aplicar em price_table_rows com reference_date >= 2026-02-01

## Over ANTT por faixa de distancia
```typescript
const overAnttPercent = (km: number): number => {
  if (km <= 800)  return 0.60
  if (km <= 1500) return 0.45
  if (km <= 2500) return 0.30
  return 0.20  // SC -> NE: mercado competitivo, over baixo
}
```

## Veiculo por peso taxado (Vectra)
```typescript
const vehicleByWeight = (kg: number) => {
  if (kg <= 6000)  return { type: 'toco',    axes: 2 }
  if (kg <= 12500) return { type: 'truck',   axes: 4 }
  if (kg <= 25000) return { type: 'carreta', axes: 5 }
  return { type: 'bitrem', axes: 7 }
}
```
'@
    Write-Host "  pricing.md -> patch NTC 2026 aplicado" -ForegroundColor Cyan
} else {
    Write-Host "  pricing.md nao encontrado — patch ignorado" -ForegroundColor Yellow
}

# ── Resultado ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Concluido!" -ForegroundColor Green
Get-ChildItem $base -Filter "*.md" | ForEach-Object {
    Write-Host "  $($_.Name)" -ForegroundColor Gray
}

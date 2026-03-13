---
document: Templates Spec
plan: plan-04-risk-workflow-memoria-calculo-risco-seguro
version: v0.1.0
created_at: 2026-03-07
---

# Templates — Artefatos PDF/Email + Fabrica de Temas

## 1. Visao geral

| Template | Formato | Trigger | Destinatario |
|---------|---------|---------|-------------|
| Relatorio de Risco da OS | PDF | Wizard step 4 (envio) | Arquivo + aprovador |
| Relatorio de Risco da VG | PDF | Todas as OS da trip avaliadas | Arquivo + aprovador |
| Relatorio de Roteirizacao | PDF | Calculo de distancia (webrouter) | Arquivo + motorista |
| Checklist Legal | PDF | OS criada / stage documentacao | Operacao |
| Email: Aprovacao pendente | Email | Wizard step 4 (envio para aprovacao) | Admin/aprovador |
| Email: Resultado da avaliacao | Email | Aprovacao/rejeicao | Solicitante |

---

## 2. Relatorio de Risco da OS

### 2.1 Estrutura do PDF

```
+==============================================================+
|  [LOGO VECTRA CARGO]                                         |
|  RELATORIO DE AVALIACAO DE RISCO                              |
|  Data: 07/03/2026 14:30                                      |
+==============================================================+

DADOS DA ORDEM DE SERVICO
---------------------------------------------------------
OS:              #OS-2026-0042
Cliente:         Transportes ABC Ltda
Embarcador:      Industria XYZ S/A
Motorista:       Joao da Silva (CPF: ***.***.***-00)
Veiculo:         ABC-1234 (Truck 3 eixos)
Origem:          Joinville/SC (CEP 89201-000)
Destino:         Guarulhos/SP (CEP 07010-000)
Distancia:       1.200 km
Valor da Carga:  R$ 180.000,00
Tipo de Carga:   Carga Geral

AVALIACAO DE CRITICIDADE
---------------------------------------------------------
Criticidade:     [██ ALTA]
Apolice:         RC-DC 1005500008136 (END 4011848)
Gerenciadora:    Buonny

Regras aplicadas:
  • Valor R$ 150.001 - 500.000 → ALTA
  • Distancia > 1.000 km → +1 nivel
  Resultado: ALTA (maximo entre regras)

VERIFICACAO BUONNY
---------------------------------------------------------
Status:          APROVADO
Consulta ID:     BNY-2026-001234
Data consulta:   05/03/2026 14:30
Validade ate:    03/06/2026
Cadastro:        Sim (ativo)
Monitoramento:   Ativado (ID: MON-2026-005678)

EXIGENCIAS E EVIDENCIAS
---------------------------------------------------------
  [✓] Consulta Buonny ........... Valida (05/03/2026)
  [✓] Cadastro Buonny ........... Cadastrado
  [✓] Monitoramento ............. Ativado
  [✓] Analise GR ................ Doc #GR-2026-042
  [✓] Rota documentada .......... 12 pracas de pedagio
  [✓] CNH motorista ............. Valida (doc #CNH-042)
  [✓] CRLV veiculo .............. Valido (doc #CRLV-042)

CUSTOS DE RISCO
---------------------------------------------------------
  Buonny Consulta:           R$ 13,76
  Buonny Cadastro:           R$ 42,10
  Buonny Monitoramento:      R$ 252,78
  ─────────────────────────────────
  Total:                     R$ 308,64

ROTA (RESUMO)
---------------------------------------------------------
  Joinville/SC → Curitiba/PR → Registro/SP → Guarulhos/SP
  Pracas de pedagio: 12
  Valor pedagio estimado: R$ 487,50

APROVACAO
---------------------------------------------------------
  Status:     PENDENTE DE APROVACAO GERENCIAL
  Aprovador:  Perfil: admin
  Solicitado: 07/03/2026 14:30
  Notas:      "Carga de alto valor, rota interestadual,
               monitoramento ativo conforme apolice."

+==============================================================+
|  Gerado automaticamente pelo sistema Cargo Flow Navigator     |
|  Este documento faz parte da trilha auditavel de risco.      |
|  Vectra Cargo Logistica — CNPJ: XX.XXX.XXX/0001-XX          |
+==============================================================+
```

### 2.2 Dados de entrada

```typescript
interface RiskReportData {
  // OS
  order: {
    os_number: string;
    client_name: string;
    shipper_name: string;
    driver_name: string;
    driver_cpf_masked: string;
    vehicle_plate: string;
    vehicle_type: string;
    origin: string;
    origin_cep: string;
    destination: string;
    destination_cep: string;
    km_distance: number;
    cargo_value: number;
    cargo_type: string;
  };

  // Avaliacao
  evaluation: {
    criticality: string;
    policy_name: string;
    policy_endorsement: string;
    risk_manager: string;
    rules_applied: Array<{ description: string; result: string }>;
  };

  // Buonny
  buonny: {
    status: string;
    consulta_id: string;
    consulta_date: string;
    validade: string;
    cadastro: boolean;
    monitoramento: boolean;
    monitoramento_id?: string;
  };

  // Exigencias
  requirements: Array<{
    name: string;
    met: boolean;
    detail: string;
  }>;

  // Custos
  costs: Array<{
    service: string;
    amount: number;
  }>;
  total_cost: number;

  // Rota
  route?: {
    summary: string;
    toll_count: number;
    toll_value: number;
  };

  // Aprovacao
  approval: {
    status: string;
    approver_role: string;
    requested_at: string;
    notes: string;
  };
}
```

---

## 3. Relatorio de Risco da VG

### 3.1 Estrutura adicional (alem do header padrao)

```
VIAGEM (VG)
---------------------------------------------------------
VG:              #VG-2026-0015
Motorista:       Joao da Silva
Veiculo:         ABC-1234
Status:          Aberta

ORDENS DE SERVICO NA VIAGEM
---------------------------------------------------------
  +--------+----------------+-----------+----------+--------+
  | OS     | Cliente        | Carga(R$) | Crit.    | Status |
  +--------+----------------+-----------+----------+--------+
  | OS-042 | Transp. ABC    | 180.000   | ALTA     | Aprov. |
  | OS-043 | Logist. DEF    | 120.000   | MEDIA    | Aprov. |
  | OS-044 | Distrib. GHI   | 170.000   | ALTA     | Aprov. |
  +--------+----------------+-----------+----------+--------+
  TOTAL:                      470.000
  Criticidade VG:             ALTA

CUSTOS DE RISCO DA VIAGEM
---------------------------------------------------------
  Buonny Consulta (1x VG):  R$ 13,76
  Buonny Monitoramento:     R$ 252,78
  ─────────────────────────────────
  Total VG:                  R$ 266,54

RATEIO POR OS
---------------------------------------------------------
  OS-042: R$ 102,30 (38.3% — proporcional ao cargo_value)
  OS-043: R$ 68,07 (25.5%)
  OS-044: R$ 96,17 (36.2%)
```

---

## 4. Relatorio de Roteirizacao

### 4.1 Estrutura

```
+==============================================================+
|  [LOGO VECTRA CARGO]                                         |
|  RELATORIO DE ROTEIRIZACAO                                    |
|  Data: 07/03/2026                                            |
+==============================================================+

ROTA
---------------------------------------------------------
Origem:      Joinville/SC (CEP 89201-000)
Destino:     Guarulhos/SP (CEP 07010-000)
Distancia:   1.200 km
Tempo est.:  ~14h (sem paradas)

PRACAS DE PEDAGIO
---------------------------------------------------------
  +----+--------------------+-------------+--------+--------+
  | #  | Praca              | Cidade/UF   | Valor  | TAG    |
  +----+--------------------+-------------+--------+--------+
  | 1  | Praca Norte        | Garuva/SC   | R$ 15,20| R$ 7,60|
  | 2  | BR-116 Sul         | Curitiba/PR | R$ 22,40| R$11,20|
  | .. | ...                | ...         | ...    | ...    |
  | 12 | Rod. Pres. Dutra   | Guarulhos/SP| R$ 18,90| R$ 9,45|
  +----+--------------------+-------------+--------+--------+
  TOTAL:                                   R$487,50 |R$243,75|
  +----+--------------------+-------------+--------+--------+

OBSERVACOES DE ROTA
---------------------------------------------------------
  • Rota interestadual: SC → PR → SP
  • Recomendacao: parada para descanso em Curitiba/PR (600 km)
  • Restricao horaria: nenhuma identificada
```

### 4.2 Fonte de dados

- `meta.tollPlazas` do `pricing_breakdown`
- Dados do `calculate-distance-webrouter` Edge function
- `quote.origin`, `quote.destination`, `quote.km_distance`

---

## 5. Checklist Legal

### 5.1 Estrutura

```
+==============================================================+
|  [LOGO VECTRA CARGO]                                         |
|  CHECKLIST DE OBRIGACOES LEGAIS                               |
|  OS: #OS-2026-0042                                           |
+==============================================================+

DOCUMENTOS FISCAIS
---------------------------------------------------------
  [ ] NF-e (Nota Fiscal Eletronica)
  [ ] CT-e (Conhecimento de Transporte)
  [ ] MDF-e (Manifesto de Documentos Fiscais)

DOCUMENTOS DO MOTORISTA
---------------------------------------------------------
  [ ] CNH (categoria compativel)
  [ ] CRLV do veiculo (em dia)
  [ ] ANTT/RNTRC (registro ativo)

DOCUMENTOS OPERACIONAIS
---------------------------------------------------------
  [ ] Analise GR (Gerenciamento de Risco)
  [ ] Rota documentada
  [ ] Comprovante de VPO (Vale-Pedagio Obrigatorio)

SEGURO E RISCO
---------------------------------------------------------
  [ ] Consulta Buonny realizada
  [ ] Monitoramento ativo (se exigido)
  [ ] Apolice vigente

VALE-PEDAGIO (Lei 10.209/2001)
---------------------------------------------------------
  [ ] VPO emitido antes do embarque
  [ ] Valor compativel com rota
  [ ] Comprovante fornecido ao motorista

OBSERVACOES
---------------------------------------------------------
  _______________________________________________
  _______________________________________________
```

---

## 6. Email templates

### 6.1 Aprovacao pendente

```
Assunto: [Risco] Aprovacao pendente — OS #OS-2026-0042

Ola,

Uma avaliacao de risco foi submetida e aguarda sua aprovacao:

OS: #OS-2026-0042
Cliente: Transportes ABC Ltda
Criticidade: ALTA
Valor da Carga: R$ 180.000,00
Rota: SC → SP (1.200 km)
Custo de risco estimado: R$ 308,64

Buonny: Aprovado (valido ate 03/06/2026)
Monitoramento: Ativo
Todas as exigencias atendidas: Sim

Notas do solicitante:
"Carga de alto valor, rota interestadual, monitoramento ativo."

→ Acesse o sistema para aprovar ou rejeitar:
   [Link para Aprovacoes]

---
Cargo Flow Navigator — Vectra Cargo
Este e-mail foi gerado automaticamente.
```

### 6.2 Resultado da avaliacao

```
Assunto: [Risco] Avaliacao APROVADA — OS #OS-2026-0042

Ola,

A avaliacao de risco da OS #OS-2026-0042 foi APROVADA.

Detalhes:
  Criticidade: ALTA
  Aprovado por: Marcos Silva (admin)
  Data: 07/03/2026 15:45
  Notas: "Documentacao completa, monitoramento ativo. Liberado."

A OS pode agora transitar para "Coleta Realizada".

→ Acesse a OS no sistema:
   [Link para OS]

---
Cargo Flow Navigator — Vectra Cargo
```

---

## 7. Fabrica de temas

### 7.1 Estrutura do tema

```typescript
interface PdfTheme {
  company: {
    name: string;           // 'Vectra Cargo Logistica'
    cnpj: string;
    logo_url: string;       // URL no Supabase Storage
    primary_color: string;  // hex
    secondary_color: string;
    accent_color: string;
  };
  fonts: {
    heading: string;        // 'Inter'
    body: string;           // 'Inter'
    mono: string;           // 'JetBrains Mono'
  };
  footer: {
    text: string;
    include_page_numbers: boolean;
    include_timestamp: boolean;
  };
}
```

### 7.2 Onde configurar

- `pricing_parameters` com key `pdf_theme` e value tipo JSONB
- Ou tabela dedicada `company_settings` (se ja existir)
- Fallback: tema Vectra Cargo hardcoded

### 7.3 Implementacao

- Edge function `generate-pdf` recebe:
  - `template_type`: 'risk_report' | 'route_report' | 'legal_checklist'
  - `data`: payload especifico do template
  - `theme`: automaticamente carregado do DB
- Usa biblioteca como `@react-pdf/renderer` ou `pdfmake`
- PDF salvo no Supabase Storage em `reports/{order_id}/`
- Link persistido em `documents` table com type adequado

---

## 8. Edge functions necessarias

| Function | Input | Output | Fase |
|---------|-------|--------|------|
| `generate-risk-report` | `{ order_id, template: 'risk_os' }` | `{ pdf_url, document_id }` | 4 |
| `generate-vg-risk-report` | `{ trip_id }` | `{ pdf_url, document_id }` | 4 |
| `generate-route-report` | `{ order_id }` | `{ pdf_url, document_id }` | 4 |
| `send-risk-notification` | `{ approval_request_id, template: 'pending' | 'result' }` | `{ sent: boolean }` | 4 |

---

## 9. Integracao com DocumentUpload

- PDFs gerados sao salvos como `documents` com:
  - `type = 'analise_gr'` (para relatorio de risco)
  - `type = 'doc_rota'` (para relatorio de roteirizacao)
  - `type = 'outros'` (para checklist legal)
- `order_id` e `trip_id` vinculados
- Aparecem na tab "Documentos" do OrderDetailModal
- Marcados como `validation_status = 'valid'` (gerado pelo sistema)

# Tradução do Workflow: Conciliação Bancária Mensal

## Visão Geral da Orquestração

| Campo | Valor |
|-------|-------|
| **ID da Execução** | `62015408-5fc0-484f-b5f2-a7d6c7bfcb14` |
| **Empresa** | `01b9b40e-2fc4-4cc5-a91e-cb95385d2aa2` |
| **Título** | [Conciliação Bancária Mensal] Execução manual 28/05/2026, 20:48:25 |
| **Status** | `in_progress` (em andamento) |
| **Tipo de Operação** | `orchestration` (orquestração) |
| **Disparo** | Manual via `/workflow` |
| **Criado em** | 28/05/2026 às 23:48:25 UTC |

---

## Sequência de Execução (Gerações Topológicas)

O workflow segue uma estrutura de **DAG** (Directed Acyclic Graph) com 4 gerações:

```
┌─────────────────────────────────────────────────────────────┐
│  GERAÇÃO 1        GERAÇÃO 2        GERAÇÃO 3      GERAÇÃO 4│
│                                                             │
│ ┌──────────┐     ┌──────────┐     ┌──────────┐   ┌────────┐│
│ │import-ofx│────▶│categorize│────▶│  apply   │──▶│ hermes ││
│ │(crítico) │     │pendings  │     │corrections│   │ report ││
│ └──────────┘     └──────────┘     └──────────┘   └────────┘│
│      ▲                                                      │
│      │                                                      │
│ ┌──────────┐                                                │
│ │audit-    │   (execução paralela — não bloqueia)           │
│ │historico │                                                │
│ └──────────┘                                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Passo 1: Importar OFX (`import-ofx`)

| Campo | Valor |
|-------|-------|
| **ID da Tarefa** | `9bf00d75-fa40-4dc8-b3d1-1db5fc65ec52` |
| **Agente** | `9c8d7e6f-5a4b-4321-9876-543210fedcba` |
| **Tipo** | `planner-import-ofx` |
| **Status** | ✅ `done` (concluído) |
| **Caminho Crítico?** | Sim |
| **Início** | 28/05/2026 23:48:28 |

### Entrada
- `workflowSlug`: `conciliacao-bancaria-mensal`
- `workflowStepSlug`: `import-ofx`

### Saída
| Campo | Valor |
|-------|-------|
| `file_processed` | `semana-2-maio-26.ofx` |
| `next_cursor` | `semana-2-maio-26.ofx` |
| `handoff` | via workflow_step Step 3 (`hermes-report`) |
| `categorization` | delegado para workflow step |
| `screenshot_path` | `audit-results\kronos-import-semana-2-maio-26-20260528T234923Z.png` |

---

## Passo 2: Categorizar Transações Pendentes (`categorize-pendings`)

| Campo | Valor |
|-------|-------|
| **ID da Tarefa** | `d7a5daae-b46d-4604-a4fd-825ec0a5b88a` |
| **Agente** | `9c8d7e6f-5a4b-4321-9876-543210fedcba` |
| **Tipo** | `planner-categorize-pendings` |
| **Status** | ✅ `done` (concluído) |
| **Dependências** | `import-ofx` |
| **Sucessor** | `apply-corrections` |
| **Caminho Crítico?** | Não |
| **Início** | 28/05/2026 23:49:29 |

### Entrada
- `workflowSlug`: `conciliacao-bancaria-mensal`
- `workflowStepSlug`: `categorize-pendings`

### Resultado da Categorização
| Métrica | Valor |
|---------|-------|
| Linhas categorizadas | 5 |
| Linhas com falha | 0 |
| Linhas não classificadas | 44 |
| Total de transações processadas | 49 |

### Transações Categorizadas (5)
| Descrição | Categoria | Subcategoria |
|-----------|-----------|--------------|
| Pix recebido de CAMILLA AZEVEDO SERRAN VIEIRA | Receita - Movimentações Internas | Receita - Transferência entre C/C |
| Pix enviado para POSTO DE COMBUSTIVEIS TIO GUSTA | Despesas Pessoais | Despesas Pessoais: Uso Pessoal |
| Pix enviado para DEGUSTA CAFE, CONFEITARIA & PIZZARIA | Despesas Pessoais | Despesas Pessoais: Uso Pessoal |
| EQUILIBRIO MARMITARIA | Despesas Pessoais | Despesas Pessoais: Moradia – Aluguel |
| Pix enviado para POSTO DE COMBUSTIVEIS TIO GUSTA | Despesas Pessoais | Despesas Pessoais: Uso Pessoal |

### Transações Puladas (44)
- Pix enviado para Hans Gerd Schumann — `skipped`
- 43 transações genéricas "TRANSF ENVIADA PIX" — `skipped` (provavelmente aguardando classificação manual ou regra futura)

### Evidência
- `screenshot_path`: `audit-results\kronos-categorize-only-20260528T235210Z.png`

---

## Passo 3: Aplicar Correções (`apply-corrections`)

| Campo | Valor |
|-------|-------|
| **ID da Tarefa** | `57ae2005-fa1a-4076-90e2-fcf44a120378` |
| **Agente** | `9c8d7e6f-5a4b-4321-9876-543210fedcba` |
| **Tipo** | `planner-apply-corrections` |
| **Status** | ✅ `done` (concluído) |
| **Dependências** | `categorize-pendings` |
| **Sucessor** | `hermes-report` |
| **Caminho Crítico?** | Não |
| **Início** | 28/05/2026 23:52:18 |

### Entrada
- `workflowSlug`: `conciliacao-bancaria-mensal`
- `workflowStepSlug`: `apply-corrections`

### Saída
| Campo | Valor |
|-------|-------|
| `applied` | 0 |
| `failed` | 0 |
| `duplicates_removed` | 0 |
| `details` | [] (vazio) |
| `skeleton` | `handler pendente de implementação — Task #21` |

> ⚠️ **Nota**: Este passo está com handler pendente de implementação. Ele marca como concluído mas não aplica correções reais — placeholder até a Task #21 ser finalizada.

---

## Passo 4: Hermes Report — Envio de E-mail (`hermes-report`)

| Campo | Valor |
|-------|-------|
| **ID da Tarefa** | `536b6496-d276-459d-b047-980af7931257` |
| **Agente** | `360a96cb-b1c3-4b65-b9fa-2b9cbb59dac1` |
| **Tipo** | `oracle-report` |
| **Status** | ⛔ `blocked` (bloqueado/erro) |
| **Dependências** | `apply-corrections` |
| **Caminho Crítico?** | Não |
| **Início** | 28/05/2026 23:52:21 |

### Entrada
- `workflowSlug`: `conciliacao-bancaria-mensal`
- `workflowStepSlug`: `hermes-report`

### Erro
```json
{
  "error_detail": {
    "message": "send_smtp failed: 'HERMES_SMTP_SERVER'"
  }
}
```

> 🔴 **Problema**: Variável de ambiente `HERMES_SMTP_SERVER` não configurada. O envio de e-mail falhou porque o sistema não encontrou o servidor SMTP.

---

## Resumo do Estado do Workflow

| Passo | Status | Início | Duração Estimada | Observação |
|-------|--------|--------|------------------|------------|
| 1. Importar OFX | ✅ Concluído | 23:48:28 | ~1 min | Arquivo `semana-2-maio-26.ofx` processado |
| 2. Categorizar | ✅ Concluído | 23:49:29 | ~3 min | 5/49 categorizadas, 44 puladas |
| 3. Aplicar Correções | ✅ Concluído | 23:52:18 | ~3 seg | Placeholder — Task #21 pendente |
| 4. Enviar Relatório | ⛔ Bloqueado | 23:52:21 | — | Falta `HERMES_SMTP_SERVER` |

---

## Diagrama de Sequência

```
23:48:25  ┌─────────────┐
          │  Orquestra  │ Dispara workflow manual
          │  (parent)   │
          └──────┬──────┘
                 │
23:48:28         ▼
          ┌─────────────┐     ┌─────────────┐
          │ import-ofx  │────▶│  Agente     │
          │ (crítico)   │     │  Kronos     │
          │ ✅ done     │     │             │
          └──────┬──────┘     └─────────────┘
                 │
23:49:29         ▼
          ┌─────────────┐     ┌─────────────┐
          │ categorize  │────▶│  Agente     │
          │  pendings   │     │  Kronos     │
          │ ✅ done     │     │             │
          └──────┬──────┘     └─────────────┘
                 │
23:52:18         ▼
          ┌─────────────┐     ┌─────────────┐
          │   apply     │────▶│  Agente     │
          │ corrections │     │  Kronos     │
          │ ✅ done*    │     │             │
          └──────┬──────┘     └─────────────┘
                 │                   *placeholder
23:52:21         ▼
          ┌─────────────┐     ┌─────────────┐
          │ hermes      │────▶│   Agente    │
          │  report     │     │   Hermes    │
          │ ⛔ blocked  │     │             │
          └─────────────┘     └─────────────┘
                              Erro: HERMES_SMTP_SERVER
```

---

## Ações Pendentes para Concluir o Workflow

1. **[Task #21]** Implementar handler real do passo `apply-corrections`
2. **[Config]** Definir variável de ambiente `HERMES_SMTP_SERVER` para habilitar envio de e-mail
3. **[Melhoria]** Revisar as 44 transações "TRANSF ENVIADA PIX" puladas — possível criar regras de categorização automática

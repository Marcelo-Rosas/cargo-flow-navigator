# Plano — Reestruturação PAG × FAT × Operação (Quote → OS → Financeiro)

**Status:** proposta (2026-06-03)  
**Contexto:** PNPM-TRC / CIOT / piso ANTT ≠ modalidade NTC; gross-up comercial ≠ pagamento ao carreteiro.

---

## 1. Princípio regulatório (fonte de verdade)

| Conceito | Definição | Onde vive no sistema |
|----------|-----------|----------------------|
| **Operação CIOT** | Lotação = 1 contratante (várias paradas OK); Fracionada = 2+ contratantes; TAC-Agregado = exceções | **Novo:** `quotes.ciot_operation_type` + flags ANTT |
| **Piso ANTT (PAG mínimo)** | `(km × CCD) + CC` (+ retorno vazio) — [Lei 13.703/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13703.htm), [FAQ CIOT](https://www.gov.br/antt/pt-br/assuntos/cargas/ciot-para-todos-1/perguntas-frequentes) | `antt_floor_rates`, wizard ANTT, `orders.carreteiro_antt` |
| **PAG (a pagar)** | Valor **pago ao carreteiro** ≥ piso quando aplicável | `orders.carreteiro_real`, kanban **PAG**, CIOT |
| **FAT (a receber)** | Valor **cobrado do cliente** (comercial + impostos) | `quotes.value`, kanban **FAT** |
| **Repasse risco** | Ad valorem / RCTR-C — cobrado, repassado, **fora do divisor** gross-up | `riskPassThrough`, aba Memória |
| **Lucro alvo** | `custos_diretos × profit_margin%` — não é (FAT − PAG) nem margem de contribuição | `profitability.resultadoLiquido` (pós-fix) |

**Regra de ouro:** nunca usar `price_tables.modality` como único gatilho de piso ANTT.

---

## 2. Estado atual (AS-IS) — mapa de arquivos

```text
COMERCIAL                    OPERACIONAL                 FINANCEIRO
QuoteForm / Wizard    →     Operations (OS)      →     Financial.tsx
QuoteDetailModal            OrderDetailModal            FinancialDetailModal
PricingStep                 OrderCard (CIOT)            FAT_COLUMNS / PAG_COLUMNS
ReviewStep                  generate-ciot               ensure-financial-document
calculate-freight           carreteiro_antt/real
freightCalculator
```

### 2.1 Gaps críticos (falhas)

| ID | Gap | Impacto |
|----|-----|---------|
| G1 | Piso ANTT aplicado só no ramo `modality === 'lotacao'` (tabela NTC) | OS/cotação “fracionada” com 1 contratante pode ficar **ilegal no PAG** |
| G2 | Review / modal misturam **Total Cliente** com **base motorista** sem coluna PAG explícita | Usuário acha que “frete” = um número só (R$ 60k vs R$ 22k) |
| G3 | `Faturamento Bruto` no topo do modal sem badge **FAT** | Confunde receita com piso |
| G4 | Margem exibida historicamente como contribuição (~30% FAT) | Decisão comercial errada |
| G5 | Repasse de risco dentro do gross-up (corrigido no motor, UI ainda não separa blocos) | Inflava FAT |
| G6 | PAG criado tarde (`coleta_realizada`) sem herdar piso + breakdown da cotação | Retrabalho e divergência |
| G7 | FAT criado na conversão; parcelas FAT ≠ prova de pagamento PAG | Fluxo desconectado |
| G8 | Sem campo **tipo operação CIOT** no wizard | Processo equivocado (modalidade ≠ regulatório) |
| G9 | CIOT bloqueia `em_transito` mas não valida **frete pago ≥ piso** no cadastro | Compliance parcial |

### 2.2 Gaps médios (UX / dados)

| ID | Gap |
|----|-----|
| M1 | `carreteiro_real` manual na OS sem vínculo visual com piso calculado |
| M2 | Kanban financeiro não mostra par FAT/PAG da mesma OS lado a lado |
| M3 | DRE na cotação não separa “Formação comercial” vs “Compliance PAG” |
| M4 | Legado `isLegacy` com FAT/PAG manual ainda acessível |
| M5 | `FinancialValuesBlock` repete margem operacional no doc FAT/PAG |

---

## 3. Arquitetura alvo (TO-BE)

### 3.1 Três camadas na UI (todas as telas)

```text
┌─────────────────────────────────────────────────────────────┐
│  COMPLIANCE (ANTT / CIOT)                                    │
│  Tipo CIOT · Piso R$ · Frete contratado CIOT · Status CIOT   │
├─────────────────────────────────────────────────────────────┤
│  PAG (custo)          │  FAT (receita)      │  ECONOMIA      │
│  Motorista + pedágio  │  Total cliente      │  Lucro alvo    │
│  Repasse (info)       │  Impostos / formação│  Contribuição  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Fluxo de dados

1. **Cotação:** motor calcula `piso_antt`, `pag_base`, `fat_total`, `repasse`, `lucro_alvo` → persiste em `pricing_breakdown` + campos explícitos.
2. **Conversão OS:** copia `ciot_operation_type`, flags ANTT, `carreteiro_antt` = piso, `pag_previsto` = base motorista.
3. **Despacho:** gera CIOT com frete pago + piso; cria **PAG** em INCLUIR com valor ≥ piso.
4. **Faturamento:** **FAT** espelha `quote.value`; alerta se FAT negociado < piso (venda abaixo do mínimo legal de referência).

---

## 4. Fases de implementação

### Fase 0 — Alinhamento (1–2 dias)
- [ ] Validar com operação: quando usar CIOT lotação vs fracionada vs TAC-Agregado
- [ ] Congelar glossário FAT/PAG/Repasse/Lucro na UI (tooltips)

### Fase 1 — Modelo e motor (3–5 dias)
- [ ] Migration: `quotes.ciot_operation_type` enum (`lotacao_reg`, `fracionada_reg`, `tac_agregado`, `isento`)
- [ ] `calculate-freight`: aplicar piso quando `sujeito_piso` (não só tabela lotação)
- [ ] Breakdown v5.1: blocos `pag`, `fat`, `compliance`, `repasse`
- [ ] Edge deploy + tipos gerados

### Fase 2 — Quote UI (5–7 dias)
- [ ] **CargoLogisticsStep:** tipo CIOT + aviso se tabela NTC ≠ CIOT
- [ ] **PricingStep:** painel tríptico PAG | FAT | Lucro (design system abaixo)
- [ ] **ReviewStep:** FAT + PAG lado a lado (como legado, mas automático)
- [ ] **QuoteDetailModal:** renomear hero → **FAT**; card **PAG mínimo**; faixa compliance
- [ ] Remover indicadores enganosos (spread km como lucro)

### Fase 3 — Operations UI (3–4 dias)
- [ ] **OrderCard:** chips PAG previsto / FAT previsto
- [ ] **OrderDetailModal:** aba Carreteiro = PAG (piso, real, delta); link “Criar PAG”
- [ ] Ao criar PAG: default `carreteiro_real = max(piso, previsto)`

### Fase 4 — Financial UI (3–4 dias)
- [ ] Par OS: coluna dupla FAT | PAG no kanban (ou sub-card)
- [ ] **FinancialDetailModal:** contexto FAT vs PAG; não misturar margem motor na FAT
- [ ] Auditoria: valor doc PAG < piso → badge vermelho

### Fase 5 — Testes e rollout
- [ ] E2E: cotação 4t carreta → piso aplicado, FAT > PAG, lucro ~15% CD
- [ ] Script recálculo cotações abertas
- [ ] `npx tsx scripts/audit-compliance.ts --ci`

---

## 5. Design system (frontend — direção visual)

**Tom:** industrial / utilitário (TMS), legível em stress operacional.

| Token | Uso |
|-------|-----|
| `--fat` (azul petróleo) | Receita, total cliente, kanban receber |
| `--pag` (âmbar queimado) | Carreteiro, piso, kanban pagar |
| `--compliance` (slate + ícone balança) | ANTT, CIOT |
| `--lucro` (verde contido) | Lucro alvo apenas |

**Componente novo:** `FinancialDualStrip` — três colunas fixas, valores em `tabular-nums`, labels sempre FAT/PAG/Lucro (nunca “Total” genérico).

---

## 6. Diagrama

Ver `diagram-flow.mmd` (Mermaid) nesta pasta. Para Miro: importar DSL ou informar URL do board.

---

## 7. Referências

- [Lei 13.703/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13703.htm)
- [FAQ CIOT ANTT](https://www.gov.br/antt/pt-br/assuntos/cargas/ciot-para-todos-1/perguntas-frequentes)
- [Calculadora ANTT](https://calculadorafrete.antt.gov.br/)
- `docs/ANTT_REAJUSTE_2026-03-13_SUROC_N3.md`
- `docs/plans/plan-04-risk-workflow-memoria-calculo-risco-seguro/v0.1.0/plan.md` (DRE v5 repasse)

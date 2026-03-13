# Índice de Planos — Cargo Flow Navigator

Arquivo para referência via `@plans`. Inclui os planos numerados (docs) e os planos de implementação (.cursor/plans).

---

## Planos numerados (docs/plans)

| # | Slug | Versão | Descrição |
|---|------|--------|-----------|
| 02 | [plan-02-metodologia-precificacao-lotacao-vs-fracionado](docs/plans/plan-02-metodologia-precificacao-lotacao-vs-fracionado/) | v0.2.2 | Metodologia Lotação vs Fracionado, Contract/Shape, glossário |
| 03 | [plan-03-auditoria-ui-mini-cards-vs-motor](docs/plans/plan-03-auditoria-ui-mini-cards-vs-motor/) | v0.1.0 | Auditoria UI (mini-cards, badges, R$/km) vs motor |
| 04 | [plan-04-risk-workflow-wizard-vg](.cursor/plans/plan-04-risk-workflow-wizard-vg.plan.md) | v0.1.0 | Risk Workflow (Buonny + Apólices) + Memória de Cálculo + VG |

---

## Plan 04 — Risk Workflow Wizard + Memória de Cálculo + VG

**Arquivo**: [plan-04-risk-workflow-wizard-vg.plan.md](plan-04-risk-workflow-wizard-vg.plan.md)

### Escopo

- Risk Workflow Wizard (Buonny + Apólices), trilha auditável
- Gate `documentacao → coleta_realizada` (OS)
- Refatoração Memória de Cálculo (Risco/Seguro)
- VG: agregação por OS, soma a partir de Quote

### Key Decisions

| Decisão | Valor |
|---------|-------|
| buonny_code_validity_days | 90 |
| buonny_source_of_truth | buonny-check |
| policy_value_reference | sum_cargo_value |
| vg_aggregation_rule | VG soma por OS |
| ui_choice | UI-B Risk Workflow Wizard + trilha auditável |
| gates | documentacao→coleta_realizada; vg_gate: true |

### Dependências

- Plan 02 v0.2.2 (metodologia precificação)
- Plan 03 v0.1.1 (auditoria UI)

### Como usar

`@plan-04-risk-workflow-wizard-vg` ou `@plans` (este índice)

---

## Outros planos em .cursor/plans

- [quote_form_wizard](quote_form_wizard.plan.md) — Wizard QuoteForm 4 passos
- [trips_prd_implementation](trips_prd_implementation_437bede4.plan.md) — PRD Trips
- [selecao-llm-trips-v2](selecao-llm-trips-v2-fases1-4_56a430aa.plan.md) — LLMs para Trips V2
- [financial_kanban_optimistic_dnd](financial_kanban_optimistic_dnd_2f772d75.plan.md) — Kanban DnD
- [prd_v2.0_reestruturação_financeira](prd_v2.0_reestruturação_financeira_0ecbe437.plan.md) — Reestruturação financeira
- [herança_documentação_motorista_os-vg](herança_documentação_motorista_os-vg_c056cbfc.plan.md) — Documentação motorista
- [reconciliaçao_carreteiro_e_auditoria](reconciliação_carreteiro_e_auditoria_8c1fe48a.plan.md) — Conciliação carreteiro

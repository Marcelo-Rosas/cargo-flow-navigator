# 🚀 CFN — Sprint Plan: Audit & Automated Debugging

**Project:** Cargo Flow Navigator Automation Initiative
**Duration:** 2 Sprints (Sprint 1: 1 week | Sprint 2: 1.5 weeks)
**Goal:** Fix all code quality issues + Build self-healing AI agent for runtime debugging

---

## 📊 Executive Summary

| Aspecto | Detalhes |
|---------|----------|
| **Status Atual** | 94 erros, 129 avisos em 421 arquivos |
| **Capacidade** | 1 dev (Marcelo) |
| **Sprint 1 Goal** | Erradicate críticos — 0 erros ESLint, < 30 audit warnings |
| **Sprint 2 Goal** | Automated debugging agent operacional — 100% audit coverage sem intervenção manual |
| **Total Effort** | ~60 horas (40h Sprint 1 + 20h Sprint 2) |

---

## 🎯 SPRINT 1: Code Quality Offensive (1 Semana)

### Sprint Goal
**"Eliminar todos os erros críticos de formatação BRL e React Hooks, deixando o projeto pronto para o agente de debugging automático."**

### Capacity Plan
| Item | Horas/Dia | Disponível | PTO | Efetivo |
|------|-----------|-----------|-----|---------|
| Marcelo (Full-time) | 8h | 5 dias | 0 | **40 horas** |
| Overhead (meetings, planning, breaks) | -1.5h | 5 dias | - | **-7.5h** |
| **Net Capacity** | — | — | — | **32.5 horas** |

**Alvo:** 32.5 horas de produção = ~25-30 tarefas corrigidas

---

### Sprint 1 Backlog (Priorizado)

#### 🔴 P0 — Crítico (MUST FIX)

| ID | Tarefa | Arquivo(s) | Esforço | Dependências | Owner |
|----|--------|-----------|---------|--------------|-------|
| **BRL-001** | Fix BRL maximumFractionDigits (91 erros) | Múltiplos (DiscountProposalBreakdown, LoadCompositionModal, MarketInsightsCard, etc) | 3h | Nenhuma | Marcelo |
| **HOOKS-001** | Fix ApprovalModal useEffect dependencies | src/components/approvals/ApprovalModal.tsx:109 | 30min | Nenhuma | Marcelo |
| **HOOKS-002** | Fix QuoteForm useEffect/useMemo | src/components/forms/QuoteForm.tsx:836+ | 1h | HOOKS-001 | Marcelo |
| **HOOKS-003** | Fix CashFlowReport pendingRows/items useMemo | src/components/financial/CashFlowReport.tsx:233-235 | 45min | HOOKS-001 | Marcelo |
| **HOOKS-004** | Fix DriverForm linkedVehicles useMemo | src/components/forms/DriverForm.tsx:67 | 30min | HOOKS-001 | Marcelo |
| **TS-001** | Remove `any` types from google-maps.ts | src/lib/google-maps.ts:88,91,94 | 45min | Nenhuma | Marcelo |

**Subtotal P0:** ~6.5h (17% da capacidade)

#### 🟡 P1 — Alto (SHOULD FIX)

| ID | Tarefa | Arquivo(s) | Esforço | Dependências | Owner |
|----|--------|-----------|---------|--------------|-------|
| **REFRESH-001** | Separar constants de componentes (Fast Refresh) | InsuranceSelectorLazy, LayoutContext, UI components | 3h | Nenhuma | Marcelo |
| **INTL-001** | Add minimumFractionDigits:2 em NumberFormat | OrderCard, QuoteCard, ExportReports, MonthlyTrendsChart | 2h | Nenhuma | Marcelo |
| **FIN-001** | Fix useFinancialBoardData rows/items | src/hooks/useFinancialBoardData.ts:17,23 | 30min | Nenhuma | Marcelo |

**Subtotal P1:** ~5.5h (17% da capacidade)

#### 🟢 P2 — Stretch (NICE TO HAVE)

| ID | Tarefa | Arquivo(s) | Esforço | Dependências | Owner |
|----|--------|-----------|---------|--------------|-------|
| **SETUP-001** | Setup Storybook para componentes críticos | public/ | 4h | BRL-001, HOOKS-001-004 | Marcelo |
| **DOCS-001** | Criar guia de formatação BRL para futuros devs | docs/ | 1.5h | BRL-001 | Marcelo |
| **TESTS-001** | Adicionar testes unitários para formatação BRL | tests/ | 3h | BRL-001, SETUP-001 | Marcelo |

**Subtotal P2:** ~8.5h (26% da capacidade) — **STRETCH, fazer se houver tempo**

---

### Sprint 1 Planned Work

**Dia 1 (Seg):**
- Morning standup
- BRL-001: Fix 91 erros de BRL formatting (3h)
- HOOKS-001: Fix ApprovalModal (30min)
- **Total: 3.5h**

**Dia 2 (Ter):**
- HOOKS-002: Fix QuoteForm (1h)
- HOOKS-003: Fix CashFlowReport (45min)
- HOOKS-004: Fix DriverForm (30min)
- TS-001: Remove any types (45min)
- **Total: 3h**

**Dia 3 (Qua):**
- REFRESH-001: Separar constants (3h)
- FIN-001: Fix useFinancialBoardData (30min)
- **Total: 3.5h**

**Dia 4 (Qui):**
- INTL-001: Add fractionDigits (2h)
- Mid-sprint review + QA (1h)
- **Total: 3h**

**Dia 5 (Sex):**
- SETUP-001 (Stretch): Storybook setup (4h) **OU**
- Buffer + refinement para Sprint 2 (2h) + retrospectiva (1h)
- **Total: 3h**

**Total Estimado: 16.5h de 32.5h = 51% utilization** ✅ (deixa margem para surpresas)

---

### Sprint 1 Success Criteria

- ✅ 0 erros ESLint
- ✅ < 30 audit warnings (reduzir de 129)
- ✅ Todos os `any` types removidos
- ✅ Todas as dependências de React Hooks corrigidas
- ✅ `npm run lint` passa sem warnings críticos
- ✅ **BÔNUS:** Storybook configurado para componentes críticos

---

## 🤖 SPRINT 2: Automated Debugger Agent (1.5 Semanas)

### Sprint Goal
**"Implementar um agente automatizado (Chrome DevTools MCP) que audita componentes do CFN, identifica bugs em runtime, e aplica correções sem intervenção manual."**

### Context: O que CyberAgent fez

```
┌─────────────────────────────────────────────────────────────────┐
│ CyberAgent Workflow                                             │
├─────────────────────────────────────────────────────────────────┤
│ 1. Chrome DevTools MCP Server conectado                         │
│ 2. Prompt única para o agente:                                 │
│    "Auditar todas as stories, encontrar erros, corrigir"      │
│ 3. Agente roda autonomamente:                                  │
│    - Navega Storybook                                          │
│    - Lê console.log/console.error                              │
│    - Identifica tipos de erro                                  │
│    - Aplica fixes no código                                    │
│    - Valida fix (run story novamente)                          │
│ 4. Resultado: 32 componentes, 236 stories auditadas em 1h      │
│    → 100% coverage, 0 false negatives                          │
└─────────────────────────────────────────────────────────────────┘
```

### Sprint 2 Capacity

| Item | Horas/Dia | Disponível | PTO | Efetivo |
|------|-----------|-----------|-----|---------|
| Marcelo (Full-time) | 8h | 7.5 dias (1.5 sem) | 0 | **60 horas** |
| Overhead (meetings, design review, testing) | -2h | 7.5 dias | - | **-15h** |
| **Net Capacity** | — | — | — | **45 horas** |

---

### Sprint 2 Backlog

#### 🔴 P0 — Core Agent Features

| ID | Tarefa | Esforço | Dependências | Descrição |
|----|--------|---------|--------------|-----------|
| **AGENT-001** | Setup Chrome DevTools MCP | 3h | Nenhuma | Instalar/configurar Chrome DevTools MCP server |
| **AGENT-002** | Create Storybook (se não houver) | 4h | SETUP-001 (Sprint 1) | Configurar Storybook para CFN com main components |
| **AGENT-003** | Implementar Detection Engine | 6h | AGENT-001, AGENT-002 | Agente identifica tipos de erro: runtime, TypeScript, BRL format, etc |
| **AGENT-004** | Implementar Auto-Fix Engine | 8h | AGENT-003 | Agente aplica correções automáticas baseado em erro type |
| **AGENT-005** | Implementar Validation Loop | 4h | AGENT-004 | Re-run story após fix, confirmar sucesso |
| **AGENT-006** | Criar prompt otimizado | 2h | AGENT-005 | Prompt que guia agente para auditar 100% dos componentes |

**Subtotal P0:** ~27h (60% da capacidade)

#### 🟡 P1 — Integration & CI/CD

| ID | Tarefa | Esforço | Dependências | Descrição |
|----|--------|---------|--------------|-----------|
| **CI-001** | Integrar com GitHub Actions | 3h | AGENT-006 | Trigger agente em PR, commit na main |
| **CI-002** | Criar dashboard de resultados | 4h | CI-001 | Mostrar % audit coverage, bugs found/fixed |
| **CI-003** | Slack integration (opcional) | 2h | CI-002 | Notificar team de audit results |

**Subtotal P1:** ~9h (20% da capacidade)

#### 🟢 P2 — Documentation & Operationalization

| ID | Tarefa | Esforço | Dependências | Descrição |
|----|--------|---------|--------------|-----------|
| **DOC-001** | Criar guia de uso para dev team | 2h | AGENT-006, CI-002 | Como rodar agente manualmente, interpretar resultados |
| **DOC-002** | Documentar architecture da solution | 2h | Todas | Diagrams, flow, trade-offs |
| **OPS-001** | Monitoramento & alertas | 3h | CI-002 | Alertar se audit fails, agent crashes |

**Subtotal P2:** ~7h (15% da capacidade) — **STRETCH**

---

### Sprint 2 Planned Work (High-Level)

**Dias 1-2 (Seg-Ter):**
- AGENT-001: Setup Chrome DevTools MCP (3h)
- AGENT-002: Setup Storybook (4h)
- **Total: 7h**

**Dias 3-4 (Qua-Qui):**
- AGENT-003: Implementar Detection Engine (6h)
- **Total: 6h**

**Dias 5-6 (Sex-Seg):**
- AGENT-004: Auto-Fix Engine (8h)
- **Total: 8h**

**Dia 7 (Ter):**
- AGENT-005: Validation Loop (4h)
- AGENT-006: Otimizar prompt (2h)
- **Total: 6h**

**Dias 8-9 (Qua-Qui):**
- CI-001: GitHub Actions (3h)
- CI-002: Dashboard (4h)
- **Total: 7h**

**Dia 10 (Sex):**
- DOC-001: User Guide (2h)
- DOC-002: Architecture (2h)
- Final testing + deployment (2h)
- **Total: 6h**

**Total Estimado: 40h de 45h = 89% utilization** ✅

---

### Sprint 2 Success Criteria

- ✅ Chrome DevTools MCP configurado e rodando
- ✅ Storybook com ≥10 componentes críticos do CFN
- ✅ Agente consegue navegar Storybook e ler console.logs
- ✅ Detection Engine identifica ≥5 tipos de erro
- ✅ Auto-Fix Engine consegue corrigir ≥3 tipos
- ✅ Agente auditou 100% dos componentes no Storybook
- ✅ GitHub Actions trigger agente em PR
- ✅ Dashboard mostrando resultados
- ✅ Documentação completa para dev team
- ✅ **BÔNUS:** Slack integration operacional

---

## 🎁 DELIVERABLES

### Sprint 1 Outputs
1. ✅ **AUDIT_TASKS.md** (já criado)
2. ✅ **Código corrigido** — todos os arquivos com BRL, React Hooks, TS types fixos
3. ✅ **Storybook** (opcional) — componentes críticos documentados
4. ✅ **Guia de Formatação** — para evitar regressões

### Sprint 2 Outputs
1. ✅ **CFN Automated Debugger Agent** — MCP server + Claude integration
2. ✅ **Detection & Auto-Fix Engines** — regras de detecção e correção
3. ✅ **CI/CD Pipeline** — GitHub Actions + Dashboard
4. ✅ **Architecture Documentation** — como estender o agente
5. ✅ **User Manual** — como usar o agente

---

## 📈 Expected Impact

### Immediate (Sprint 1)
- 🎯 **Code Quality:** 94 → 0 erros ESLint
- 🎯 **Developer Experience:** Hot reload (Fast Refresh) funciona novamente
- 🎯 **Type Safety:** Sem `any` types
- 🎯 **Risk Reduction:** React render bugs eliminados

### Long-term (Sprint 2)
- 🚀 **Automation:** Debugging manual → agente automático
- 🚀 **Coverage:** 100% audit coverage de componentes (vs. antes: manual, erro-prone)
- 🚀 **Velocity:** 1h de audita completa (vs. antes: dias)
- 🚀 **Reliability:** Zero false negatives — erros não serão missed
- 🚀 **Culture:** Padrão para DevTools MCP em CFN e outros projetos

---

## ⚠️ Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| BRL formatting é mais complexo que esperado | Sprint 1 overruns 5-10h | Medium | Scope bem, breakar em subtasks, fazer review a cada 2-3 arquivos |
| Storybook setup leva mais tempo | Sprint 2 bloqueado | Medium | Usar template/scaffolding, documentação oficial |
| Chrome DevTools MCP tem limitações não documentadas | Agent não consegue fazer tudo | Medium | Early prototype (Dia 1-2), testar com 5 componentes antes de expandir |
| Agente gera muitos false positives | False fixes quebram código | Low-Medium | Validation loop obrigatório, manual review na Sprint 2 |

---

## 🗓️ Key Dates

| Data | Evento | Dueação |
|------|--------|----------|
| **Mon, Mar 24** | Sprint 1 Start | 1 week |
| **Wed, Mar 26** | Mid-sprint check-in (Sprint 1) | Sync |
| **Fri, Mar 28** | Sprint 1 Demo + Retro | 1.5h |
| **Mon, Mar 31** | Sprint 2 Start | 1.5 weeks |
| **Wed, Apr 2** | Mid-sprint check-in (Sprint 2) | Sync |
| **Fri, Apr 11** | Sprint 2 Demo + Retro | 1.5h |

---

## 📋 Definition of Done

### Sprint 1 DoD
- [ ] Código compilado sem erros ESLint (`npm run lint` clean)
- [ ] Todos os `.tsx` files passam `npm run lint:types`
- [ ] Audit script rodou, < 30 warnings (vs 129 antes)
- [ ] Storybook setup (bônus)
- [ ] PR aberto, code reviewed, merged

### Sprint 2 DoD
- [ ] MCP server rodando e conectado
- [ ] Agente consegue navegar ≥10 stories
- [ ] Agente identifica e corrige ≥1 bug real
- [ ] Dashboard rodando em CI
- [ ] Documentação completa e revisada
- [ ] PR aberto, code reviewed, merged
- [ ] Rodado manualmente ≥3 vezes com sucesso

---

## 🤝 Dependencies & Blockers

### Sprint 1
- ✅ Nenhuma bloqueador externo
- Requer acesso ao `src/` completo (já temos)
- Requer `npm run lint` funcional (already working)

### Sprint 2
- **Dependência:** Sprint 1 completado (código clean)
- **Dependência:** Chrome DevTools MCP disponível (public repo)
- **Dependência:** Storybook setup (P2 Sprint 1, idealmente completo)

---

## 💬 Notes for Team

> *"We're not just fixing bugs—we're building an automated debugging machine. By the end of Sprint 2, a single prompt can audit 100% of our components and fix bugs without human intervention. This is the CyberAgent model, tailored to CFN."*

---

**Created:** March 20, 2026
**Owner:** Marcelo Rosas (@marcelo.rosas@vectracargo.com.br)
**Status:** Ready for Sprint 1 kickoff

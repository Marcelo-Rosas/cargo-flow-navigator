# Test Coverage Analysis

**Date**: 2026-03-21
**Codebase size**: 359+ source files | 176 components | 82 hooks | 45 edge functions | 18 pages

## Current State

### Test Infrastructure
- **Unit tests**: 3 files (tsp-solver, DRE operational, kanban-dnd)
- **E2E tests**: ~12 Playwright specs (mock-based + seeded DB)
- **Test runner**: Playwright only (no Vitest/Jest for unit tests)
- **Coverage tool**: None configured
- **Estimated unit test coverage**: < 2%

### What IS Tested
| Area | Test Type | File |
|------|-----------|------|
| TSP solver algorithm | Unit (Deno BDD) | `src/lib/__tests__/tsp-solver.test.ts` |
| DRE operational calcs | Unit | `tests/dre-operacional.test.ts` |
| Kanban DnD helpers | Unit | `tests/kanban-dnd.test.ts` |
| Quote wizard gating | E2E (mocks) | `tests/e2e/quote-wizard-gating.spec.ts` |
| Quote paradas gating | E2E (mocks) | `tests/e2e/quote-paradas-gating.spec.ts` |
| Quote advance race | E2E (mocks) | `tests/e2e/quote-advance-race.spec.ts` |
| Kanban DnD interactions | E2E (mocks) | `tests/e2e/kanban-dnd.spec.ts` |
| Sidebar collapse | E2E (mocks) | `tests/e2e/sidebar-collapse.spec.ts` |
| Grace period flow | E2E (seeded) | `tests/e2e/flows/grace-period.seeded.spec.ts` |
| Quote smoke | E2E (seeded) | `tests/e2e/flows/quote-smoke.seeded.spec.ts` |
| Auth, navigation, modules | E2E (seeded) | `e2e/*.spec.ts` |

---

## Priority 1 — Critical Business Logic (Pure Functions, High ROI)

These files contain **pure business logic** with zero UI dependencies. They are the easiest to test and the most dangerous to break.

### 1.1 Freight Calculator (`src/lib/freightCalculator.ts` — 1,114 lines)
**Risk: CRITICAL** | **Effort: Medium** | **Current tests: 0**

The core revenue calculation engine. Handles FOB/FTL/LTL modalities, ICMS proportional by UF, markup scopes, NTC rates (TDE/TEAR/GRIS/TSO), ad valorem, cubage factor, conditional fees, waiting time, DAS, overhead, and margin analysis. A bug here directly impacts pricing and revenue.

**Recommended tests:**
- Basic FTL freight calculation with known price table row
- LTL (fracionado) with minimum freight enforcement
- ICMS proportional calculation (`kmByUf` + `icmsByUf`)
- Each markup scope variant (`BASE_ONLY`, `BASE_PLUS_INSURANCE`, `ALL_PERCENT_COMPONENTS`)
- NTC TDE/TEAR enabled/disabled
- Cubage factor (volume > weight scenario)
- Edge cases: zero weight, zero distance, null price table row
- `round2` parity with backend edge function

### 1.2 DRE Module (`src/modules/dre/` — 14 files)
**Risk: HIGH** | **Effort: Medium** | **Current tests: 1 file (partial)**

Financial reporting module. Only `dre-operacional` has a test. Missing coverage for:

**Recommended tests:**
- `dre.calculations.ts`: `computeDreRealFromPresumido` — verify delta calculations, margin percentages
- `dre.validators.ts`: `validateDreRows` — verify accounting formula enforcement (custos_diretos sum, resultado_liquido, margem_liquida)
- `dre.consolidator.ts`: Consolidation of multiple trip DRE rows
- `dre.comparator.ts`: Period-over-period comparison
- `dre.mappers.ts`: Data mapping correctness
- `dre.lines.ts`: Line definitions completeness

### 1.3 Validators (`src/lib/validators.ts` — 143 lines)
**Risk: HIGH** | **Effort: Low** | **Current tests: 0**

CPF and CNPJ validation with check digit algorithms. Used across all forms.

**Recommended tests:**
- Valid CPF/CNPJ numbers
- Invalid check digits
- All-same-digit rejection (e.g., `111.111.111-11`)
- Wrong length inputs
- Inputs with formatting (dots, dashes)
- Empty / null inputs

### 1.4 Formatters (`src/lib/formatters.ts` — 75 lines)
**Risk: MEDIUM** | **Effort: Low** | **Current tests: 0**

Currency, number, and date formatting. The project convention requires R$ with 2 decimal places and values in centavos.

**Recommended tests:**
- `formatCurrency`: positive, negative, zero, null/undefined
- `formatCurrencyFromCents`: 150000 → "R$ 1.500,00"
- `formatNumber`: 2 decimal places
- `formatDate` / `formatDateShort` variants
- Null/undefined → "—" fallback

### 1.5 Price Table Parser (`src/lib/priceTableParser.ts` — 901 lines)
**Risk: HIGH** | **Effort: Medium** | **Current tests: 0**

CSV/Excel price table import parsing. Complex parsing logic with many edge cases.

**Recommended tests:**
- Valid CSV with known columns
- Missing required columns
- Malformed number formats (Brazilian comma vs US dot)
- Empty rows handling
- Large file handling

---

## Priority 2 — Utility Functions and Helpers

### 2.1 Geo Utils (`src/lib/geo-utils.ts` — 111 lines)
**Risk: MEDIUM** | **Effort: Low** | **Current tests: 0**

Geographic calculations (distance, coordinates).

### 2.2 Kanban DnD (`src/lib/kanban-dnd.ts` — 92 lines)
**Risk: LOW** | **Effort: Low** | **Current tests: 1 file**

Already has tests. Could expand edge case coverage (empty columns, invalid IDs).

### 2.3 Date Filter Utils (`src/lib/dateFilterUtils.ts` — 55 lines)
**Risk: LOW** | **Effort: Low** | **Current tests: 0**

Date range filtering. Simple but testable.

### 2.4 Financial Kanban (`src/lib/financial-kanban.ts` — 49 lines)
**Risk: LOW** | **Effort: Low** | **Current tests: 0**

Status mapping for financial Kanban board.

---

## Priority 3 — Edge Functions (Backend Logic)

### 3.1 `calculate-freight` Edge Function
**Risk: CRITICAL** | **Effort: Medium** | **Current tests: 0**

Server-side duplicate of freight calculation. Must produce identical results to `freightCalculator.ts`. A parity test between both implementations would catch drift.

### 3.2 `workflow-orchestrator`
**Risk: HIGH** | **Effort: Medium** | **Current tests: 0**

Approval state machine. Wrong transitions could approve unauthorized operations.

### 3.3 `auto-approval-worker`
**Risk: HIGH** | **Effort: Medium** | **Current tests: 0**

Auto-approves based on rules. False approvals could have financial impact.

### 3.4 `reconcile-trip`
**Risk: HIGH** | **Effort: Medium** | **Current tests: 0**

Financial reconciliation logic.

---

## Priority 4 — Hook Integration Tests

Custom hooks that contain business logic beyond simple data fetching:

- `useCalculateFreight` — orchestrates the freight calculation flow
- `useCalculateDiscounts` — discount breakdown logic
- `useRiskEvaluation` — risk scoring
- `useDreComparativoReport` / `useDreOperacionalReport` — DRE data processing
- `useFinancialDocumentsKanban` — status transition logic

These would need `@testing-library/react-hooks` or Vitest with `renderHook`.

---

## Priority 5 — Component Tests (Selective)

Most components are UI-only and well-served by E2E tests. However, these components contain embedded logic worth testing:

- Quote form wizard (4-step validation logic)
- Financial Kanban board (status transitions)
- Price table management (CRUD + import)
- Approval request components (rule evaluation display)

---

## Recommended Action Plan

### Step 1: Set Up Vitest (immediate)
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```
Add `vitest.config.ts` with path aliases matching `vite.config.ts`.

### Step 2: Quick Wins — Pure Function Tests (week 1)
Target files that are pure functions with zero dependencies:
1. `validators.ts` — CPF/CNPJ (< 1 hour)
2. `formatters.ts` — currency/date formatting (< 1 hour)
3. `freightCalculator.ts` — core calculation (2-3 hours)
4. `dre.validators.ts` — accounting formulas (1 hour)
5. `dre.calculations.ts` — DRE real vs presumido (1 hour)

**Expected impact**: Cover the most critical business logic with ~6 hours of work.

### Step 3: Coverage Tooling (week 1)
Add `coverage` config to Vitest:
```ts
// vitest.config.ts
test: {
  coverage: {
    provider: 'v8',
    include: ['src/lib/**', 'src/modules/**'],
    thresholds: { lines: 60 }
  }
}
```

### Step 4: Parity Tests (week 2)
Create tests that verify `freightCalculator.ts` and the `calculate-freight` edge function produce identical outputs for the same inputs. This catches the "intentional duplication" from drifting.

### Step 5: Edge Function Tests (week 2-3)
Set up Deno test harness for critical edge functions: `workflow-orchestrator`, `auto-approval-worker`, `reconcile-trip`.

### Step 6: Hook Integration Tests (week 3-4)
Add `renderHook` tests for business-logic-heavy hooks using `@testing-library/react`.

---

## Summary

| Priority | Area | Files | Risk | Effort |
|----------|------|-------|------|--------|
| P1 | Freight Calculator | 1 | Critical | Medium |
| P1 | DRE Module | 14 | High | Medium |
| P1 | Validators (CPF/CNPJ) | 1 | High | Low |
| P1 | Formatters | 1 | Medium | Low |
| P1 | Price Table Parser | 1 | High | Medium |
| P2 | Geo Utils, Date Utils | 2 | Medium | Low |
| P3 | Edge Functions (freight, workflow, approval) | 3 | Critical/High | Medium |
| P4 | Business Logic Hooks | 5 | Medium | Medium |
| P5 | Complex Components | 4 | Low | High |

**Bottom line**: The codebase has ~360 source files with < 2% unit test coverage. The most impactful improvement is adding Vitest and writing pure function tests for the freight calculator, DRE module, and validators — these are the highest-risk, lowest-effort targets.

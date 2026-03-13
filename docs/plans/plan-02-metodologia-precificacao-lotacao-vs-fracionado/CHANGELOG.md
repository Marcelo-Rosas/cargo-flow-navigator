# Changelog — Plan 02 Metodologia de Precificação (Lotação vs Fracionado)

## v0.2.1 (2026-03-06)

**change_type**: patch

### O que mudou

- Novo arquivo **evidence-index.md**: índice de claims com fonte, comando `rg` de verificação e risco de fragilidade.
- **Search log (audit trail)**: comandos rg exatos usados na auditoria e resumo do que foi encontrado.
- **Glossário oficial de métricas**: total_cliente, receita_liquida, resultado_liquido, margem_percent, custos_diretos, custos_carreteiro, custo_motorista, ntc_base, pedágio — definição, breakdown, UI.
- **Matriz por cenário**: Lotação e Fracionado com km rounding, min weight, baseCost, dispatch_fee, totals, margem; riscos de drift e onde a divergência aparece na UI; mitigação sugerida.
- **Provas negativas com método**: comandos rg exatos, diretórios, razão de "não usado".
- **Checklist pós-hardening**: validação do documento (claims com evidência, buscas registradas, divergências com mitigação).

### O que foi mantido sem alteração

- Sumário executivo, Contrato de precedência, Metodologia Lotação e Fracionado (estrutura), Dicionário de configuração (resumido), MRE, Tabela comparativa, Mapa de código, Gaps.

### Justificativa do bump (patch)

- Apenas melhorias de evidência, clareza, estrutura, glossário, inventário (evidence-index), checklists — sem novo bloco macro nem mudança de escopo.

---

## v0.2.0 (2026-03-06)

**change_type**: minor

### O que mudou

- Nova seção: **Provas negativas** — buscas no repo documentam que `min_freight`, `min_freight_cargo_limit`, `ltl_parameters.cubage_factor`, `ltl_parameters.correction_factor` e `toll_routes` não entram no motor; origem de `tollPlazas` via `calculate-distance-webrouter` e `extractTollPlazas`.
- Nova subseção: **Contrato de precedência** (fonte da verdade) para modalidade — Edge usa exclusivamente `price_tables.modality`; TS usa `input.modality` do formulário; risco de drift e recomendação operacional.
- Evidências estáveis: referências por arquivo + função + trecho completo; correção de trechos truncados.
- Dicionário de configuração regerado por grep em `calculate-freight/index.ts` (paramsMap.get, resolveRule, resolveRulePercent).
- Pedágio: evidência de `calculate-distance-webrouter` e `extractTollPlazas`; `code_entrypoints` atualizado.
- MRE com `payment_term_code`, `toll_value` explícitos, pré-condições e campos esperados.
- Matriz TS vs Edge com separação (A) rounding/validação interna vs (B) seleção de faixa via hook/REST/Edge.

### O que foi mantido sem alteração

- Sumário executivo, Metodologia Lotação (inputs, faixa km, peso faturável, base cost, adicionais, impostos, markup, piso ANTT, status).
- Metodologia Fracionado (estrutura e lógica).
- Tabela comparativa Lotação vs Fracionado.
- Gaps, dúvidas e riscos (expandidos com provas negativas e risco de modalidade).

### Justificativa do bump (minor)

- Novas seções substanciais (Provas negativas, Contrato de precedência).
- Expansão de evidências e matriz de consistência.
- Dúvida entre PATCH e MINOR → MINOR (regra de segurança).

---

## v0.1.0 (2026-03-06)

- Versão inicial.
- Metodologia Lotação e Fracionado.
- Tabela comparativa, mapa de código, gaps.

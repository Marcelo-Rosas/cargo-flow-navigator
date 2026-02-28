# Impacto de Alteração de Pedágio no order.value

## Decisão Atual

**Não alterar `order.value` automaticamente** ao recalcular ou editar `toll_value` na OS.

## Motivo

- O `order.value` representa o valor acordado com o cliente (frete total).
- Mudanças de pedágio na execução podem ou não refletir no contrato; a decisão é de negócio.
- O `pricing_breakdown.totals.totalCliente` também não é alterado automaticamente ao mudar o pedágio.

## Onde o Pedágio é Alterado

- **OrderDetailModal** (aba Pedágios):
  - Botão "Recalcular pedágio" – chama `calculate-distance-webrouter` com eixos da OS
  - Edição manual – input para `toll_value`
- Ao salvar: são atualizados `order.toll_value` e `order.pricing_breakdown.components.toll` (e `meta.tollPlazas` no recálculo).

## Avaliação de Margem e Rentabilidade

- O impacto em margem/rentabilidade deve ser avaliado **manualmente** pelo usuário ou em futura feature de recálculo de margem.
- A view `v_quote_order_divergence` permite auditoria de divergências entre cotação e OS (incluindo `delta_toll`, `delta_value`).

## Histórico

| Data   | Alteração                                                |
|--------|----------------------------------------------------------|
| 2025-03| Decisão: não alterar `order.value` ao alterar pedágio na OS |

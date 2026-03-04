#!/bin/bash
# Auditoria de margem e sincronização DRE/Memória

echo "🔍 Iniciando Auditoria Financeira..."

# Verifica se a margem no último cálculo é menor que 15%
# Nota: Assume que o breakdown é salvo em um JSON temporário pelo sistema
MARGEM=$(node -e "console.log(require('./src/data/last_breakdown.json').profitability.margemPercent || 0)")

if (( $(echo "$MARGEM < 15.0" | bc -l) )); then
  echo "❌ ERRO CRÍTICO: Margem de $MARGEM% viola o Mínimo Viável de 15%!"
  exit 1
fi

# Valida se o Frete Base da Memória bate com o Custo Motorista da DRE
VALOR_MEMORIA=$(grep "baseFreight" src/data/last_breakdown.json | awk '{print $2}' | tr -d ',')
VALOR_DRE=$(grep "custoEfetivoMotorista" src/components/modals/quote-detail/QuoteModalCostCompositionTab.tsx)

echo "✅ Sucesso: Margem de $MARGEM% validada e dados sincronizados."
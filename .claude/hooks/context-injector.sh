#!/bin/bash
# Injeção automática de contexto fiscal e operacional

# Regras imutáveis da Vectra Cargo para cada prompt
echo "Contexto Adicional:
- Alíquota de DAS: 14.00%
- Overhead Fixo: garantir que o cálculo busca o percentual correto na tabela PricingRuleConfig --> Over calculando corretamente sobre Receita Líquida
- Modelo: Gross-up (Asset-Light)
- Custo Motorista deve ser sempre igual ao Frete Base."
- Garantir que o valor do custo do motorista sempre seja FreteBase + Pedágio
- Garantir que o cálculo de margem seja fiel em todas as suas aparições em ui+badge
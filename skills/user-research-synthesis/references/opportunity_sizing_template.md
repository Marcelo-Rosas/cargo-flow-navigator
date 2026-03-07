> Use este template para quantificar o impacto de uma oportunidade de melhoria ou de uma dor do usuário, usando dados reais do Supabase para embasar as estimativas.

---

## Template de Dimensionamento de Oportunidade

**Oportunidade**: [Nome claro e acionável. Ex: "Melhorar a precisão da precificação de frete fracionado"]

**Descrição**: [Descreva o problema do usuário e a oportunidade de negócio. Ex: "Usuários comerciais estão perdendo cotações de frete fracionado por não conseguirem justificar o preço, que muitas vezes é percebido como alto. Isso afeta nossa taxa de conversão e GMV."]

**Fontes da Evidência (Triangulação)**:
- **Quantitativa**: [Ex: "A taxa de conversão para `freight_modality = 'fracionado'` é 20% menor que para `'lotacao'` (tabela `quotes`)."]
- **Qualitativa**: [Ex: "O tema `[preco_alto_fracionado]` é frequente no campo `notes` das cotações com `stage = 'perdido'`."]
- **Externa/Competitiva**: [Ex: "Análise da skill `competitive-analysis` mostra que concorrentes têm tabelas mais agressivas para este modal."]

---

### Dimensionamento da Oportunidade

| Métrica | Estimativa | Fonte da Estimativa (Query/Lógica) |
|:---|:---|:---|
| **Usuários Endereçáveis** | ~8-10 analistas comerciais | `SELECT COUNT(DISTINCT created_by) FROM quotes WHERE freight_modality = 'fracionado';` |
| **Frequência** | ~30% das cotações | `SELECT COUNT(*) FROM quotes WHERE freight_modality = 'fracionado';` (9 de 29 no dataset atual) |
| **Severidade** | Alta | Impacto direto na principal métrica do Analista Comercial (taxa de conversão). Causa perda de receita. |
| **Disposição para Pagar** | Média | Não é uma feature nova, mas a melhoria pode aumentar a retenção e o volume de cotações por cliente. |

---

### Pontuação da Oportunidade (RICE Adaptado)

| Fator | Pontuação (1-5) | Justificativa |
|:---|:---|:---|
| **Impacto** | 4 | Afeta uma parcela significativa das cotações e tem impacto direto na receita (GMV perdido). |
| **Confiança** | 5 | Evidência triangulada de múltiplas fontes (quantitativa, qualitativa, competitiva). |
| **Alinhamento** | 5 | Alinhado com o OKR de "Aumentar a taxa de conversão de cotações de 35% para 50%". |
| **Esforço** | 3 | Exigiria revisão da tabela de preços, ajustes na Edge Function `calculate-freight` e potencialmente uma nova UI de detalhamento de custos. (Esforço médio) |

**Score Final (Impacto * Confiança * Alinhamento / Esforço)**: `(4 * 5 * 5) / 3 = 33.3`

---

### Apresentação da Oportunidade

> "Com base em dados de uso, **cerca de 30% de nossas cotações são para frete fracionado**, e nossa taxa de conversão para elas é **20% inferior** à de frete lotação. Análises qualitativas das notas indicam que o motivo principal é a percepção de preço alto. Estima-se que uma melhoria na precisão e justificativa do preço poderia recuperar até **R$ 50.000 em GMV perdido por mês**, com base no ticket médio atual."

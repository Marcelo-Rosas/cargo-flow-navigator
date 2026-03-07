# Template de Priorização RICE — Cargo Flow Navigator

> Use esta tabela para comparar iniciativas do backlog de forma quantitativa. Adapte os valores de Reach e Effort à sua realidade.

## Tabela de Pontuação RICE

| Iniciativa | Reach (Usuários/mês) | Impact (0.25-3) | Confidence (50-100%) | Effort (dev-weeks) | RICE Score |
|:---|:---:|:---:|:---:|:---:|:---:|
| **[Ex: Reestruturação Financeira v2.0]** | 15 (todos os clientes) | 3 (massivo) | 80% | 8 | **4.5** |
| **[Ex: Refatoração do QuoteForm para Wizard]** | 15 (todos os clientes) | 2 (alto) | 100% | 6 | **5.0** |
| **[Ex: Cálculo de Rentabilidade (NTC)]** | 10 (clientes com frota própria) | 2 (alto) | 80% | 4 | **4.0** |
| **[Ex: Herança de Documentos de Motorista]** | 15 (todos os clientes) | 1 (médio) | 100% | 2 | **7.5** |
| **[Ex: Skeleton Loaders na UI]** | 15 (todos os clientes) | 0.5 (baixo) | 100% | 3 | **2.5** |
| **[Ex: Extração de Valor de Comprovante (OCR/IA)]** | 5 (clientes com alto volume) | 3 (massivo) | 50% | 10 | **0.75** |

---

## Guia de Pontuação

### Reach (Alcance)

- **Como medir**: Quantos clientes ou usuários únicos interagirão com a funcionalidade por mês?
- **Fonte de dados**: `users`, `quotes`, `orders` no Supabase.

### Impact (Impacto)

- **3 (Massivo)**: Muda fundamentalmente o workflow do usuário, como a **Reestruturação Financeira**.
- **2 (Alto)**: Melhora significativamente um workflow existente, como a **Refatoração do QuoteForm**.
- **1 (Médio)**: Uma melhoria útil que economiza tempo, como a **Herança de Documentos**.
- **0.5 (Baixo)**: Uma melhoria de qualidade de vida, como **Skeleton Loaders**.
- **0.25 (Mínimo)**: Um ajuste pequeno ou correção de bug menor.

### Confidence (Confiança)

- **100%**: Temos dados quantitativos (pesquisas, entrevistas, métricas de uso) que suportam as estimativas de alcance e impacto.
- **80%**: Temos evidências qualitativas (feedback de alguns clientes, análise competitiva).
- **50%**: É uma intuição ou "aposta" baseada no conhecimento do produto, sem dados diretos.

### Effort (Esforço)

- **Como medir**: Estime o tempo total de desenvolvimento em "semanas de desenvolvedor" (dev-weeks). Inclua todo o trabalho necessário (backend, frontend, design, testes).
- **Fonte de dados**: Estimativa da equipe de engenharia.

---

## Como Usar

1. Liste as iniciativas que você quer priorizar.
2. Preencha as colunas `Reach`, `Impact`, `Confidence` e `Effort` para cada uma.
3. A coluna `RICE Score` será calculada automaticamente: **(Reach * Impact * Confidence) / Effort**.
4. Ordene a tabela pelo `RICE Score` em ordem decrescente para ver a lista priorizada.

**Lembre-se**: RICE é uma ferramenta para guiar a discussão, não uma regra absoluta. Use-o para desafiar suas suposições e tomar decisões mais informadas.

---
name: roadmap-management
description: Planeja e prioriza roadmaps de produto usando frameworks como RICE, MoSCoW e ICE. Use ao criar um roadmap, repriorizar funcionalidades, mapear dependências, escolher entre formatos Now/Next/Later ou trimestral, ou apresentar tradeoffs de roadmap para stakeholders.
---

# Skill: Gestão de Roadmap — Cargo Flow Navigator

Você é especialista em planejamento, priorização e comunicação de roadmaps de produto para o **Cargo Flow Navigator**. Você ajuda a construir roadmaps que são estratégicos, realistas e úteis para a tomada de decisão, usando o backlog real do projeto, as discussões nos planos `.cursor/plans/` e o schema do banco de dados como fonte da verdade.

---

## Frameworks de Roadmap para o Cargo Flow Navigator

### 1. Now / Next / Later (Formato Principal)

O formato mais eficaz para comunicar o roadmap para a maioria das audiências.

- **Now (Agora)**: Trabalho comprometido e em andamento. Alta confiança no escopo e cronograma.
- **Next (A Seguir)**: Trabalho planejado para os próximos 1-3 meses. Boa confiança no *quê*, menos confiança no *quando*.
- **Later (Depois)**: Apostas estratégicas e oportunidades que pretendemos buscar. Escopo e tempo são flexíveis.

### 2. Temas Trimestrais (Alinhamento Estratégico)

Organiza o roadmap em torno de 2-3 temas por trimestre, alinhados aos OKRs.

- Cada tema representa uma área estratégica de investimento (ex: "Reestruturação Financeira v2.0", "Otimização da Experiência do Usuário no Orçamento").
- Facilita a explicação do **PORQUÊ** estamos construindo o que estamos construindo.

### 3. Visão de Cronograma / Gantt (Planejamento de Execução)

- Visão baseada em calendário com datas de início/fim e durações.
- **Uso**: Apenas para planejamento de execução interno com a engenharia. **Não usar para comunicação externa** para evitar criar falsas expectativas de datas.

---

## Frameworks de Priorização Adaptados

### 1. Matriz Valor vs Esforço (Priorização Visual)

Plote as iniciativas do backlog em uma matriz 2x2.

| | **Baixo Esforço** | **Alto Esforço** |
|:---|:---|:---|
| **Alto Valor** | **Quick Wins** (Faça primeiro) | **Grandes Apostas** (Planeje com cuidado) |
| **Baixo Valor** | **Preenchimentos** (Faça se sobrar tempo) | **Poços de Dinheiro** (Não faça) |

### 2. MoSCoW (Escopo de Release)

Categorize itens em **Must have**, **Should have**, **Could have**, **Won't have**.

- **Must have**: O roadmap é um fracasso sem estes. Compromissos não negociáveis.
- **Should have**: Importante e esperado, mas a entrega é viável sem eles.
- **Could have**: Desejável, mas claramente de menor prioridade.
- **Won't have**: Explicitamente fora do escopo para este período.

### 3. RICE Score (Priorização Quantitativa)

**RICE = (Reach x Impact x Confidence) / Effort**

- **Reach (Alcance)**: Quantos usuários/clientes serão afetados? (ex: "todos os 15 clientes da base", "afeta 100% das cotações de lotação").
- **Impact (Impacto)**: Qual o impacto para cada um? (3 = massivo, 2 = alto, 1 = médio, 0.5 = baixo).
- **Confidence (Confiança)**: Quão confiantes estamos nas estimativas? (100% = alta, 80% = média, 50% = baixa).
- **Effort (Esforço)**: Quantos "dev-weeks"? Incluir engenharia, design, etc.

---

## Backlog Priorizado do Cargo Flow Navigator (Exemplo Q2 2026)

Com base na análise dos planos `.cursor/plans/` e do estado atual do banco, este é um exemplo de backlog priorizado.

### Now (Em Andamento / Próximo Sprint)

| Iniciativa | Justificativa | Framework | Prioridade |
|:---|:---|:---|:---:|
| **Reconciliação de Carreteiro** | Correção de bug crítico na lógica de divergência | Valor vs Esforço | **Quick Win** |
| **Herança de Documentos de Motorista** | Reduz atrito no processo de vincular OS a uma viagem | Valor vs Esforço | **Quick Win** |
| **Correção de Faixa de KM (Lotação)** | Garante a precisão do cálculo de frete no simulador | MoSCoW | **Must Have** |

### Next (Próximos 1-3 Meses)

| Iniciativa | Justificativa | Framework | Prioridade |
|:---|:---|:---|:---:|
| **Reestruturação Financeira v2.0** | PRD completo, base para a nova visão financeira | Valor vs Esforço | **Grande Aposta** |
| **Agrupamento de OS em Viagens (Trips)** | Funcionalidade core da reestruturação financeira | MoSCoW | **Must Have** |
| **Refatoração do QuoteForm para Wizard** | Melhora a UX e manutenibilidade de um componente crítico | Valor vs Esforço | **Grande Aposta** |
| **Cálculo de Rentabilidade (NTC)** | Aumenta a precisão da margem de lucro na cotação | RICE | Alto Score |

### Later (3-6+ Meses)

| Iniciativa | Justificativa | Framework | Prioridade |
|:---|:---|:---|:---:|
| **Failover Automático de LLMs** | Aumenta a resiliência da camada de IA | MoSCoW | **Should Have** |
| **Auditoria de Divergência (Quote vs OS)** | Ferramenta de análise para identificar falhas no processo comercial | RICE | Médio Score |
| **Skeleton Loaders na UI** | Melhora a percepção de performance da interface | Valor vs Esforço | **Preenchimento** |
| **Extração de Valor de Comprovante (OCR/IA)** | Automação complexa, dependente de outras features | MoSCoW | **Could Have** |

---

## Gestão de Dependências e Capacidade

### Mapeamento de Dependências

- **Dependências Técnicas**: A **Reestruturação Financeira v2.0** depende da conclusão do **Agrupamento de OS em Viagens (Trips)**.
- **Dependências de Time**: A **Refatoração do QuoteForm** exigirá esforço conjunto de engenharia e design.
- **Dependências de Conhecimento**: A **Extração de Valor via OCR** requer uma fase de pesquisa e prova de conceito antes do desenvolvimento.

### Alocação de Capacidade (Sugestão)

- **70% Features Planejadas**: Itens do roadmap (Now/Next).
- **20% Saúde Técnica**: Débito técnico, melhorias de performance, refatorações.
- **10% Não Planejado**: Buffer para bugs urgentes e pequenas melhorias.

---

## Keywords

roadmap, priorização, RICE, MoSCoW, ICE, Now Next Later, planejamento de produto, gestão de backlog, dependências, capacidade

# Template de PRD — [Nome da Funcionalidade]

> **Status**: Rascunho | Em Revisão | Aprovado
> **Autor**: [Seu Nome]
> **Stakeholders**: [Nomes/Times]
> **Última Atualização**: [Data]

---

## 1. Declaração do Problema

*(Descreva o problema do usuário em 2-3 frases. Quem o vivencia, com que frequência, e qual o custo de não resolvê-lo? Fundamente com evidências: links para tickets de suporte, quotes de entrevistas, queries do Supabase, etc.)*

## 2. Objetivos

| # | Objetivo | Métrica de Sucesso Primária | Meta |
|:--|:---|:---|:---|
| 1 | **[Objetivo de Usuário 1]** | [Métrica Antecedente] | [Valor] |
| 2 | **[Objetivo de Usuário 2]** | [Métrica Antecedente] | [Valor] |
| 3 | **[Objetivo de Negócio 1]** | [Métrica Consequente] | [Valor] |

## 3. Não-Objetivos

- **[Não-Objetivo 1]**: *(Breve justificativa: muito complexo, iniciativa separada, etc.)*
- **[Não-Objetivo 2]**: *(Breve justificativa)*
- **[Não-Objetivo 3]**: *(Breve justificativa)*

## 4. Histórias de Usuário

### P0 (Obrigatório)

- Como um(a) **[tipo de usuário]**, eu quero **[capacidade]** para que **[benefício]**.
- Como um(a) **[tipo de usuário]**, eu quero **[capacidade]** para que **[benefício]**.

### P1 (Desejável)

- Como um(a) **[tipo de usuário]**, eu quero **[capacidade]** para que **[benefício]**.

### Casos de Borda e Erro

- Como um(a) **[tipo de usuário]**, eu quero **[ver uma mensagem de erro clara]** quando **[condição de erro]**.

## 5. Requisitos e Critérios de Aceitação

### P0 — Requisitos Obrigatórios

**REQ-001: [Nome do Requisito]**

- [ ] **Dado** [pré-condição], **Quando** [ação], **Então** [resultado].
- [ ] **Dado** [outra pré-condição], **Quando** [outra ação], **Então** [outro resultado].

**REQ-002: [Nome do Requisito]**

- [ ] Checklist de critério de aceitação 1.
- [ ] Checklist de critério de aceitação 2.

### P1 — Requisitos Desejáveis

**REQ-003: [Nome do Requisito]**

- [ ] ...

## 6. Métricas de Sucesso

| Métrica | Tipo | Descrição | Query de Medição (SQL) |
|:---|:---|:---|:---|
| **[Métrica 1]** | Antecedente | [O que mede] | `SELECT ...` |
| **[Métrica 2]** | Antecedente | [O que mede] | `SELECT ...` |
| **[Métrica 3]** | Consequente | [O que mede] | `SELECT ...` |

## 7. Questões Abertas

| # | Questão | Dono | Bloqueante? |
|:--|:---|:---|:---:|
| 1 | [Questão sobre design] | @designer | Sim |
| 2 | [Questão sobre implementação] | @engenheiro | Não |
| 3 | [Questão sobre dados] | @analista | Não |

## 8. Considerações de Cronograma

- **Dependências**: [Dependência de outra equipe ou sistema]
- **Prazos**: [Data limite, se houver, e por quê]
- **Faseamento Sugerido**:
  - **Fase 1 (MVP)**: Requisitos P0 (REQ-001, REQ-002)
  - **Fase 2 (Fast Follow)**: Requisitos P1 (REQ-003)

---

## Anexos

- [Link para o design no Figma]
- [Link para a pesquisa de usuário]
- [Link para o documento de análise competitvo relacionado]

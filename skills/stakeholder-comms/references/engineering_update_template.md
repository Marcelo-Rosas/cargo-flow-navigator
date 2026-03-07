# Atualização para Engenharia — Sprint [Número] — [Data]

### Concluído (Shipped)

- **Herança de Documentos de Motorista**: Finalizado e mergeado na `main`. [Link para o PR #123]
  - **Impacto**: Reduz a necessidade de uploads duplicados para motoristas em viagens recorrentes.
- **Correção da Lógica de Reconciliação**: Deploy realizado. [Link para o Ticket #456]
  - **Impacto**: O badge de divergência agora reflete corretamente o status da reconciliação.

---

### Em Progresso

- **Feature `Trips` (Agrupamento de OS)** - Owner: [Nome do Dev]
  - **Status**: Migration SQL e triggers concluídos. UI de vinculação em andamento.
  - **Previsão de Conclusão**: Final do sprint atual.
  - **Bloqueios**: Aguardando decisão sobre a regra de rateio de custos para implementar a view `trip_financial_summary`.

- **Refatoração do QuoteForm para Wizard** - Owner: [Nome do Dev]
  - **Status**: Schemas Zod fatiados. Componente `IdentificationStep` criado.
  - **Previsão de Conclusão**: Sprint [Número+1].
  - **Bloqueios**: Nenhum.

---

### Decisões

- **Decisão Tomada**: O padrão para chaves estrangeiras de usuário será sempre `auth.users(id)`, conforme documentado no plano `trips_prd_implementation`. [Link para o plano]
- **Decisão Necessária**: Precisamos definir a estratégia de tratamento de erros para a Edge Function `calculate-freight`. As opções são:
  1. Retornar um erro genérico `OUT_OF_RANGE`.
  2. Retornar erros específicos para "tabela não selecionada", "erro de consulta" ou "faixa não encontrada".
  - **Recomendação**: Opção 2, para fornecer feedback mais claro na UI e facilitar a depuração.

---

### Mudanças de Prioridade

- A tarefa de implementação de `Skeleton Loaders` foi movida para o backlog (`Later`) para dar prioridade à correção do bug na `calculate-freight` que está afetando o simulador.

### Próximos Itens (Coming Up)

- **View `trip_financial_summary`**: Assim que a decisão sobre o rateio for tomada, esta será a próxima prioridade para desbloquear a Reestruturação Financeira v2.0.
- **Componente `CargoStep` do Wizard**: Próximo passo na refatoração do QuoteForm.

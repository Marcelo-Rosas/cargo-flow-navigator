# Atualização para Liderança — [Nome do Projeto/Iniciativa] — [Data]

**Status**: [Verde / Amarelo / Vermelho]

**TL;DR**: [Ex: A implementação da feature `Trips` está em andamento, mas em risco (Amarelo) devido a uma dependência na definição da estratégia de rateio de custos, o que pode impactar o cronograma da Reestruturação Financeira v2.0.]

---

### Progresso

*O que alcançamos em relação às metas.*

- **Concluído**: Implementação da `Herança de Documentos de Motorista`, reduzindo o tempo de cadastro de OS em viagens recorrentes.
- **Em Andamento**: Desenvolvimento da migration e triggers para a feature `Trips` (Agrupamento de OS).
- **Métrica Chave**: A taxa de conversão de cotações se manteve em **35%** esta semana.

### Riscos e Mitigações

*Apenas riscos que precisam da sua atenção ou ajuda.*

- **Risco**: Atraso na definição da regra de negócio para rateio de custos da viagem (revenue vs. peso vs. cubagem).
  - **Impacto**: Bloqueia o desenvolvimento da view `trip_financial_summary` e, consequentemente, todo o cronograma da Reestruturação Financeira v2.0.
  - **Plano de Mitigação**: Agendamos uma reunião de decisão com a equipe de produto e operações para amanhã.
  - **Pedido de Ajuda**: Precisamos que a liderança reforce a urgência desta decisão para as equipes envolvidas.

### Decisões Necessárias

*Decisões que precisam do seu input para desbloquear o progresso.*

- **Decisão**: Priorizar o desenvolvimento do **Wizard do QuoteForm** ou do cálculo de **Rentabilidade via NTC** no próximo sprint, dado que ambos são `Grandes Apostas` com esforço similar.
  - **Recomendação**: Priorizar o **Wizard do QuoteForm** para melhorar a experiência do usuário e a qualidade dos dados de entrada, o que beneficiará a precisão de análises futuras.
  - **Prazo**: Precisamos desta decisão até sexta-feira para planejar o próximo sprint.

### Próximos Marcos

- **Finalização da feature `Trips`**: [Data Prevista]
- **Início do desenvolvimento da `Reestruturação Financeira v2.0`**: [Data Prevista]

---

*Anexos: [Link para o Roadmap Now/Next/Later], [Link para o Dashboard de Métricas]*

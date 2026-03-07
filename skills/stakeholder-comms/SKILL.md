---
name: stakeholder-comms
description: Elabora atualizações para stakeholders adaptadas à audiência — liderança, engenharia, clientes ou parceiros multifuncionais. Use ao escrever atualizações de status semanais, relatórios mensais, anúncios de lançamento, comunicação de riscos ou documentação de decisões.
---

# Skill: Comunicação com Stakeholders — Cargo Flow Navigator

Você é especialista em comunicações de gestão de produto para o **Cargo Flow Navigator**. Você ajuda a comunicar de forma clara e eficaz com diversas audiências, usando o contexto real do projeto, os riscos ativos e as decisões documentadas como base.

---

## Templates de Atualização por Audiência

### 1. Liderança (Diretoria, C-Level)

**O que eles querem saber**: Contexto estratégico, progresso em relação às metas, riscos que precisam da ajuda deles, decisões que precisam do seu input.

**Formato**: Use o template `references/leadership_update_template.md`.

**Dicas para a Liderança da Vectra Cargo**:
- **Lidere com a conclusão**: "Concluímos a herança de documentos, o que deve reduzir o tempo de onboarding de OS em 30%" é melhor do que "Resolvemos 15 tickets".
- **Mantenha-o curto**: Menos de 200 palavras. Anexe o `now_next_later_template.md` da skill `roadmap-management` para detalhes.
- **Status Amarelo não é falha**: É boa gestão de risco. Use-o para sinalizar o risco de que a "Reestruturação Financeira v2.0" pode atrasar se a feature "Trips" não for concluída a tempo.
- **Pedidos de ajuda devem ser específicos**: "Precisamos da decisão sobre a priorização entre o Wizard do QuoteForm e a Rentabilidade NTC até sexta-feira" é melhor do que "Precisamos de apoio".

### 2. Equipe de Engenharia (Squads de Código, Fluxos, etc.)

**O que eles querem saber**: Prioridades claras, contexto técnico, bloqueios resolvidos, decisões que afetam seu trabalho.

**Formato**: Use o template `references/engineering_update_template.md`.

**Dicas para a Engenharia da Vectra Cargo**:
- **Link para tudo**: Vincule aos PRs no GitHub, aos planos em `.cursor/plans/` e às migrations em `supabase/migrations/`.
- **Explique o "porquê" das mudanças de prioridade**: "Estamos pausando o `skeleton-loaders` para focar na `reconciliação-carreteiro` porque o bug de lógica invertida está impactando a operação financeira do cliente X".
- **Seja explícito sobre bloqueios**: "A feature `Trips` está bloqueada aguardando a decisão final sobre a estratégia de rateio de custos (revenue vs. peso)".

### 3. Parceiros Multifuncionais (Design, Segurança)

**O que eles querem saber**: O que está vindo que os afeta, para o que precisam se preparar, como podem dar feedback.

**Formato**: Use o template `references/cross_functional_update_template.md`.

**Dicas para os Parceiros da Vectra Cargo**:
- **Seja direto sobre o impacto**: "Para o Squad de Design: a refatoração do `QuoteForm` para um Wizard de 4 passos começará no próximo sprint. Precisaremos do protótipo finalizado até a próxima sexta-feira".
- **Peça feedback direcionado**: "Para o Squad de Segurança: estamos planejando a feature de herança de documentos de motorista. Gostaríamos do seu feedback sobre os riscos de compartilhamento de dados entre OS de clientes diferentes".

### 4. Clientes / Usuários Finais (Embarcadores, Analistas)

**O que eles querem saber**: O que há de novo, o que está por vir, como isso os beneficia, como começar a usar.

**Formato**: Use o template `references/customer_update_template.md`.

**Dicas para os Clientes da Vectra Cargo**:
- **Zero jargão interno**: Fale sobre "agrupar várias ordens em uma única viagem" em vez de "feature Trips".
- **Foque no benefício**: "Agora você pode anexar o comprovante de adiantamento diretamente na OS, e o sistema irá conciliar o valor automaticamente" é melhor do que "Implementamos a tabela `payment_proofs`".
- **Seja honesto sobre prazos**: "Estamos trabalhando em uma nova visão financeira que permitirá analisar a rentabilidade por viagem, com previsão para o final do trimestre" é melhor do que uma data específica que pode mudar.

---

## Frameworks de Comunicação

### Status Green / Yellow / Red

- **Green (Verde)**: Em dia. Sem riscos significativos.
- **Yellow (Amarelo)**: Em risco. Progresso mais lento que o esperado. Ex: A feature `Trips` está em amarelo porque a definição do rateio de custos ainda está em aberto.
- **Red (Vermelho)**: Fora do prazo. Bloqueio significativo sem mitigação clara. Ex: A `Reestruturação Financeira v2.0` está em vermelho porque a feature `Trips` está bloqueada.

### Gestão de Riscos (ROAM)

- **Resolved (Resolvido)**: O risco não é mais uma preocupação.
- **Owned (Assumido)**: O risco é reconhecido e alguém está gerenciando-o ativamente.
- **Accepted (Aceito)**: O risco é conhecido, mas decidimos prosseguir sem mitigação.
- **Mitigated (Mitigado)**: Ações reduziram o risco a um nível aceitável.

### Documentação de Decisões (ADR - Architecture Decision Record)

Use o formato de ADR para documentar decisões importantes, como as encontradas nos planos `.cursor/plans/`.

- **Exemplo**: A decisão de usar `auth.users(id)` como padrão para chaves estrangeiras ou definir a tolerância de reconciliação em R$ 1,00 são bons candidatos para um ADR.

---

## Keywords

comunicação, stakeholders, atualização de status, relatório de projeto, gestão de riscos, ADR, comunicação com liderança, comunicação com engenharia
